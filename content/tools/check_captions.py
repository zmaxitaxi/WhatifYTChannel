"""Check a caption track against the plan's readability rules.

Rules (TECHNICAL_PLAN.md, "Style and captions"):
  - at most 2.5 words per second of reading load
  - at most two lines at the main caption size
  - cues must not overlap and should cover the whole runtime

Line length is an estimate: 52 px serif on the 810 px safe width
(1080 - 90 left - 180 right) fits about 30 characters per line.
Confirm on a real render before trusting it.

Usage: python3 content/tools/check_captions.py content/v01_stanford_boston/captions.json
"""
import json
import sys

MAX_WPS = 2.5
CHARS_PER_LINE = 30
MAX_LINES = 2


def wrap_lines(text: str, width: int) -> int:
    lines, current = 1, 0
    for word in text.split():
        add = len(word) if current == 0 else len(word) + 1
        if current + add > width and current > 0:
            lines += 1
            current = len(word)
        else:
            current += add
    return lines


def main(path: str) -> int:
    track = json.load(open(path))
    fps, total = track["fps"], track["totalFrames"]
    cues = sorted(track["captions"], key=lambda c: c["startFrame"])
    problems = 0
    prev_end = 0
    for c in cues:
        secs = (c["endFrame"] - c["startFrame"]) / fps
        words = len(c["text"].split())
        wps = words / secs
        lines = wrap_lines(c["text"], CHARS_PER_LINE)
        flags = []
        if wps > MAX_WPS:
            flags.append(f"reading load {wps:.2f} wps > {MAX_WPS}")
        if lines > MAX_LINES:
            flags.append(f"{lines} lines > {MAX_LINES}")
        if c["startFrame"] < prev_end:
            flags.append("overlaps previous cue")
        elif c["startFrame"] > prev_end:
            flags.append(f"gap of {c['startFrame'] - prev_end} frames before cue")
        prev_end = c["endFrame"]
        status = "OK  " if not flags else "FAIL"
        problems += bool(flags)
        print(f"{status} {c['id']:7} {secs:4.1f}s {words:2}w {wps:4.2f}wps {lines}L  {c['text']}"
              + ("  <- " + "; ".join(flags) if flags else ""))
    if prev_end != total:
        print(f"FAIL track ends at frame {prev_end}, runtime is {total}")
        problems += 1
    print(f"\n{len(cues)} cues, {problems} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
