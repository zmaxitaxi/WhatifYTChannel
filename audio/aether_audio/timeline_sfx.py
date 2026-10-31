"""Short, non-looping scene Foley for the alternate-history cut.

These original procedural designs use fixed seeds, soft attacks and filtered
transients. No birds, wind beds, speech, external samples, or rising chirps.
"""

from __future__ import annotations

import numpy as np

RATE = 48_000
TAU = 2 * np.pi


def _canvas(seconds: float) -> np.ndarray:
    return np.zeros(round(seconds * RATE), dtype=np.float64)


def _hit(out, rng, at, duration, tones=(), noise=0.0, cutoff=1600, decay=0.08):
    n = round(duration * RATE)
    t = np.arange(n) / RATE
    signal = sum(amp * np.sin(TAU * hz * t) for hz, amp in tones)
    if noise:
        raw = rng.standard_normal(n)
        freq = np.fft.rfftfreq(n, 1 / RATE)
        filtered = np.fft.irfft(np.fft.rfft(raw) / np.sqrt(1 + (freq / cutoff) ** 6), n=n)
        filtered /= max(float(np.max(np.abs(filtered))), 1e-9)
        signal = signal + noise * filtered
    envelope = np.minimum(t / .004, 1) * np.exp(-t / decay)
    envelope *= np.minimum((duration - t) / .025, 1)
    start = round(at * RATE)
    length = min(n, len(out) - start)
    out[start:start + length] += (signal * envelope)[:length]


def _finish(out, peak=-10):
    ramp = min(240, len(out) // 4)
    out[:ramp] *= np.linspace(0, 1, ramp)
    out[-ramp:] *= np.linspace(1, 0, ramp)
    out *= 10 ** (peak / 20) / max(float(np.max(np.abs(out))), 1e-9)
    side = np.roll(out, 83) * .06
    side[:83] = 0
    stereo = np.stack([out + side, out - side], axis=1)
    stereo *= 10 ** (peak / 20) / max(float(np.max(np.abs(stereo))), 1e-9)
    return stereo


def paper_stamp(rng):
    out = _canvas(1.1)
    for at in (.02, .15, .27):
        _hit(out, rng, at, .15, noise=.3, cutoff=2100, decay=.07)
    _hit(out, rng, .5, .35, [(125, .7), (260, .2)], noise=.22, cutoff=950, decay=.065)
    return _finish(out)


def campus_bell(rng):
    out = _canvas(1.35)
    _hit(out, rng, .02, 1.25, [(440, .6), (1195, .14), (1780, .045)], decay=.32)
    return _finish(out, -12)


def garage_latch(rng):
    out = _canvas(.8)
    _hit(out, rng, .03, .22, [(520, .3), (940, .09)], noise=.24, cutoff=1700, decay=.025)
    _hit(out, rng, .25, .35, [(96, .7), (220, .18)], noise=.3, cutoff=800, decay=.08)
    return _finish(out)


def workshop_dial(rng):
    out = _canvas(1.05)
    for i, at in enumerate((.04, .17, .33)):
        _hit(out, rng, at, .09, [(670 + i * 35, .16)], noise=.23, cutoff=1400, decay=.012)
    _hit(out, rng, .42, .55, [(110, .28), (220, .08)], decay=.19)
    return _finish(out, -12)


def construction_taps(rng):
    out = _canvas(1.15)
    for at, amp in ((.03, .8), (.3, .55), (.61, .4)):
        _hit(out, rng, at, .3, [(185, amp), (460, amp * .2)], noise=amp * .28, cutoff=1250, decay=.055)
    return _finish(out)


def suitcase_roll(rng):
    out = _canvas(1.15)
    for i, at in enumerate(np.arange(.04, .92, .11)):
        _hit(out, rng, float(at), .12, [(155, .12 + .03 * (i % 2))], noise=.22, cutoff=1050, decay=.028)
    _hit(out, rng, .92, .2, [(370, .2)], noise=.12, cutoff=1300, decay=.03)
    return _finish(out, -12)


def keyboard(rng):
    out = _canvas(1.2)
    for at in (.03, .13, .22, .38, .49, .58, .72):
        _hit(out, rng, at, .09, [(520, .13), (1060, .035)], noise=.28, cutoff=2200, decay=.014)
    _hit(out, rng, .9, .12, [(392, .15)], decay=.04)
    return _finish(out, -12)


def harbor_buoy(rng):
    out = _canvas(1.2)
    _hit(out, rng, .03, 1.05, [(220, .7), (593, .12), (1105, .035)], decay=.27)
    _hit(out, rng, .38, .35, [(90, .12)], noise=.07, cutoff=480, decay=.1)
    return _finish(out, -13)


def ferry_depart(rng):
    out = _canvas(1.4)
    for at in (.03, .21, .4, .61):
        _hit(out, rng, at, .38, [(72, .32), (144, .1)], noise=.09, cutoff=420, decay=.14)
    for at in (.75, .98):
        _hit(out, rng, at, .28, noise=.13, cutoff=650, decay=.1)
    return _finish(out, -13)


def port_crate(rng):
    out = _canvas(.95)
    _hit(out, rng, .03, .35, [(82, .65), (164, .2)], noise=.25, cutoff=850, decay=.085)
    for at in (.4, .57):
        _hit(out, rng, at, .17, [(420, .16), (780, .035)], noise=.12, cutoff=1700, decay=.03)
    return _finish(out)


def housing_keys(rng):
    out = _canvas(.95)
    for i, at in enumerate((.02, .15, .29)):
        _hit(out, rng, at, .2, [(870 + i * 43, .22), (1520, .05)], noise=.055, cutoff=1900, decay=.04)
    _hit(out, rng, .53, .24, [(160, .32)], noise=.12, cutoff=780, decay=.045)
    return _finish(out, -13)


def future_resolve(rng):
    out = _canvas(1.4)
    for at, hz, amp in ((.02, 261.63, .35), (.18, 329.63, .25), (.34, 392, .2)):
        _hit(out, rng, at, .95, [(hz, amp), (hz * 2, amp * .12)], decay=.3)
    return _finish(out, -14)


# ID, category, description, generator, seed, audible sync point.
SCENE_EFFECTS = (
    ("fx_paper_stamp", "impact", "Paper handling and a soft desk stamp.", paper_stamp, 2301, .5),
    ("fx_campus_bell", "arrival", "One warm collegiate bell, with a short tail.", campus_bell, 2302, .02),
    ("fx_garage_latch", "movement", "A private garage key and muffled latch.", garage_latch, 2303, .25),
    ("fx_workshop_dial", "movement", "Instrument dial clicks and a brief low oscillator.", workshop_dial, 2304, .04),
    ("fx_construction_taps", "impact", "Three restrained construction taps.", construction_taps, 2305, .03),
    ("fx_suitcase_roll", "movement", "Suitcase wheels over a few pavement joints.", suitcase_roll, 2306, .04),
    ("fx_keyboard", "ui", "A short mechanical keyboard phrase and a low confirmation tone.", keyboard, 2307, .03),
    ("fx_harbor_buoy", "arrival", "A low harbor bell with a muted water knock.", harbor_buoy, 2308, .03),
    ("fx_ferry_depart", "movement", "A brief muted ferry engine pulse and two water laps.", ferry_depart, 2309, .03),
    ("fx_port_crate", "impact", "A cargo crate set down and its latch secured.", port_crate, 2310, .03),
    ("fx_housing_keys", "movement", "Two quiet key gestures and a door latch.", housing_keys, 2311, .02),
    ("fx_future_resolve", "stinger", "A warm, restrained three-note future resolution.", future_resolve, 2312, .02),
)
