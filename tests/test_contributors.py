import json
import shutil
import subprocess

import pytest

from aether.contributors import cue_track, load_package


def test_production_sound_adapts_to_francis_contract(spec):
    load_package("aether_audio")
    from aether_audio.contracts import parse_cue_track, require_valid
    from aether_audio.library import load_library

    data = cue_track(spec, "integration-test")
    plan = {
        "jobId": "integration-test",
        "output": {"fps": 30, "totalFrames": spec.output.total_frames},
        "shots": [{"id": shot.id} for shot in spec.shots],
    }
    require_valid(parse_cue_track(data), load_library(), plan)
    assert len(data["cues"]) == len(spec.sound)
    assert json.loads(json.dumps(data))["totalFrames"] == 1800


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg is required for AAC integration")
def test_final_aac_preserves_delivery_peak_limit(tmp_path, spec):
    """A passing PCM mix must also remain safe after the lossy delivery encode."""
    load_package("aether_audio")
    load_package("aether_delivery")
    from aether_audio.contracts import parse_cue_track
    from aether_audio.library import load_library
    from aether_audio.mix import mix_track
    from aether_delivery.inspect_media import _loudness

    wav, aac = tmp_path / "mix.wav", tmp_path / "encoded.m4a"
    mix_track(parse_cue_track(cue_track(spec, "aac-regression")), load_library(), wav)
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-i",
            str(wav),
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            str(aac),
        ],
        check=True,
        capture_output=True,
        timeout=120,
    )
    levels = _loudness(aac)
    assert levels["truePeakDbtp"] <= -1.0, levels
    assert abs(levels["integratedLufs"] - spec.audio_loudness_lufs) <= 1.0, levels
