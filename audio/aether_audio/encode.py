"""Final Shorts delivery encode and FFprobe/FFmpeg inspection.

Output contract (TECHNICAL_PLAN.md section 4, Export):
H.264 1080x1920, constant 30 fps, 9:16, yuv420p with explicit BT.709
conversion and matching tags, fast-start, AAC stereo 48 kHz, CRF 18.
"""

from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

WIDTH, HEIGHT, FPS = 1080, 1920, 30
CRF = 18
AUDIO_BITRATE = "192k"


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


def _concat_list(chunks: list[Path], directory: Path) -> Path:
    lst = directory / "chunks.txt"
    lst.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in chunks))
    return lst


def resolve_video_inputs(video: Path) -> list[Path]:
    """A single file, or a directory of Patrick's chunk_###.mp4 intermediates."""
    if video.is_dir():
        chunks = sorted(p for p in video.glob("chunk_*.mp4") if not p.name.endswith(".tmp.mp4"))
        if not chunks:
            raise FileNotFoundError(f"no chunk_*.mp4 intermediates in {video}")
        return chunks
    return [video]


def encode_short(video: Path, audio_wav: Path, out_mp4: Path, total_frames: int) -> list[str]:
    """Mux the visual intermediate(s) with the final mix into the delivery MP4."""
    inputs = resolve_video_inputs(video)
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    total_samples = total_frames * 48_000 // FPS
    vf = (
        f"scale=w={WIDTH}:h={HEIGHT}:flags=lanczos+accurate_rnd+full_chroma_int"
        ":out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1"
    )
    with tempfile.TemporaryDirectory() as tmp:
        if len(inputs) > 1:
            video_args = ["-f", "concat", "-safe", "0", "-i", str(_concat_list(inputs, Path(tmp)))]
        else:
            video_args = ["-i", str(inputs[0])]
        cmd = [
            "ffmpeg", "-hide_banner", "-nostdin", "-y",
            *video_args,
            "-i", str(audio_wav),
            "-map", "0:v:0", "-map", "1:a:0",
            "-vf", vf,
            "-r", str(FPS), "-fps_mode", "cfr",
            "-frames:v", str(total_frames),
            "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
            "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-color_range", "tv", "-aspect", "9:16",
            "-af", f"atrim=end_sample={total_samples}",
            "-c:a", "aac", "-b:a", AUDIO_BITRATE, "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart",
            str(out_mp4),
        ]
        _run(cmd)
    return cmd


# --------------------------------------------------------------------------
# Inspection
# --------------------------------------------------------------------------


def _top_level_atoms(path: Path, limit: int = 32) -> list[str]:
    atoms = []
    with open(path, "rb") as f:
        while len(atoms) < limit:
            header = f.read(8)
            if len(header) < 8:
                break
            size = int.from_bytes(header[:4], "big")
            kind = header[4:8].decode("latin-1")
            if size == 1:
                size = int.from_bytes(f.read(8), "big")
                f.seek(size - 16, 1)
            elif size == 0:
                atoms.append(kind)
                break
            else:
                f.seek(size - 8, 1)
            atoms.append(kind)
    return atoms


def measure_loudness(path: Path) -> dict:
    """EBU R128 integrated loudness, LRA, true peak, and momentary series."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(path), "-map", "0:a:0",
         "-af", "ebur128=peak=true:framelog=verbose", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    )
    err = proc.stderr
    summary = err[err.rfind("Summary:"):]

    def grab(label: str) -> float:
        m = re.search(rf"{label}:\s+(-?[\d.]+|-inf)", summary)
        return float("-inf") if not m or m.group(1) == "-inf" else float(m.group(1))

    momentary = [
        (float(t), float(mv))
        for t, mv in re.findall(r"t:\s*([\d.]+)\s+TARGET:.*?M:\s*(-?[\d.]+)", err)
    ]
    return {
        "integratedLufs": grab("I"),
        "loudnessRangeLu": grab("LRA"),
        "truePeakDbtp": grab("Peak"),
        "momentary": momentary,
    }


def find_abrupt_jumps(momentary: list[tuple[float, float]], threshold_lu: float = 12.0,
                      floor_lufs: float = -45.0) -> list[dict]:
    """Momentary-loudness rises sharper than threshold within 100 ms.

    These are flagged for a human to confirm they are intended (an impact on
    a cut) rather than a bad edit. Silence below floor_lufs is ignored.
    """
    jumps = []
    for (t0, m0), (t1, m1) in zip(momentary, momentary[1:]):
        if max(m0, m1) < floor_lufs:
            continue
        delta = m1 - max(m0, floor_lufs)
        if abs(delta) >= threshold_lu:
            jumps.append({"timeSeconds": round(t1, 2), "frame": int(round(t1 * FPS)),
                          "deltaLu": round(delta, 1)})
    return jumps


def inspect_short(mp4: Path, total_frames: int, integrated_target: float = -16.0,
                  true_peak_max: float = -1.0, lufs_tolerance: float = 1.0) -> dict:
    """Check the delivery file against the Shorts contract. Returns a report."""
    probe = json.loads(_run([
        "ffprobe", "-v", "error", "-count_frames", "-show_streams", "-show_format",
        "-of", "json", str(mp4),
    ]).stdout)
    v = next((s for s in probe["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
    checks: list[dict] = []

    def check(name: str, ok: bool, actual, expected) -> None:
        checks.append({"check": name, "pass": bool(ok), "actual": actual, "expected": expected})

    check("has video stream", v is not None, v is not None, True)
    check("has audio stream", a is not None, a is not None, True)
    if v:
        check("video codec", v.get("codec_name") == "h264", v.get("codec_name"), "h264")
        check("dimensions", (v.get("width"), v.get("height")) == (WIDTH, HEIGHT),
              f"{v.get('width')}x{v.get('height')}", f"{WIDTH}x{HEIGHT}")
        check("frame rate", v.get("r_frame_rate") == "30/1" and v.get("avg_frame_rate") == "30/1",
              f"r={v.get('r_frame_rate')} avg={v.get('avg_frame_rate')}", "30/1 constant")
        check("frame count", int(v.get("nb_read_frames", -1)) == total_frames,
              int(v.get("nb_read_frames", -1)), total_frames)
        check("pixel format", v.get("pix_fmt") == "yuv420p", v.get("pix_fmt"), "yuv420p")
        check("display aspect", v.get("display_aspect_ratio") == "9:16",
              v.get("display_aspect_ratio"), "9:16")
        check("sample aspect", v.get("sample_aspect_ratio", "1:1") == "1:1",
              v.get("sample_aspect_ratio"), "1:1")
        tags = {k: v.get(k) for k in ("color_space", "color_primaries", "color_transfer")}
        check("bt709 tags", all(val == "bt709" for val in tags.values()), tags, "bt709")
        check("color range", v.get("color_range") == "tv", v.get("color_range"), "tv")
    if a:
        check("audio codec", a.get("codec_name") == "aac", a.get("codec_name"), "aac")
        check("audio sample rate", a.get("sample_rate") == "48000", a.get("sample_rate"), "48000")
        check("audio channels", a.get("channels") == 2, a.get("channels"), 2)
    atoms = _top_level_atoms(mp4)
    faststart = "moov" in atoms and "mdat" in atoms and atoms.index("moov") < atoms.index("mdat")
    check("fast start (moov before mdat)", faststart, atoms, "moov before mdat")
    duration = float(probe["format"].get("duration", 0))
    expected_dur = total_frames / FPS
    check("duration", abs(duration - expected_dur) <= 1.5 / FPS, round(duration, 4), expected_dur)

    loud = measure_loudness(mp4) if a else None
    if loud:
        check("integrated loudness", abs(loud["integratedLufs"] - integrated_target) <= lufs_tolerance,
              loud["integratedLufs"], f"{integrated_target} ±{lufs_tolerance} LUFS")
        check("true peak", loud["truePeakDbtp"] <= true_peak_max,
              loud["truePeakDbtp"], f"<= {true_peak_max} dBTP")
    jumps = find_abrupt_jumps(loud["momentary"]) if loud else []
    return {
        "file": str(mp4),
        "pass": all(c["pass"] for c in checks),
        "checks": checks,
        "loudness": {k: val for k, val in (loud or {}).items() if k != "momentary"},
        "abruptLoudnessJumps": jumps,
        "fileSizeBytes": mp4.stat().st_size,
    }
