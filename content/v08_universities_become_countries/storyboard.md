# V08 storyboard: What if every university became a country?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V08.

## Fun take (somewhat realistic, funny)

Every campus becomes a tiny nation with a flag, a border, and a mascot-in-chief. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Maya as a border guard with a clipboard; mascots as heads of state (original designs, no real logos).

**Label on every imagined cue:** "Imagined scenario". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Hoover Tower with a flag on top and a tiny border fence around the Quad.
  - Caption: "What if every college became a country?" **[H]**
  - Sound: Trumpet fanfare.
- **Muted read:** A campus became a country.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** US map dotted with colleges.
  - Caption: "Right now, colleges are just dots on a map." **[S]** · facts: `v08.f.institution_count`
  - Sound: Map shimmer.
- **225–360:** Montage of school colors and cheering crowds.
  - Caption: "They already have colors, mascots, and loud fans." **[S]**
  - Sound: Crowd chant.
- **Muted read:** Colleges already act like teams.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** Flags shoot up from every dot at once.
  - Caption: "Then every campus declares independence." **[H]**
  - Sound: Flag snaps.
- **510–750:** Dotted borders draw themselves around campuses.
  - Caption: "Borders pop up across the whole map." **[H]**
  - Sound: Marker squeak.
- **750–900:** Size comparison: Stanford outline next to Monaco and Vatican City outlines.
  - Caption: "Stanford alone is bigger than Monaco and Vatican City." **[S]** · facts: `v08.c.stanford_km2`, `v08.c.compare`
  - Sound: Ding.
- **Muted read:** Every campus becomes a nation.

### 4. Consequences: 30–48 s (frames 900–1440)

- **BORDER DAY, 900–1080:** Maya stamping a student's passport at a campus gate.
  - Caption: "Problem 1: Visiting a friend needs a passport." **[H]**
  - Sound: Stamp thunk.
- **TRADE DAY, 1080–1260:** Students trading meal-swipe cards at a border market stall.
  - Caption: "Problem 2: Meal swipes become the currency." **[H]**
  - Sound: Card beeps, coin clinks.
- **SUMMIT DAY, 1260–1440:** Two mascots shake hands at a table on the 50-yard line.
  - Caption: "Problem 3: Football games turn into peace talks." **[H]**
  - Sound: Handshake, crowd 'awww'.
- **Muted read:** Passports, pizza money, peace talks.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Hundreds of flags around a big round table.
  - Caption: "So they all form one giant Student Union." **[H]** · facts: `v08.h.un`
  - Sound: Gavel, applause.
- **1590–1710:** Split: plain map (top) vs map full of flags (bottom).
  - Caption: "Same campuses. Way more flags." **[H]**
  - Sound: Chime.
- **Muted read:** They unite.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Blank flag waving, waiting to be designed.
  - Caption: "What would your college's flag look like?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "Colleges become countries with borders and flags, chaos follows, then they form a Student Union."

## Renderer gaps (for Patrick)

- Fictional border overlay
- Original flag generator (no trademarked logos)
- Area-comparison overlay

## Fact notes

- Cue 6 needs v08.f.monaco_area and v08.f.vatican_area verified (Stanford 33.8 km² is verified)
- Cue 3 is general description; no source label needed
