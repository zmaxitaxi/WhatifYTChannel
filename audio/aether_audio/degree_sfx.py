"""Original quiet musical underscore; circular notes produce a seamless 12s loop."""

from __future__ import annotations

import numpy as np


def degree_pulse(rng: np.random.Generator) -> np.ndarray:
    rate, seconds = 48_000, 12
    t = np.arange(rate * seconds) / rate
    out = np.zeros_like(t)
    chords = (
        (130.8128, 164.8138, 195.9977, 246.9417),
        (110.0, 130.8128, 164.8138, 195.9977),
        (87.3071, 130.8128, 164.8138, 220.0),
        (97.9989, 146.8324, 195.9977, 220.0),
    )
    for bar, chord in enumerate(chords):
        age = (t - bar * 3) % seconds
        envelope = np.where(age < 3.65, np.sin(np.pi * np.minimum(age / 3.65, 1)) ** 2, 0)
        for i, hz in enumerate(chord):
            phase = i * .41
            tone = np.sin(2 * np.pi * hz * age + phase)
            tone += .1 * np.sin(2 * np.pi * hz * 2 * age + phase)
            out += tone * envelope * .035
        for beat in range(4):
            age = (t - bar * 3 - beat * .75) % seconds
            env = (1 - np.exp(-age / .028)) * np.exp(-age / .32)
            env *= np.clip((1.3 - age) / .2, 0, 1)
            hz = chord[(beat + bar) % 4]
            out += np.sin(2 * np.pi * hz * age) * env * .027
    # Small circular stereo offset: no outdoor noise, chirps, sweeps, or hard hits.
    side = np.roll(out, 79) * .045
    stereo = np.stack((out + side, out - side), axis=1)
    stereo *= 10 ** (-15 / 20) / np.max(np.abs(stereo))
    return stereo
