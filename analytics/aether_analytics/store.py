"""SQLite storage for imported analytics, retention curves, and human quality ratings.

Snapshots are append-only: every import adds new rows stamped with `observed_at`, so
view growth can be calculated later and an import never overwrites earlier evidence.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA_VERSION = 1

# Metric columns shared by API and CSV snapshots. A value of NULL means "not available
# from this source", never zero.
METRIC_COLUMNS: tuple[str, ...] = (
    "views",
    "estimated_minutes_watched",
    "average_view_duration_seconds",
    "average_view_percentage",
    "likes",
    "comments",
    "shares",
    "subscribers_gained",
    "impressions",
    "impressions_ctr",
    "engaged_views",
    "stayed_to_watch_percentage",
)

RUBRIC_DIMENSIONS: tuple[str, ...] = (
    "premise",  # immediate premise comprehension
    "recognition",  # recognition of people, landmarks, and places
    "action",  # clear action and cause/effect
    "captions",  # caption readability and muted comprehension
    "camera",  # camera clarity and motion
    "style",  # consistent style
    "sound",  # sound timing
)

_metric_sql = ",\n    ".join(f"{name} REAL" for name in METRIC_COLUMNS)
_rubric_sql = ",\n    ".join(
    f"{name} INTEGER NOT NULL CHECK ({name} BETWEEN 1 AND 5)" for name in RUBRIC_DIMENSIONS
)

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS schema_info (
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
    youtube_video_id TEXT PRIMARY KEY,
    concept_id TEXT,              -- V01..V12 or a held-out variation id
    job_id TEXT,                  -- controller job id that produced the upload
    title TEXT,
    published_at TEXT,
    duration_seconds REAL
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_video_id TEXT NOT NULL REFERENCES videos(youtube_video_id),
    observed_at TEXT NOT NULL,
    period_start TEXT,
    period_end TEXT,
    source TEXT NOT NULL CHECK (source IN ('api', 'csv')),
    source_file TEXT,
    {_metric_sql}
);
CREATE INDEX IF NOT EXISTS idx_snapshots_video ON metric_snapshots(youtube_video_id, observed_at);

CREATE TABLE IF NOT EXISTS retention_points (
    youtube_video_id TEXT NOT NULL REFERENCES videos(youtube_video_id),
    observed_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('api', 'csv')),
    elapsed_ratio REAL NOT NULL CHECK (elapsed_ratio >= 0 AND elapsed_ratio <= 1),
    audience_watch_ratio REAL NOT NULL,
    relative_retention_performance REAL,
    PRIMARY KEY (youtube_video_id, observed_at, elapsed_ratio)
);

CREATE TABLE IF NOT EXISTS quality_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    youtube_video_id TEXT,
    reviewer TEXT NOT NULL,
    rated_at TEXT NOT NULL,
    {_rubric_sql},
    notes TEXT,
    CHECK (job_id IS NOT NULL OR youtube_video_id IS NOT NULL)
);
"""


def connect(db_path: str | Path) -> sqlite3.Connection:
    path = Path(db_path)
    if str(path) != ":memory:":
        path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if str(path) != ":memory:":
        conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA)
    if conn.execute("SELECT COUNT(*) FROM schema_info").fetchone()[0] == 0:
        conn.execute("INSERT INTO schema_info(version) VALUES (?)", (SCHEMA_VERSION,))
    conn.commit()
    return conn


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def upsert_video(
    conn: sqlite3.Connection,
    youtube_video_id: str,
    *,
    concept_id: str | None = None,
    job_id: str | None = None,
    title: str | None = None,
    published_at: str | None = None,
    duration_seconds: float | None = None,
) -> None:
    """Create the video row or fill in fields. Known values are never replaced by NULL."""
    conn.execute(
        """
        INSERT INTO videos (youtube_video_id, concept_id, job_id, title, published_at, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(youtube_video_id) DO UPDATE SET
            concept_id = COALESCE(excluded.concept_id, videos.concept_id),
            job_id = COALESCE(excluded.job_id, videos.job_id),
            title = COALESCE(excluded.title, videos.title),
            published_at = COALESCE(excluded.published_at, videos.published_at),
            duration_seconds = COALESCE(excluded.duration_seconds, videos.duration_seconds)
        """,
        (youtube_video_id, concept_id, job_id, title, published_at, duration_seconds),
    )


def insert_snapshot(
    conn: sqlite3.Connection,
    youtube_video_id: str,
    *,
    observed_at: str,
    source: str,
    metrics: dict[str, float | None],
    period_start: str | None = None,
    period_end: str | None = None,
    source_file: str | None = None,
) -> None:
    unknown = set(metrics) - set(METRIC_COLUMNS)
    if unknown:
        raise ValueError(f"unknown metric columns: {sorted(unknown)}")
    upsert_video(conn, youtube_video_id)
    cols = ["youtube_video_id", "observed_at", "period_start", "period_end", "source", "source_file"]
    vals: list[object] = [youtube_video_id, observed_at, period_start, period_end, source, source_file]
    for name in METRIC_COLUMNS:
        cols.append(name)
        vals.append(metrics.get(name))
    conn.execute(
        f"INSERT INTO metric_snapshots ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
        vals,
    )


def insert_retention(
    conn: sqlite3.Connection,
    youtube_video_id: str,
    *,
    observed_at: str,
    source: str,
    points: list[tuple[float, float, float | None]],
) -> None:
    """points: (elapsed_ratio 0..1, audience_watch_ratio, relative_retention_performance)."""
    upsert_video(conn, youtube_video_id)
    conn.executemany(
        """
        INSERT OR REPLACE INTO retention_points
            (youtube_video_id, observed_at, source, elapsed_ratio, audience_watch_ratio,
             relative_retention_performance)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [(youtube_video_id, observed_at, source, e, a, r) for e, a, r in points],
    )


def insert_rating(
    conn: sqlite3.Connection,
    *,
    reviewer: str,
    rated_at: str,
    scores: dict[str, int],
    job_id: str | None = None,
    youtube_video_id: str | None = None,
    notes: str | None = None,
) -> None:
    if job_id is None and youtube_video_id is None:
        raise ValueError("a rating needs a job_id or a youtube_video_id")
    missing = [d for d in RUBRIC_DIMENSIONS if d not in scores]
    if missing:
        raise ValueError(f"missing rubric scores: {missing}")
    for dim in RUBRIC_DIMENSIONS:
        value = scores[dim]
        if not isinstance(value, int) or not 1 <= value <= 5:
            raise ValueError(f"{dim} must be an integer from 1 to 5, got {value!r}")
    cols = ["job_id", "youtube_video_id", "reviewer", "rated_at", *RUBRIC_DIMENSIONS, "notes"]
    vals = [job_id, youtube_video_id, reviewer, rated_at, *(scores[d] for d in RUBRIC_DIMENSIONS), notes]
    conn.execute(
        f"INSERT INTO quality_ratings ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
        vals,
    )
