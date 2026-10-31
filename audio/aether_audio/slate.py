"""Sync-check slate video: a stand-in picture when no renderer capture exists.

Each shot gets its own background colour, the frame number is burned in,
and every cue's id flashes on screen for the 3 frames starting at its
syncFrame, so audio/picture alignment can be judged by eye and ear.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from .contracts import SoundCueTrack

SHOT_COLOURS = ("0x1d3b53", "0x8c1515", "0x2f4f2f", "0x4a4a6a", "0x5a3d1e", "0x2b2b2b")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _safe(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9 _.,+-]", " ", text)


def make_slate(plan: dict, track: SoundCueTrack, out_mp4: Path) -> None:
    total = plan["output"]["totalFrames"]
    fps = plan["output"]["fps"]
    filters = []
    for i, shot in enumerate(plan["shots"]):
        colour = SHOT_COLOURS[i % len(SHOT_COLOURS)]
        filters.append(
            f"drawbox=x=0:y=0:w=iw:h=ih:color={colour}:t=fill"
            f":enable='between(n,{shot['startFrame']},{shot['endFrame'] - 1})'"
        )
        filters.append(
            f"drawtext=fontfile={FONT}:text='{_safe(shot['id'])}':fontsize=54:fontcolor=white"
            f":x=(w-tw)/2:y=260:enable='between(n,{shot['startFrame']},{shot['endFrame'] - 1})'"
        )
    for cap in plan.get("captions", []):
        filters.append(
            f"drawtext=fontfile={FONT}:text='{_safe(cap['text'])}':fontsize=40:fontcolor=white"
            f":x=(w-tw)/2:y=1500:enable='between(n,{cap['startFrame']},{cap['endFrame'] - 1})'"
        )
    filters.append(
        f"drawtext=fontfile={FONT}:text='frame %{{frame_num}}':start_number=0:fontsize=120"
        ":fontcolor=white:x=(w-tw)/2:y=820"
    )
    # Stack simultaneous cue labels so they don't overprint each other.
    by_frame: dict[int, int] = {}
    for cue in track.cues:
        row = by_frame.get(cue.sync_frame, 0)
        by_frame[cue.sync_frame] = row + 1
        filters.append(
            f"drawtext=fontfile={FONT}:text='{_safe(cue.id)}':fontsize=44:fontcolor=yellow"
            f":box=1:boxcolor=black@0.6:x=(w-tw)/2:y={1040 + row * 70}"
            f":enable='between(n,{cue.sync_frame},{cue.sync_frame + 2})'"
        )
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-nostdin", "-y",
            "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:r={fps}:d={total / fps}",
            "-vf", ",".join(filters),
            "-frames:v", str(total),
            "-c:v", "libx264", "-crf", "0", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            str(out_mp4),
        ],
        capture_output=True, text=True, check=True,
    )
