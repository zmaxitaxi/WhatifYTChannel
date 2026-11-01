import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from aether.app import create_app
from aether.contributors import cue_track, load_package
from aether.validation import load_spec


def test_degree_story_is_fictional_and_continuous(degree_spec):
    assert degree_spec.scenario_family == "degree_expiry"
    assert (
        degree_spec.captions[0].text.replace("\n", " ")
        == "What if your degree expired every five years?"
    )
    assert all(shot.operation == "degree_journey" for shot in degree_spec.shots)
    assert all(
        claim.kind in {"hypothetical", "assumption"} for claim in degree_spec.evidence.claims
    )
    assert [point.year for point in degree_spec.journey.checkpoints] == [
        2026,
        2031,
        2036,
        2041,
        2046,
        2051,
        None,
    ]
    assert degree_spec.journey.checkpoints[-1].frame == degree_spec.output.total_frames - 1


@pytest.mark.parametrize("change", ["missing", "reverse", "start", "end", "year"])
def test_bad_journey_tracks_are_rejected(degree_raw, change):
    if change == "missing":
        degree_raw["journey"] = None
    elif change == "reverse":
        degree_raw["journey"]["checkpoints"][1]["frame"] = 0
    elif change == "start":
        degree_raw["journey"]["checkpoints"][0]["year"] = 2027
    elif change == "end":
        degree_raw["journey"]["checkpoints"][-1]["frame"] -= 1
    else:
        degree_raw["journey"]["checkpoints"][2]["year"] = 2029
    with pytest.raises(ValidationError):
        load_spec(json.dumps(degree_raw))


def test_degree_audio_has_a_full_length_music_bed(degree_spec):
    load_package("aether_audio")
    from aether_audio.contracts import parse_cue_track, require_valid
    from aether_audio.library import load_library

    library = load_library()
    bed = next(cue for cue in degree_spec.sound if cue.asset_id == "music_degree_pulse")
    assert bed.frame == 0 and bed.end_frame == degree_spec.output.total_frames
    assert library[bed.asset_id].category == "music" and library[bed.asset_id].loopable
    assert not any(cue.asset_id.startswith(("amb_", "crowd_")) for cue in degree_spec.sound)
    require_valid(parse_cue_track(cue_track(degree_spec, "degree-audio")), library)


def test_degree_story_cannot_silently_drop_continuous_audio(degree_raw):
    degree_raw["sound"] = degree_raw["sound"][1:]
    with pytest.raises(ValidationError, match="continuous full-length musical bed"):
        load_spec(json.dumps(degree_raw))


def test_website_can_still_create_the_degree_story(tmp_path, degree_raw):
    with TestClient(create_app(tmp_path, start_worker=False)) as client:
        result = client.post("/jobs", json={"spec": degree_raw})
        assert result.status_code == 201
        job = result.json()
        saved = client.get(f"/jobs/{job['id']}/spec").json()
        assert saved["scenario_family"] == "degree_expiry"
        assert saved["journey"]["checkpoints"][0]["year"] == 2026
        page = client.get(f"/?job={job['id']}")
        assert page.status_code == 200
        assert "Render Stanford journey" in page.text
        assert "What if your degree expired every five years?" in page.text
