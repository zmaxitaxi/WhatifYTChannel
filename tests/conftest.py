import json

import pytest

from aether.paths import ROOT
from aether.validation import load_spec


@pytest.fixture
def raw_spec():
    return json.loads((ROOT / "fixtures/v01_stanford_boston_timeline.json").read_text())


@pytest.fixture
def spec():
    return load_spec((ROOT / "fixtures/v01_stanford_boston_timeline.json").read_text())


@pytest.fixture
def degree_raw():
    return json.loads((ROOT / "fixtures/v13_degree_expiry.json").read_text())


@pytest.fixture
def degree_spec():
    return load_spec((ROOT / "fixtures/v13_degree_expiry.json").read_text())


@pytest.fixture
def boston_raw():
    return json.loads((ROOT / "fixtures/v01_boston_continuous.json").read_text())


@pytest.fixture
def boston_spec():
    return load_spec((ROOT / "fixtures/v01_boston_continuous.json").read_text())
