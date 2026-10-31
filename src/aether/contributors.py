"""Adapters to the contributor-owned packages; planning data never chooses Python modules."""

import argparse
import importlib.util
import sys
from pathlib import Path

from aether.contracts import ProductionSpec
from aether.paths import ROOT
from aether.storage import atomic_json

PACKAGES = {"aether_audio": "audio", "aether_delivery": "delivery"}


def load_package(name: str) -> None:
    if name in sys.modules:
        return
    directory = ROOT / PACKAGES[name] / name
    spec = importlib.util.spec_from_file_location(
        name, directory / "__init__.py", submodule_search_locations=[str(directory)]
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Contributor package {name} is unavailable; sync the repository")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)


def cue_track(spec: ProductionSpec, job_id: str) -> dict:
    aliases = {
        "soft_chime_v1": "arr_shimmer",
        "air_sweep_v1": "mv_flight_swoosh",
        "arrival_v1": "stinger_surprise",
    }
    return {
        "specVersion": "1.0.0",
        "jobId": job_id,
        "fps": 30,
        "totalFrames": spec.output.total_frames,
        "sampleRate": 48000,
        "libraryVersion": "1.0.0",
        "loudness": {
            "integratedLufs": spec.audio_loudness_lufs,
            "truePeakDbtp": -1.0,
            "loudnessRangeLu": 11.0,
        },
        "cues": [
            {
                "id": cue.id,
                "assetId": aliases.get(cue.asset_id, cue.asset_id),
                "syncFrame": cue.frame,
                "endFrame": cue.end_frame,
                "gainDb": cue.gain_db,
                "fadeInFrames": cue.fade_in_frames,
                "fadeOutFrames": cue.fade_out_frames,
                "pan": cue.pan,
                "shotId": next(
                    shot.id for shot in spec.shots if shot.start_frame <= cue.frame < shot.end_frame
                ),
                "syncEvent": "ProductionSpec frame cue",
            }
            for cue in spec.sound
        ],
    }


def inspect_delivery(path: Path, total_frames: int, target_lufs: float = -16.0) -> dict:
    load_package("aether_delivery")
    from aether_delivery.inspect_media import inspect_video

    report = inspect_video(path, expected_frames=total_frames, target_lufs=target_lufs)
    return report.to_dict()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["mix", "encode"])
    parser.add_argument("--spec", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--audio", type=Path)
    parser.add_argument("--video", type=Path)
    parser.add_argument("--frames", type=int)
    parser.add_argument("--copy-video", action="store_true")
    args = parser.parse_args()
    load_package("aether_audio")
    if args.mode == "mix":
        from aether_audio.contracts import parse_cue_track
        from aether_audio.library import load_library
        from aether_audio.mix import mix_track

        spec = ProductionSpec.model_validate_json(args.spec.read_text())
        track = cue_track(spec, args.output.parent.name)
        plan = {
            "jobId": track["jobId"],
            "output": {"fps": 30, "totalFrames": spec.output.total_frames},
            "shots": [{"id": shot.id} for shot in spec.shots],
        }
        atomic_json(args.output.parent / "sound-cues.json", track)
        report = mix_track(parse_cue_track(track), load_library(), args.output, plan)
        atomic_json(args.output.parent / "audio-report.json", report)
    else:
        from aether_audio.encode import encode_short

        command = encode_short(
            args.video,
            args.audio,
            args.output,
            args.frames,
            input_is_srgb=not args.copy_video,
            copy_video=args.copy_video,
        )
        atomic_json(args.output.parent / "encode-command.json", command)


if __name__ == "__main__":
    main()
