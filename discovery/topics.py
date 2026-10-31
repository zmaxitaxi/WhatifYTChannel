"""Topic support checks, duplicate detection, and heuristic ranking.

Implements the discovery rules in TECHNICAL_PLAN.md ("Discovery, analytics,
and scheduling"):

* reject unsupported topics before ranking,
* deduplicate by institutions, scenario family, and transformation,
* rank supported topics with the initial heuristic weights.

Standard library only, so it runs before Max's Pydantic contracts land. When
those exist, ``Topic`` should be replaced by (or converted from) the shared
contract type rather than kept as a second source of truth.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

# Initial heuristic weights from the technical plan. Not trained parameters.
WEIGHTS: dict[str, float] = {
    "trend_strength": 0.30,
    "visual_potential": 0.25,
    "originality": 0.20,
    "rendering_feasibility": 0.15,
    "novelty": 0.10,
}

# Scenario families the renderer is planned to support (TECHNICAL_PLAN.md,
# "All twelve original concepts"). A topic outside these is rejected before
# ranking; it becomes engineering work, not a production candidate.
SUPPORTED_FAMILIES: frozenset[str] = frozenset(
    {
        "relocation",
        "swap",
        "disappearance",
        "status_change",
        "ranking",
        "fictional_borders",
        "absence",
        "merger",
        "crowd_flow",
        "symbolic_competition",
    }
)

# Symmetric transformations: "A and B swap" == "B and A swap". Institutions are
# already compared as a set, so these need no special ordering logic.

# Canonical institution ids. Keys are lowercase aliases.
INSTITUTION_ALIASES: dict[str, str] = {
    "stanford": "stanford",
    "stanford university": "stanford",
    "leland stanford junior university": "stanford",
    "berkeley": "berkeley",
    "uc berkeley": "berkeley",
    "cal": "berkeley",
    "university of california, berkeley": "berkeley",
    "harvard": "harvard",
    "harvard university": "harvard",
    "mit": "mit",
    "massachusetts institute of technology": "mit",
    "ucla": "ucla",
    "university of california, los angeles": "ucla",
    "yale": "yale",
    "princeton": "princeton",
    "columbia": "columbia",
    "penn": "penn",
    "upenn": "penn",
    "university of pennsylvania": "penn",
    "brown": "brown",
    "cornell": "cornell",
    "dartmouth": "dartmouth",
    "caltech": "caltech",
    "usc": "usc",
    "university of southern california": "usc",
    "michigan": "umich",
    "umich": "umich",
    "university of michigan": "umich",
    "nyu": "nyu",
    # Groups are treated as one "institution" token so that cohort topics
    # dedupe against each other.
    "ivy league": "group:ivy_league",
    "all public universities": "group:public_universities",
    "every public university": "group:public_universities",
    "all universities": "group:all_universities",
    "every university": "group:all_universities",
    "all colleges": "group:all_universities",
    "all students": "group:all_students",
    "every student": "group:all_students",
}


def canonical_institution(name: str) -> str:
    """Map an institution name or alias to its canonical id."""
    key = re.sub(r"\s+", " ", name.strip().lower())
    return INSTITUTION_ALIASES.get(key, key.replace(" ", "_"))


def canonical_transformation(text: str) -> str:
    """Lowercase, trim, and collapse separators so 'relocate: Boston' == 'relocate_boston'."""
    return re.sub(r"[^a-z0-9]+", "_", text.strip().lower()).strip("_")


@dataclass(frozen=True)
class Topic:
    id: str
    title: str
    institutions: frozenset[str]
    scenario_family: str
    transformation: str
    scores: dict[str, float] = field(default_factory=dict, compare=False, hash=False)
    rationale: dict[str, str] = field(default_factory=dict, compare=False, hash=False)
    status: str = "candidate"  # candidate | queued | published

    @classmethod
    def from_dict(cls, raw: dict) -> "Topic":
        return cls(
            id=raw["id"],
            title=raw["title"],
            institutions=frozenset(canonical_institution(i) for i in raw["institutions"]),
            scenario_family=raw["scenario_family"].strip().lower(),
            transformation=canonical_transformation(raw["transformation"]),
            scores=dict(raw.get("scores", {})),
            rationale=dict(raw.get("rationale", {})),
            status=raw.get("status", "candidate"),
        )

    @property
    def dedup_key(self) -> tuple[tuple[str, ...], str, str]:
        return (tuple(sorted(self.institutions)), self.scenario_family, self.transformation)


# --------------------------------------------------------------------------- support


def unsupported_reason(topic: Topic) -> str | None:
    """Return why a topic cannot be produced yet, or None if it is supported."""
    if topic.scenario_family not in SUPPORTED_FAMILIES:
        return f"scenario family '{topic.scenario_family}' has no renderer support"
    if not topic.institutions:
        return "no institutions named"
    return None


# --------------------------------------------------------------------------- duplicates


def jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


@dataclass(frozen=True)
class DuplicateMatch:
    topic_id: str
    other_id: str
    kind: str  # "exact" | "near"
    reason: str


def compare(a: Topic, b: Topic) -> DuplicateMatch | None:
    """Classify a pair as an exact duplicate, a near duplicate, or distinct.

    exact: same institution set, scenario family, and transformation.
    near:  same family and same institution set with a different
           transformation, or same family and transformation with
           institution overlap of at least one half.
    """
    if a.dedup_key == b.dedup_key:
        return DuplicateMatch(a.id, b.id, "exact", "same institutions, family, and transformation")
    if a.scenario_family != b.scenario_family:
        return None
    overlap = jaccard(a.institutions, b.institutions)
    if a.institutions == b.institutions:
        return DuplicateMatch(
            a.id, b.id, "near", f"same institutions and family; transformation differs ({a.transformation} vs {b.transformation})"
        )
    if a.transformation == b.transformation and overlap >= 0.5:
        return DuplicateMatch(a.id, b.id, "near", f"same family and transformation; institution overlap {overlap:.0%}")
    return None


def find_duplicates(topics: list[Topic], existing: list[Topic] | None = None) -> list[DuplicateMatch]:
    """Compare each topic against earlier topics in the list and against ``existing``.

    The first occurrence wins, so put already-queued or published topics in
    ``existing`` (or earlier in the list) to keep them.
    """
    existing = list(existing or [])
    matches: list[DuplicateMatch] = []
    seen: list[Topic] = list(existing)
    for topic in topics:
        for other in seen:
            match = compare(topic, other)
            if match:
                matches.append(match)
        seen.append(topic)
    return matches


# --------------------------------------------------------------------------- scoring


def novelty_scores(topics: list[Topic]) -> dict[str, float]:
    """Novelty relative to the rest of the slate, so the channel does not repeat itself.

    Starts at 100; minus 15 for every other topic in the same scenario family,
    minus 10 for every other topic sharing an institution (groups excluded).
    Clamped to 0–100.
    """
    out: dict[str, float] = {}
    for t in topics:
        same_family = sum(1 for o in topics if o.id != t.id and o.scenario_family == t.scenario_family)
        named = {i for i in t.institutions if not i.startswith("group:")}
        shared_inst = sum(1 for o in topics if o.id != t.id and named & o.institutions)
        out[t.id] = max(0.0, min(100.0, 100.0 - 15 * same_family - 10 * shared_inst))
    return out


def score(scores: dict[str, float]) -> float:
    missing = [k for k in WEIGHTS if k not in scores]
    if missing:
        raise ValueError(f"missing score terms: {', '.join(missing)}")
    for k, v in scores.items():
        if k in WEIGHTS and not 0 <= v <= 100:
            raise ValueError(f"{k}={v} is outside 0–100")
    return round(sum(WEIGHTS[k] * scores[k] for k in WEIGHTS), 1)


@dataclass
class RankResult:
    ranked: list[tuple[Topic, float, dict[str, float]]]
    rejected: list[tuple[Topic, str]]
    duplicates: list[DuplicateMatch]


def rank(topics: list[Topic], existing: list[Topic] | None = None) -> RankResult:
    """Reject unsupported topics, drop exact duplicates, then rank by heuristic score.

    Near duplicates stay in the ranking but are reported, so a person decides.
    ``novelty`` is computed from the surviving slate unless a topic sets it
    explicitly.
    """
    rejected: list[tuple[Topic, str]] = []
    supported: list[Topic] = []
    for t in topics:
        reason = unsupported_reason(t)
        if reason:
            rejected.append((t, reason))
        else:
            supported.append(t)

    duplicates = find_duplicates(supported, existing)
    exact_ids = {m.topic_id for m in duplicates if m.kind == "exact"}
    for t in supported:
        if t.id in exact_ids:
            other = next(m.other_id for m in duplicates if m.topic_id == t.id and m.kind == "exact")
            rejected.append((t, f"exact duplicate of {other}"))
    survivors = [t for t in supported if t.id not in exact_ids]

    novelty = novelty_scores(survivors + list(existing or []))
    ranked = []
    for t in survivors:
        terms = dict(t.scores)
        terms.setdefault("novelty", novelty[t.id])
        ranked.append((t, score(terms), terms))
    ranked.sort(key=lambda r: (-r[1], r[0].id))
    return RankResult(ranked, rejected, duplicates)


def load_topics(path: str | Path) -> list[Topic]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [Topic.from_dict(raw) for raw in data["topics"]]
