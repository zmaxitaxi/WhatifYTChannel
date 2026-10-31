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
    assert json.loads(json.dumps(data))["totalFrames"] == spec.output.total_frames


def test_each_timeline_scene_has_a_distinct_short_non_looping_effect(spec):
    load_package("aether_audio")
    from aether_audio.library import load_library

    library = load_library()
    scenes = {shot.history.scene for shot in spec.shots}
    coverage = set()
    assets = set()
    for cue in spec.sound:
        shot = next(shot for shot in spec.shots if shot.start_frame <= cue.frame < shot.end_frame)
        coverage.add(shot.history.scene)
        asset = library[cue.asset_id]
        assert not asset.loopable
        assert asset.samples <= 1.5 * 48000
        assert asset.category not in {"ambience", "crowd"}
        assert cue.asset_id.startswith("fx_")
        assets.add(cue.asset_id)
    assert coverage == scenes
    assert len(spec.sound) == len(assets) == len(scenes) == 12


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
