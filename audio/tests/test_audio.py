"""Tests for the AETHER audio tools. Run from audio/: python -m unittest -v"""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

import numpy as np

from aether_audio.contracts import (
    SAMPLES_PER_FRAME,
    CueValidationError,
    SoundCue,
    load_cue_track,
    parse_cue_track,
    validate_cue_track,
)
from aether_audio.library import MANIFEST_PATH, load_library, verify_library
from aether_audio.mix import place_cue, render_premix
from aether_audio.synth import SOUND_DESIGNS, render_design
from aether_audio.wavio import read_wav, write_wav

AUDIO = Path(__file__).resolve().parent.parent
REPO = AUDIO.parent
V01_PLAN = REPO / "renderer" / "fixtures" / "v01_stanford_boston_slice.json"
V01_CUES = AUDIO / "cues" / "v01_stanford_boston_slice.cues.json"
HAS_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _track(cues: list[dict], total_frames: int = 360) -> dict:
    return {
        "specVersion": "1.0.0", "jobId": "job_v01_slice_001", "fps": 30,
        "totalFrames": total_frames, "sampleRate": 48000, "libraryVersion": "1.0.0",
        "loudness": {"integratedLufs": -16.0, "truePeakDbtp": -1.0}, "cues": cues,
    }


class LibraryTests(unittest.TestCase):
    def test_manifest_matches_files(self):
        self.assertEqual(verify_library(), [])

    def test_every_asset_records_source_rights_and_hash(self):
        manifest = json.loads(MANIFEST_PATH.read_text())
        self.assertEqual(set(manifest["assets"]), {d.asset_id for d in SOUND_DESIGNS})
        for asset_id, a in manifest["assets"].items():
            with self.subTest(asset_id):
                self.assertEqual(len(a["sha256"]), 64)
                self.assertIn("generator", a["source"])
                self.assertIn("seed", a["source"])
                self.assertIn("license", a["rights"])
                self.assertIn("attributionRequired", a["rights"])
                self.assertEqual(a["format"]["sampleRate"], 48000)
                self.assertLessEqual(a["peakDbfs"], -0.9)

    def test_plan_categories_are_covered(self):
        categories = {d.category for d in SOUND_DESIGNS}
        for needed in ("ambience", "movement", "crowd", "transition", "arrival", "disappearance", "impact"):
            self.assertIn(needed, categories)

    def test_generation_is_deterministic(self):
        for design in SOUND_DESIGNS[:6]:
            with self.subTest(design.asset_id):
                np.testing.assert_array_equal(render_design(design), render_design(design))

    def test_wav_round_trip(self):
        audio = np.stack([np.linspace(-1, 1, 1000), np.linspace(1, -1, 1000)], axis=1)
        with tempfile.TemporaryDirectory() as tmp:
            for bits, tol in ((16, 1 / 32767), (24, 1 / 8388607)):
                p = Path(tmp) / f"x{bits}.wav"
                write_wav(p, audio, 48000, bits=bits)
                back, rate = read_wav(p)
                self.assertEqual(rate, 48000)
                np.testing.assert_allclose(back, audio, atol=tol)

    def test_loopable_assets_wrap_without_a_click(self):
        library = load_library()
        for asset in library.values():
            if not asset.loopable:
                continue
            with self.subTest(asset.id):
                audio = asset.load()
                seam = np.abs(audio[0] - audio[-1]).max()
                typical = np.abs(np.diff(audio, axis=0)).max()
                self.assertLessEqual(seam, typical)


class CueContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.library = load_library()
        cls.plan = json.loads(V01_PLAN.read_text())

    def test_v01_cue_track_is_valid_against_the_renderer_fixture(self):
        track = load_cue_track(V01_CUES)
        self.assertEqual(validate_cue_track(track, self.library, self.plan), [])

    def test_v01_cuts_have_sound(self):
        track = load_cue_track(V01_CUES)
        sync_frames = {c.sync_frame for c in track.cues}
        for shot in self.plan["shots"]:
            self.assertIn(shot["startFrame"], sync_frames, f"no cue on the cut into {shot['id']}")

    def test_rejects_unknown_asset_and_out_of_range_frames(self):
        track = parse_cue_track(_track([
            {"id": "a", "assetId": "not_in_library", "syncFrame": 0},
            {"id": "b", "assetId": "imp_hit_low", "syncFrame": 360},
            {"id": "c", "assetId": "amb_campus_day", "syncFrame": 10, "endFrame": 400},
            {"id": "c", "assetId": "imp_hit_low", "syncFrame": 10, "gainDb": 12},
        ]))
        problems = " | ".join(validate_cue_track(track, self.library, self.plan))
        self.assertIn("not an approved library asset", problems)
        self.assertIn("syncFrame 360 outside", problems)
        self.assertIn("beyond totalFrames", problems)
        self.assertIn("duplicate id", problems)
        self.assertIn("gainDb 12.0", problems)

    def test_rejects_fades_longer_than_the_cue_and_overrun_of_one_shot_asset(self):
        track = parse_cue_track(_track([
            {"id": "a", "assetId": "ui_caption_pop", "syncFrame": 5, "fadeInFrames": 10},
            {"id": "b", "assetId": "imp_hit_low", "syncFrame": 5, "endFrame": 200},
        ]))
        problems = " | ".join(validate_cue_track(track, self.library))
        self.assertIn("fades", problems)
        self.assertIn("runs past the end of non-looping asset", problems)

    def test_rejects_mismatched_plan(self):
        track = parse_cue_track(_track([], total_frames=300))
        self.assertTrue(any("totalFrames" in p for p in validate_cue_track(track, self.library, self.plan)))

    def test_missing_field_raises(self):
        with self.assertRaises(CueValidationError):
            parse_cue_track({"specVersion": "1.0.0"})


class TimingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.library = load_library()

    def test_one_frame_is_exactly_1600_samples(self):
        self.assertEqual(SAMPLES_PER_FRAME, 1600)

    def test_sync_point_lands_on_the_sync_frame(self):
        whoosh = self.library["tr_whoosh_up"]
        cue = SoundCue(id="w", asset_id="tr_whoosh_up", sync_frame=90)
        placed = place_cue(cue, whoosh, 360 * SAMPLES_PER_FRAME)
        self.assertEqual(placed.sync_sample, 90 * 1600)
        self.assertEqual(placed.start_sample, 90 * 1600 - whoosh.sync_point_samples)
        # The asset's loudest moment really is at its declared sync point.
        audio = whoosh.load()
        env = np.convolve(np.abs(audio).sum(axis=1), np.ones(960) / 960, mode="same")
        self.assertLess(abs(int(np.argmax(env)) - whoosh.sync_point_samples), 0.05 * 48000)

    def test_impact_starts_on_its_frame_and_nothing_plays_before(self):
        track = parse_cue_track(_track([
            {"id": "hit", "assetId": "imp_hit_low", "syncFrame": 270},
        ]))
        premix, placements = render_premix(track, self.library)
        nonzero = np.flatnonzero(np.abs(premix).sum(axis=1) > 0)
        # The asset's own 0.5 ms click-guard fade means sample 0 of it is silent.
        self.assertGreaterEqual(int(nonzero[0]), 270 * 1600)
        self.assertLess(int(nonzero[0]), 270 * 1600 + 24)
        self.assertEqual(premix.shape, (360 * 1600, 2))

    def test_end_frame_is_half_open_and_loops_fill_to_it(self):
        track = parse_cue_track(_track([
            {"id": "amb", "assetId": "amb_map_air", "syncFrame": 0, "endFrame": 330},
        ]))
        premix, _ = render_premix(track, self.library)
        self.assertGreater(np.abs(premix[330 * 1600 - 1]).sum(), 0)  # loop reached the end
        self.assertEqual(np.abs(premix[330 * 1600:]).sum(), 0)

    def test_fades_and_pan(self):
        track = parse_cue_track(_track([
            {"id": "amb", "assetId": "amb_campus_day", "syncFrame": 0, "endFrame": 60,
             "fadeInFrames": 15, "fadeOutFrames": 15, "pan": -1.0},
        ]))
        premix, _ = render_premix(track, self.library)
        self.assertEqual(premix[0].tolist(), [0.0, 0.0])
        self.assertAlmostEqual(float(np.abs(premix[:60 * 1600, 1]).max()), 0.0, places=12)
        self.assertLess(np.abs(premix[59 * 1600 + 1590]).max(), 0.01)


@unittest.skipUnless(HAS_FFMPEG, "ffmpeg/ffprobe not installed")
class DeliveryTests(unittest.TestCase):
    """End-to-end: mix, slate, encode, and inspect a short 2-second job."""

    def test_package_meets_shorts_contract(self):
        from aether_audio.__main__ import main

        plan = json.loads(V01_PLAN.read_text())
        plan["output"]["totalFrames"] = 90
        plan["shots"] = [dict(plan["shots"][0], endFrame=45), dict(plan["shots"][1], startFrame=45, endFrame=90)]
        plan["captions"] = [dict(plan["captions"][0], endFrame=90)]
        cues = _track([
            {"id": "amb", "assetId": "amb_campus_day", "syncFrame": 0, "endFrame": 90,
             "gainDb": -10, "fadeInFrames": 3, "fadeOutFrames": 10},
            {"id": "cut", "assetId": "tr_whoosh_up", "syncFrame": 45, "gainDb": -6},
            {"id": "hit", "assetId": "imp_hit_low", "syncFrame": 45, "gainDb": -4},
        ], total_frames=90)
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            (t / "plan.json").write_text(json.dumps(plan))
            (t / "cues.json").write_text(json.dumps(cues))
            code = main(["package", "--cues", str(t / "cues.json"), "--plan", str(t / "plan.json"),
                         "--out-dir", str(t / "out")])
            report = json.loads((t / "out" / "report.json").read_text())
            failed = [c for c in report["inspection"]["checks"] if not c["pass"]]
            self.assertEqual(failed, [])
            self.assertEqual(code, 0)
            mix, rate = read_wav(t / "out" / "mix.wav")
            self.assertEqual((len(mix), rate), (90 * 1600, 48000))


if __name__ == "__main__":
    unittest.main()
