import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from aether_analytics import csv_import, report, store, youtube_api  # noqa: E402

FIXTURES = ROOT / "fixtures"
GOOD = dict(premise=5, recognition=4, action=4, captions=5, camera=4, style=4, sound=4)


class Base(unittest.TestCase):
    def setUp(self):
        self.conn = store.connect(":memory:")

    def tearDown(self):
        self.conn.close()


class StudioCsvTest(Base):
    def test_imports_rows_skips_total_and_converts_units(self):
        result = csv_import.import_studio_table(
            self.conn, FIXTURES / "studio_table_data.csv", observed_at="2026-11-10T00:00:00Z"
        )
        self.assertEqual(result["imported"], 2)
        self.assertEqual(result["skipped"], 1)
        snap = self.conn.execute(
            "SELECT * FROM metric_snapshots WHERE youtube_video_id = 'abcV01xyz00'"
        ).fetchone()
        self.assertEqual(snap["views"], 12900)
        self.assertAlmostEqual(snap["estimated_minutes_watched"], 128.4 * 60)
        self.assertEqual(snap["average_view_duration_seconds"], 36)
        self.assertEqual(snap["impressions_ctr"], 8.1)
        self.assertIsNone(snap["engaged_views"])  # not in export -> missing, not zero
        video = self.conn.execute("SELECT * FROM videos WHERE youtube_video_id = 'abcV01xyz00'").fetchone()
        self.assertEqual(video["published_at"], "2026-11-03")
        self.assertEqual(video["duration_seconds"], 58)

    def test_reimport_appends_snapshot_for_growth(self):
        csv_import.import_studio_table(self.conn, FIXTURES / "studio_table_data.csv", observed_at="2026-11-10T00:00:00Z")
        self.conn.execute(
            "INSERT INTO metric_snapshots (youtube_video_id, observed_at, source, views) "
            "VALUES ('abcV01xyz00', '2026-11-11T00:00:00Z', 'csv', 15000)"
        )
        growth = report.view_growth(
            self.conn.execute("SELECT * FROM metric_snapshots WHERE youtube_video_id='abcV01xyz00'").fetchall()
        )
        self.assertEqual(growth["views_gained"], 2100)

    def test_missing_id_column_is_rejected(self):
        bad = FIXTURES.parent / "tests" / "_bad.csv"
        bad.write_text("Title,Views\nx,1\n", encoding="utf-8")
        try:
            with self.assertRaises(ValueError):
                csv_import.import_studio_table(self.conn, bad, observed_at="t")
        finally:
            bad.unlink()

    def test_duration_parsing(self):
        self.assertEqual(csv_import.parse_duration("0:00:41"), 41)
        self.assertEqual(csv_import.parse_duration("1:05"), 65)
        self.assertEqual(csv_import.parse_duration("58"), 58)
        self.assertIsNone(csv_import.parse_duration(""))


class RetentionTest(Base):
    def test_retention_csv_percentages_become_ratios(self):
        csv_import.import_retention_csv(
            self.conn, FIXTURES / "retention_v01.csv", youtube_video_id="abcV01xyz00", observed_at="t1"
        )
        rows = self.conn.execute("SELECT * FROM retention_points ORDER BY elapsed_ratio").fetchall()
        self.assertEqual(len(rows), 12)
        self.assertEqual(rows[1]["elapsed_ratio"], 0.05)
        self.assertEqual(rows[1]["audience_watch_ratio"], 0.82)

    def test_summary_maps_biggest_drop_to_seconds_and_frames(self):
        csv_import.import_retention_csv(
            self.conn, FIXTURES / "retention_v01.csv", youtube_video_id="abcV01xyz00", observed_at="t1"
        )
        rows = self.conn.execute("SELECT * FROM retention_points").fetchall()
        s = report.summarize_retention(rows, duration_seconds=60)
        # 0 -> 5% loses 18 points, the largest single step
        self.assertAlmostEqual(s.biggest_drop, 0.18)
        self.assertEqual(s.biggest_drop_at_seconds, 3.0)
        self.assertEqual(s.biggest_drop_at_frame, 90)
        self.assertAlmostEqual(s.hook_retention, 0.82)  # 3s of 60s = 5%


class RubricTest(Base):
    def _rate(self, reviewer, **overrides):
        store.insert_rating(self.conn, reviewer=reviewer, rated_at="t", job_id="job-1", scores={**GOOD, **overrides})

    def test_pass(self):
        self._rate("a")
        s = report.summarize_rubric(self.conn.execute("SELECT * FROM quality_ratings").fetchall())
        self.assertTrue(s.passes)

    def test_low_average_fails(self):
        self._rate("a", premise=3, recognition=3, action=4, captions=4, camera=4, style=4, sound=4)
        s = report.summarize_rubric(self.conn.execute("SELECT * FROM quality_ratings").fetchall())
        self.assertFalse(s.passes)
        self.assertIn("average", s.reasons[0])

    def test_any_dimension_below_three_fails_even_with_high_average(self):
        self._rate("a", sound=2, premise=5, recognition=5, action=5, captions=5, camera=5, style=5)
        s = report.summarize_rubric(self.conn.execute("SELECT * FROM quality_ratings").fetchall())
        self.assertGreaterEqual(s.average, 4)
        self.assertFalse(s.passes)

    def test_rejects_out_of_range_and_missing(self):
        with self.assertRaises(ValueError):
            self._rate("a", sound=6)
        with self.assertRaises(ValueError):
            store.insert_rating(self.conn, reviewer="a", rated_at="t", job_id="j", scores={"premise": 5})


class ApiTest(Base):
    def test_video_metrics_and_retention_via_fake_transport(self):
        calls = []

        def fake(url, params, token):
            calls.append(params)
            if params["dimensions"] == "video":
                return {
                    "columnHeaders": [{"name": "video"}] + [{"name": m} for m in youtube_api.VIDEO_METRICS],
                    "rows": [["abcV01xyz00", 13000, 7800, 36, 62.0, 950, 34, 71, 52]],
                }
            return {
                "columnHeaders": [{"name": "elapsedVideoTimeRatio"}, {"name": "audienceWatchRatio"},
                                  {"name": "relativeRetentionPerformance"}],
                "rows": [[0.01, 1.0, 0.5], [0.5, 0.6, 0.5], [1.0, 0.4, 0.4]],
            }

        r = youtube_api.import_video_metrics(
            self.conn, token="tok", start_date="2026-11-01", end_date="2026-11-10", observed_at="t2", transport=fake
        )
        self.assertEqual(r["video_ids"], ["abcV01xyz00"])
        youtube_api.import_retention(
            self.conn, token="tok", youtube_video_id="abcV01xyz00", start_date="2026-11-01",
            end_date="2026-11-10", observed_at="t2", transport=fake,
        )
        self.assertEqual(calls[0]["ids"], "channel==MINE")
        self.assertEqual(calls[1]["filters"], "video==abcV01xyz00")
        snap = self.conn.execute("SELECT * FROM metric_snapshots").fetchone()
        self.assertEqual(snap["source"], "api")
        self.assertIsNone(snap["impressions"])  # Studio-only metric stays missing


class ReadoutTest(Base):
    def setUp(self):
        super().setUp()
        csv_import.import_studio_table(self.conn, FIXTURES / "studio_table_data.csv", observed_at="2026-11-10T00:00:00Z")
        csv_import.import_retention_csv(
            self.conn, FIXTURES / "retention_v01.csv", youtube_video_id="abcV01xyz00", observed_at="2026-11-10T00:00:00Z"
        )
        store.upsert_video(self.conn, "abcV01xyz00", concept_id="V01", job_id="job-v01")
        store.insert_rating(self.conn, reviewer="francis", rated_at="t", job_id="job-v01", scores=GOOD)
        store.insert_rating(self.conn, reviewer="max", rated_at="t", job_id="job-v09", scores={**GOOD, "camera": 2})
        self.conn.execute(
            "INSERT INTO metric_snapshots (youtube_video_id, observed_at, source, views, average_view_percentage) "
            "VALUES ('abcV01xyz00', '2026-11-11T00:00:00Z', 'api', 14000, 63.5)"
        )

    def test_api_wins_and_csv_fills_gaps(self):
        v01 = next(r for r in report.build_readouts(self.conn) if r.youtube_video_id == "abcV01xyz00")
        self.assertEqual(v01.metrics["views"], 14000)
        self.assertTrue(v01.metric_sources["views"].startswith("api"))
        self.assertEqual(v01.metrics["impressions"], 60100)
        self.assertTrue(v01.metric_sources["impressions"].startswith("csv"))
        self.assertTrue(v01.rubric.passes)  # rating linked through job id

    def test_flags_and_unpublished(self):
        readouts = {r.youtube_video_id: r for r in report.build_readouts(self.conn)}
        v02 = readouts["abcV02xyz00"]
        self.assertTrue(any("average view percentage" in f for f in v02.flags))
        self.assertTrue(any("no human rubric" in f for f in v02.flags))
        self.assertTrue(any("steep drop" in f for f in readouts["abcV01xyz00"].flags))
        pending = report.unpublished_ratings(self.conn)
        self.assertEqual(list(pending), ["job-v09"])
        self.assertFalse(pending["job-v09"].passes)

    def test_renders_markdown_and_json(self):
        md = report.to_markdown(self.conn, "2026-11-11")
        self.assertIn("| V01 | What if Stanford was in Boston? | 14,000 |", md)
        self.assertIn("job-v09", md)
        data = json.loads(report.to_json(self.conn, "2026-11-11"))
        self.assertEqual(data["channel"]["videos"], 2)
        self.assertEqual(data["channel"]["rubric_passing"], 1)


if __name__ == "__main__":
    unittest.main()
