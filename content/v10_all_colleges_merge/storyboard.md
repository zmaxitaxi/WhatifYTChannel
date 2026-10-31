# V10 storyboard: What if all colleges merged into one campus?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V10.

## Fun take (somewhat realistic, funny)

Every campus drifts into one ridiculous mega-campus in the middle of the country. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Maya with a map that keeps unfolding; mascots crowding one stadium.

**Label on every imagined cue:** "Imagined scenario". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Hoover Tower, the Great Dome, Royce Hall and Sather Tower squished side by side.
  - Caption: "What if all colleges became one campus?" **[H]**
  - Sound: Squish sound.
- **Muted read:** Landmarks squished together.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** US map with all college dots.
  - Caption: "America has thousands of colleges." **[S]** · facts: `v10.f.institution_count`
  - Sound: Shimmer.
- **225–360:** Quick montage of different landmarks.
  - Caption: "Each has its own buildings and traditions." **[S]**
  - Sound: Four quick stings.
- **Muted read:** Many separate colleges today.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** Map: every dot lifts slightly and turns toward the center.
  - Caption: "Then every campus starts moving to one spot." **[H]**
  - Sound: Low hum.
- **510–750:** All dots slide toward Kansas.
  - Caption: "Every campus slides toward the middle of the map." **[H]** **[T]**
  - Sound: Sliding whoosh.
- **750–900:** Campuses press together edge to edge; a dust cloud and a car alarm.
  - Caption: "And they all squeeze together." **[H]**
  - Sound: Crunch, car alarm.
- **Muted read:** They get pulled together.

### 4. Consequences: 30–48 s (frames 900–1440)

- **MONDAY, 900–1080:** Maya with an unfolding map, walking at sunset.
  - Caption: "Problem 1: The walk to class takes all day." **[H]**
  - Sound: Footsteps, yawn.
- **GAME DAY, 1080–1260:** Stadium packed with mascots.
  - Caption: "Problem 2: Every mascot shows up to one game." **[H]**
  - Sound: Chaotic crowd roar.
- **LUNCH, 1260–1440:** Line disappearing over the horizon.
  - Caption: "Problem 3: The dining hall line never ends." **[H]**
  - Sound: Stomach growl.
- **Muted read:** Distance, crowds, lines.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Generated master layout with landmark districts.
  - Caption: "So they build one mega-campus." **[H]** · facts: `v10.a.layout`
  - Sound: Building montage.
- **1590–1710:** Orbit of the mega-campus, all towers visible.
  - Caption: "Every landmark. One very crowded campus." **[H]**
  - Sound: Chime.
- **Muted read:** A mega-campus.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Maya choosing between towers.
  - Caption: "Which landmark would you visit first?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "Every college gets pulled into one giant campus, and walking to class takes all day."

## Renderer gaps (for Patrick)

- Generated master layout (aggregation)
- Magnet prop
- Instanced map dots sliding

## Fact notes

- Mega-campus is an 'Illustrative layout' (v10.a.layout); no land-area claim
- v10.c.stanfords ('N Stanfords') can be added once IPEDS totals land
