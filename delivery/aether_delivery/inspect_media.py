"""Final-media inspection for finished AETHER Shorts.

Runs FFprobe and FFmpeg against one finished MP4 and checks it against the
single delivery format in TECHNICAL_PLAN.md ("Export" and "Audio"):

- H.264 video, 1080 x 1920, 9:16, constant 30 fps, yuv420p, BT.709 tags
- exact frame count (when the ProductionSpec's totalFrames is known)
- 45-75 second runtime
- AAC stereo audio at 48 kHz
- fast-start (moov atom before mdat)
- about -16 LUFS integrated, true peak at or below -1 dBTP

Every check is reported, pass or fail, so a reviewer can see what was checked.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass, field
from fractions import Fraction
from pathlib import Path

WIDTH = 1080
HEIGHT = 1920
FPS = Fraction(30, 1)
MIN_SECONDS = 45.0
MAX_SECONDS = 75.0
AUDIO_RATE = 48000
AUDIO_CHANNELS = 2
TARGET_LUFS = -16.0
LUFS_TOLERANCE = 1.5
MAX_TRUE_PEAK_DBTP = -1.0


@dataclass
class Check:
    id: str
    ok: bool
    expected: str
    actual: str
    severity: str = "error"  # "error" blocks hand-off, "warning" needs a human look


@dataclass
class InspectionReport:
    path: str
    checks: list[Check] = field(default_factory=list)
    probe_summary: dict = field(default_factory=dict)

    @property
    def errors(self) -> list[Check]:
        return [c for c in self.checks if not c.ok and c.severity == "error"]

    @property
    def warnings(self) -> list[Check]:
        return [c for c in self.checks if not c.ok and c.severity == "warning"]

    @property
    def passed(self) -> bool:
        return not self.errors

    def add(self, id: str, ok: bool, expected, actual, severity: str = "error") -> None:
        self.checks.append(Check(id, bool(ok), str(expected), str(actual), severity))

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "passed": self.passed,
            "errorCount": len(self.errors),
            "warningCount": len(self.warnings),
            "checks": [asdict(c) for c in self.checks],
            "probe": self.probe_summary,
        }

    def to_markdown(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        lines = [
            f"# Final-media inspection: {status}",
            "",
            f"File: `{Path(self.path).name}`",
            "",
            "| Check | Result | Expected | Actual |",
            "|---|---|---|---|",
        ]
        for c in self.checks:
            mark = "ok" if c.ok else ("FAIL" if c.severity == "error" else "warn")
            lines.append(f"| {c.id} | {mark} | {c.expected} | {c.actual} |")
        return "\n".join(lines) + "\n"


def _require_tools() -> None:
    for tool in ("ffprobe", "ffmpeg"):
        if shutil.which(tool) is None:
            raise RuntimeError(f"{tool} was not found on PATH")


def _ffprobe(path: Path) -> dict:
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-count_packets",
            "-show_format", "-show_streams", "-of", "json", str(path),
        ],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)


def _loudness(path: Path) -> dict | None:
    """Measure integrated loudness and true peak with FFmpeg's loudnorm analysis pass."""
    proc = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn",
            "-af", f"loudnorm=I={TARGET_LUFS}:TP={MAX_TRUE_PEAK_DBTP}:print_format=json",
            "-f", "null", "-",
        ],
        capture_output=True, text=True,
    )
    match = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", proc.stderr, re.S)
    if not match:
        return None
    data = json.loads(match.group(0))
    return {"integratedLufs": float(data["input_i"]), "truePeakDbtp": float(data["input_tp"])}


def _moov_before_mdat(path: Path) -> bool | None:
    """Walk top-level MP4 atoms; fast-start files place moov before mdat."""
    with path.open("rb") as fh:
        while True:
            header = fh.read(8)
            if len(header) < 8:
                return None
            size = int.from_bytes(header[:4], "big")
            kind = header[4:8]
            if kind == b"moov":
                return True
            if kind == b"mdat":
                return False
            if size == 1:
                size = int.from_bytes(fh.read(8), "big")
                fh.seek(size - 16, 1)
            elif size == 0:
                return None
            else:
                fh.seek(size - 8, 1)


def _frac(value: str | None) -> Fraction | None:
    if not value or value in ("0/0", "N/A"):
        return None
    return Fraction(value)


def inspect_video(
    path: str | Path, expected_frames: int | None = None, *, target_lufs: float = TARGET_LUFS
) -> InspectionReport:
    """Inspect a finished Short. ``expected_frames`` is the ProductionSpec's totalFrames."""
    _require_tools()
    path = Path(path)
    report = InspectionReport(path=str(path))
    if not path.is_file():
        report.add("file_exists", False, "readable file", "missing")
        return report

    probe = _ffprobe(path)
    fmt = probe.get("format", {})
    streams = probe.get("streams", [])
    videos = [s for s in streams if s.get("codec_type") == "video"]
    audios = [s for s in streams if s.get("codec_type") == "audio"]

    report.add("container_mp4", "mp4" in fmt.get("format_name", ""), "mp4", fmt.get("format_name"))
    report.add("one_video_stream", len(videos) == 1, 1, len(videos))
    report.add("one_audio_stream", len(audios) == 1, 1, len(audios))

    duration = float(fmt.get("duration", 0) or 0)
    report.add(
        "runtime_45_to_75s", MIN_SECONDS <= duration <= MAX_SECONDS,
        f"{MIN_SECONDS:.0f}-{MAX_SECONDS:.0f} s", f"{duration:.3f} s",
    )

    if videos:
        v = videos[0]
        w, h = v.get("width"), v.get("height")
        report.add("video_codec_h264", v.get("codec_name") == "h264", "h264", v.get("codec_name"))
        report.add("resolution_1080x1920", (w, h) == (WIDTH, HEIGHT), f"{WIDTH}x{HEIGHT}", f"{w}x{h}")
        sar = v.get("sample_aspect_ratio", "1:1")
        report.add("square_pixels", sar in ("1:1", "0:1", None), "1:1", sar)
        dar = Fraction(w, h) if w and h else None
        report.add("aspect_9_16", dar == Fraction(9, 16), "9:16", f"{dar.numerator}:{dar.denominator}" if dar else "?")
        r_rate, avg_rate = _frac(v.get("r_frame_rate")), _frac(v.get("avg_frame_rate"))
        report.add(
            "constant_30fps", r_rate == FPS and avg_rate == FPS,
            "30/1 (r and avg)", f"r={v.get('r_frame_rate')} avg={v.get('avg_frame_rate')}",
        )
        report.add("pixel_format_yuv420p", v.get("pix_fmt") == "yuv420p", "yuv420p", v.get("pix_fmt"))
        tags = {k: v.get(k) for k in ("color_primaries", "color_transfer", "color_space")}
        report.add(
            "bt709_color_tags", all(t == "bt709" for t in tags.values()),
            "bt709/bt709/bt709", "/".join(str(t) for t in tags.values()),
        )
        frames = int(v.get("nb_read_packets") or v.get("nb_frames") or 0)
        if expected_frames is not None:
            report.add("exact_frame_count", frames == expected_frames, expected_frames, frames)
        else:
            report.add(
                "exact_frame_count", False, "totalFrames from ProductionSpec",
                f"{frames} (not compared)", severity="warning",
            )
        expected_duration = frames / float(FPS) if frames else 0
        report.add(
            "duration_matches_frames", abs(duration - expected_duration) <= 0.1,
            f"{expected_duration:.3f} s +/-0.1", f"{duration:.3f} s",
        )
        report.probe_summary["video"] = {
            "codec": v.get("codec_name"), "profile": v.get("profile"), "width": w, "height": h,
            "fps": v.get("r_frame_rate"), "pixFmt": v.get("pix_fmt"), "frames": frames,
            "bitRate": v.get("bit_rate"), **tags,
        }

    if audios:
        a = audios[0]
        rate, channels = int(a.get("sample_rate", 0)), a.get("channels")
        report.add("audio_codec_aac", a.get("codec_name") == "aac", "aac", a.get("codec_name"))
        report.add("audio_48khz", rate == AUDIO_RATE, AUDIO_RATE, rate)
        report.add("audio_stereo", channels == AUDIO_CHANNELS, AUDIO_CHANNELS, channels)
        report.probe_summary["audio"] = {"codec": a.get("codec_name"), "sampleRate": rate, "channels": channels}

        loud = _loudness(path)
        if loud is None:
            report.add("loudness_measured", False, "loudnorm analysis", "could not parse")
        else:
            i, tp = loud["integratedLufs"], loud["truePeakDbtp"]
            report.add(
                "integrated_loudness", abs(i - target_lufs) <= LUFS_TOLERANCE,
                f"{target_lufs} LUFS +/-{LUFS_TOLERANCE}", f"{i} LUFS", severity="warning",
            )
            report.add("true_peak", tp <= MAX_TRUE_PEAK_DBTP, f"<= {MAX_TRUE_PEAK_DBTP} dBTP", f"{tp} dBTP")
            report.probe_summary["loudness"] = loud

    faststart = _moov_before_mdat(path)
    report.add("faststart_moov_first", faststart is True, "moov before mdat", faststart)
    report.probe_summary["format"] = {
        "formatName": fmt.get("format_name"), "duration": duration,
        "sizeBytes": int(fmt.get("size", 0) or 0), "bitRate": fmt.get("bit_rate"),
    }
    return report
