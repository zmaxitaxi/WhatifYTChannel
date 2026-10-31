import unittest

from discovery.competitors import Observation, view_velocity
from discovery.rank import TOPICS_FILE
from discovery.topics import Topic, compare, find_duplicates, load_topics, rank, score

FULL = {"trend_strength": 50, "visual_potential": 50, "originality": 50, "rendering_feasibility": 50, "novelty": 50}


def t(id, inst, fam, tr, **scores):
    return Topic.from_dict(
        {"id": id, "title": id, "institutions": inst, "scenario_family": fam, "transformation": tr, "scores": {**FULL, **scores}}
    )


class DuplicateTests(unittest.TestCase):
    def test_aliases_and_order_make_exact_duplicate(self):
        a = t("a", ["Berkeley", "Stanford"], "swap", "swap")
        b = t("b", ["Stanford University", "Cal"], "Swap", " SWAP ")
        self.assertEqual(compare(b, a).kind, "exact")

    def test_different_destination_is_near_duplicate(self):
        a = t("a", ["Stanford"], "relocation", "relocate:boston")
        b = t("b", ["stanford"], "relocation", "relocate:cambridge")
        self.assertEqual(compare(b, a).kind, "near")

    def test_shared_institution_in_different_family_is_distinct(self):
        a = t("a", ["Stanford"], "relocation", "relocate:boston")
        b = t("b", ["Stanford"], "absence", "never_exist")
        self.assertIsNone(compare(b, a))

    def test_swap_with_different_partner_is_distinct(self):
        a = t("a", ["Berkeley", "Stanford"], "swap", "swap")
        b = t("b", ["MIT", "Stanford"], "swap", "swap")
        self.assertIsNone(compare(b, a))

    def test_existing_topics_win(self):
        published = t("old", ["Harvard"], "relocation", "relocate:california")
        new = t("new", ["Harvard University"], "relocation", "relocate california")
        [m] = find_duplicates([new], existing=[published])
        self.assertEqual((m.topic_id, m.other_id, m.kind), ("new", "old", "exact"))


class RankTests(unittest.TestCase):
    def test_weights(self):
        self.assertEqual(score(FULL), 50.0)
        self.assertEqual(score({**FULL, "trend_strength": 100}), 65.0)

    def test_score_rejects_out_of_range_and_missing(self):
        with self.assertRaises(ValueError):
            score({**FULL, "originality": 120})
        with self.assertRaises(ValueError):
            score({"trend_strength": 50})

    def test_unsupported_and_exact_duplicates_are_rejected(self):
        topics = [
            t("keep", ["Stanford"], "relocation", "relocate:boston"),
            t("dup", ["Stanford"], "relocation", "relocate:boston"),
            t("bad", ["Stanford"], "time_travel", "go_back"),
        ]
        result = rank(topics)
        self.assertEqual([x[0].id for x in result.ranked], ["keep"])
        self.assertEqual({x[0].id for x in result.rejected}, {"dup", "bad"})

    def test_novelty_penalises_repeated_family(self):
        a = Topic.from_dict({"id": "a", "title": "a", "institutions": ["Yale"], "scenario_family": "swap", "transformation": "x",
                             "scores": {k: v for k, v in FULL.items() if k != "novelty"}})
        b = Topic.from_dict({"id": "b", "title": "b", "institutions": ["Brown"], "scenario_family": "swap", "transformation": "y",
                             "scores": {k: v for k, v in FULL.items() if k != "novelty"}})
        c = Topic.from_dict({"id": "c", "title": "c", "institutions": ["Duke"], "scenario_family": "merger", "transformation": "z",
                             "scores": {k: v for k, v in FULL.items() if k != "novelty"}})
        terms = {r[0].id: r[2]["novelty"] for r in rank([a, b, c]).ranked}
        self.assertEqual(terms, {"a": 85.0, "b": 85.0, "c": 100.0})

    def test_project_slate_loads_and_ranks(self):
        result = rank(load_topics(TOPICS_FILE))
        ids = {r[0].id for r in result.ranked}
        self.assertTrue({f"V{i:02d}" for i in range(1, 13)} <= ids)


class VelocityTests(unittest.TestCase):
    def test_views_per_day(self):
        def obs(ts, views):
            return Observation(ts, "UC1", "vid", "title", "2026-10-01T00:00:00Z", views, None, None)

        v = view_velocity([obs("2026-10-02T00:00:00Z", 3000), obs("2026-10-01T00:00:00Z", 1000)])
        self.assertEqual(v["vid"]["views_per_day"], 2000.0)
        self.assertIsNone(view_velocity([obs("2026-10-01T00:00:00Z", 1)])["vid"]["views_per_day"])


if __name__ == "__main__":
    unittest.main()
