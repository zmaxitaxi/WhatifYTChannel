# Discovery

Workstream C, task 7: competitor observations, topic ranking, and duplicate detection. Implements the rules in `TECHNICAL_PLAN.md` under "Discovery, analytics, and scheduling". Standard-library Python 3.11+, no installs.

| File | Purpose |
|---|---|
| `topics.py` | Support check, duplicate detection, heuristic score, ranking |
| `rank.py` | CLI that ranks `data/topics.json` and writes `docs/research/topic_ranking.md` |
| `competitors.py` | YouTube Data API snapshots of competitor Shorts and views-per-day |
| `data/topics.json` | The topic slate (V01–V12 plus candidates) with estimated scores and reasons |
| `data/competitors.json` | Channels to monitor |

```bash
python3 -m discovery.rank --write                          # rank and regenerate the report
YOUTUBE_API_KEY=... python3 -m discovery.competitors observe   # append a snapshot
python3 -m discovery.competitors velocity                  # views/day between snapshots
python3 -m unittest discover -s discovery/tests -t .        # tests
```

## Rules

1. **Reject unsupported topics first.** A topic whose scenario family is not in `SUPPORTED_FAMILIES` is rejected; it becomes engineering work, not a production candidate.
2. **Deduplicate.** The key is (institution set, scenario family, transformation). Institution names go through an alias table (Cal → berkeley, Stanford University → stanford) and transformations are normalised, so "Cal and Stanford trade campuses" matches "Berkeley and Stanford switch campuses". Exact duplicates are dropped; the earlier or already-queued topic wins.
   Near duplicates (same family and institutions but a different transformation, such as Stanford to Boston versus Stanford to Cambridge) stay in the ranking and are listed for a person to decide.
3. **Rank.** `score = 0.30 trend + 0.25 visual + 0.20 originality + 0.15 feasibility + 0.10 novelty`, each 0–100. Novelty is computed from the slate: minus 15 for each other topic in the same family, minus 10 for each sharing a named institution.

The first four terms are human estimates until competitor observations exist. The weights are the plan's initial heuristic, not trained values. Google Trends and machine-learned ranking are out of scope for the release.

When Max's Pydantic contracts land, `Topic` should convert from the shared contract instead of being a second definition.
