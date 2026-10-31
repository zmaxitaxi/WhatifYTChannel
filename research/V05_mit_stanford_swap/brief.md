# V05 — What if MIT and Stanford swapped locations?

- **Scenario family:** swap (Swap, identity preservation)
- **Status:** draft. Facts below are from general knowledge and target sources; each needs checking before story beats.
- **Fact pack:** [factpack.json](factpack.json)

## Premise in one line

Two tech giants trade coasts. MIT's Great Dome lands in Silicon Valley; Hoover Tower lands on the Charles River.

## Original situation (facts and calculations)

| Claim | Kind | Verified | Target source |
|---|---|---|---|
| MIT was founded in 1861 and moved to its Cambridge campus in 1916. | fact | no | https://www.mit.edu/about/ |
| MIT's Cambridge campus area. | fact | no | https://web.mit.edu/facts/ |
| The Great Dome tops Building 10 overlooking Killian Court. | fact | no | https://web.mit.edu/facts/ |
| Stanford's campus covers 8,353 acres. | fact | yes | https://facts.stanford.edu/ |
| MIT reference coordinate (Cambridge, MA). | fact | no | https://www.naturalearthdata.com/ |
| Stanford reference coordinate (Stanford, CA). | fact | no | https://www.naturalearthdata.com/ |
| MIT to Stanford is about 4,326 km great-circle. | calculation | yes | haversine(lat1, lon1, lat2, lon2) with R = 6371.0088 km |
| Stanford's campus is N times the size of MIT's. | calculation | no | stanford_acres / mit_acres |

## Assumptions (disclose)

- The relocated campuses are redesigned to fit the destination footprint; landmarks are preserved. *Disclosure:* Visual only, no label needed beyond 'Imagined swap'

## What changes (hypothetical, must be labeled)

- MIT and Stanford swap locations.
- MIT would have far more room to spread out in Palo Alto. (leans on v05.c.area_ratio)
- Stanford would have to squeeze onto a much smaller urban site. (leans on v05.c.area_ratio)

## Keep real

- No claims about which school would 'win' Silicon Valley or startups.
- Size contrast is the hero comparison; it must be the calculated ratio.

## Open questions

1. Pin MIT's official campus acreage.
2. Overlap with V01 route shot; vary camera and destination redesign.

## Fun take (realistic and funny)

**Vibe:** Two nerdy rivals compare floor plans. Every joke is a spec sheet joke.

**Beats:**

1. Side-by-side: Stanford's 8,353 acres vs. MIT's much smaller footprint. The size gap is the hero stat.
2. MIT lands in Palo Alto, looks around, and starts building out instead of up.
3. Stanford lands in Cambridge, and the Main Quad gets squeezed between the Charles River and Massachusetts Avenue.
4. Hoover Tower finds the new skyline crowded. The Great Dome finds the new skyline empty.
5. Both schools discover their commute is now a bus ride instead of a bike ride (or vice versa).

**Punchline:** The VC office near Stanford and the Kendall Square biotech startups swap neighbors. Nobody notices for a week.

**End-card question:** Which school would win the swap?
