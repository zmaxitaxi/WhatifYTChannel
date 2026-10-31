"""Command line: python -m aether_analytics <command> ..."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import csv_import, report, store, youtube_api

DEFAULT_DB = Path("analytics_data") / "analytics.sqlite3"


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _token() -> str:
    token = os.environ.get("YT_ANALYTICS_ACCESS_TOKEN")
    if not token:
        sys.exit("Set YT_ANALYTICS_ACCESS_TOKEN to an OAuth token with the yt-analytics.readonly scope.")
    return token


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="aether_analytics", description=__doc__)
    p.add_argument("--db", default=str(DEFAULT_DB), help=f"SQLite file (default {DEFAULT_DB})")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("import-csv", help="Import a YouTube Studio 'Table data.csv' export")
    s.add_argument("path")
    s.add_argument("--period-start")
    s.add_argument("--period-end")
    s.add_argument("--observed-at", help="When the export was taken (default now, UTC)")

    s = sub.add_parser("import-retention-csv", help="Import one video's audience-retention CSV")
    s.add_argument("path")
    s.add_argument("--video", required=True, help="YouTube video id")
    s.add_argument("--observed-at")

    s = sub.add_parser("import-api", help="Pull per-video metrics from the YouTube Analytics API")
    s.add_argument("--start", required=True, help="YYYY-MM-DD")
    s.add_argument("--end", required=True, help="YYYY-MM-DD")
    s.add_argument("--retention", action="store_true", help="Also pull each video's retention curve")

    s = sub.add_parser("link", help="Link an uploaded video to its concept and production job")
    s.add_argument("--video", required=True)
    s.add_argument("--concept", help="e.g. V01")
    s.add_argument("--job")
    s.add_argument("--title")
    s.add_argument("--duration", type=float, help="seconds")

    s = sub.add_parser("rate", help="Record a human rubric rating (each score 1-5)")
    target = s.add_mutually_exclusive_group(required=True)
    target.add_argument("--job")
    target.add_argument("--video")
    s.add_argument("--reviewer", required=True)
    for dim in store.RUBRIC_DIMENSIONS:
        s.add_argument(f"--{dim}", type=int, required=True, choices=range(1, 6))
    s.add_argument("--notes")

    s = sub.add_parser("report", help="Write the production-quality readout")
    s.add_argument("--format", choices=["md", "json"], default="md")
    s.add_argument("--out", help="File to write (default stdout)")

    args = p.parse_args(argv)
    conn = store.connect(args.db)
    observed = getattr(args, "observed_at", None) or _now()

    if args.cmd == "import-csv":
        result = csv_import.import_studio_table(
            conn, args.path, observed_at=observed, period_start=args.period_start, period_end=args.period_end
        )
    elif args.cmd == "import-retention-csv":
        result = csv_import.import_retention_csv(conn, args.path, youtube_video_id=args.video, observed_at=observed)
    elif args.cmd == "import-api":
        token = _token()
        result = youtube_api.import_video_metrics(
            conn, token=token, start_date=args.start, end_date=args.end, observed_at=observed
        )
        if args.retention:
            result["retention"] = {
                vid: youtube_api.import_retention(
                    conn, token=token, youtube_video_id=vid, start_date=args.start,
                    end_date=args.end, observed_at=observed,
                )["imported"]
                for vid in result["video_ids"]
            }
    elif args.cmd == "link":
        with store.transaction(conn):
            store.upsert_video(conn, args.video, concept_id=args.concept, job_id=args.job,
                               title=args.title, duration_seconds=args.duration)
        result = {"linked": args.video}
    elif args.cmd == "rate":
        with store.transaction(conn):
            if args.video:
                store.upsert_video(conn, args.video)
            store.insert_rating(
                conn, reviewer=args.reviewer, rated_at=observed, job_id=args.job, youtube_video_id=args.video,
                scores={d: getattr(args, d) for d in store.RUBRIC_DIMENSIONS}, notes=args.notes,
            )
        result = {"rated": args.job or args.video}
    else:  # report
        text = (report.to_markdown if args.format == "md" else report.to_json)(conn, observed)
        if args.out:
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            Path(args.out).write_text(text, encoding="utf-8")
            result = {"wrote": args.out}
        else:
            sys.stdout.write(text)
            return 0
    print(json.dumps(result, indent=2))
    return 0
