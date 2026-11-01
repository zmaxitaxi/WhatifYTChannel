import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from aether.app import create_app
from aether.contributors import cue_track, load_package
from aether.validation import load_spec


def test_boston_checkpoints_follow_dated_chapters_without_a_degree_counter(boston_spec):
    assert boston_spec.journey is None
    assert [p.year for p in boston_spec.history_journey.checkpoints] == [
        1885, 1891, 1939, 1951, 1996, 2026, 2050, None,
    ]
    assert all(s.operation == "boston_journey" for s in boston_spec.shots)
    assert boston_spec.history_journey.checkpoints[-1].frame == 2159
    assert all(c.kind != "verified" for c in boston_spec.evidence.claims if c.id.startswith("b_"))


@pytest.mark.parametrize("change", ["missing", "duplicate", "year", "chapter", "music", "cut"])
def test_boston_cannot_drift_from_its_continuous_story(boston_raw, change):
    if change == "missing":
        boston_raw["history_journey"] = None
    elif change == "duplicate":
        boston_raw["history_journey"]["checkpoints"][1]["frame"] = 0
    elif change == "year":
        boston_raw["history_journey"]["checkpoints"][2]["year"] = 1880
    elif change == "chapter":
        boston_raw["history_journey"]["checkpoints"][2]["frame"] += 1
    elif change == "music":
        boston_raw["sound"][0]["end_frame"] -= 30
    else:
        boston_raw["shots"][2]["operation"] = "history_scene"
    with pytest.raises(ValidationError):
        load_spec(json.dumps(boston_raw))


def test_boston_music_is_one_full_score_and_all_cues_are_valid(boston_spec):
    load_package("aether_audio")
    from aether_audio.contracts import parse_cue_track, require_valid
    from aether_audio.library import load_library

    library = load_library()
    music = library["music_boston_sunrise"]
    assert music.category == "music" and not music.loopable
    assert music.samples == 72 * 48_000
    assert not any(c.asset_id.startswith(("amb_", "crowd_")) for c in boston_spec.sound)
    require_valid(parse_cue_track(cue_track(boston_spec, "boston-score")), library)


def test_website_default_creates_the_uncut_stanford_story(tmp_path):
    with TestClient(create_app(tmp_path, start_worker=False)) as client:
        result = client.post("/jobs", json={})
        assert result.status_code == 201
        job = result.json()
        saved = client.get(f"/jobs/{job['id']}/spec").json()
        assert saved["history_journey"]["checkpoints"][0]["year"] == 1885
        assert saved["journey"] is None
        page = client.get(f"/?job={job['id']}")
        assert "Render Stanford journey" in page.text
        assert "What if Stanford started in Boston?" in page.text
