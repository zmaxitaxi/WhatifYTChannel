"""Audio-only revisions preserve the verified video stream and create a new job."""

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from aether.capture import Cancelled, check_cancel, worker_lock
from aether.contracts import ProductionSpec
from aether.media import encode_video, synthesize_audio, verify_video
from aether.storage import Store, atomic_json, digest


def validate_audio_revision(original: ProductionSpec, revised: ProductionSpec) -> None:
    excluded = {"sound", "audio_loudness_lufs"}
    if original.model_dump(exclude=excluded) != revised.model_dump(exclude=excluded):
        raise ValueError("Audio revisions must preserve every visual, caption, and output setting")


def video_stream_hash(path: Path) -> str:
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-map",
            "0:v:0",
            "-c:v",
            "copy",
            "-f",
            "hash",
            "-hash",
            "sha256",
            "-",
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return result.stdout.strip()


def remix_job(store: Store, source_id: str, spec: ProductionSpec) -> dict:
    with worker_lock(store):
        source = store.get(source_id)
        validate_audio_revision(
            ProductionSpec.model_validate_json(json.dumps(source["spec"])), spec
        )
        video = next((item for item in source["artifacts"] if item["kind"] == "video"), None)
        if video is None:
            raise ValueError("The source production must have a completed video")
        original = store.artifact_path(source_id, video["id"])
        if digest(original) != video["sha256"]:
            raise ValueError("The source video's checksum changed")
        job = store.create(spec)
        job_id, directory = job["id"], store.job_dir(job["id"])
        attempt = store.begin_attempt(
            job_id, hashlib.sha256((video["sha256"] + spec.model_dump_json()).encode()).hexdigest()
        )
        try:
            store.update(job_id, status="packaging", completed_frames=spec.output.total_frames)

            def cancel():
                check_cancel(store, job_id)

            cancel()
            for item in source["artifacts"]:
                if item["kind"] in {"poster", "contact_sheet", "frame_diagnostics"}:
                    path = store.artifact_path(source_id, item["id"])
                    target = directory / path.name
                    shutil.copy2(path, target)
                    store.register(job_id, item["kind"], target)
            synthesize_audio(spec, directory / "effects.wav", cancel)
            output = directory / "short.mp4"
            encode_video(
                original,
                directory / "effects.wav",
                output,
                spec.output.total_frames,
                directory / "encode.log",
                cancel,
                copy_video=True,
            )
            cancel()
            original_hash, revised_hash = video_stream_hash(original), video_stream_hash(output)
            if original_hash != revised_hash:
                raise ValueError("The audio revision changed the encoded video stream")
            atomic_json(
                directory / "audio-revision.json",
                {
                    "source_job": source_id,
                    "source_file_sha256": video["sha256"],
                    "video_stream_sha256": revised_hash,
                    "video_stream_unchanged": True,
                    "target_lufs": spec.audio_loudness_lufs,
                },
            )
            info = verify_video(
                output,
                spec.output.total_frames,
                delivery=True,
                target_lufs=spec.audio_loudness_lufs,
            )
            atomic_json(directory / "media-report.json", info)
            for kind, name in (
                ("video", "short.mp4"),
                ("media_report", "media-report.json"),
                ("audio_report", "audio-report.json"),
                ("sound_cues", "sound-cues.json"),
                ("delivery_report", "delivery-report.json"),
                ("audio_revision", "audio-revision.json"),
            ):
                store.register(job_id, kind, directory / name)
            store.update(job_id, status="awaiting_review")
            store.finish_attempt(attempt, "awaiting_review")
        except Exception as error:
            status = "cancelled" if isinstance(error, Cancelled) else "failed"
            store.update(job_id, status=status, error=f"{type(error).__name__}: {error}")
            store.finish_attempt(attempt, status)
            raise
        return store.get(job_id)
