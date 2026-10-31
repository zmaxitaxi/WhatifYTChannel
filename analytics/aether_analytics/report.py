"""Production-quality readouts.

Joins three kinds of evidence per video:
  * audience metrics (latest API snapshot, gaps filled from the latest Studio CSV snapshot),
  * the audience-retention curve (hook hold, biggest drop, mapped to seconds and frames),
  * human rubric ratings from TECHNICAL_PLAN.md section 6 (average >= 4, no dimension < 3).

Flag thresholds are starting heuristics, not trained values; tune them in `Thresholds`.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass, field
from statistics import mean

from .store import METRIC_COLUMNS, RUBRIC_DIMENSIONS

FPS = 30  # Shorts output contract: 1080 x 1920, 30 fps


@dataclass(frozen=True)
class Thresholds:
    rubric_min_average: float = 4.0
    rubric_min_dimension: int = 3
    hook_seconds: float = 3.0
    min_hook_retention: float = 0.70
    min_average_view_percentage: float = 70.0
    steep_drop: float = 0.10  # watch-ratio lost between two consecutive curve points


# ---------------------------------------------------------------- rubric


@dataclass
class RubricSummary:
    ratings: int
    reviewers: list[str]
    dimension_means: dict[str, float]
    average: float
    lowest_dimension: str
    lowest_score: float
    passes: bool
    reasons: list[str]


def summarize_rubric(rows: list[sqlite3.Row], t: Thresholds = Thresholds()) -> RubricSummary | None:
    if not rows:
        return None
    dim_means = {d: round(mean(r[d] for r in rows), 2) for d in RUBRIC_DIMENSIONS}
    average = round(mean(dim_means.values()), 2)
    lowest = min(dim_means, key=dim_means.__getitem__)
    reasons = []
    if average < t.rubric_min_average:
        reasons.append(f"average {average} is below {t.rubric_min_average}")
    # Each individual rating must also keep every dimension at or above the floor.
    for r in rows:
        for d in RUBRIC_DIMENSIONS:
            if r[d] < t.rubric_min_dimension:
                reasons.append(f"{r['reviewer']} scored {d} {r[d]} (floor {t.rubric_min_dimension})")
    return RubricSummary(
        ratings=len(rows),
        reviewers=sorted({r["reviewer"] for r in rows}),
        dimension_means=dim_means,
        average=average,
        lowest_dimension=lowest,
        lowest_score=dim_means[lowest],
        passes=not reasons,
        reasons=reasons,
    )


# ---------------------------------------------------------------- retention


@dataclass
class RetentionSummary:
    points: int
    observed_at: str
    hook_ratio: float
    hook_retention: float
    midpoint_retention: float
    end_retention: float
    biggest_drop: float
    biggest_drop_at_ratio: float
    biggest_drop_at_seconds: float | None
    biggest_drop_at_frame: int | None


def interpolate(points: list[tuple[float, float]], x: float) -> float:
    if x <= points[0][0]:
        return points[0][1]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if x0 <= x <= x1:
            return y0 if x1 == x0 else y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return points[-1][1]


def summarize_retention(
    rows: list[sqlite3.Row], duration_seconds: float | None, t: Thresholds = Thresholds()
) -> RetentionSummary | None:
    if not rows:
        return None
    pts = sorted((r["elapsed_ratio"], r["audience_watch_ratio"]) for r in rows)
    hook_ratio = min(t.hook_seconds / duration_seconds, 1.0) if duration_seconds else 0.05
    drop, drop_at = 0.0, pts[0][0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 - y1 > drop:
            drop, drop_at = y0 - y1, x1
    seconds = round(drop_at * duration_seconds, 2) if duration_seconds else None
    return RetentionSummary(
        points=len(pts),
        observed_at=rows[0]["observed_at"],
        hook_ratio=round(hook_ratio, 4),
        hook_retention=round(interpolate(pts, hook_ratio), 4),
        midpoint_retention=round(interpolate(pts, 0.5), 4),
        end_retention=round(pts[-1][1], 4),
        biggest_drop=round(drop, 4),
        biggest_drop_at_ratio=drop_at,
        biggest_drop_at_seconds=seconds,
        biggest_drop_at_frame=int(seconds * FPS) if seconds is not None else None,
    )


# ---------------------------------------------------------------- metrics


def merged_metrics(snapshots: list[sqlite3.Row]) -> tuple[dict[str, float | None], dict[str, str]]:
    """Latest API value per metric, falling back to the latest CSV value. Returns (values, provenance)."""
    latest: dict[str, sqlite3.Row] = {}
    for snap in sorted(snapshots, key=lambda s: (s["observed_at"], s["id"])):
        latest[snap["source"]] = snap
    values: dict[str, float | None] = {}
    provenance: dict[str, str] = {}
    for col in METRIC_COLUMNS:
        values[col] = None
        for source in ("api", "csv"):
            snap = latest.get(source)
            if snap is not None and snap[col] is not None:
                values[col] = snap[col]
                provenance[col] = f"{source} @ {snap['observed_at']}"
                break
    return values, provenance


def view_growth(snapshots: list[sqlite3.Row]) -> dict[str, object] | None:
    """Views gained between the two most recent snapshots of the same source."""
    by_source: dict[str, list[sqlite3.Row]] = {}
    for s in snapshots:
        if s["views"] is not None:
            by_source.setdefault(s["source"], []).append(s)
    for source in ("api", "csv"):
        snaps = sorted(by_source.get(source, []), key=lambda s: (s["observed_at"], s["id"]))
        if len(snaps) >= 2:
            prev, last = snaps[-2], snaps[-1]
            return {
                "source": source,
                "from": prev["observed_at"],
                "to": last["observed_at"],
                "views_gained": last["views"] - prev["views"],
            }
    return None


# ---------------------------------------------------------------- readout


@dataclass
class VideoReadout:
    youtube_video_id: str
    concept_id: str | None
    job_id: str | None
    title: str | None
    published_at: str | None
    duration_seconds: float | None
    metrics: dict[str, float | None]
    metric_sources: dict[str, str]
    missing_metrics: list[str]
    growth: dict[str, object] | None
    retention: RetentionSummary | None
    rubric: RubricSummary | None
    flags: list[str] = field(default_factory=list)


def _flags(r: VideoReadout, t: Thresholds) -> list[str]:
    flags = []
    if r.rubric is None:
        flags.append("no human rubric rating yet")
    elif not r.rubric.passes:
        flags.append("rubric below release bar: " + "; ".join(r.rubric.reasons))
    if r.retention is None:
        flags.append("no retention curve imported")
    else:
        if r.retention.hook_retention < t.min_hook_retention:
            flags.append(
                f"weak hook: {r.retention.hook_retention:.0%} still watching at "
                f"{t.hook_seconds:g}s (target {t.min_hook_retention:.0%})"
            )
        if r.retention.biggest_drop >= t.steep_drop:
            where = (
                f"{r.retention.biggest_drop_at_seconds}s / frame {r.retention.biggest_drop_at_frame}"
                if r.retention.biggest_drop_at_seconds is not None
                else f"{r.retention.biggest_drop_at_ratio:.0%} of the video"
            )
            flags.append(f"steep drop of {r.retention.biggest_drop:.0%} at {where}; check the story beat there")
    avp = r.metrics.get("average_view_percentage")
    if avp is not None and avp < t.min_average_view_percentage:
        flags.append(f"average view percentage {avp:.1f}% is below {t.min_average_view_percentage:g}%")
    if r.duration_seconds is not None and not 45 <= r.duration_seconds <= 75:
        flags.append(f"duration {r.duration_seconds:g}s is outside the 45-75s story target")
    return flags


def build_readouts(conn: sqlite3.Connection, t: Thresholds = Thresholds()) -> list[VideoReadout]:
    readouts = []
    for v in conn.execute("SELECT * FROM videos ORDER BY concept_id IS NULL, concept_id, published_at"):
        vid = v["youtube_video_id"]
        snaps = conn.execute("SELECT * FROM metric_snapshots WHERE youtube_video_id = ?", (vid,)).fetchall()
        values, provenance = merged_metrics(snaps)
        latest_curve = conn.execute(
            "SELECT MAX(observed_at) FROM retention_points WHERE youtube_video_id = ?", (vid,)
        ).fetchone()[0]
        curve = (
            conn.execute(
                "SELECT * FROM retention_points WHERE youtube_video_id = ? AND observed_at = ?",
                (vid, latest_curve),
            ).fetchall()
            if latest_curve
            else []
        )
        ratings = conn.execute(
            "SELECT * FROM quality_ratings WHERE youtube_video_id = ? OR (job_id IS NOT NULL AND job_id = ?)",
            (vid, v["job_id"]),
        ).fetchall()
        r = VideoReadout(
            youtube_video_id=vid,
            concept_id=v["concept_id"],
            job_id=v["job_id"],
            title=v["title"],
            published_at=v["published_at"],
            duration_seconds=v["duration_seconds"],
            metrics=values,
            metric_sources=provenance,
            missing_metrics=[c for c in METRIC_COLUMNS if values[c] is None],
            growth=view_growth(snaps),
            retention=summarize_retention(curve, v["duration_seconds"], t),
            rubric=summarize_rubric(ratings, t),
        )
        r.flags = _flags(r, t)
        readouts.append(r)
    return readouts


def unpublished_ratings(conn: sqlite3.Connection, t: Thresholds = Thresholds()) -> dict[str, RubricSummary]:
    """Rubric results for jobs that have not been linked to an uploaded video yet."""
    rows = conn.execute(
        """
        SELECT * FROM quality_ratings
        WHERE youtube_video_id IS NULL
          AND job_id NOT IN (SELECT job_id FROM videos WHERE job_id IS NOT NULL)
        """
    ).fetchall()
    by_job: dict[str, list[sqlite3.Row]] = {}
    for r in rows:
        by_job.setdefault(r["job_id"], []).append(r)
    return {job: s for job, rs in sorted(by_job.items()) if (s := summarize_rubric(rs, t)) is not None}


def channel_summary(readouts: list[VideoReadout]) -> dict[str, object]:
    def avg(values: list[float]) -> float | None:
        return round(mean(values), 2) if values else None

    rated = [r for r in readouts if r.rubric]
    passing = [r for r in rated if r.rubric and r.rubric.passes]
    failing = [r for r in rated if r.rubric and not r.rubric.passes]

    def avp(rs: list[VideoReadout]) -> float | None:
        return avg([r.metrics["average_view_percentage"] for r in rs
                    if r.metrics.get("average_view_percentage") is not None])

    weakest: dict[str, float] = {}
    if rated:
        weakest = {
            d: round(mean(r.rubric.dimension_means[d] for r in rated if r.rubric), 2)
            for d in RUBRIC_DIMENSIONS
        }
    return {
        "videos": len(readouts),
        "rated_videos": len(rated),
        "rubric_passing": len(passing),
        "total_views": sum(r.metrics["views"] or 0 for r in readouts),
        "mean_average_view_percentage": avp(readouts),
        "mean_hook_retention": avg([r.retention.hook_retention for r in readouts if r.retention]),
        "avg_view_percentage_rubric_pass": avp(passing),
        "avg_view_percentage_rubric_fail": avp(failing),
        "rubric_dimension_means": weakest,
        "weakest_dimension": min(weakest, key=weakest.__getitem__) if weakest else None,
        "flagged_videos": sum(1 for r in readouts if r.flags),
    }


# ---------------------------------------------------------------- rendering


def to_json(conn: sqlite3.Connection, generated_at: str, t: Thresholds = Thresholds()) -> str:
    readouts = build_readouts(conn, t)
    return json.dumps(
        {
            "generated_at": generated_at,
            "thresholds": asdict(t),
            "channel": channel_summary(readouts),
            "videos": [asdict(r) for r in readouts],
            "unpublished_jobs": {k: asdict(v) for k, v in unpublished_ratings(conn, t).items()},
        },
        indent=2,
    )


def _fmt(value: float | None, kind: str = "") -> str:
    if value is None:
        return "—"
    if kind == "pct":
        return f"{value:.1f}%"
    if kind == "ratio":
        return f"{value:.0%}"
    if kind == "s":
        return f"{value:.1f}s"
    return f"{value:,.0f}"


def to_markdown(conn: sqlite3.Connection, generated_at: str, t: Thresholds = Thresholds()) -> str:
    readouts = build_readouts(conn, t)
    ch = channel_summary(readouts)
    out = [
        "# Production-quality readout",
        "",
        f"Generated {generated_at}. Rubric bar: average ≥ {t.rubric_min_average:g}, "
        f"no dimension below {t.rubric_min_dimension}. Retention and view-percentage flags are heuristics.",
        "",
        "## Channel",
        "",
        f"- Videos tracked: {ch['videos']} ({ch['rated_videos']} rated, {ch['rubric_passing']} pass the rubric)",
        f"- Total views: {_fmt(ch['total_views'])}",
        f"- Mean average view percentage: {_fmt(ch['mean_average_view_percentage'], 'pct')}",
        f"- Mean hook retention at {t.hook_seconds:g}s: {_fmt(ch['mean_hook_retention'], 'ratio')}",
        f"- Average view % for rubric passes vs fails: "
        f"{_fmt(ch['avg_view_percentage_rubric_pass'], 'pct')} vs {_fmt(ch['avg_view_percentage_rubric_fail'], 'pct')}",
        f"- Weakest rubric dimension across rated videos: {ch['weakest_dimension'] or '—'}",
        f"- Videos with flags: {ch['flagged_videos']}",
        "",
        "## Videos",
        "",
        "| Concept | Video | Views | Avg view % | Hook | Biggest drop | Rubric | Flags |",
        "|---|---|---:|---:|---:|---|---|---:|",
    ]
    for r in readouts:
        drop = (
            f"{r.retention.biggest_drop:.0%} @ "
            + (f"{r.retention.biggest_drop_at_seconds:g}s" if r.retention.biggest_drop_at_seconds is not None
               else f"{r.retention.biggest_drop_at_ratio:.0%}")
            if r.retention
            else "—"
        )
        rubric = (f"{r.rubric.average:.2f} {'pass' if r.rubric.passes else 'FAIL'}" if r.rubric else "—")
        label = (r.title or r.youtube_video_id).replace("|", "/")
        out.append(
            f"| {r.concept_id or '—'} | {label} | {_fmt(r.metrics['views'])} | "
            f"{_fmt(r.metrics['average_view_percentage'], 'pct')} | "
            f"{_fmt(r.retention.hook_retention, 'ratio') if r.retention else '—'} | {drop} | {rubric} | {len(r.flags)} |"
        )
    for r in readouts:
        out += ["", f"### {r.concept_id or 'Unlinked'} · {r.title or r.youtube_video_id}", ""]
        out.append(f"- YouTube ID `{r.youtube_video_id}`" + (f", job `{r.job_id}`" if r.job_id else ""))
        if r.growth:
            out.append(f"- Views gained {r.growth['from']} → {r.growth['to']}: {_fmt(r.growth['views_gained'])}")
        if r.rubric:
            dims = ", ".join(f"{d} {s:g}" for d, s in r.rubric.dimension_means.items())
            out.append(f"- Rubric ({r.rubric.ratings} rating(s) by {', '.join(r.rubric.reviewers)}): {dims}")
        if r.missing_metrics:
            out.append(f"- Not available: {', '.join(r.missing_metrics)}")
        for flag in r.flags:
            out.append(f"- ⚠ {flag}")
    pending = unpublished_ratings(conn, t)
    if pending:
        out += ["", "## Rated jobs not yet linked to an upload", "",
                "| Job | Ratings | Average | Lowest | Result |", "|---|---:|---:|---|---|"]
        for job, s in pending.items():
            out.append(f"| {job} | {s.ratings} | {s.average:.2f} | {s.lowest_dimension} {s.lowest_score:g} | "
                       f"{'pass' if s.passes else 'FAIL'} |")
    return "\n".join(out) + "\n"
