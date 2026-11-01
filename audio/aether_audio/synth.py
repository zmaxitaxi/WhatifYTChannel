"""Deterministic procedural sound design for the AETHER sound library.

Every effect is generated from code plus a fixed seed, so the team owns the
result outright: no third-party samples, no licence terms, no attribution.
The generated WAVs are committed and pinned by SHA-256 in library.json; this
module is their provenance, not something production jobs run.

All generators return float64 arrays shaped (n, 2) at SAMPLE_RATE, peak <= 1.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

import numpy as np

from .timeline_sfx import SCENE_EFFECTS
from .degree_sfx import degree_pulse
from .boston_score import boston_sunrise

SAMPLE_RATE = 48_000
TWO_PI = 2.0 * math.pi


# --------------------------------------------------------------------------
# Building blocks
# --------------------------------------------------------------------------


def _t(seconds: float) -> np.ndarray:
    return np.arange(int(round(seconds * SAMPLE_RATE))) / SAMPLE_RATE


def _white(rng: np.random.Generator, n: int) -> np.ndarray:
    return rng.standard_normal(n)


def _spectral_shape(x: np.ndarray, gain_fn: Callable[[np.ndarray], np.ndarray]) -> np.ndarray:
    """Static filter applied in the frequency domain (zero-phase)."""
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1.0 / SAMPLE_RATE)
    return np.fft.irfft(spec * gain_fn(freqs), n=len(x))


def _pink(rng: np.random.Generator, n: int) -> np.ndarray:
    return _spectral_shape(_white(rng, n), lambda f: 1.0 / np.sqrt(np.maximum(f, 20.0)))


def _brown(rng: np.random.Generator, n: int) -> np.ndarray:
    return _spectral_shape(_white(rng, n), lambda f: 1.0 / np.maximum(f, 15.0))


def _lowpass_static(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return _spectral_shape(x, lambda f: 1.0 / np.sqrt(1.0 + (f / cutoff) ** (2 * order)))


def _highpass_static(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return _spectral_shape(
        x, lambda f: 1.0 - 1.0 / np.sqrt(1.0 + (f / cutoff) ** (2 * order))
    )


def _svf_bandpass(x: np.ndarray, cutoff: np.ndarray, q: float) -> np.ndarray:
    """Chamberlin state-variable band-pass with a per-sample cutoff (Hz)."""
    out = np.empty_like(x)
    low = band = 0.0
    damp = 1.0 / q
    f = 2.0 * np.sin(np.pi * np.clip(cutoff, 20.0, SAMPLE_RATE / 6.0) / SAMPLE_RATE)
    for i in range(len(x)):
        fi = f[i]
        low += fi * band
        high = x[i] - low - damp * band
        band += fi * high
        out[i] = band
    return out


def _svf_lowpass(x: np.ndarray, cutoff: np.ndarray, q: float = 0.707) -> np.ndarray:
    out = np.empty_like(x)
    low = band = 0.0
    damp = 1.0 / q
    f = 2.0 * np.sin(np.pi * np.clip(cutoff, 20.0, SAMPLE_RATE / 6.0) / SAMPLE_RATE)
    for i in range(len(x)):
        fi = f[i]
        low += fi * band
        high = x[i] - low - damp * band
        band += fi * high
        out[i] = low
    return out


def _env_ad(n: int, attack: float, decay_tau: float, curve: float = 1.0) -> np.ndarray:
    t = np.arange(n) / SAMPLE_RATE
    a = np.clip(t / max(attack, 1e-4), 0.0, 1.0) ** curve
    d = np.exp(-np.maximum(t - attack, 0.0) / decay_tau)
    return a * d


def _sine_sweep(t: np.ndarray, f0: float, f1: float, shape: float = 1.0) -> np.ndarray:
    """Sine with instantaneous frequency moving f0 -> f1 across t."""
    p = (t / t[-1]) ** shape
    freq = f0 * (f1 / f0) ** p
    phase = np.cumsum(freq) / SAMPLE_RATE * TWO_PI
    return np.sin(phase)


def _smooth_noise(rng: np.random.Generator, n: int, rate_hz: float) -> np.ndarray:
    """Slow random control signal in [0, 1]."""
    points = max(4, int(n / SAMPLE_RATE * rate_hz) + 4)
    knots = rng.random(points)
    xp = np.linspace(0, n, points)
    return np.interp(np.arange(n), xp, knots)


def _stereo(mono: np.ndarray, width: float = 0.0, decorrelate_ms: float = 11.0) -> np.ndarray:
    """Centre-panned mono, optionally widened with a short-delayed side signal."""
    if width <= 0:
        return np.stack([mono, mono], axis=1)
    d = int(decorrelate_ms * SAMPLE_RATE / 1000)
    side = np.concatenate([np.zeros(d), mono[:-d]]) * width * 0.5
    mid = mono * (1 - width * 0.5)
    return np.stack([mid + side, mid - side], axis=1)


def _stereo_pair(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.stack([left, right], axis=1)


def _make_loopable(x: np.ndarray, fade_s: float = 0.5) -> np.ndarray:
    """Crossfade the tail into the head so the asset loops without a click.

    The result is fade_s shorter than the input; its last sample flows
    continuously into its first.
    """
    n = int(fade_s * SAMPLE_RATE)
    out = x[:-n].copy()
    ramp = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
    if x.ndim == 2:
        ramp = ramp[:, None]
    out[:n] = x[:n] * ramp + x[-n:] * (1 - ramp)
    return out


def _fade_edges(x: np.ndarray, fade_in_s: float = 0.003, fade_out_s: float = 0.02) -> np.ndarray:
    n_in = max(1, int(fade_in_s * SAMPLE_RATE))
    n_out = max(1, int(fade_out_s * SAMPLE_RATE))
    env = np.ones(len(x))
    env[:n_in] = np.linspace(0, 1, n_in)
    env[-n_out:] *= np.linspace(1, 0, n_out)
    return x * (env[:, None] if x.ndim == 2 else env)


def _normalize_peak(x: np.ndarray, peak_dbfs: float = -1.0) -> np.ndarray:
    peak = np.max(np.abs(x))
    if peak == 0:
        return x
    return x * (10 ** (peak_dbfs / 20) / peak)


# --------------------------------------------------------------------------
# Effects
# --------------------------------------------------------------------------


def amb_campus_day(rng: np.random.Generator) -> np.ndarray:
    """Sunny campus: soft breeze bed with sparse synthetic bird chirps."""
    dur = 8.0
    n = int(dur * SAMPLE_RATE)
    breeze_l = _lowpass_static(_pink(rng, n), 900.0)
    breeze_r = _lowpass_static(_pink(rng, n), 900.0)
    sway = 0.6 + 0.4 * _smooth_noise(rng, n, 0.7)
    breeze_l *= sway / np.max(np.abs(breeze_l))
    breeze_r *= sway / np.max(np.abs(breeze_r))

    birds_l = np.zeros(n)
    birds_r = np.zeros(n)
    t_chirp = _t(0.09)
    for _ in range(16):
        start = int(rng.uniform(0.3, dur - 0.9) * SAMPLE_RATE)
        f0 = rng.uniform(2600, 4200)
        pan = rng.uniform(0.15, 0.85)
        for k in range(int(rng.integers(2, 5))):
            chirp = _sine_sweep(t_chirp, f0, f0 * rng.uniform(1.25, 1.6), 0.7)
            chirp *= np.sin(np.linspace(0, np.pi, len(t_chirp))) ** 2
            s = start + k * int(0.12 * SAMPLE_RATE)
            e = min(n, s + len(chirp))
            amp = rng.uniform(0.08, 0.18)
            birds_l[s:e] += chirp[: e - s] * amp * (1 - pan)
            birds_r[s:e] += chirp[: e - s] * amp * pan

    out = _stereo_pair(breeze_l * 0.35 + birds_l, breeze_r * 0.35 + birds_r)
    return _normalize_peak(_make_loopable(out, 0.6), -6.0)


def amb_winter_wind(rng: np.random.Generator) -> np.ndarray:
    """Cold gusting wind with a whistling resonance, for snowy destinations."""
    dur = 8.0
    n = int(dur * SAMPLE_RATE)
    gust = 0.35 + 0.65 * _smooth_noise(rng, n, 0.9) ** 1.5
    chans = []
    for _ in range(2):
        body = _lowpass_static(_pink(rng, n), 1400.0)
        body /= np.max(np.abs(body))
        whistle_cut = 500.0 + 900.0 * _smooth_noise(rng, n, 0.6)
        whistle = _svf_bandpass(_white(rng, n), whistle_cut, q=9.0)
        whistle /= np.max(np.abs(whistle))
        chans.append((body * 0.8 + whistle * 0.25) * gust)
    out = _stereo_pair(*chans)
    return _normalize_peak(_make_loopable(out, 0.6), -6.0)


def amb_map_air(rng: np.random.Generator) -> np.ndarray:
    """High-altitude air bed for the map / route shots."""
    dur = 6.0
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    chans = []
    for detune in (0.0, 0.7):
        air = _lowpass_static(_pink(rng, n), 600.0)
        air /= np.max(np.abs(air))
        drone = 0.25 * np.sin(TWO_PI * (55.0 + detune) * t) + 0.12 * np.sin(TWO_PI * (110.0 + detune) * t)
        chans.append(air * 0.7 + drone)
    out = _stereo_pair(*chans)
    return _normalize_peak(_make_loopable(out, 0.5), -6.0)


def crowd_murmur(rng: np.random.Generator) -> np.ndarray:
    """Unintelligible student crowd walla built from formant-filtered noise."""
    dur = 6.0
    n = int(dur * SAMPLE_RATE)
    chans = [np.zeros(n), np.zeros(n)]
    for _ in range(14):
        formant = rng.uniform(350, 1100) * (1 + 0.15 * (_smooth_noise(rng, n, 3.0) - 0.5))
        voice = _svf_bandpass(_white(rng, n), formant, q=4.0)
        syllables = np.clip(np.sin(TWO_PI * rng.uniform(3.0, 5.5) * np.arange(n) / SAMPLE_RATE
                                   + rng.uniform(0, TWO_PI)), 0, 1) ** 2
        phrase = (_smooth_noise(rng, n, 0.8) > 0.4).astype(float)
        phrase = _lowpass_static(phrase, 8.0)
        voice = voice / np.max(np.abs(voice)) * syllables * phrase
        pan = rng.uniform(0.1, 0.9)
        chans[0] += voice * (1 - pan)
        chans[1] += voice * pan
    out = _stereo_pair(*chans)
    return _normalize_peak(_make_loopable(out, 0.5), -6.0)


def mv_rumble_lift(rng: np.random.Generator) -> np.ndarray:
    """Ground-shaking rumble that swells as a campus tears loose and rises."""
    dur = 1.8
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    swell = (t / dur) ** 1.6
    rumble = _lowpass_static(_brown(rng, n), 180.0)
    rumble /= np.max(np.abs(rumble))
    sub = _sine_sweep(t + 1e-6, 38.0, 62.0, 1.0)
    creak_cut = 220.0 + 260.0 * (t / dur)
    creak = _svf_bandpass(_white(rng, n), creak_cut, q=14.0)
    creak_gate = np.clip(_lowpass_static((_smooth_noise(rng, n, 9.0) > 0.55).astype(float), 25.0), 0, 1)
    creak = creak / np.max(np.abs(creak)) * creak_gate
    # Falling grit: sparse soft grains, each a few ms long, kept below 4 kHz.
    grains = (rng.random(n) > 0.9994).astype(float)
    grains = np.convolve(grains, np.hanning(int(0.004 * SAMPLE_RATE)), mode="same")
    debris = _lowpass_static(grains * _white(rng, n), 4000.0) * 3.0
    mono = (rumble * 0.8 + sub * 0.5 + creak * 0.18 + debris) * swell
    tail = np.ones(n)
    tail[-int(0.15 * SAMPLE_RATE):] = np.linspace(1, 0, int(0.15 * SAMPLE_RATE))
    return _normalize_peak(_stereo(mono * tail, 0.6), -1.0)


def _whoosh(rng: np.random.Generator, dur: float, peak_at: float, f_lo: float, f_hi: float,
            rising: bool) -> np.ndarray:
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    # Amplitude: exponential swell into the peak, quicker fall after it.
    amp = np.where(t < peak_at, np.exp((t - peak_at) / (peak_at / 3.0)),
                   np.exp(-(t - peak_at) / ((dur - peak_at) / 3.5)))
    p = np.clip(t / dur, 0, 1)
    cut = f_lo * (f_hi / f_lo) ** (p if rising else 1 - p)
    chans = []
    for side in (0, 1):
        noise = _white(rng, n)
        band = _svf_bandpass(noise, cut * (1.0 + 0.04 * side), q=1.6)
        chans.append(band / np.max(np.abs(band)) * amp)
    # Pan from one side to the other across the peak for movement.
    sweep = np.clip((t - peak_at) / (dur * 0.5) + 0.5, 0, 1)
    left = chans[0] * np.cos(sweep * np.pi / 2) * 1.2
    right = chans[1] * np.sin(sweep * np.pi / 2) * 1.2
    return _normalize_peak(_fade_edges(_stereo_pair(left, right), 0.002, 0.05), -1.0)


def tr_whoosh_up(rng: np.random.Generator) -> np.ndarray:
    """Rising transition whoosh. Its loudest point is SYNC_POINTS['tr_whoosh_up']."""
    return _whoosh(rng, 1.0, 0.62, 300.0, 5200.0, rising=True)


def tr_whoosh_down(rng: np.random.Generator) -> np.ndarray:
    """Falling transition whoosh for zooming back to the ground."""
    return _whoosh(rng, 1.0, 0.55, 250.0, 4200.0, rising=False)


def mv_flight_swoosh(rng: np.random.Generator) -> np.ndarray:
    """Long airborne pass: a slow filtered sweep with doppler-like pitch drift."""
    dur = 3.0
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    env = np.sin(np.pi * t / dur) ** 1.5
    cut = 400.0 + 1800.0 * np.sin(np.pi * t / dur) ** 2
    chans = []
    for side in (0, 1):
        band = _svf_bandpass(_white(rng, n), cut * (1 + 0.03 * side), q=1.2)
        chans.append(band / np.max(np.abs(band)))
    hum = _sine_sweep(t + 1e-6, 140.0, 95.0, 1.0) * 0.35
    pan = t / dur
    left = (chans[0] + hum) * env * np.cos(pan * np.pi / 2)
    right = (chans[1] + hum) * env * np.sin(pan * np.pi / 2)
    return _normalize_peak(_fade_edges(_stereo_pair(left, right), 0.01, 0.1), -1.0)


def arr_impact_snow(rng: np.random.Generator) -> np.ndarray:
    """Heavy landing: sub thump, body crunch, and a puff of displaced snow."""
    dur = 1.6
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    thump = _sine_sweep(t + 1e-6, 95.0, 34.0, 0.25) * _env_ad(n, 0.003, 0.22)
    crunch = _lowpass_static(_white(rng, n), 1800.0)
    crunch = crunch / np.max(np.abs(crunch)) * _env_ad(n, 0.001, 0.06)
    puff_cut = 3000.0 * np.exp(-t / 0.5) + 400.0
    puff_l = _svf_bandpass(_white(rng, n), puff_cut, q=0.9)
    puff_r = _svf_bandpass(_white(rng, n), puff_cut * 1.05, q=0.9)
    puff_env = _env_ad(n, 0.02, 0.35)
    mono = thump * 1.0 + crunch * 0.45
    left = mono + puff_l / np.max(np.abs(puff_l)) * puff_env * 0.35
    right = mono + puff_r / np.max(np.abs(puff_r)) * puff_env * 0.35
    return _normalize_peak(_fade_edges(_stereo_pair(left, right), 0.0005, 0.2), -1.0)


def arr_shimmer(rng: np.random.Generator) -> np.ndarray:
    """Bright arrival sparkle: a short cluster of bell partials."""
    dur = 1.6
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    notes = [1046.5, 1318.5, 1568.0, 2093.0]  # C6 E6 G6 C7
    chans = [np.zeros(n), np.zeros(n)]
    for i, f in enumerate(notes):
        delay = i * 0.045
        tt = np.maximum(t - delay, 0)
        bell = (np.sin(TWO_PI * f * tt) + 0.4 * np.sin(TWO_PI * f * 2.76 * tt)) * np.exp(-tt / 0.35)
        bell *= (t >= delay)
        pan = 0.25 + 0.5 * i / (len(notes) - 1)
        chans[0] += bell * (1 - pan)
        chans[1] += bell * pan
    return _normalize_peak(_fade_edges(_stereo_pair(*chans), 0.001, 0.2), -1.0)


def dis_poof(rng: np.random.Generator) -> np.ndarray:
    """Disappearance: reversed swell that snaps off into a tiny pop."""
    dur = 0.9
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    swell = np.exp((t - 0.8) / 0.18) * (t < 0.8)
    cut = 600.0 * (5000.0 / 600.0) ** np.clip(t / 0.8, 0, 1)
    chans = []
    for side in (0, 1):
        band = _svf_bandpass(_white(rng, n), cut * (1 + 0.05 * side), q=1.4)
        chans.append(band / np.max(np.abs(band)) * swell)
    pop = _sine_sweep(_t(0.1) + 1e-6, 900.0, 300.0, 0.5) * _env_ad(int(0.1 * SAMPLE_RATE), 0.001, 0.02)
    s = int(0.8 * SAMPLE_RATE)
    for ch in chans:
        ch[s:s + len(pop)] += pop[: n - s] * 0.8
    return _normalize_peak(_fade_edges(_stereo_pair(*chans), 0.01, 0.02), -1.0)


def imp_hit_low(rng: np.random.Generator) -> np.ndarray:
    """Short punchy low hit for emphasis on a reveal or a number landing."""
    dur = 0.8
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    body = _sine_sweep(t + 1e-6, 150.0, 45.0, 0.2) * _env_ad(n, 0.002, 0.14)
    click = _highpass_static(_white(rng, n), 1500.0) * _env_ad(n, 0.0005, 0.008)
    mono = body + click * 0.3
    return _normalize_peak(_fade_edges(_stereo(mono), 0.0005, 0.1), -1.0)


def ui_caption_pop(rng: np.random.Generator) -> np.ndarray:
    """Soft, low-key pop under each new caption card."""
    dur = 0.12
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    blip = _sine_sweep(t + 1e-6, 1250.0, 620.0, 0.4) * _env_ad(n, 0.002, 0.025)
    return _normalize_peak(_fade_edges(_stereo(blip), 0.0005, 0.02), -1.0)


def ui_counter_tick(rng: np.random.Generator) -> np.ndarray:
    """Tiny mechanical tick for metric counters."""
    dur = 0.04
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    tick = np.sin(TWO_PI * 3100.0 * t) * _env_ad(n, 0.0003, 0.004)
    tick += _highpass_static(_white(rng, n), 4000.0) * _env_ad(n, 0.0002, 0.002) * 0.4
    return _normalize_peak(_fade_edges(_stereo(tick), 0.0002, 0.005), -1.0)


def stinger_surprise(rng: np.random.Generator) -> np.ndarray:
    """Two-note rising "wait, what?" plucked sting for a character reaction."""
    dur = 0.9
    n = int(dur * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    out = np.zeros(n)
    for start, f in ((0.0, 523.25), (0.14, 783.99)):  # C5 then G5
        tt = np.maximum(t - start, 0)
        tone = sum(np.sin(TWO_PI * f * h * tt) / h ** 1.4 for h in (1, 2, 3, 4))
        out += tone * np.exp(-tt / 0.22) * (t >= start)
    return _normalize_peak(_fade_edges(_stereo(out, 0.4), 0.001, 0.15), -1.0)


# --------------------------------------------------------------------------
# Registry
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class SoundDesign:
    asset_id: str
    category: str
    description: str
    generator: Callable[[np.random.Generator], np.ndarray]
    seed: int
    loopable: bool = False
    # Seconds into the asset where the audible "hit" lands. A cue's syncFrame
    # is placed on this point, so a whoosh peaks exactly on the picture cut.
    sync_point_s: float = 0.0


SOUND_DESIGNS: tuple[SoundDesign, ...] = (
    SoundDesign("amb_campus_day", "ambience", "Sunny campus breeze with sparse birdsong.", amb_campus_day, 1101, loopable=True),
    SoundDesign("amb_winter_wind", "ambience", "Cold gusting wind with a whistle, for snowy scenes.", amb_winter_wind, 1102, loopable=True),
    SoundDesign("amb_map_air", "ambience", "High-altitude air and low drone for map shots.", amb_map_air, 1103, loopable=True),
    SoundDesign("crowd_murmur", "crowd", "Unintelligible student crowd walla.", crowd_murmur, 1201, loopable=True),
    SoundDesign("mv_rumble_lift", "movement", "Rumble and creak swelling as a campus lifts off.", mv_rumble_lift, 1301),
    SoundDesign("mv_flight_swoosh", "movement", "Long airborne pass with slow doppler drift.", mv_flight_swoosh, 1302),
    SoundDesign("tr_whoosh_up", "transition", "Rising whoosh; peak lands on the cut.", tr_whoosh_up, 1401, sync_point_s=0.62),
    SoundDesign("tr_whoosh_down", "transition", "Falling whoosh for zooming back to ground.", tr_whoosh_down, 1402, sync_point_s=0.55),
    SoundDesign("arr_impact_snow", "arrival", "Heavy landing thump with a snow puff.", arr_impact_snow, 1501),
    SoundDesign("arr_shimmer", "arrival", "Bright bell sparkle for a reveal.", arr_shimmer, 1502),
    SoundDesign("dis_poof", "disappearance", "Reverse swell that snaps off into a pop.", dis_poof, 1601, sync_point_s=0.8),
    SoundDesign("imp_hit_low", "impact", "Short punchy low hit for emphasis.", imp_hit_low, 1701),
    SoundDesign("ui_caption_pop", "ui", "Soft pop under a new caption card.", ui_caption_pop, 1801),
    SoundDesign("ui_counter_tick", "ui", "Tiny tick for metric counters.", ui_counter_tick, 1802),
    SoundDesign("stinger_surprise", "stinger", "Two-note rising sting for a surprised reaction.", stinger_surprise, 1901),
) + tuple(SoundDesign(asset_id, category, description, generator, seed, sync_point_s=sync)
          for asset_id, category, description, generator, seed, sync in SCENE_EFFECTS) + (
    SoundDesign("music_degree_pulse", "music", "Quiet warm four-chord educational underscore with a gentle pulse; seamless 12-second loop.", degree_pulse, 2026, loopable=True),
    SoundDesign("music_boston_sunrise", "music", "Original 72-second warm chamber/electronic score, developing from intimate workshop to an optimistic sunlit harbor.", boston_sunrise, 1885),
)


def render_design(design: SoundDesign) -> np.ndarray:
    rng = np.random.default_rng(design.seed)
    audio = design.generator(rng)
    assert audio.ndim == 2 and audio.shape[1] == 2, design.asset_id
    return np.clip(audio, -1.0, 1.0)
