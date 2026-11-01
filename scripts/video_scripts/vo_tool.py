"""Check and render the narration scripts in this folder.

Each video has one JSON script (vNN_*.json). It holds, per caption cue:
the time window, the on-screen text (copied from the caption track), the
narration line, a delivery note, and the fact ids the line relies on.

Checks:
  - cues are in order, do not overlap, and cover 0 to runtimeSeconds
  - each narration line fits its window when read at SPEECH_WPS, with a
    short pause per sentence break and a safety margin at the end
  - every number spoken or shown appears in the video's fact pack
    (exact or rounded), or is listed in allowedNumbers (round labels etc.)
  - when the caption track exists, the on-screen text and timing match it

Usage:
  python3 scripts/video_scripts/vo_tool.py check [--captions-root DIR] [files...]
  python3 scripts/video_scripts/vo_tool.py render [files...]

With no files it uses every vNN_*.json next to this tool. render writes a
Markdown table (vNN_*.md) beside each JSON file.
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys

SPEECH_WPS = 2.6        # about 156 words a minute, a normal voice-over pace
SENTENCE_PAUSE = 0.2    # seconds added per sentence break inside a line
END_MARGIN = 0.3        # seconds of air left before the next cue
FPS = 30

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")

ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]


def spoken_words_for_int(n: int) -> int:
    """Rough count of words needed to say an integer aloud."""
    if n == 0:
        return 1
    if 1100 <= n <= 2099 and n % 100 != 0:   # years: "eighteen eighty-five"
        return 2
    words = 0
    for scale, size in ((1_000_000_000, 1), (1_000_000, 1), (1_000, 1)):
        if n >= scale:
            words += spoken_words_for_int(n // scale) + size
            n %= scale
    if n >= 100:
        words += 2  # "six hundred"
        n %= 100
    if n:
        words += 1  # "ninety", "fourteen", "forty-nine"
    return words


def spoken_word_count(text: str) -> int:
    count = 0
    for token in text.split():
        m = NUM_RE.search(token)
        if m and any(ch.isdigit() for ch in token):
            raw = m.group(0).replace(",", "")
            whole, _, frac = raw.partition(".")
            count += spoken_words_for_int(int(whole)) + (1 + len(frac) if frac else 0)
        elif re.search(r"[A-Za-z]", token):
            count += 1
    return count


def sentence_breaks(text: str) -> int:
    ends = len(re.findall(r"[.?!…]+(?=\s|$)", text.strip()))
    return max(0, ends - 1)


def speech_seconds(text: str) -> float:
    return spoken_word_count(text) / SPEECH_WPS + SENTENCE_PAUSE * sentence_breaks(text)


def numbers_in(text: str) -> list[float]:
    out = []
    for m in NUM_RE.finditer(text):
        out.append(float(m.group(0).replace(",", "").rstrip(".")))
    return out


def pack_numbers(value) -> list[float]:
    nums: list[float] = []
    if isinstance(value, bool) or value is None:
        return nums
    if isinstance(value, (int, float)):
        nums.append(float(value))
    elif isinstance(value, dict):
        for v in value.values():
            nums += pack_numbers(v)
    elif isinstance(value, list):
        for v in value:
            nums += pack_numbers(v)
    elif isinstance(value, str):
        nums += numbers_in(value)
    return nums


def number_ok(n: float, allowed: list[float]) -> bool:
    for a in allowed:
        if abs(n - a) < 1e-9 or abs(n - round(a)) < 1e-9:
            return True
        # rounding to tens or hundreds is fine for "about" figures
        if a >= 100 and (abs(n - round(a, -1)) < 1e-9 or abs(n - round(a, -2)) < 1e-9):
            return True
    return False


def load(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def check(path: str, captions_root: str | None) -> int:
    script = load(path)
    name = os.path.basename(path)
    problems = 0

    def bad(msg: str) -> None:
        nonlocal problems
        problems += 1
        print(f"  FAIL {msg}")

    pack = load(os.path.join(REPO, script["factPack"]))
    claims = {c["id"]: c for c in pack["claims"]}
    allowed = [float(x) for x in script.get("allowedNumbers", [])]
    pack_nums = []
    for c in pack["claims"]:
        pack_nums += pack_numbers(c.get("value"))
    pack_nums += numbers_in(pack.get("topic", ""))

    runtime = script["runtimeSeconds"]
    cues = script["cues"]
    t = 0.0
    total_words = 0
    for i, cue in enumerate(cues, 1):
        start, end = cue["start"], cue["end"]
        label = f"cue {i} ({start:g}-{end:g}s)"
        if abs(start - t) > 1e-6:
            bad(f"{label}: starts at {start:g}s, expected {t:g}s (gap or overlap)")
        t = end
        window = end - start
        narration = cue.get("narration", "")
        total_words += spoken_word_count(narration)
        need = speech_seconds(narration)
        if narration and need + END_MARGIN > window + 1e-6:
            bad(f"{label}: narration needs ~{need:.1f}s + {END_MARGIN}s margin, window is {window:g}s")
        for fid in cue.get("factIds", []):
            if fid not in claims:
                bad(f"{label}: unknown fact id {fid}")
        for field in ("narration", "onScreen"):
            for n in numbers_in(cue.get(field, "")):
                if not (number_ok(n, pack_nums) or number_ok(n, allowed)):
                    bad(f"{label}: {field} number {n:g} is not in the fact pack or allowedNumbers")
    if abs(t - runtime) > 1e-6:
        bad(f"cues end at {t:g}s, runtime is {runtime}s")

    track_path = None
    if script.get("captionTrack"):
        for root in filter(None, [REPO, captions_root]):
            candidate = os.path.join(root, script["captionTrack"])
            if os.path.exists(candidate):
                track_path = candidate
                break
            alt = os.path.join(root, os.path.basename(os.path.dirname(script["captionTrack"])), "captions.json")
            if os.path.exists(alt):
                track_path = alt
                break
    if track_path:
        track = sorted(load(track_path)["captions"], key=lambda c: c["startFrame"])
        if len(track) != len(cues):
            bad(f"caption track has {len(track)} cues, script has {len(cues)}")
        for i, (cap, cue) in enumerate(zip(track, cues), 1):
            if cap["text"] != cue["onScreen"]:
                bad(f"cue {i}: on-screen text differs from caption track: {cap['text']!r}")
            if abs(cap["startFrame"] / FPS - cue["start"]) > 1e-6 or abs(cap["endFrame"] / FPS - cue["end"]) > 1e-6:
                bad(f"cue {i}: timing differs from caption track")
        src = os.path.relpath(track_path, REPO) if track_path.startswith(REPO) else track_path
        note = f"matched against {src}"
    else:
        note = "caption track not found, on-screen text not cross-checked"

    status = "OK  " if problems == 0 else "FAIL"
    print(f"{status} {name}: {len(cues)} cues, {total_words} spoken words "
          f"(~{total_words / SPEECH_WPS:.0f}s of speech in {runtime}s), {note}")
    return problems


def render(path: str) -> str:
    script = load(path)
    lines = [
        f"# {script['id']} script: {script['title']}",
        "",
        "<!-- Generated from " + os.path.basename(path) + " by vo_tool.py render. Edit the JSON, then re-render. -->",
        "",
        f"- **Runtime:** {script['runtimeSeconds']} s",
        f"- **Narrator:** {script['narrator']}",
        f"- **Fact pack:** `{script['factPack']}`",
    ]
    if script.get("captionTrack"):
        lines.append(f"- **Caption track (on-screen text):** `{script['captionTrack']}`")
    if script.get("basedOn"):
        lines.append(f"- **Based on:** {script['basedOn']}")
    total = sum(spoken_word_count(c.get("narration", "")) for c in script["cues"])
    lines += [f"- **Spoken words:** {total} (about {total / SPEECH_WPS:.0f} s at {SPEECH_WPS} words/s)", ""]
    if script.get("logline"):
        lines += [f"> {script['logline']}", ""]
    lines += [
        "| Time | Beat | On screen | Narration | Delivery | Facts |",
        "|---|---|---|---|---|---|",
    ]
    for cue in script["cues"]:
        secs = speech_seconds(cue.get("narration", ""))
        stamp = f"**{cue['stamp']}** " if cue.get("stamp") else ""
        facts = ", ".join(f"`{f}`" for f in cue.get("factIds", [])) or "imagined"
        lines.append(
            f"| {cue['start']:g}–{cue['end']:g} s | {cue['beat']} | {stamp}{cue['onScreen']} "
            f"| {cue.get('narration', '')} <br>*~{secs:.1f} s* | {cue.get('delivery', '')} | {facts} |"
        )
    lines.append("")
    lines.append("## Voice-over read (plain text)")
    lines.append("")
    lines.append("```text")
    for cue in script["cues"]:
        if cue.get("narration"):
            lines.append(f"[{cue['start']:04.1f}] {cue['narration']}")
    lines.append("```")
    if script.get("notes"):
        lines += ["", "## Notes for the team", ""]
        lines += [f"- {n}" for n in script["notes"]]
    lines.append("")
    out = path[:-5] + ".md"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    return out


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in ("check", "render"):
        print(__doc__)
        return 2
    cmd, rest = argv[0], argv[1:]
    captions_root = None
    if "--captions-root" in rest:
        i = rest.index("--captions-root")
        captions_root = rest[i + 1]
        rest = rest[:i] + rest[i + 2:]
    files = rest or sorted(glob.glob(os.path.join(HERE, "v[0-9][0-9]*.json")))
    if cmd == "render":
        for f in files:
            print("wrote", os.path.relpath(render(f), REPO))
        return 0
    failures = sum(check(f, captions_root) for f in files)
    print(f"\n{len(files)} scripts, {failures} problems")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
