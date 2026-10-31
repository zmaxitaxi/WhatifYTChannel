# V01 storyboard: What if Stanford was in Boston?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920.
Caption track: [captions.json](captions.json). Check it with `python3 content/tools/check_captions.py content/v01_stanford_boston/captions.json`.

This storyboard extends Patrick's 12-second slice in [renderer/fixtures/v01_stanford_boston_slice.json](../../renderer/fixtures/v01_stanford_boston_slice.json) into the full Short. It reuses the same character (`student_maya`), Stanford kit, route, and Boston snow preset wherever possible.

## Style notes taken from the reference shorts

The three reference shorts are viral "what if" explainers ("What if the sun vanished for 24 hours?", "What if you sold Pop Rocks to Vikings? (Day 1–3)", "What if you had AI in Ancient Greece?"). I could only read their titles and channels, not watch them, so these notes come from the titles plus the OutwardAnimates reference in CONTEXT.md. Francis should sanity-check them against the actual videos.

| What they do | How V01 uses it |
|---|---|
| The question is the first frame. No intro, no logo. | Frame 0 already shows Hoover Tower in Boston snow with the question on screen. |
| Time progression gives the video chapters ("Day 1–3"). | Consequences use stamps: FIRST WINTER, FIRST MAP CHECK, FIRST RIVALRY. |
| A reacting character carries the emotion. | Maya reacts at the hook, the snow beat, and the ending. |
| One number at a time, big and animated. | Three counters only: miles, inches of snow, percent of Boston. |
| Ends on a question to drive comments. | Final caption: "Would you still apply?" |

## Beat sheet

The beats follow the plan's default structure (TECHNICAL_PLAN.md, "Story structure").

| Time | Beat | Purpose |
|---|---|---|
| 0–3 s | Hook | Show the hypothetical immediately |
| 3–12 s | Establish | Stanford as it really is |
| 12–30 s | Transform | Lift, cross-country flight, landing |
| 30–48 s | Consequences | Snow, size, neighbors |
| 48–57 s | Reveal | Redesigned campus, before/after |
| 57–60 s | Resolve | Close the thought, prompt comments |

## Shot-by-shot storyboard

Frames are half-open `[start, end)`. Tags: **[H]** = hypothetical label shown, **[S]** = source label shown, **[T]** = time-scale label shown. "Gap" marks something the renderer cannot do yet.

### 1. Hook — 0–3 s (frames 0–90)

- **Picture:** Close-up of Maya, surprised, pointing over her shoulder. Behind her, out of focus, Hoover Tower stands in falling snow with a brick Boston skyline.
- **Camera:** `character_closeup`, slight push-in.
- **Caption:** "What if Stanford was in Boston?" **[H]**
- **Sound:** wind gust plus a short "whoosh-hit" on frame 0.
- **Muted read:** Stanford's tower is in a snowy city and someone is shocked.
- **Gap:** the slice puts Maya in `california_sunny`; this shot needs her in `boston_snowy` with the tower behind her.

### 2. Establish — 3–12 s (frames 90–360)

- **Shot 2a (90–225):** Slow orbit of the Main Quad and Hoover Tower in sun. Caption: "This is Stanford, in sunny Palo Alto, California."
- **Shot 2b (225–360):** Low dolly along a palm-lined path to red-tile roofs. Caption: "Palm trees, red-tile roofs, and basically zero snow." **[S]**
- **Camera:** `cinematic_orbit`, then `static_establish` with drift.
- **Sound:** light birds and campus ambience; bicycle bell at 2b.
- **Muted read:** this is normal, warm, sunny Stanford.

### 3. Transform — 12–30 s (frames 360–900)

- **Shot 3a (360–510):** Ground cracks around the campus; the whole campus lifts with a dust ring. Maya (small, in the foreground) looks up, worried. Caption: "Now imagine the whole campus lifting off." **[H]**
- **Shot 3b (510–750):** Map view. The campus icon arcs from Palo Alto to Boston along the route. Counter climbs 0 → 2,690 mi. Caption: "It flies 2,690 miles across the country." **[S]** **[T]**
- **Shot 3c (750–900):** Descent onto the Charles River bank, Boston skyline behind. Snow starts. Caption: "And lands in Boston, right on the Charles River." **[H]**
- **Camera:** `cinematic_orbit` → `map_route_tracking` → `cinematic_orbit`.
- **Sound:** low rumble build, jet whoosh across the map, heavy landing thud on frame 840.
- **Muted read:** the campus physically moved from California to Boston.

### 4. Consequences — 30–48 s (frames 900–1440)

- **Shot 4a, FIRST WINTER (900–1080):** Snow piles on red-tile roofs and the palm trees droop. Maya in shorts, arms crossed, worried. Counter 0 → 49 in. Caption: "Problem 1: Boston gets about 49 inches of snow a year." **[S]**
- **Shot 4b, FIRST MAP CHECK (1080–1260):** Top-down Boston map. Stanford's real footprint is laid over it and covers a big chunk of the city. Counter 0 → 27%. Caption: "Problem 2: Stanford is a quarter the size of Boston." **[S]**
- **Shot 4c, FIRST RIVALRY (1260–1440):** Wide shot. Stanford's tower on one side of the river, Harvard and MIT landmarks on the other, with Cardinal red, Crimson, and MIT gray labels. Caption: "Problem 3: Harvard and MIT are now its neighbors." **[H]**
- **Sound:** a "stamp" hit for each chapter card; teeth-chatter at 4a; map-zoom swish at 4b; crowd "ooh" at 4c.
- **Muted read:** three clear problems, each with one picture and one number.
- **Gaps:** footprint-overlay-on-map (4b), Harvard and MIT kits placed together (4c), palm "droop", and a chapter-stamp overlay component.

### 5. Reveal — 48–57 s (frames 1440–1710)

- **Shot 5a (1440–1590):** Time-lapse rebuild: sandstone arcades turn to brick, palms become bare maples, roofs get steeper. Hoover Tower stays. Caption: "So the campus gets rebuilt for New England." **[H]**
- **Shot 5b (1590–1710):** Split screen. Top half: sunny Palo Alto Stanford. Bottom half: snowy Boston Stanford. Same camera angle on Hoover Tower. Caption: "Same Hoover Tower. Completely different Stanford." **[H]**
- **Camera:** `cinematic_orbit` → `split_comparison`.
- **Sound:** construction tick-tick swell, resolving into a single chime at the split.
- **Muted read:** the tower survived but everything around it changed.
- **Gap:** an in-shot redesign transition between two campus layouts.

### 6. Resolve — 57–60 s (frames 1710–1800)

- **Picture:** Maya in a winter coat in front of snowy Hoover Tower, confused shrug, then a small smile.
- **Camera:** `character_closeup`.
- **Caption:** "Would you still apply?" **[H]**
- **Sound:** wind settles; soft end sting.
- **Muted read:** the question is handed to the viewer.
- **Gap:** clothing swap (winter coat) and a shrug action.

## Fact checks needed (hand to the V01 fact pack, task 1)

Every number on screen needs a fact-pack entry before render. Values below are my working numbers, not yet verified against the sources.

| Claim | Working value | Where to verify |
|---|---|---|
| Palo Alto → Boston distance | 4,329 km / 2,690 mi | Verified as `v01.c.distance` (haversine, R = 6371.0088 km); the slice fixture's 4,334 km should be updated to match |
| Boston average yearly snowfall | 49.2 in | Verified as `v01.f.boston_snow` (NOAA 1991–2020 normals, Logan) |
| Palo Alto snowfall | effectively zero | NOAA normals for a nearby station |
| Stanford land area | 8,353 acres (verified in `research/V01_stanford_in_boston/factpack.json`) | facts.stanford.edu |
| Boston land area | ~48.3 sq mi (~30,900 acres) | U.S. Census Bureau |
| Stanford as share of Boston | ~27% (8,353 ÷ 30,900) | Calculation from the two rows above |

Do not add claims about admissions, rankings, or the economy. Everything after the landing is labeled as imagined except the snowfall and area numbers.

## Muted-comprehension check

Paper check on draft 1. The real check is the Day 3 task: watch the render muted, on a phone, at full size.

| Test | Result |
|---|---|
| Premise is clear by 3 s with no sound | Pass on paper: question caption plus tower-in-snow image |
| Each beat has one caption that stands alone | Pass: every caption is a full sentence |
| Reading load ≤ 2.5 words/s | Pass: max 2.0 words/s (checker output) |
| ≤ 2 lines per caption at 52 px | Pass on estimate (~30 chars/line); confirm on a render |
| No sound-only information | Pass: every sound cue doubles a visual event |
| Facts and imagined parts are visibly different | Pass: [H], [S], [T] labels on every cue |
| Viewer can retell it in one sentence | "Stanford moves to Boston, gets buried in snow, is too big, ends up next to Harvard and MIT, and is rebuilt in brick." |

## Changes needed from Patrick (renderer gaps)

1. Maya in `boston_snowy` with a landmark behind her (shot 1).
2. Campus footprint overlay on a city map (shot 4b).
3. Multiple university kits in one scene (shot 4c).
4. Layout-to-layout redesign transition (shot 5a).
5. Clothing swap and a shrug action (shot 6).
6. Chapter-stamp overlay (likely mine, under caption overlays, task 3).

If any gap slips, the fallback is a cut instead of a transition: hard cut from the Palo Alto layout to the Boston layout in 5a, and a static overlay image for 4b.
