"""Controller supervision around Francis's sound mixer, encoder, and delivery checker."""

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from aether.contracts import ProductionSpec
from aether.contributors import inspect_delivery
from aether.storage import atomic_json


def probe(path: Path) -> dict:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-count_frames",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return json.loads(result.stdout)


def verify_video(
    path: Path, frames: int, *, delivery: bool = False, target_lufs: float = -16.0
) -> dict:
    info = probe(path)
    video = next(stream for stream in info["streams"] if stream["codec_type"] == "video")
    for key, value in {
        "width": 1080,
        "height": 1920,
        "r_frame_rate": "30/1",
        "avg_frame_rate": "30/1",
    }.items():
        if video.get(key) != value:
            raise ValueError(f"{path.name}: {key} is {video.get(key)}, expected {value}")
    if int(video.get("nb_read_frames", -1)) != frames:
        raise ValueError(f"{path.name}: wrong decoded frame count")
    if delivery:
        report = inspect_delivery(path, frames, target_lufs)
        atomic_json(path.parent / "delivery-report.json", report)
        if not report["passed"]:
            failures = [
                check["id"]
                for check in report["checks"]
                if not check["ok"] and check["severity"] == "error"
            ]
            raise ValueError("Delivery inspection failed: " + ", ".join(failures))
        info["delivery_inspection"] = report
    return info


def supervised(command: list[str], log: Path, cancel=lambda: None, timeout=900) -> None:
    with log.open("wb") as errors:
        process = subprocess.Popen(
            command, stdout=errors, stderr=subprocess.STDOUT, start_new_session=True
        )
        try:
            deadline = time.monotonic() + timeout
            while process.poll() is None:
                cancel()
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"Media stage timed out; see {log.name}")
                time.sleep(0.2)
            if process.returncode:
                raise RuntimeError(f"Media stage failed; see {log.name}")
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


def synthesize_audio(spec: ProductionSpec, path: Path, cancel=lambda: None) -> None:
    source = path.parent / "audio-spec.json"
    source.write_text(spec.model_dump_json())
    supervised(
        [
            sys.executable,
            "-m",
            "aether.contributors",
            "mix",
            "--spec",
            str(source),
            "--output",
            str(path),
        ],
        path.parent / "audio.log",
        cancel,
        timeout=300,
    )


def package(chunks: list[Path], audio: Path, output: Path, log: Path, cancel=lambda: None) -> None:
    concat = output.parent / "visual.ffconcat"
    concat.write_text(
        "ffconcat version 1.0\n" + "".join(f"file '{path.name}'\n" for path in chunks)
    )
    frames = sum(int(probe(chunk)["streams"][0]["nb_read_frames"]) for chunk in chunks)
    encode_video(concat, audio, output, frames, log, cancel)


def encode_video(
    video: Path,
    audio: Path,
    output: Path,
    frames: int,
    log: Path,
    cancel=lambda: None,
    *,
    copy_video: bool = False,
) -> None:
    temporary = output.with_suffix(".partial.mp4")
    supervised(
        [
            sys.executable,
            "-m",
            "aether.contributors",
            "encode",
            "--video",
            str(video),
            "--audio",
            str(audio),
            "--output",
            str(temporary),
            "--frames",
            str(frames),
            *(["--copy-video"] if copy_video else []),
        ],
        log,
        cancel,
    )
    temporary.replace(output)
