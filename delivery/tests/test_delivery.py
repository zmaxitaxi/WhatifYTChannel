import datetime as dt
import json
import subprocess
from pathlib import Path

import pytest
from pydantic import ValidationError

from aether_delivery.__main__ import main
from aether_delivery.handoff import build_handoff, record_publish
from aether_delivery.inspect_media import inspect_video
from aether_delivery.publish_meta import PublishMetadata, content_checks, render_description

EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "v01_publish.json"
FRAMES = 1350  # 45 s at 30 fps


def _encode(out: Path, *, size="1080x1920", rate=30, seconds=45, faststart=True, pix="yuv420p", audio_rate=48000):
    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-f", "lavfi", "-i", f"color=c=0x334455:s={size}:r={rate}:d={seconds}",
        "-f", "lavfi", "-i", f"sine=frequency=440:sample_rate={audio_rate}:duration={seconds}",
        "-af", "volume=-12dB,aformat=channel_layouts=stereo",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", pix,
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709",
        "-c:a", "aac", "-ar", str(audio_rate), "-ac", "2",
    ]
    if faststart:
        cmd += ["-movflags", "+faststart"]
    subprocess.run(cmd + [str(out)], check=True)
    return out


@pytest.fixture(scope="session")
def good_video(tmp_path_factory):
    return _encode(tmp_path_factory.mktemp("v") / "good.mp4")


@pytest.fixture(scope="session")
def bad_video(tmp_path_factory):
    return _encode(
        tmp_path_factory.mktemp("v") / "bad.mp4",
        size="1920x1080", rate=25, seconds=10, faststart=False, audio_rate=44100,
    )


def _meta(tmp_path, **overrides):
    data = json.loads(EXAMPLE.read_text())
    data.update(overrides)
    p = tmp_path / "meta.json"
    p.write_text(json.dumps(data))
    return p


def _ids(report):
    return {c.id for c in report.errors}


def test_compliant_video_passes_format_checks(good_video):
    report = inspect_video(good_video, expected_frames=FRAMES)
    assert report.passed, report.to_markdown()


def test_frame_count_mismatch_is_an_error(good_video):
    assert "exact_frame_count" in _ids(inspect_video(good_video, expected_frames=FRAMES + 1))


def test_noncompliant_video_reports_each_problem(bad_video):
    errors = _ids(inspect_video(bad_video))
    assert {
        "resolution_1080x1920", "aspect_9_16", "constant_30fps", "runtime_45_to_75s",
        "audio_48khz", "faststart_moov_first",
    } <= errors


def test_missing_file(tmp_path):
    assert "file_exists" in _ids(inspect_video(tmp_path / "nope.mp4"))


def test_example_metadata_is_valid_but_blocked_on_unverified_source():
    meta = PublishMetadata.model_validate_json(EXAMPLE.read_text())
    failed = {r[0] for r in content_checks(meta) if not r[1] and r[4] == "error"}
    assert failed == {"sources_verified"}
    desc = render_description(meta)
    assert "hypothetical scenario" in desc and "Sources:" in desc and "#Shorts" in desc


@pytest.mark.parametrize(
    "field,value",
    [("title", "x" * 101), ("title", "Stanford <3 Boston"), ("hashtags", ["#a b"]), ("hashtags", [f"#t{i}" for i in range(16)])],
)
def test_metadata_rejects_youtube_violations(field, value):
    data = json.loads(EXAMPLE.read_text())
    data[field] = value
    with pytest.raises(ValidationError):
        PublishMetadata.model_validate(data)


def test_handoff_ready_and_record(good_video, tmp_path):
    data = json.loads(EXAMPLE.read_text())
    data["expected_frames"] = FRAMES
    data["sources"][0]["verified"] = True
    meta_path = tmp_path / "meta.json"
    meta_path.write_text(json.dumps(data))

    folder, ready = build_handoff(good_video, meta_path, tmp_path / "out", today=dt.date(2026, 10, 31))
    assert ready
    assert folder.name == "V01_2026-10-31"
    for name in ("V01.mp4", "title.txt", "description.txt", "tags.txt", "HANDOFF.md", "inspection.json", "manifest.json"):
        assert (folder / name).is_file(), name
    assert "READY FOR MANUAL PUBLISHING" in (folder / "HANDOFF.md").read_text()
    manifest = json.loads((folder / "manifest.json").read_text())
    assert manifest["status"] == "ready" and len(manifest["video"]["sha256"]) == 64

    record_publish(folder, "https://youtube.com/shorts/example")
    assert json.loads((folder / "manifest.json").read_text())["published"]["url"].endswith("example")


def test_handoff_blocked_cannot_be_recorded(good_video, tmp_path):
    rc = main(["handoff", str(good_video), str(_meta(tmp_path)), "--out", str(tmp_path / "out"), "--no-copy"])
    assert rc == 1
    folder = next((tmp_path / "out").iterdir())
    text = (folder / "HANDOFF.md").read_text()
    assert "BLOCKED" in text and "sources_verified" in text and "exact_frame_count" in text
    with pytest.raises(ValueError):
        record_publish(folder, "https://youtube.com/shorts/x")
