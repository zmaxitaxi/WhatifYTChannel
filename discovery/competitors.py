"""Competitor observations through the YouTube Data API.

Saves timestamped snapshots (JSON Lines) so view changes can be calculated
between runs, as TECHNICAL_PLAN.md asks. Standard library only.

Usage:
    YOUTUBE_API_KEY=... python3 -m discovery.competitors observe
    python3 -m discovery.competitors velocity

The API key is read from the environment and never written to disk. The
observations file holds only public video statistics.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
COMPETITORS_FILE = DATA_DIR / "competitors.json"
OBSERVATIONS_FILE = DATA_DIR / "observations.jsonl"
API = "https://www.googleapis.com/youtube/v3"


@dataclass(frozen=True)
class Observation:
    observed_at: str  # ISO 8601 UTC
    channel_id: str
    video_id: str
    title: str
    published_at: str
    views: int
    likes: int | None
    comments: int | None


def _get(endpoint: str, params: dict, key: str) -> dict:
    query = urllib.parse.urlencode({**params, "key": key})
    with urllib.request.urlopen(f"{API}/{endpoint}?{query}", timeout=30) as resp:
        return json.load(resp)


def recent_video_ids(channel_id: str, key: str, limit: int = 15) -> list[str]:
    # Every channel's uploads playlist id is its channel id with "UC" -> "UU".
    playlist = "UU" + channel_id[2:]
    data = _get("playlistItems", {"part": "contentDetails", "playlistId": playlist, "maxResults": limit}, key)
    return [item["contentDetails"]["videoId"] for item in data.get("items", [])]


def observe_channel(channel_id: str, key: str, now: str) -> list[Observation]:
    ids = recent_video_ids(channel_id, key)
    if not ids:
        return []
    data = _get("videos", {"part": "snippet,statistics", "id": ",".join(ids)}, key)
    out = []
    for v in data.get("items", []):
        stats = v.get("statistics", {})
        out.append(
            Observation(
                observed_at=now,
                channel_id=channel_id,
                video_id=v["id"],
                title=v["snippet"]["title"],
                published_at=v["snippet"]["publishedAt"],
                views=int(stats.get("viewCount", 0)),
                likes=int(stats["likeCount"]) if "likeCount" in stats else None,
                comments=int(stats["commentCount"]) if "commentCount" in stats else None,
            )
        )
    return out


def load_competitors(path: Path = COMPETITORS_FILE) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["channels"]


def append_observations(obs: list[Observation], path: Path = OBSERVATIONS_FILE) -> None:
    with path.open("a", encoding="utf-8") as f:
        for o in obs:
            f.write(json.dumps(o.__dict__, ensure_ascii=False) + "\n")


def load_observations(path: Path = OBSERVATIONS_FILE) -> list[Observation]:
    if not path.exists():
        return []
    return [Observation(**json.loads(line)) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def view_velocity(observations: list[Observation]) -> dict[str, dict]:
    """Views gained per day between the first and last snapshot of each video.

    Videos with a single snapshot report ``views_per_day`` as None rather than
    guessing from lifetime averages.
    """
    by_video: dict[str, list[Observation]] = {}
    for o in observations:
        by_video.setdefault(o.video_id, []).append(o)
    out = {}
    for vid, snaps in by_video.items():
        snaps.sort(key=lambda o: o.observed_at)
        first, last = snaps[0], snaps[-1]
        days = (_parse(last.observed_at) - _parse(first.observed_at)).total_seconds() / 86400
        out[vid] = {
            "title": last.title,
            "channel_id": last.channel_id,
            "views": last.views,
            "snapshots": len(snaps),
            "views_per_day": round((last.views - first.views) / days, 1) if days > 0 else None,
        }
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["observe", "velocity"])
    args = parser.parse_args(argv)

    if args.command == "observe":
        key = os.environ.get("YOUTUBE_API_KEY")
        if not key:
            print("Set YOUTUBE_API_KEY to a YouTube Data API v3 key.", file=sys.stderr)
            return 2
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        total = 0
        for ch in load_competitors():
            obs = observe_channel(ch["channel_id"], key, now)
            append_observations(obs)
            total += len(obs)
            print(f"{ch['name']}: {len(obs)} videos")
        print(f"Saved {total} observations to {OBSERVATIONS_FILE}")
        return 0

    rows = sorted(view_velocity(load_observations()).values(), key=lambda r: -(r["views_per_day"] or -1))
    for r in rows:
        vpd = "n/a (one snapshot)" if r["views_per_day"] is None else f"{r['views_per_day']:,.0f}/day"
        print(f"{vpd:>20}  {r['views']:>12,}  {r['title']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
