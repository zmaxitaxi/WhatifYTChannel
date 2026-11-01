# V06 storyboard: What if every Ivy League university became public?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V06.

## Fun take (somewhat realistic, funny)

Eight old iron gates swing open at once. The punchline: public still doesn't mean free. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Maya in line; a stuffy professor character in a bow tie.

**Label on every imagined cue:** "Imagined status change". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Ivy-covered gates with a 'PUBLIC' sign slapped on; Maya surprised.
  - Caption: "What if the Ivy League went public?" **[H]**
  - Sound: Gate creak, gasp.
- **Muted read:** Ivy League gates labeled public.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Map of the Northeast with eight shields popping up one by one.
  - Caption: "There are eight Ivy League schools." **[S]** · facts: `v06.f.members`
  - Sound: Eight quick pops.
- **225–360:** Velvet rope, bouncer in a bow tie.
  - Caption: "All private. All old. All very hard to get into." **[S]** · facts: `v06.f.all_private`
  - Sound: Velvet rope clink.
- **Muted read:** Eight private, exclusive schools.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** State flags raised next to each Ivy's flag; a governor signing a document.
  - Caption: "Then each state takes control of its Ivy." **[H]**
  - Sound: Pen scratch, flag snap.
- **510–750:** Map: all eight shields flip from private gold to public blue.
  - Caption: "Eight iron gates swing open at once." **[H]**
  - Sound: Eight gate creaks in a row.
- **750–900:** A line of students snakes out from Harvard's gate.
  - Caption: "And the line outside starts to grow." **[H]**
  - Sound: Crowd murmur.
- **Muted read:** All eight become public.

### 4. Consequences: 30–48 s (frames 900–1440)

- **OPEN HOUSE, 900–1080:** Aerial: the line loops around the block twice.
  - Caption: "Problem 1: The tour line wraps around the block." **[H]**
  - Sound: Long beep.
- **BUDGET DAY, 1080–1260:** Lawmakers argue at a table piled with Ivy paperwork.
  - Caption: "Problem 2: Lawmakers now vote on their budgets." **[H]** · facts: `v06.h.in_state`
  - Sound: Gavel bangs.
- **FIRST BILL, 1260–1440:** Maya opens an envelope labeled TUITION, jaw drops.
  - Caption: "Problem 3: Public doesn't mean free. Surprise!" **[H]** · facts: `v06.f.public_tuition`, `v06.h.not_free`
  - Sound: Cash register 'cha-ching'.
- **Muted read:** Crowds, politics, and tuition still exists.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** New dorm towers sprout behind the old brick quads.
  - Caption: "So the Ivies grow to fit everyone." **[H]**
  - Sound: Construction montage.
- **1590–1710:** Split: quiet quad (top) vs packed quad (bottom).
  - Caption: "Same ivy. Much bigger crowds." **[H]**
  - Sound: Chime.
- **Muted read:** Campuses grow.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Maya in line, checking her watch.
  - Caption: "Would you still want to go?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "The Ivies go public, lines explode, lawmakers get involved, and it's still not free."

## Renderer gaps (for Patrick)

- Ivy shields on a regional map
- Gate-opening animation
- Long-line crowd flow (shared with V11)

## Fact notes

- Plan rule kept: never equates public with free (Problem 3 is the joke)
- v06.f.members = 8 (unverified)
