"""Owner-authorized YouTube Analytics API (v2) import.

Only metrics the API supports are requested. Studio-only metrics such as impressions and
impressions CTR are left missing here and come from a Studio CSV import instead.

Authentication is deliberately outside this module: pass an OAuth 2.0 access token with the
`https://www.googleapis.com/auth/yt-analytics.readonly` scope (env `YT_ANALYTICS_ACCESS_TOKEN`).
Metric reference: https://developers.google.com/youtube/analytics/metrics
"""

from __future__ import annotations

import json
import sqlite3
import urllib.parse
import urllib.request
from typing import Callable

from . import store

REPORTS_URL = "https://youtubeanalytics.googleapis.com/v2/reports"

# API metric name -> local column
VIDEO_METRICS: dict[str, str] = {
    "views": "views",
    "estimatedMinutesWatched": "estimated_minutes_watched",
    "averageViewDuration": "average_view_duration_seconds",
    "averageViewPercentage": "average_view_percentage",
    "likes": "likes",
    "comments": "comments",
    "shares": "shares",
    "subscribersGained": "subscribers_gained",
}

Transport = Callable[[str, dict[str, str], str], dict]


def http_transport(url: str, params: dict[str, str], token: str) -> dict:
    full = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 - fixed https endpoint
        return json.loads(resp.read().decode("utf-8"))


def _rows(payload: dict) -> list[dict[str, object]]:
    names = [h["name"] for h in payload.get("columnHeaders", [])]
    return [dict(zip(names, row)) for row in payload.get("rows", []) or []]


def import_video_metrics(
    conn: sqlite3.Connection,
    *,
    token: str,
    start_date: str,
    end_date: str,
    observed_at: str,
    transport: Transport = http_transport,
    max_results: int = 200,
) -> dict[str, object]:
    params = {
        "ids": "channel==MINE",
        "startDate": start_date,
        "endDate": end_date,
        "metrics": ",".join(VIDEO_METRICS),
        "dimensions": "video",
        "sort": "-views",
        "maxResults": str(max_results),
    }
    rows = _rows(transport(REPORTS_URL, params, token))
    with store.transaction(conn):
        for row in rows:
            video_id = str(row["video"])
            metrics = {
                column: (float(row[api]) if row.get(api) is not None else None)
                for api, column in VIDEO_METRICS.items()
            }
            store.insert_snapshot(
                conn,
                video_id,
                observed_at=observed_at,
                source="api",
                metrics=metrics,
                period_start=start_date,
                period_end=end_date,
            )
    return {"imported": len(rows), "video_ids": [str(r["video"]) for r in rows]}


def import_retention(
    conn: sqlite3.Connection,
    *,
    token: str,
    youtube_video_id: str,
    start_date: str,
    end_date: str,
    observed_at: str,
    transport: Transport = http_transport,
) -> dict[str, object]:
    params = {
        "ids": "channel==MINE",
        "startDate": start_date,
        "endDate": end_date,
        "metrics": "audienceWatchRatio,relativeRetentionPerformance",
        "dimensions": "elapsedVideoTimeRatio",
        "filters": f"video=={youtube_video_id}",
    }
    rows = _rows(transport(REPORTS_URL, params, token))
    points = [
        (
            float(r["elapsedVideoTimeRatio"]),
            float(r["audienceWatchRatio"]),
            float(r["relativeRetentionPerformance"])
            if r.get("relativeRetentionPerformance") is not None
            else None,
        )
        for r in rows
    ]
    with store.transaction(conn):
        store.insert_retention(conn, youtube_video_id, observed_at=observed_at, source="api", points=points)
    return {"imported": len(points)}
