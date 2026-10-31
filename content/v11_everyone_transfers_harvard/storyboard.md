# V11 storyboard: What if every student transferred to Harvard?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V11.

## Fun take (somewhat realistic, funny)

Every college student in America shows up at Harvard Yard on the same morning. Chaos, gently. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Theo as the Harvard student who just wanted a coffee; an illustrative crowd.

**Label on every imagined cue:** "Imagined scenario". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Theo opens his dorm door to a wall of students.
  - Caption: "What if every student transferred to Harvard?" **[H]**
  - Sound: Door creak, crowd roar.
- **Muted read:** Way too many students at Harvard.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Calm Yard, a few students reading on the grass.
  - Caption: "Harvard Yard on a normal day." **[S]**
  - Sound: Birds.
- **225–360:** Theo strolls with a coffee.
  - Caption: "Calm, quiet, and plenty of room." **[S]**
  - Sound: Sip.
- **Muted read:** Normal, calm Harvard.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** Phones everywhere tapping a big red TRANSFER button.
  - Caption: "Then everyone hits 'transfer' at once." **[H]**
  - Sound: Rapid clicks.
- **510–750:** Map: crowd rivers flowing into Cambridge. Label: 'Illustrative crowd'.
  - Caption: "Students stream in from every state." **[H]** **[T]** · facts: `v11.a.crowd`
  - Sound: Stampede rumble.
- **750–900:** Yard fills like a bathtub.
  - Caption: "Harvard Yard fills up in seconds." **[H]** · facts: `v11.h.overflow`
  - Sound: Water-fill gurgle.
- **Muted read:** Everyone moves to Harvard.

### 4. Consequences: 30–48 s (frames 900–1440)

- **FIRST CLASS, 900–1080:** Professor on a jumbotron in a packed stadium.
  - Caption: "Problem 1: Lectures need a stadium. Maybe ten." **[H]**
  - Sound: Mic feedback.
- **FIRST NIGHT, 1080–1260:** Dorm room with bunk beds stacked to the ceiling.
  - Caption: "Problem 2: Roommates. So many roommates." **[H]**
  - Sound: Snoring chorus.
- **FIRST MORNING, 1260–1440:** Coffee line looping around Harvard Square; Theo at the very back.
  - Caption: "Problem 3: The coffee line wraps around Harvard Square." **[H]**
  - Sound: Long sigh.
- **Muted read:** Classes, dorms, coffee all overflow.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Brick dorm skyscrapers shoot up into the clouds.
  - Caption: "So Harvard builds up. Way, way up." **[H]**
  - Sound: Rising whoosh.
- **1590–1710:** Split: calm Yard (top) vs packed Yard (bottom).
  - Caption: "Same Harvard Yard. Slightly more crowded." **[H]**
  - Sound: Chime.
- **Muted read:** Harvard grows vertically.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Theo, squished, gives a thumbs up.
  - Caption: "Would you transfer?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "Every student moves to Harvard, everything overflows, and Harvard builds skyscraper dorms."

## Renderer gaps (for Patrick)

- Crowd-flow rivers on the map
- Instanced crowd filling the Yard
- Stacked-bunk dorm gag

## Fact notes

- Crowd is illustrative (v11.a.crowd): add '1 figure ≈ N students' label once v11.c.multiple is calculated
- No numbers until v11.f.harvard_enrollment and IPEDS totals are pinned
