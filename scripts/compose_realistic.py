"""Compose a photoreal-stills Short: camera moves, word-by-word captions, narrator, SFX.

Usage:
  uv run python scripts/compose_realistic.py content/v01_stanford_boston/realistic_plan.json \
      --assets DIR --out DIR

DIR (assets) holds <shot id>.(png|jpg|webp) stills and voice/<shot id>.(wav|mp3) narration.
Missing stills fall back to a grey placeholder so the timing can be previewed.
Output: visual.mkv (lossless sRGB), mix.wav, short.mp4 (via aether_audio.encode),
delivery-report.json (via aether_delivery).
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "audio"))
sys.path.insert(0, str(ROOT / "delivery"))

W, H, FPS, SR = 1080, 1920, 30, 48_000
FONT_DIR = Path("/usr/share/fonts/opentype/inter")
FONT_BLACK = FONT_DIR / "InterDisplay-Black.otf"
FONT_BOLD = FONT_DIR / "Inter-Bold.otf"
YELLOW = (255, 216, 77)
CAPTION_Y = 1230  # centre of caption block; clear of Shorts UI at the bottom
XFADE = 8  # frames of cross-dissolve between shots


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size)


def ease(t: float) -> float:
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def find(directory: Path, stem: str, exts: tuple[str, ...]) -> Path | None:
    for ext in exts:
        p = directory / f"{stem}{ext}"
        if p.is_file():
            return p
    return None


# ---------------------------------------------------------------- pictures


def load_still(assets: Path, shot_id: str, label: str) -> Image.Image:
    p = find(assets, shot_id, (".png", ".jpg", ".jpeg", ".webp"))
    if p is None:
        img = Image.new("RGB", (W, H), (70, 74, 80))
        d = ImageDraw.Draw(img)
        d.text((60, 200), f"MISSING STILL\n{label}", font=font(FONT_BOLD, 48), fill="white")
        return img
    img = Image.open(p).convert("RGB")
    # cover-fit to 9:16 at 1.25x so camera moves never reveal an edge
    scale = max(W * 1.25 / img.width, H * 1.25 / img.height)
    return img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)


def camera(img: Image.Image, motion: str, t: float, local_frame: int) -> Image.Image:
    """Crop a W×H window from img according to a named move; t in [0,1]."""
    e = ease(t)
    iw, ih = img.size
    zoom = 1.0  # 1.0 = window is 1/1.25 of the oversized image
    cx, cy = 0.5, 0.5
    if motion in ("push_in", "push_in_shake"):
        zoom = 1.0 + 0.12 * e
    elif motion in ("pull_out", "zoom_out_slow"):
        zoom = 1.14 - 0.14 * e
    elif motion == "pan_up":
        cy = 0.58 - 0.16 * e
        zoom = 1.04
    elif motion == "drift_right":
        cx = 0.42 + 0.16 * e
        zoom = 1.04
    elif motion == "drift_left":
        cx = 0.58 - 0.16 * e
        zoom = 1.04
    elif motion == "map_route":
        zoom = 1.0 + 0.05 * e
    # window size in source pixels
    base_w = iw / 1.25
    base_h = ih / 1.25
    win_w = base_w / zoom
    win_h = base_h / zoom
    x0 = cx * iw - win_w / 2
    y0 = cy * ih - win_h / 2
    if motion == "push_in_shake" and local_frame < 24:
        k = (24 - local_frame) / 24
        x0 += math.sin(local_frame * 2.1) * 14 * k
        y0 += math.cos(local_frame * 2.9) * 18 * k
    x0 = min(max(x0, 0), iw - win_w)
    y0 = min(max(y0, 0), ih - win_h)
    return img.transform(
        (W, H), Image.EXTENT, (x0, y0, x0 + win_w, y0 + win_h), Image.BICUBIC
    )


def make_vignette() -> np.ndarray:
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2)
    v = 1.0 - 0.28 * np.clip(r - 0.35, 0, 1) ** 1.5
    # extra darkening behind captions and the top tag for legibility
    band = np.exp(-(((yy - CAPTION_Y) / 230) ** 2)) * 0.22
    return (np.clip(v - band, 0.0, 1.0))[..., None]


# ---------------------------------------------------------------- overlays


def outlined_text(d, xy, text, f, fill, stroke=8, anchor="mm"):
    d.text(xy, text, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0), anchor=anchor)


def draw_tag(d: ImageDraw.ImageDraw, tag: str) -> None:
    f = font(FONT_BOLD, 30)
    label = {"IMAGINED": "IMAGINED", "REAL": "REAL PLACE", "FACT": "REAL NUMBER"}.get(tag, tag)
    color = {"IMAGINED": (235, 87, 87), "REAL": (64, 160, 110), "FACT": (60, 120, 220)}.get(
        tag, (90, 90, 90)
    )
    x0, y0 = 54, 150
    tw = d.textlength(label, font=f)
    d.rounded_rectangle((x0, y0, x0 + tw + 36, y0 + 52), radius=26, fill=(*color, 230))
    d.text((x0 + 18, y0 + 26), label, font=f, fill="white", anchor="lm")


def draw_stamp(img: Image.Image, text: str, lf: int) -> None:
    if lf > 70:
        return
    pop = ease(lf / 6) if lf < 6 else 1.0
    alpha = 1.0 if lf < 55 else max(0.0, 1 - (lf - 55) / 15)
    f = font(FONT_BLACK, round(84 * (1.6 - 0.6 * pop)))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    tw = d.textlength(text, font=f)
    box = (W / 2 - tw / 2 - 30, 330, W / 2 + tw / 2 + 30, 330 + f.size + 40)
    d.rounded_rectangle(box, radius=14, outline=(255, 255, 255, 255), width=7, fill=(200, 30, 45, 210))
    d.text((W / 2, (box[1] + box[3]) / 2), text, font=f, fill="white", anchor="mm")
    layer = layer.rotate(-4, resample=Image.BICUBIC, center=(W / 2, 400))
    if alpha < 1:
        layer.putalpha(layer.getchannel("A").point(lambda a: int(a * alpha)))
    img.alpha_composite(layer)


def draw_counter(d: ImageDraw.ImageDraw, c: dict, t: float, has_stamp: bool) -> None:
    v = c["from"] + (c["to"] - c["from"]) * ease(min(t / 0.7, 1.0))
    text = f"{round(v):,}{c.get('suffix', '')}"
    y = 560 if has_stamp else 420
    outlined_text(d, (W / 2, y), text, font(FONT_BLACK, 150), "white", stroke=10)
    outlined_text(d, (W / 2, y + 110), c["label"], font(FONT_BOLD, 40), "white", stroke=5)


def draw_route(img: Image.Image, route: list[list[float]], t: float) -> None:
    (ax, ay), (bx, by) = [(p[0] * W, p[1] * H) for p in route]
    mx, my = (ax + bx) / 2, min(ay, by) - 260
    prog = ease(min(t / 0.8, 1.0))
    pts = []
    for i in range(0, 101):
        s = i / 100 * prog
        x = (1 - s) ** 2 * ax + 2 * (1 - s) * s * mx + s * s * bx
        y = (1 - s) ** 2 * ay + 2 * (1 - s) * s * my + s * s * by
        pts.append((x, y))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if len(pts) > 1:
        d.line(pts, fill=(255, 70, 70, 255), width=12, joint="curve")
    for (x, y), name in (((ax, ay), "Palo Alto"), ((bx, by), "Boston")):
        d.ellipse((x - 16, y - 16, x + 16, y + 16), fill=(255, 255, 255, 255), outline=(200, 30, 45, 255), width=6)
        outlined_text(d, (x, y + 52), name, font(FONT_BOLD, 40), "white", stroke=5)
    hx, hy = pts[-1]
    d.ellipse((hx - 24, hy - 24, hx + 24, hy + 24), fill=(255, 216, 77, 255), outline=(0, 0, 0, 255), width=4)
    glow = layer.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(glow)
    img.alpha_composite(layer)


# ---------------------------------------------------------------- captions


def word_timings(text: str, start_s: float, dur_s: float) -> list[tuple[str, float, float]]:
    words = text.split()
    weights = [len(w.strip(",.?!:")) + 2 for w in words]
    total = sum(weights)
    out, t = [], start_s
    for w, k in zip(words, weights):
        d = dur_s * k / total
        out.append((w, t, t + d))
        t += d
    return out


def group_words(timed, max_words=3, max_chars=16):
    groups, cur = [], []
    for item in timed:
        trial = " ".join(w for w, *_ in cur + [item])
        if cur and (len(cur) >= max_words or len(trial) > max_chars):
            groups.append(cur)
            cur = []
        cur.append(item)
        if item[0][-1] in ".?!:,":
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    return groups


def draw_caption(img: Image.Image, groups, now: float) -> None:
    active = None
    for g in groups:
        if g[0][1] <= now < g[-1][2] + 0.25:
            active = g
    if active is None:
        return
    f = font(FONT_BLACK, 88)
    fa = font(FONT_BLACK, 96)
    d = ImageDraw.Draw(img)
    space = d.textlength(" ", font=f)
    styled = [(w.upper(), fa if a <= now < b else f, a <= now < b) for w, a, b in active]
    widths = [d.textlength(w, font=ff) for w, ff, _ in styled]
    x = W / 2 - (sum(widths) + space * (len(widths) - 1)) / 2
    appear = min(1.0, (now - active[0][1]) / 0.08)
    y = CAPTION_Y + (1 - appear) * 20
    for (w, ff, on), wd in zip(styled, widths):
        outlined_text(d, (x, y), w, ff, YELLOW if on else "white", stroke=9, anchor="lm")
        x += wd + space


# ---------------------------------------------------------------- audio


def read_audio(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def place(bus: np.ndarray, clip: np.ndarray, at_s: float, gain_db: float = 0.0) -> None:
    i = int(at_s * SR)
    if i >= len(bus):
        return
    n = min(len(clip), len(bus) - i)
    bus[i : i + n] += clip[:n] * (10 ** (gain_db / 20))


def build_mix(plan: dict, assets: Path, total_s: float, out: Path) -> dict:
    voice = np.zeros((int(total_s * SR), 2), np.float32)
    sfx = np.zeros_like(voice)
    lib = ROOT / "audio" / "library" / "sfx"
    timing = {}
    for shot in plan["shots"]:
        s0, s1 = shot["start"] / FPS, shot["end"] / FPS
        vp = find(assets / "voice", shot["id"], (".wav", ".mp3", ".m4a", ".ogg"))
        if vp:
            clip = read_audio(vp)
            # trim leading/trailing silence
            env = np.abs(clip).max(axis=1)
            nz = np.nonzero(env > 0.01)[0]
            if len(nz):
                clip = clip[max(nz[0] - 1200, 0) : nz[-1] + 2400]
            room = s1 - s0 - 0.25
            dur = len(clip) / SR
            if dur > room:  # speed up gently (pitch-preserving) to fit the shot
                tmp = out.parent / f"_fit_{shot['id']}.wav"
                tempo = min(dur / room, 1.6)
                subprocess.run(
                    ["ffmpeg", "-v", "error", "-y", "-i", str(vp), "-af",
                     f"silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                     f"silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo={tempo:.3f}",
                     "-ar", str(SR), "-ac", "2", str(tmp)],
                    check=True,
                )
                clip = read_audio(tmp)
                dur = len(clip) / SR
            at = s0 + 0.12
            place(voice, clip, at)
            timing[shot["id"]] = (at, dur)
        else:
            n = len(shot["narration"].split())
            timing[shot["id"]] = (s0 + 0.12, min(n / 2.6, s1 - s0 - 0.3))
    cues = [
        ("stinger_surprise", 0.0, -14), ("amb_winter_wind", 0.0, -24),
        ("amb_campus_day", 3.0, -24), ("amb_campus_day", 7.4, -24),
        ("mv_rumble_lift", 12.0, -12), ("tr_whoosh_up", 16.6, -14),
        ("mv_flight_swoosh", 17.5, -16), ("arr_impact_snow", 25.2, -10),
        ("amb_winter_wind", 26.0, -22), ("imp_hit_low", 30.0, -12),
        ("amb_winter_wind", 33.0, -22), ("imp_hit_low", 36.0, -12),
        ("tr_whoosh_down", 36.1, -16), ("imp_hit_low", 42.0, -12),
        ("crowd_murmur", 42.3, -20), ("arr_shimmer", 48.0, -18),
        ("tr_whoosh_up", 53.0, -16), ("stinger_surprise", 57.0, -16),
        ("amb_winter_wind", 55.0, -24),
    ]
    for name, at, g in cues:
        p = lib / f"{name}.wav"
        if p.is_file():
            place(sfx, read_audio(p), at, g)
    for shot in plan["shots"]:  # counter ticks
        if "counter" in shot:
            tick = lib / "ui_counter_tick.wav"
            if tick.is_file():
                clip = read_audio(tick)
                for k in range(8):
                    place(sfx, clip, shot["start"] / FPS + 0.15 + k * 0.08, -22)
    # duck SFX under the narrator
    env = np.abs(voice).max(axis=1)
    k = int(0.15 * SR)
    env = np.convolve(env, np.ones(k) / k, mode="same")
    duck = 1.0 - 0.6 * np.clip(env * 8, 0, 1)
    mix = voice + sfx * duck[:, None]
    tmp = out.with_suffix(".raw.wav")
    _write_wav(tmp, mix)
    # loudness-normalise to -16 LUFS / -2 dBTP (two-pass loudnorm)
    meas = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(tmp), "-af",
         "loudnorm=I=-16:TP=-2.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    ).stderr
    j = json.loads(meas[meas.rindex("{") : meas.rindex("}") + 1])
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af",
         f"loudnorm=I=-16:TP=-2.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}"
         f":measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}"
         f":offset={j['target_offset']}:linear=true",
         "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s24le", str(out)],
        check=True,
    )
    tmp.unlink()
    return timing


def _write_wav(path: Path, data: np.ndarray) -> None:
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", str(path)],
        input=pcm.tobytes(), check=True,
    )


# ---------------------------------------------------------------- main


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("plan", type=Path)
    ap.add_argument("--assets", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--frames", help="only render these comma-separated frames as PNG previews")
    args = ap.parse_args()
    plan = json.loads(args.plan.read_text())
    shots = plan["shots"]
    total = shots[-1]["end"]
    args.out.mkdir(parents=True, exist_ok=True)

    timing = build_mix(plan, args.assets, total / FPS, args.out / "mix.wav")
    captions = {
        s["id"]: group_words(word_timings(s.get("caption", s["narration"]), *timing[s["id"]]))
        for s in shots
    }
    stills = {s["id"]: load_still(args.assets, s["id"], s["id"]) for s in shots}
    for s in shots:
        if "imageB" in s:
            stills[s["id"] + "_B"] = stills[s["imageB"]]
    vignette = make_vignette()
    rng = np.random.default_rng(7)
    grain = [rng.normal(0, 4.0, (H // 2, W // 2, 1)).astype(np.float32) for _ in range(6)]

    def shot_frame(s: dict, f: int) -> Image.Image:
        lf = f - s["start"]
        t = lf / max(s["end"] - s["start"] - 1, 1)
        if s["motion"] == "split":
            sunny = camera(stills[s["id"] + "_B"], "push_in", t, lf)
            snowy = camera(stills[s["id"]], "push_in", t, lf)
            img = sunny.copy()
            img.paste(sunny.crop((0, H // 4, W, H * 3 // 4)), (0, 0))
            off = int((1 - ease(min(t / 0.25, 1))) * H / 2)
            img.paste(snowy.crop((0, H // 4, W, H * 3 // 4)), (0, H // 2 + off))
            d = ImageDraw.Draw(img)
            d.rectangle((0, H // 2 + off - 4, W, H // 2 + off + 4), fill="white")
            outlined_text(d, (W / 2, 260), "PALO ALTO", font(FONT_BLACK, 60), "white", 7)
            if off < H / 2 - 120:
                outlined_text(d, (W / 2, H // 2 + off + 80), "BOSTON", font(FONT_BLACK, 60), "white", 7)
            return img
        return camera(stills[s["id"]], s["motion"], t, lf)

    def render(f: int) -> Image.Image:
        idx = next(i for i, s in enumerate(shots) if s["start"] <= f < s["end"])
        s = shots[idx]
        base = shot_frame(s, f)
        if idx > 0 and f - s["start"] < XFADE:  # dissolve from the previous shot
            prev = shot_frame(shots[idx - 1], f)
            base = Image.blend(prev, base, (f - s["start"] + 1) / (XFADE + 1))
        arr = np.asarray(base, dtype=np.float32) * vignette
        g = np.repeat(np.repeat(grain[f % 6], 2, 0), 2, 1)
        arr = np.clip(arr + g, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr).convert("RGBA")
        lf = f - s["start"]
        t = lf / max(s["end"] - s["start"] - 1, 1)
        if s["motion"] == "map_route" and "route" in s:
            draw_route(img, s["route"], t)
        if "stamp" in s:
            draw_stamp(img, s["stamp"], lf)
        d = ImageDraw.Draw(img)
        if "counter" in s:
            draw_counter(d, s["counter"], t, "stamp" in s and lf < 70)
        draw_tag(d, s["tag"])
        draw_caption(img, captions[s["id"]], f / FPS)
        return img.convert("RGB")

    if args.frames:
        for f in map(int, args.frames.split(",")):
            render(f).save(args.out / f"preview-{f:04d}.png")
        return

    visual = args.out / "visual.mkv"
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-c:v", "ffv1", "-level", "3", str(visual)],
        stdin=subprocess.PIPE,
    )
    for f in range(total):
        proc.stdin.write(render(f).tobytes())
        if f % 150 == 0:
            print(f"frame {f}/{total}", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("visual encode failed")

    from aether_audio.encode import encode_short
    from aether_delivery.inspect_media import inspect_video

    short = args.out / "short.mp4"
    encode_short(visual, args.out / "mix.wav", short, total, input_is_srgb=True)
    report = inspect_video(short, expected_frames=total, target_lufs=-16.0).to_dict()
    (args.out / "delivery-report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: report[k] for k in ("passed", "errorCount", "warningCount")}))


if __name__ == "__main__":
    main()
