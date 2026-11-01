"""Original 72-second chamber/electronic score, growing from workshop to sunlight."""

from __future__ import annotations

import numpy as np


def boston_sunrise(rng: np.random.Generator) -> np.ndarray:
    rate, seconds = 48_000, 72
    out = np.zeros((rate * seconds, 2), dtype=np.float64)
    chords = [
        (57, 60, 64), (53, 57, 60), (48, 55, 60), (55, 59, 62),
        (48, 55, 64), (53, 57, 60), (57, 60, 64), (55, 59, 62),
        (53, 60, 65), (48, 55, 64), (55, 59, 62), (57, 60, 64),
        (48, 55, 64), (55, 59, 62), (57, 60, 64), (53, 57, 60),
        (53, 60, 65), (55, 59, 62), (48, 55, 64), (55, 59, 62),
        (48, 55, 64), (53, 57, 60), (55, 59, 62), (48, 55, 64),
    ]

    def note(start, duration, midi, amplitude, pan=0.0, sustain=False):
        begin = int(start * rate)
        count = min(int(duration * rate), len(out) - begin)
        t = np.arange(count) / rate
        hz = 440 * 2 ** ((midi - 69) / 12)
        if sustain:
            env = np.sin(np.pi * np.minimum(t / duration, 1)) ** 2
            tone = np.sin(2 * np.pi * hz * t) + .10 * np.sin(2 * np.pi * hz * 2 * t)
        else:
            env = (1 - np.exp(-t / .016)) * np.exp(-t / .52)
            env *= np.clip((duration - t) / .16, 0, 1)
            tone = sum(np.sin(2 * np.pi * hz * h * t) / h ** 2.4 for h in (1, 2, 3, 4))
        signal = tone * env * amplitude
        out[begin:begin + count, 0] += signal * np.sqrt((1 - pan) / 2)
        out[begin:begin + count, 1] += signal * np.sqrt((1 + pan) / 2)

    for bar, chord in enumerate(chords):
        start = bar * 3.0
        growth = bar / 23
        for voice, midi in enumerate(chord):
            # Overlapping slow chord voices keep the background continuous.
            note(max(0, start - .4), 4.2, midi, .023, (voice - 1) * .15, True)
        for beat in range(4):
            midi = chord[(bar + beat) % 3] + (12 if beat % 2 else 0)
            note(start + beat * .75, 1.8, midi, .038 + growth * .012,
                 (-1 if beat % 2 else 1) * .12)
        note(start, 3.4, chord[0] - 12, .021, 0, True)
        if bar >= 8:
            note(start + 1.5, 1.6, chord[1], .018, -.1)
        if bar >= 16:
            # A restrained higher voice opens the final third; no chirping ostinato.
            note(start + .75, 2.6, chord[2] + 12, .017, .1, True)
    # Finish on C, with no abruptly cut notes or noises.
    t = np.arange(len(out)) / rate
    fade = np.minimum(t / .35, 1) * np.clip((seconds - t) / 1.1, 0, 1)
    out *= fade[:, None]
    out *= 10 ** (-14 / 20) / np.max(np.abs(out))
    return out
