"""Import YouTube Studio CSV exports.

Studio's "Advanced mode -> Export current view -> Comma-separated values" produces a
`Table data.csv` whose first data row is a channel "Total". Column names vary with the
metrics selected in Studio, so headers are matched through an alias table and anything
unrecognised is ignored. Missing columns stay NULL rather than becoming zero.
"""

from __future__ import annotations

import csv
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from . import store


def _norm(header: str) -> str:
    return re.sub(r"[^a-z0-9%]+", " ", header.strip().lower()).strip()


VIDEO_ID_HEADERS = {"content", "video", "video id"}
TITLE_HEADERS = {"video title", "title"}
PUBLISHED_HEADERS = {"video publish time", "publish time", "published"}
DURATION_HEADERS = {"duration", "duration seconds", "video length"}

# normalised Studio header -> (metric column, converter name)
METRIC_ALIASES: dict[str, tuple[str, str]] = {
    "views": ("views", "number"),
    "watch time hours": ("estimated_minutes_watched", "hours_to_minutes"),
    "watch time minutes": ("estimated_minutes_watched", "number"),
    "average view duration": ("average_view_duration_seconds", "duration"),
    "average percentage viewed %": ("average_view_percentage", "number"),
    "average percentage viewed": ("average_view_percentage", "number"),
    "likes": ("likes", "number"),
    "comments added": ("comments", "number"),
    "comments": ("comments", "number"),
    "shares": ("shares", "number"),
    "subscribers": ("subscribers_gained", "number"),
    "subscribers gained": ("subscribers_gained", "number"),
    "impressions": ("impressions", "number"),
    "impressions click through rate %": ("impressions_ctr", "number"),
    "impressions click through rate": ("impressions_ctr", "number"),
    "engaged views": ("engaged_views", "number"),
    "stayed to watch %": ("stayed_to_watch_percentage", "number"),
    "stayed to watch": ("stayed_to_watch_percentage", "number"),
}

RETENTION_X_HEADERS = {
    "video position %",
    "video position",
    "elapsed video time ratio",
    "elapsed ratio",
}
RETENTION_Y_HEADERS = {
    "absolute audience retention %",
    "audience retention %",
    "audience watch ratio",
    "absolute audience retention",
}
RETENTION_REL_HEADERS = {
    "relative audience retention",
    "relative retention performance",
    "relative audience retention %",
}


def parse_number(raw: str | None) -> float | None:
    if raw is None:
        return None
    text = raw.strip().replace(",", "").rstrip("%")
    if text in {"", "-", "—", "N/A", "n/a"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_duration(raw: str | None) -> float | None:
    """Accepts '0:00:41', '0:41', or plain seconds."""
    if raw is None or not raw.strip():
        return None
    text = raw.strip()
    if ":" not in text:
        return parse_number(text)
    seconds = 0.0
    try:
        for part in text.split(":"):
            seconds = seconds * 60 + float(part)
    except ValueError:
        return None
    return seconds


def _convert(kind: str, raw: str | None) -> float | None:
    if kind == "duration":
        return parse_duration(raw)
    value = parse_number(raw)
    if value is not None and kind == "hours_to_minutes":
        return value * 60
    return value


def _find(headers: dict[str, str], names: set[str]) -> str | None:
    for original, normalised in headers.items():
        if normalised in names:
            return original
    return None


def _read_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    # utf-8-sig strips the BOM Studio writes on Windows exports.
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        return list(reader.fieldnames or []), rows


def import_studio_table(
    conn: sqlite3.Connection,
    path: str | Path,
    *,
    observed_at: str,
    period_start: str | None = None,
    period_end: str | None = None,
) -> dict[str, object]:
    path = Path(path)
    fieldnames, rows = _read_rows(path)
    headers = {h: _norm(h) for h in fieldnames}
    id_col = _find(headers, VIDEO_ID_HEADERS)
    if id_col is None:
        raise ValueError(f"{path.name}: no 'Content' / video id column; got {fieldnames}")
    title_col = _find(headers, TITLE_HEADERS)
    published_col = _find(headers, PUBLISHED_HEADERS)
    duration_col = _find(headers, DURATION_HEADERS)
    metric_cols = {h: METRIC_ALIASES[n] for h, n in headers.items() if n in METRIC_ALIASES}
    ignored = [h for h, n in headers.items() if h not in metric_cols and h not in
               {id_col, title_col, published_col, duration_col}]

    imported, skipped = 0, 0
    with store.transaction(conn):
        for row in rows:
            video_id = (row.get(id_col) or "").strip()
            if not video_id or video_id.lower() == "total":
                skipped += 1
                continue
            store.upsert_video(
                conn,
                video_id,
                title=((row.get(title_col) or "").strip() or None) if title_col else None,
                published_at=_parse_publish(row.get(published_col)) if published_col else None,
                duration_seconds=parse_duration(row.get(duration_col)) if duration_col else None,
            )
            metrics: dict[str, float | None] = {}
            for header, (column, kind) in metric_cols.items():
                value = _convert(kind, row.get(header))
                if value is not None or column not in metrics:
                    metrics[column] = value
            store.insert_snapshot(
                conn,
                video_id,
                observed_at=observed_at,
                source="csv",
                metrics=metrics,
                period_start=period_start,
                period_end=period_end,
                source_file=path.name,
            )
            imported += 1
    return {"imported": imported, "skipped": skipped, "ignored_columns": ignored,
            "metrics": sorted({c for c, _ in metric_cols.values()})}


def _parse_publish(raw: str | None) -> str | None:
    if not raw or not raw.strip():
        return None
    text = raw.strip()
    for fmt in ("%b %d, %Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%SZ", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return text


def import_retention_csv(
    conn: sqlite3.Connection,
    path: str | Path,
    *,
    youtube_video_id: str,
    observed_at: str,
) -> dict[str, object]:
    """Import one video's audience-retention curve.

    Accepts Studio's retention export ("Video position (%)", "Absolute audience retention (%)")
    or a plain file with elapsed_ratio / audience_watch_ratio columns.
    """
    path = Path(path)
    fieldnames, rows = _read_rows(path)
    headers = {h: _norm(h) for h in fieldnames}
    x_col = _find(headers, RETENTION_X_HEADERS)
    y_col = _find(headers, RETENTION_Y_HEADERS)
    rel_col = _find(headers, RETENTION_REL_HEADERS)
    if x_col is None or y_col is None:
        raise ValueError(f"{path.name}: need a video-position and a retention column; got {fieldnames}")
    x_pct = "%" in headers[x_col] or "position" in headers[x_col]
    y_pct = "%" in headers[y_col] or "retention" in headers[y_col]

    points: list[tuple[float, float, float | None]] = []
    for row in rows:
        x = parse_number(row.get(x_col))
        y = parse_number(row.get(y_col))
        if x is None or y is None:
            continue
        if x_pct:
            x /= 100
        if y_pct:
            y /= 100
        rel = parse_number(row.get(rel_col)) if rel_col else None
        if rel is not None and "%" in headers[rel_col]:
            rel /= 100
        points.append((min(max(x, 0.0), 1.0), y, rel))
    if not points:
        raise ValueError(f"{path.name}: no retention rows")
    with store.transaction(conn):
        store.insert_retention(conn, youtube_video_id, observed_at=observed_at, source="csv", points=points)
    return {"imported": len(points)}
