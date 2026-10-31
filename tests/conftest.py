import json

import pytest

from aether.paths import FIXTURE
from aether.validation import load_spec


@pytest.fixture
def raw_spec():
    return json.loads(FIXTURE.read_text())


@pytest.fixture
def spec():
    return load_spec(FIXTURE.read_text())
