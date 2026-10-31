import json

import pytest
from pydantic import ValidationError

from aether.contracts import ProductionSpec
from aether.paths import ROOT
from aether.schema import export_schema
from aether.validation import CapabilityError, load_spec


def test_fixture_is_a_complete_short(spec):
    assert spec.output.total_frames == 1800
    assert spec.shots[0].start_frame == 0
    assert spec.shots[-1].end_frame == 1800
    assert {claim.kind for claim in spec.evidence.claims} == {"verified", "hypothetical"}


@pytest.mark.parametrize(
    "field,value",
    [("width", 540), ("height", 960), ("fps", 15), ("total_frames", 300), ("aspect_ratio", "16:9")],
)
def test_alternate_outputs_are_rejected(raw_spec, field, value):
    raw_spec["output"][field] = value
    with pytest.raises(ValidationError):
        load_spec(json.dumps(raw_spec))


def test_out_of_order_shots_are_rejected(raw_spec):
    raw_spec["shots"][1]["start_frame"] += 1
    with pytest.raises(ValidationError, match="contiguous"):
        load_spec(json.dumps(raw_spec))


def test_overlapping_captions_are_rejected(raw_spec):
    raw_spec["captions"][1]["start_frame"] = 120
    with pytest.raises(ValidationError, match="non-overlapping"):
        load_spec(json.dumps(raw_spec))


def test_reading_load_is_enforced(raw_spec):
    raw_spec["captions"][0]["end_frame"] = 30
    with pytest.raises(ValidationError, match="words/second"):
        load_spec(json.dumps(raw_spec))


def test_unresolved_claims_are_rejected(raw_spec):
    raw_spec["shots"][0]["claim_ids"] = ["nonexistent"]
    with pytest.raises(ValidationError, match="unknown claim"):
        load_spec(json.dumps(raw_spec))


def test_verified_claim_requires_evidence(raw_spec):
    raw_spec["evidence"]["claims"][0]["source_ids"] = []
    with pytest.raises(ValidationError, match="needs a source"):
        load_spec(json.dumps(raw_spec))


def test_unknown_operations_need_development(raw_spec):
    raw_spec["shots"][0]["operation"] = "arbitrary_combat_simulation"
    with pytest.raises(CapabilityError, match="needs development|Needs development"):
        load_spec(json.dumps(raw_spec))


def test_unknown_scenario_needs_development(raw_spec):
    raw_spec["scenario_family"] = "swap"
    with pytest.raises(CapabilityError, match="scenario:swap"):
        load_spec(json.dumps(raw_spec))


def test_executable_fields_and_remote_assets_are_rejected(raw_spec):
    raw_spec["shots"][0]["javascript"] = "alert(1)"
    raw_spec["campus"]["landmark_asset"] = "https://example.com/model.glb"
    with pytest.raises(ValidationError):
        load_spec(json.dumps(raw_spec))


def test_boolean_seed_is_not_an_integer(raw_spec):
    raw_spec["seed"] = True
    with pytest.raises(ValidationError):
        load_spec(json.dumps(raw_spec))


def test_exported_schema_matches_authoritative_model(tmp_path):
    path = tmp_path / "schema.json"
    export_schema(path)
    assert json.loads(path.read_text()) == json.loads(
        (ROOT / "contracts" / "production.schema.json").read_text()
    )
    schema = json.loads(path.read_text())
    assert set(schema["properties"]) == set(schema["required"])


def test_canonical_round_trip(spec):
    assert ProductionSpec.model_validate_json(spec.model_dump_json()) == spec
