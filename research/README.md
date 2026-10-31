# Research briefs and fact packs (Workstream C, task 1)

One folder per concept, `V01` to `V12`. Each folder has two files:

- `brief.md` is the human-readable research brief: premise, original situation, what changes, consequences we may show, labeling rules, and open questions.
- `factpack.json` is the machine-readable `FactPack` that story planning consumes (TECHNICAL_PLAN.md, "Research and factual boundaries").

## The one rule

Every claim is exactly one of these kinds, and the kind decides how it may appear on screen.

| `kind` | Meaning | On-screen treatment |
|---|---|---|
| `fact` | Verified from a cited source | Plain caption, `sourceLabel` names the source |
| `calculation` | Derived from facts by a recorded formula | Caption, `sourceLabel` says what was calculated |
| `assumption` | A declared simplification we chose (cohort, year, scale) | Disclosed in the description or a small label |
| `hypothetical` | An imagined event or consequence | `isHypothetical: true`, conditional wording ("would", "could") |

Hypothetical claims never get numbers that look measured. If a number appears in a hypothetical caption it must come from a `fact` or `calculation` claim and be referenced by id.

## FactPack format (draft, pending Max's Pydantic model)

Max owns the schema source. Until the Pydantic `FactPack` model lands, packs follow this shape so they can be converted mechanically:

```json
{
  "factPackVersion": "0.1.0",
  "conceptId": "V01",
  "topic": "What if Stanford was in Boston?",
  "scenarioFamily": "relocation",
  "status": "verified | draft_needs_verification",
  "preparedBy": "Francis",
  "preparedOn": "YYYY-MM-DD",
  "datasets": [{ "id": "...", "name": "...", "version": "...", "url": "..." }],
  "claims": [
    {
      "id": "v01.f.founded",
      "kind": "fact",
      "text": "Stanford was founded in 1885 and opened in 1891.",
      "value": 1885,
      "units": "year",
      "population": "Stanford University",
      "source": { "title": "...", "url": "...", "publisher": "...", "sourceDate": "...", "retrievedOn": "YYYY-MM-DD" },
      "verified": true
    },
    {
      "id": "v01.c.distance",
      "kind": "calculation",
      "text": "...",
      "value": 4329,
      "units": "km",
      "formula": "haversine(lat1, lon1, lat2, lon2), R = 6371.0088 km",
      "inputs": ["v01.f.coord_stanford", "v01.f.coord_boston"],
      "verified": true
    },
    {
      "id": "v01.h.snow",
      "kind": "hypothetical",
      "text": "Stanford students would face real snow.",
      "dependsOn": ["v01.f.boston_snow"],
      "wording": "conditional"
    }
  ]
}
```

Rules for every claim:

- `fact` needs `source.url`, `source.sourceDate` (or "undated"), `source.retrievedOn`, `units`, and `population`.
- `calculation` needs `formula` and `inputs` (claim ids or literal values with units).
- `hypothetical` needs `dependsOn` when it leans on a fact, and must not carry an invented `value`.
- `verified: false` means the claim was drafted from general knowledge and must be checked against the listed source before the concept goes to story planning.

## Status

| ID | Concept | Status |
|---|---|---|
| V01 | Stanford in Boston | Verified (sources fetched 2026-10-31) |
| V02–V12 | Remaining concepts | Draft briefs; facts listed with target sources but `verified: false` |

Population-wide concepts (V03, V06, V08, V10, V11, V12) must pin an IPEDS release and cohort definition before verification. See each brief's "Dataset and cohort" section.
