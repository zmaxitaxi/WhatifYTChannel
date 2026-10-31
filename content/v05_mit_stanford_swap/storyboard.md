# V05 storyboard: What if MIT and Stanford swapped locations?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V05.

## Fun take (somewhat realistic, funny)

Two nerd capitals trade coasts. MIT gets room to stretch; Stanford has to squeeze into the city. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** An MIT student with a robot sidekick; Theo from Stanford.

**Label on every imagined cue:** "Imagined swap". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** The Great Dome rising out of Cambridge while Hoover Tower rises out of Palo Alto, split screen.
  - Caption: "What if MIT and Stanford swapped places?" **[H]**
  - Sound: Twin rumble.
- **Muted read:** Two campuses are lifting off.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Killian Court and the Great Dome on the river; a little robot rolls by.
  - Caption: "MIT: the Great Dome, the Charles River, and robots." **[S]** · facts: `v05.f.great_dome`
  - Sound: Servo whirr.
- **225–360:** Wide aerial of Stanford's huge open land.
  - Caption: "Stanford: Hoover Tower and 8,353 acres of room." **[S]** · facts: `v05.f.stanford_acres`
  - Sound: Birds, breeze.
- **Muted read:** Two very different campuses.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** Both campuses rise out of the ground on opposite coasts, split screen.
  - Caption: "Both campuses lift off at the same time." **[H]**
  - Sound: Double rumble.
- **510–750:** Map: the two campuses pass each other over Kansas. Counter 0 → 4,326 km.
  - Caption: "They cross the country, about 4,326 km each way." **[S]** **[T]** · facts: `v05.c.distance`
  - Sound: Two whooshes crossing.
- **750–900:** Great Dome lands among palms; Hoover Tower lands on the Charles.
  - Caption: "And each lands where the other used to be." **[H]**
  - Sound: Two landing thuds.
- **Muted read:** They swap coasts.

### 4. Consequences: 30–48 s (frames 900–1440)

- **DAY 1, 900–1080:** MIT buildings tiny in a huge field; robot gets lost.
  - Caption: "Problem 1: MIT suddenly has way too much space." **[H]** · facts: `v05.c.area_ratio`
  - Sound: Echo 'hello?'
- **DAY 2, 1080–1260:** Stanford buildings stacked like Tetris between Cambridge blocks.
  - Caption: "Problem 2: Stanford has to squeeze into the city." **[H]** · facts: `v05.c.area_ratio`
  - Sound: Tetris-like clicks.
- **FIRST WINTER, 1260–1440:** Theo in shorts as a snowball hits him.
  - Caption: "Problem 3: Stanford students meet real snow." **[H]**
  - Sound: Snowball thwump.
- **Muted read:** Space and weather problems.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Great Dome sprouts solar panels and palms; Hoover Tower gets a snowplow.
  - Caption: "By spring, both campuses adapt." **[H]**
  - Sound: Montage swoosh.
- **1590–1710:** Split: Dome in sun (top), Hoover in snow (bottom).
  - Caption: "Same schools. Totally swapped weather." **[H]**
  - Sound: Chime.
- **Muted read:** Both adapt to new homes.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** MIT student and Theo each hold up their school's color.
  - Caption: "Which one would you rather attend?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "MIT and Stanford fly across the country, swap places, and deal with space and snow."

## Renderer gaps (for Patrick)

- MIT identity kit
- Rocket prop
- Tetris-style squeeze layout (could reuse V10 aggregation)

## Fact notes

- v05.c.area_ratio needs MIT acreage before any 'N times bigger' caption; current captions avoid the number
- Avoid duplicating V01's route shot: use the mid-air high-five instead
