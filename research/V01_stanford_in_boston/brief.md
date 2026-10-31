# V01 — What if Stanford was in Boston?

- **Scenario family:** relocation (route tracking, destination redesign)
- **Status:** verified, ready for story beats (task 2)
- **Fact pack:** [factpack.json](factpack.json)
- **Renderer fixture it feeds:** `renderer/fixtures/v01_stanford_boston_slice.json`

## Premise in one line

Stanford's campus lifts out of the Bay Area and lands in Boston, where it has to survive New England winters and share a city with Harvard and MIT.

## Original situation (facts)

| Claim | Value | Source |
|---|---|---|
| Founded / opened | 1885 / 1891, by Leland and Jane Stanford | facts.stanford.edu |
| Campus size | 8,353 acres, 630 buildings | facts.stanford.edu |
| Enrollment, Autumn 2025 | 7,289 undergraduate, 10,025 graduate | facts.stanford.edu |
| Hoover Tower | 285 ft (87 m), finished 1941, architect Arthur Brown Jr. | facts.stanford.edu/about; Wikipedia |
| Location | Stanford, California, San Francisco Bay Area | facts.stanford.edu/about |

## Destination (facts)

| Claim | Value | Source |
|---|---|---|
| Boston average yearly snowfall | 49.2 in (125 cm), 1991–2020 normals, Logan Airport | NOAA NCEI normals via Current Results; CBS Boston (May 4, 2021) |
| Boston January snowfall | 14.3 in | same |
| Boston January average high / low | 37 °F / 23 °F (3 °C / −5 °C) | Current Results, NOAA 1991–2020 normals |

## Calculations

| Claim | Value | Formula |
|---|---|---|
| Stanford to Boston distance | 4,329 km (2,690 mi) great-circle | Haversine, R = 6371.0088 km, Stanford 37.4275, −122.1697 → Boston 42.3601, −71.0589 |
| Stanford (relocated) to Harvard/MIT area | about 4,325 km travelled to land a few km from Cambridge | Haversine to Cambridge 42.3736, −71.1097 |
| Total enrollment | 17,314 | 7,289 + 10,025 |

## What changes (hypothetical, must be labeled)

1. The campus relocates. This is an **imagined relocation**; transit time is compressed and must carry the `TIME SCALE: IMAGINED TRANSIT` label.
2. The destination is redesigned: sandstone arcades and red tile roofs under snow, palm trees swapped or wrapped. This is a visual design choice, not a claim.
3. Consequences we may show, all with conditional wording:
   - Students would trade a mild Bay Area winter for about 49 inches of snow a year (number comes from the fact, the experience is hypothetical).
   - Stanford would sit within a few kilometres of Harvard and MIT, so the three would compete for the same city. Do **not** claim any effect on admissions, rankings, or applicant numbers.
   - Silicon Valley loses its namesake university next door. Keep it as a question ("Would Silicon Valley still grow here?"), not an economic claim.

## Do not say

- Any invented admissions, ranking, endowment, or economic effect.
- "Stanford would become #1 in Boston" or similar rank claims.
- Exact Bay Area snowfall numbers unless we add a sourced Palo Alto normal (open question 1).
- That the move takes a real duration; animation time is not a measurement.

## Caption-ready lines (≤ 2 lines, ≤ 2.5 words/s)

| Beat | Caption | Kind | sourceLabel |
|---|---|---|---|
| Hook 0–3 s | What if Stanford moved to Boston? | hypothetical | — |
| Setup | Founded 1885. 8,353 acres in California. | fact | Stanford Facts 2025 |
| Lift | Hoover Tower: 285 feet, built 1941. | fact | Stanford Facts |
| Transit | 4,329 km across the country. | calculation | Great-circle calculation |
| Arrival | Boston gets about 49 inches of snow a year. | fact | NOAA 1991–2020 normals |
| Consequence | Sandstone arcades would meet real winters. | hypothetical | Imagined scenario |
| Reveal | Harvard and MIT would be neighbours. | hypothetical | Imagined scenario |

Note for the fixture: `cap_03` currently says "4,300 km". That rounds correctly, but "about 4,330 km" or "4,329 km" matches the calculation exactly.

## Open questions

1. Palo Alto January normals and snowfall for a side-by-side climate card. NOAA's San Jose or Palo Alto station 1991–2020 normals would work; not fetched yet.
2. Do we want a Harvard and MIT landmark cameo at arrival? That needs Patrick's identity kits.
