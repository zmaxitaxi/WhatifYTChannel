"""Command line for the AETHER audio and delivery tools.

    python -m aether_audio build-library
    python -m aether_audio verify-library
    python -m aether_audio validate --cues CUES --plan PLAN
    python -m aether_audio mix      --cues CUES --plan PLAN --out mix.wav
    python -m aether_audio encode   --video VIDEO_OR_CHUNK_DIR --audio mix.wav --plan PLAN --out final.mp4
    python -m aether_audio inspect  --mp4 final.mp4 --plan PLAN
    python -m aether_audio package  --cues CUES --plan PLAN --out-dir DIR [--video VIDEO_OR_CHUNK_DIR]

`package` runs mix -> encode -> inspect in one go. Without --video it builds a
sync-check slate so the audio can be reviewed before a renderer capture exists.
Exit status is non-zero when validation or inspection fails.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .contracts import load_cue_track, validate_cue_track
from .encode import encode_short, inspect_short
from .library import MANIFEST_PATH, build_library, load_library, verify_library
from .mix import mix_track
from .slate import make_slate


def _plan(path: str) -> dict:
    return json.loads(Path(path).read_text())


def _print(obj) -> None:
    print(json.dumps(obj, indent=2))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="aether_audio")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build-library")
    sub.add_parser("verify-library")
    v = sub.add_parser("validate")
    v.add_argument("--cues", required=True)
    v.add_argument("--plan")
    m = sub.add_parser("mix")
    m.add_argument("--cues", required=True)
    m.add_argument("--plan")
    m.add_argument("--out", required=True)
    e = sub.add_parser("encode")
    e.add_argument("--video", required=True)
    e.add_argument("--audio", required=True)
    e.add_argument("--plan", required=True)
    e.add_argument("--out", required=True)
    i = sub.add_parser("inspect")
    i.add_argument("--mp4", required=True)
    i.add_argument("--plan", required=True)
    p = sub.add_parser("package")
    p.add_argument("--cues", required=True)
    p.add_argument("--plan", required=True)
    p.add_argument("--out-dir", required=True)
    p.add_argument("--video")
    args = ap.parse_args(argv)

    if args.cmd == "build-library":
        manifest = build_library()
        print(f"wrote {len(manifest['assets'])} assets to {MANIFEST_PATH}")
        return 0
    if args.cmd == "verify-library":
        problems = verify_library()
        for prob in problems:
            print(prob, file=sys.stderr)
        print("library OK" if not problems else f"{len(problems)} problem(s)")
        return 1 if problems else 0

    library = load_library()
    if args.cmd == "validate":
        problems = validate_cue_track(load_cue_track(Path(args.cues)), library,
                                      _plan(args.plan) if args.plan else None)
        for prob in problems:
            print(prob, file=sys.stderr)
        print("cue track OK" if not problems else f"{len(problems)} problem(s)")
        return 1 if problems else 0
    if args.cmd == "mix":
        report = mix_track(load_cue_track(Path(args.cues)), library, Path(args.out),
                           _plan(args.plan) if args.plan else None)
        _print({k: report[k] for k in ("output", "totalSamples", "premixPeakDbfs")}
               | {"loudnorm": report["loudnorm"]["secondPass"]})
        return 0
    if args.cmd == "encode":
        plan = _plan(args.plan)
        encode_short(Path(args.video), Path(args.audio), Path(args.out), plan["output"]["totalFrames"])
        print(f"wrote {args.out}")
        return 0
    if args.cmd == "inspect":
        report = inspect_short(Path(args.mp4), _plan(args.plan)["output"]["totalFrames"])
        _print(report)
        return 0 if report["pass"] else 1
    if args.cmd == "package":
        plan = _plan(args.plan)
        track = load_cue_track(Path(args.cues))
        out = Path(args.out_dir)
        out.mkdir(parents=True, exist_ok=True)
        mix_report = mix_track(track, library, out / "mix.wav", plan)
        video = Path(args.video) if args.video else out / "slate.mp4"
        if not args.video:
            make_slate(plan, track, video)
        final = out / f"{track.job_id}.mp4"
        encode_short(video, out / "mix.wav", final, plan["output"]["totalFrames"])
        inspection = inspect_short(final, plan["output"]["totalFrames"],
                                   track.loudness.integrated_lufs, track.loudness.true_peak_dbtp)
        report = {"mix": mix_report, "inspection": inspection,
                  "videoSource": "renderer capture" if args.video else "sync-check slate"}
        (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        _print(inspection)
        return 0 if inspection["pass"] else 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
