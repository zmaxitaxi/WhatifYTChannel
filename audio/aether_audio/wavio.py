"""Minimal PCM WAV read/write (16/24-bit) using only the standard library."""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


def write_wav(path: Path, audio: np.ndarray, sample_rate: int, bits: int = 24) -> None:
    """Write float audio shaped (n, channels) in [-1, 1] as PCM."""
    if audio.ndim == 1:
        audio = audio[:, None]
    clipped = np.clip(audio, -1.0, 1.0)
    if bits == 16:
        ints = np.round(clipped * 32767).astype("<i2")
        data = ints.tobytes()
    elif bits == 24:
        ints = np.round(clipped * 8388607).astype("<i4")
        raw = ints.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3]
        data = raw.tobytes()
    else:
        raise ValueError(f"unsupported bit depth {bits}")
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(audio.shape[1])
        w.setsampwidth(bits // 8)
        w.setframerate(sample_rate)
        w.writeframes(data)


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    """Read a PCM WAV into float64 shaped (n, channels)."""
    with wave.open(str(path), "rb") as w:
        channels = w.getnchannels()
        width = w.getsampwidth()
        rate = w.getframerate()
        raw = w.readframes(w.getnframes())
    if width == 2:
        ints = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32767.0
    elif width == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        padded = np.zeros((len(b), 4), dtype=np.uint8)
        padded[:, :3] = b
        padded[:, 3] = np.where(b[:, 2] & 0x80, 0xFF, 0x00)
        ints = padded.view("<i4").reshape(-1).astype(np.float64) / 8388607.0
    else:
        raise ValueError(f"{path}: unsupported sample width {width}")
    return ints.reshape(-1, channels), rate
