import pytest

from aether.audio_revision import validate_audio_revision


def test_audio_revision_allows_quieter_mix_and_different_cues(spec):
    revised = spec.model_copy(update={"sound": [], "audio_loudness_lufs": -26.0})
    validate_audio_revision(spec, revised)


def test_audio_revision_refuses_changed_visuals(spec):
    with pytest.raises(ValueError, match="preserve every visual"):
        validate_audio_revision(spec, spec.model_copy(update={"seed": spec.seed + 1}))
