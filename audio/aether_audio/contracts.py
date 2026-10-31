"""Sound cue track contract (the "Sound" section of the ProductionSpec).

A cue track is pure data: approved asset IDs, frame numbers on the shared
timeline, gain, fades, and pan. Frames follow the renderer convention:
time = frame / fps, intervals are half-open [start, end).

At 48 kHz and 30 fps one frame is exactly 1,600 samples, so every cue lands
on a sample boundary that matches a video frame boundary.

This module mirrors what will become Max's Pydantic model; it validates with
the standard library so the audio tools run without the controller.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SHORTS_FPS = 30
SAMPLE_RATE = 48_000
SAMPLES_PER_FRAME = SAMPLE_RATE // SHORTS_FPS  # 1600
CUE_TRACK_SPEC_VERSION = "1.0.0"

MAX_GAIN_DB = 6.0
MIN_GAIN_DB = -60.0


class CueValidationError(ValueError):
    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class LoudnessTarget:
    integrated_lufs: float = -16.0
    true_peak_dbtp: float = -1.0
    loudness_range_lu: float = 11.0


@dataclass(frozen=True)
class SoundCue:
    id: str
    asset_id: str
    sync_frame: int
    end_frame: int | None = None
    gain_db: float = 0.0
    fade_in_frames: int = 0
    fade_out_frames: int = 0
    pan: float = 0.0
    shot_id: str | None = None
    sync_event: str = ""

    @property
    def sync_sample(self) -> int:
        return self.sync_frame * SAMPLES_PER_FRAME


@dataclass(frozen=True)
class SoundCueTrack:
    spec_version: str
    job_id: str
    fps: int
    total_frames: int
    sample_rate: int
    library_version: str
    loudness: LoudnessTarget
    cues: tuple[SoundCue, ...]
    notes: str = ""
    raw: dict[str, Any] = field(default_factory=dict, compare=False, repr=False)

    @property
    def total_samples(self) -> int:
        return self.total_frames * (self.sample_rate // self.fps)


def _cue_from_json(c: dict[str, Any]) -> SoundCue:
    return SoundCue(
        id=c["id"],
        asset_id=c["assetId"],
        sync_frame=int(c["syncFrame"]),
        end_frame=None if c.get("endFrame") is None else int(c["endFrame"]),
        gain_db=float(c.get("gainDb", 0.0)),
        fade_in_frames=int(c.get("fadeInFrames", 0)),
        fade_out_frames=int(c.get("fadeOutFrames", 0)),
        pan=float(c.get("pan", 0.0)),
        shot_id=c.get("shotId"),
        sync_event=c.get("syncEvent", ""),
    )


def parse_cue_track(data: dict[str, Any]) -> SoundCueTrack:
    try:
        loud = data.get("loudness", {})
        return SoundCueTrack(
            spec_version=data["specVersion"],
            job_id=data["jobId"],
            fps=int(data["fps"]),
            total_frames=int(data["totalFrames"]),
            sample_rate=int(data["sampleRate"]),
            library_version=data["libraryVersion"],
            loudness=LoudnessTarget(
                integrated_lufs=float(loud.get("integratedLufs", -16.0)),
                true_peak_dbtp=float(loud.get("truePeakDbtp", -1.0)),
                loudness_range_lu=float(loud.get("loudnessRangeLu", 11.0)),
            ),
            cues=tuple(_cue_from_json(c) for c in data["cues"]),
            notes=data.get("notes", ""),
            raw=data,
        )
    except KeyError as e:
        raise CueValidationError([f"missing required field {e}"]) from e


def load_cue_track(path: Path) -> SoundCueTrack:
    return parse_cue_track(json.loads(Path(path).read_text()))


def validate_cue_track(
    track: SoundCueTrack,
    library: dict[str, Any],
    plan: dict[str, Any] | None = None,
) -> list[str]:
    """Return human-readable problems. An empty list means the track is valid.

    `library` maps asset id -> LibraryAsset. `plan` is the CompiledScenePlan
    JSON; when given, frame counts and shot ids are cross-checked against it.
    """
    p: list[str] = []
    if track.spec_version.split(".")[0] != CUE_TRACK_SPEC_VERSION.split(".")[0]:
        p.append(f"unsupported specVersion {track.spec_version}")
    if track.fps != SHORTS_FPS:
        p.append(f"fps must be {SHORTS_FPS}, got {track.fps}")
    if track.sample_rate != SAMPLE_RATE:
        p.append(f"sampleRate must be {SAMPLE_RATE}, got {track.sample_rate}")
    if track.total_frames <= 0:
        p.append("totalFrames must be positive")
    if track.loudness.true_peak_dbtp > -1.0:
        p.append("loudness.truePeakDbtp must be <= -1.0")

    shot_ids: set[str] = set()
    if plan is not None:
        out = plan.get("output", {})
        if out.get("totalFrames") != track.total_frames:
            p.append(f"totalFrames {track.total_frames} != plan totalFrames {out.get('totalFrames')}")
        if out.get("fps") != track.fps:
            p.append(f"fps {track.fps} != plan fps {out.get('fps')}")
        if plan.get("jobId") != track.job_id:
            p.append(f"jobId {track.job_id} != plan jobId {plan.get('jobId')}")
        shot_ids = {s["id"] for s in plan.get("shots", [])}

    seen: set[str] = set()
    for c in track.cues:
        where = f"cue {c.id}"
        if c.id in seen:
            p.append(f"{where}: duplicate id")
        seen.add(c.id)
        asset = library.get(c.asset_id)
        if asset is None:
            p.append(f"{where}: assetId {c.asset_id} is not an approved library asset")
        if not (0 <= c.sync_frame < track.total_frames):
            p.append(f"{where}: syncFrame {c.sync_frame} outside [0, {track.total_frames})")
        if c.end_frame is not None:
            if c.end_frame <= c.sync_frame:
                p.append(f"{where}: endFrame {c.end_frame} must be after syncFrame {c.sync_frame}")
            if c.end_frame > track.total_frames:
                p.append(f"{where}: endFrame {c.end_frame} beyond totalFrames {track.total_frames}")
        if not (MIN_GAIN_DB <= c.gain_db <= MAX_GAIN_DB):
            p.append(f"{where}: gainDb {c.gain_db} outside [{MIN_GAIN_DB}, {MAX_GAIN_DB}]")
        if not (-1.0 <= c.pan <= 1.0):
            p.append(f"{where}: pan {c.pan} outside [-1, 1]")
        if c.fade_in_frames < 0 or c.fade_out_frames < 0:
            p.append(f"{where}: fades must be non-negative")
        if c.shot_id is not None and plan is not None and c.shot_id not in shot_ids:
            p.append(f"{where}: shotId {c.shot_id} not in plan")
        if asset is not None:
            if c.sync_frame * SAMPLES_PER_FRAME - asset.sync_point_samples < -asset.samples:
                p.append(f"{where}: asset would end before the programme starts")
            span_frames = _audible_frames(c, asset, track.total_frames)
            if c.fade_in_frames + c.fade_out_frames > span_frames:
                p.append(
                    f"{where}: fades ({c.fade_in_frames}+{c.fade_out_frames} frames) longer than the cue ({span_frames} frames)"
                )
            if c.end_frame is not None and not asset.loopable:
                natural_end = (c.sync_frame * SAMPLES_PER_FRAME - asset.sync_point_samples + asset.samples)
                if c.end_frame * SAMPLES_PER_FRAME > natural_end + SAMPLES_PER_FRAME:
                    p.append(
                        f"{where}: endFrame {c.end_frame} runs past the end of non-looping asset {c.asset_id}"
                    )
    return p


def _audible_frames(c: SoundCue, asset: Any, total_frames: int) -> int:
    start = max(0, c.sync_frame * SAMPLES_PER_FRAME - asset.sync_point_samples)
    if c.end_frame is not None:
        end = c.end_frame * SAMPLES_PER_FRAME
    elif asset.loopable:
        end = total_frames * SAMPLES_PER_FRAME
    else:
        end = c.sync_frame * SAMPLES_PER_FRAME - asset.sync_point_samples + asset.samples
    end = min(end, total_frames * SAMPLES_PER_FRAME)
    return max(0, (end - start) // SAMPLES_PER_FRAME)


def require_valid(track: SoundCueTrack, library: dict[str, Any], plan: dict[str, Any] | None = None) -> None:
    problems = validate_cue_track(track, library, plan)
    if problems:
        raise CueValidationError(problems)
