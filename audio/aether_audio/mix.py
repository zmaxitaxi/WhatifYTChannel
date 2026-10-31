"""Render a frame-timed cue track to a loudness-normalised 48 kHz stereo mix."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .contracts import SAMPLES_PER_FRAME, SoundCue, SoundCueTrack, require_valid
from .library import LibraryAsset
from .wavio import write_wav

# The limiter approximates true peak at 4x oversampling, and AAC encoding adds
# overshoot of its own. High-crest sound effects exceeded the encoded ceiling
# with 0.5 dB of headroom; reserve 2.5 dB and verify the final AAC independently.
TRUE_PEAK_HEADROOM_DB = 2.5


@dataclass(frozen=True)
class PlacedCue:
    cue_id: str
    asset_id: str
    start_sample: int  # inclusive, programme time
    end_sample: int  # exclusive, programme time
    sync_sample: int

    def as_dict(self) -> dict:
        return {
            "cueId": self.cue_id,
            "assetId": self.asset_id,
            "startSample": self.start_sample,
            "endSample": self.end_sample,
            "syncSample": self.sync_sample,
            "startFrame": self.start_sample / SAMPLES_PER_FRAME,
            "endFrame": self.end_sample / SAMPLES_PER_FRAME,
            "syncFrame": self.sync_sample / SAMPLES_PER_FRAME,
        }


def _raised_cosine(n: int) -> np.ndarray:
    return np.sin(np.linspace(0.0, np.pi / 2, n, endpoint=False) if n else np.zeros(0)) ** 2


def _pan_gains(pan: float) -> tuple[float, float]:
    """Constant-power balance; pan 0 leaves both channels at unity."""
    theta = (pan + 1.0) * np.pi / 4.0
    return float(np.cos(theta) * np.sqrt(2.0)), float(np.sin(theta) * np.sqrt(2.0))


def place_cue(cue: SoundCue, asset: LibraryAsset, total_samples: int) -> PlacedCue:
    sync = cue.sync_frame * SAMPLES_PER_FRAME
    start = sync - asset.sync_point_samples
    if cue.end_frame is not None:
        end = cue.end_frame * SAMPLES_PER_FRAME
        if not asset.loopable:
            end = min(end, start + asset.samples)
    elif asset.loopable:
        end = total_samples
    else:
        end = start + asset.samples
    return PlacedCue(cue.id, cue.asset_id, max(0, start), min(end, total_samples), sync)


def render_cue(cue: SoundCue, asset_audio: np.ndarray, asset: LibraryAsset,
               total_samples: int) -> tuple[PlacedCue, np.ndarray]:
    """Return the placement and the processed audio for [start, end)."""
    placed = place_cue(cue, asset, total_samples)
    length = placed.end_sample - placed.start_sample
    if length <= 0:
        return placed, np.zeros((0, 2))
    # Offset into the asset where the programme-visible part begins.
    offset = placed.start_sample - (placed.sync_sample - asset.sync_point_samples)
    if asset.loopable:
        idx = (offset + np.arange(length)) % len(asset_audio)
        seg = asset_audio[idx]
    else:
        seg = asset_audio[offset: offset + length]
        if len(seg) < length:
            seg = np.concatenate([seg, np.zeros((length - len(seg), 2))])
    seg = seg * (10 ** (cue.gain_db / 20.0))
    gl, gr = _pan_gains(cue.pan)
    seg = seg * np.array([gl, gr])

    env = np.ones(length)
    fi = min(length, cue.fade_in_frames * SAMPLES_PER_FRAME)
    fo = min(length, cue.fade_out_frames * SAMPLES_PER_FRAME)
    if fi:
        env[:fi] *= _raised_cosine(fi)
    if fo:
        env[length - fo:] *= _raised_cosine(fo)[::-1]
    return placed, seg * env[:, None]


def render_premix(track: SoundCueTrack, library: dict[str, LibraryAsset],
                  plan: dict | None = None) -> tuple[np.ndarray, list[PlacedCue]]:
    """Sum every cue onto the programme timeline (float, before loudness)."""
    require_valid(track, library, plan)
    total = track.total_samples
    bus = np.zeros((total, 2))
    placements = []
    cache: dict[str, np.ndarray] = {}
    for cue in track.cues:
        asset = library[cue.asset_id]
        if cue.asset_id not in cache:
            cache[cue.asset_id] = asset.load()
        placed, audio = render_cue(cue, cache[cue.asset_id], asset, total)
        bus[placed.start_sample: placed.start_sample + len(audio)] += audio
        placements.append(placed)
    return bus, placements


# --------------------------------------------------------------------------
# Loudness: static gain to -16 LUFS, true-peak limiter, verified with ebur128
# --------------------------------------------------------------------------


def _ffmpeg(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", *args],
                          capture_output=True, text=True, check=True)


def measure_r128(path: Path) -> dict:
    """Integrated loudness and true peak of an audio file via FFmpeg ebur128."""
    proc = _ffmpeg(["-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"])
    summary = proc.stderr[proc.stderr.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", summary)
    tp = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    if not i:
        raise RuntimeError("could not measure integrated loudness (silent mix?)")
    return {"integratedLufs": float(i.group(1)),
            "truePeakDbtp": float("-inf") if not tp or tp.group(1) == "-inf" else float(tp.group(1))}


def loudness_normalize(src_wav: Path, dst_wav: Path, total_samples: int,
                       integrated_lufs: float, true_peak_dbtp: float,
                       max_iterations: int = 5, tolerance_lu: float = 0.2) -> dict:
    """Static gain to the loudness target with a true-peak brickwall limiter.

    Sound-effect mixes have a high crest factor: the gain that brings the
    integrated loudness to target usually pushes impacts past the true-peak
    ceiling. FFmpeg's loudnorm then silently switches to its dynamic mode,
    which pumps. Instead this applies one static gain, catches only the
    transients with a limiter running at 4x the sample rate (approximating
    true peak), measures, and corrects the gain for what the limiter took
    away. No other dynamics processing is applied.
    """
    ceiling = true_peak_dbtp - TRUE_PEAK_HEADROOM_DB
    limit_lin = 10 ** (ceiling / 20.0)
    premix = measure_r128(src_wav)
    gain_db = integrated_lufs - premix["integratedLufs"]
    history = []
    with tempfile.TemporaryDirectory() as tmp:
        candidate = Path(tmp) / "candidate.wav"
        for _ in range(max_iterations):
            _ffmpeg([
                "-y", "-i", str(src_wav), "-af",
                f"volume={gain_db:.3f}dB,aresample=192000,"
                f"alimiter=limit={limit_lin:.5f}:attack=1:release=80:asc=1:level=disabled,"
                f"aresample=48000,apad=whole_len={total_samples},atrim=end_sample={total_samples}",
                "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", str(candidate),
            ])
            measured = measure_r128(candidate)
            history.append({"gainDb": round(gain_db, 3), **measured})
            error = integrated_lufs - measured["integratedLufs"]
            if abs(error) <= tolerance_lu:
                break
            gain_db += error
        dst_wav.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(candidate, dst_wav)
    final = history[-1]
    return {
        "method": "static gain + 4x-oversampled brickwall limiter",
        "premixIntegratedLufs": premix["integratedLufs"],
        "premixTruePeakDbtp": premix["truePeakDbtp"],
        "gainDb": final["gainDb"],
        "limiterCeilingDbtp": ceiling,
        "integratedLufs": final["integratedLufs"],
        "truePeakDbtp": final["truePeakDbtp"],
        "converged": abs(integrated_lufs - final["integratedLufs"]) <= tolerance_lu,
        "iterations": history,
    }


def mix_track(track: SoundCueTrack, library: dict[str, LibraryAsset], out_wav: Path,
              plan: dict | None = None) -> dict:
    """Render, normalise, and write the final programme mix. Returns a report."""
    premix, placements = render_premix(track, library, plan)
    peak = float(np.max(np.abs(premix))) if len(premix) else 0.0
    # Keep the premix out of clipping before handing it to FFmpeg as PCM;
    # the loudness stage sets the final level anyway.
    scale = 0.5 / peak if peak > 0.5 else 1.0
    with tempfile.TemporaryDirectory() as tmp:
        pre_path = Path(tmp) / "premix.wav"
        write_wav(pre_path, premix * scale, track.sample_rate, bits=24)
        loud = loudness_normalize(
            pre_path, out_wav, track.total_samples,
            track.loudness.integrated_lufs, track.loudness.true_peak_dbtp,
        )
    return {
        "jobId": track.job_id,
        "output": str(out_wav),
        "totalSamples": track.total_samples,
        "premixPeakDbfs": round(20 * np.log10(max(peak, 1e-9)), 2),
        "loudnorm": loud,
        "placements": [p.as_dict() for p in placements],
    }
