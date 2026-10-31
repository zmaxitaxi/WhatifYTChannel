"""Command line: python -m aether_delivery {inspect,handoff,record} ..."""

from __future__ import annotations

import argparse
import json
import sys

from .handoff import build_handoff, record_publish
from .inspect_media import inspect_video


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="aether_delivery", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_inspect = sub.add_parser("inspect", help="Check one MP4 against the Shorts delivery format")
    p_inspect.add_argument("video")
    p_inspect.add_argument("--frames", type=int, help="Expected totalFrames from the ProductionSpec")
    p_inspect.add_argument("--json", action="store_true", help="Print JSON instead of a table")

    p_handoff = sub.add_parser("handoff", help="Inspect, validate metadata, and write the hand-off folder")
    p_handoff.add_argument("video")
    p_handoff.add_argument("metadata", help="PublishMetadata JSON for this video")
    p_handoff.add_argument("--out", default="handoff", help="Root folder for hand-off packages")
    p_handoff.add_argument("--no-copy", action="store_true", help="Reference the MP4 instead of copying it")

    p_record = sub.add_parser("record", help="Record the live URL after manual publishing")
    p_record.add_argument("folder")
    p_record.add_argument("--url", required=True)

    args = parser.parse_args(argv)

    if args.cmd == "inspect":
        report = inspect_video(args.video, expected_frames=args.frames)
        print(json.dumps(report.to_dict(), indent=2) if args.json else report.to_markdown())
        return 0 if report.passed else 1

    if args.cmd == "handoff":
        folder, ready = build_handoff(args.video, args.metadata, args.out, copy_video=not args.no_copy)
        print(f"{'READY' if ready else 'BLOCKED'}: {folder / 'HANDOFF.md'}")
        return 0 if ready else 1

    if args.cmd == "record":
        manifest = record_publish(args.folder, args.url)
        print(f"Recorded {manifest['videoId']} at {manifest['published']['url']}")
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
