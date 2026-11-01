# V04 storyboard: What if Harvard moved to California?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V04.

## Fun take (somewhat realistic, funny)

America's oldest college goes full beach mode. Brick and ivy meet surfboards and sunscreen. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Theo as a Harvard student in a scarf; later in sunglasses and flip-flops.

**Label on every imagined cue:** "Imagined relocation". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Harvard Yard's red brick buildings sitting on a sunny beach; Theo in a scarf, sweating.
  - Caption: "What if Harvard moved to California?" **[H]**
  - Sound: Seagulls plus a whoosh-hit.
- **Muted read:** Harvard is somewhere it doesn't belong.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Snowy Harvard Yard, Widener Library steps.
  - Caption: "Harvard: founded 1636. Brick, ivy, and big libraries." **[S]** · facts: `v04.f.founded`, `v04.f.landmarks`
  - Sound: Wind, church bell.
- **225–360:** Students trudging through knee-deep snow. Counter 0 → 49 in.
  - Caption: "Boston gets about 49 inches of snow a year." **[S]** · facts: `v04.f.boston_snow`
  - Sound: Crunching footsteps.
- **Muted read:** This is snowy, historic Harvard.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** The Yard lifts like a cake out of a pan.
  - Caption: "Then Harvard Yard pops off the map." **[H]**
  - Sound: Cork pop, rumble.
- **510–750:** Map route Cambridge → LA. Counter 0 → 4,180 km.
  - Caption: "It flies about 4,180 km west to Los Angeles." **[S]** **[T]** · facts: `v04.c.distance_la`
  - Sound: Jet whoosh.
- **750–900:** The Yard plops down by the ocean; a wave splashes a statue.
  - Caption: "And lands right next to the beach." **[H]**
  - Sound: Splash.
- **Muted read:** Harvard flies to the LA coast.

### 4. Consequences: 30–48 s (frames 900–1440)

- **WEEK 1, 900–1080:** Ivy on the brick walls goes crispy and brown; a groundskeeper with a hose.
  - Caption: "Problem 1: The ivy dries out in the sun." **[H]**
  - Sound: Hose spray, sizzle.
- **WEEK 2, 1080–1260:** Professor lecturing from a lifeguard chair; students on towels.
  - Caption: "Problem 2: Lectures move to the beach." **[H]**
  - Sound: Waves, whistle.
- **WEEK 3, 1260–1440:** Royce Hall and Widener Library stare each other down across a street.
  - Caption: "Problem 3: UCLA is suddenly a neighbor." **[H]** · facts: `v04.h.neighbour`
  - Sound: Western standoff whistle.
- **Muted read:** Three funny side effects of the move.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Brick gets white stucco, ivy becomes succulents, surfboards lean on Widener.
  - Caption: "So Harvard gets a California makeover." **[H]**
  - Sound: Montage swoosh.
- **1590–1710:** Split: snowy Yard (top) vs beach Yard (bottom).
  - Caption: "Same crimson. Way more sunscreen." **[H]**
  - Sound: Chime.
- **Muted read:** Harvard redesigned for California.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Theo in sunglasses holding a snow shovel and a surfboard, deciding.
  - Caption: "Would you trade snow for surf?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "Harvard moves from snowy Cambridge to the LA beach, melts a little, and gets a makeover."

## Renderer gaps (for Patrick)

- Harvard identity kit
- Beach environment preset
- Wilting-ivy gag animation

## Fact notes

- v04.f.founded (1636, unverified)
- v04.f.boston_snow = V01's verified 49.2 in
- Destination assumed Los Angeles (v04.a.destination), matches 4,180 km calc
