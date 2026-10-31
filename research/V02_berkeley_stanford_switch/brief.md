# V02 — What if Berkeley and Stanford switched campuses?

- **Scenario family:** swap (Paired movement, swap, comparison)
- **Status:** draft. Facts below are from general knowledge and target sources; each needs checking before story beats.
- **Fact pack:** [factpack.json](factpack.json)

## Premise in one line

The two Bay Area rivals trade campuses: Cal's students land among Stanford's sandstone and palms, Stanford's land in Berkeley's hills next to Sather Tower.

## Original situation (facts and calculations)

| Claim | Kind | Verified | Target source |
|---|---|---|---|
| UC Berkeley was founded in 1868 as the first campus of the University of California. | fact | no | https://www.berkeley.edu/about/history-discoveries |
| Sather Tower (the Campanile) is about 307 feet tall and was completed in 1914. | fact | no | https://www.berkeley.edu/ |
| Berkeley is a public university; Stanford is private. | fact | no | https://www.universityofcalifornia.edu/ |
| Stanford was founded in 1885 and opened in 1891. | fact | yes | https://facts.stanford.edu/ |
| Stanford's campus covers 8,353 acres. | fact | yes | https://facts.stanford.edu/ |
| Berkeley's campus area (central campus and total holdings, definition to pin). | fact | no | https://www.berkeley.edu/about/ |
| Cal and Stanford have played the Big Game in football since 1892. | fact | no | https://en.wikipedia.org/wiki/Big_Game_(American_football) |
| Stanford reference coordinate (Stanford, CA). | fact | no | https://www.naturalearthdata.com/ |
| Berkeley reference coordinate (Berkeley, CA). | fact | no | https://www.naturalearthdata.com/ |
| The two campuses are about 50 km apart in a straight line. | calculation | yes | haversine(lat1, lon1, lat2, lon2) with R = 6371.0088 km |

## Assumptions (disclose)

- Only the student bodies and identities swap; buildings stay put (or the reverse, pick one in story beats). *Disclosure:* Premise caption states what moves

## What changes (hypothetical, must be labeled)

- Berkeley and Stanford trade campuses.
- Students would look up at a different tower: Sather instead of Hoover. (leans on v02.f.sather_tower)
- Would the Big Game still feel the same if the home fields were swapped? (leans on v02.f.big_game)

## Do not say

- Do not say Berkeley would become private or Stanford public; only the campus location swaps.
- No tuition or admissions consequences.

## Open questions

1. Pin which campus-area definition to compare (Berkeley central campus vs total land).
2. Decide whether people move, buildings move, or both.
