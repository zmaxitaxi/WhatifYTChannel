# V03 storyboard: What if every public university disappeared?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V03.

## Fun take (somewhat realistic, funny)

Public colleges quietly blink off the map overnight. Private schools are left standing awkwardly in the silence. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Maya (public-college student), a private-school student in a blazer for the punchline.

**Label on every imagined cue:** "Imagined scenario". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Royce Hall and Sather Tower blink out with a 'poof' cloud. Maya, mid-bite of a sandwich, freezes.
  - Caption: "What if every public university vanished overnight?" **[H]**
  - Sound: Cartoon poof, gasp.
- **Muted read:** Famous public campuses vanish.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Dark US map lighting up with thousands of dots.
  - Caption: "This is every college in America." **[S]** · facts: `v03.f.public_count`
  - Sound: Rising shimmer as dots appear.
- **225–360:** Public dots glow blue; close-ups of the Campanile and Royce Hall.
  - Caption: "Most of them are public, like Berkeley and UCLA." **[S]** · facts: `v03.f.examples`
  - Sound: Two pops.
- **Muted read:** There are lots of colleges and most are public.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** Close-up: a public campus sign, then empty grass where the buildings were.
  - Caption: "Then one morning, they're just gone." **[H]**
  - Sound: Silence, one bird.
- **510–750:** Blue dots pop out in waves west to east. Only a few gold dots remain.
  - Caption: "Poof. Poof. Poof. State by state." **[H]** **[T]**
  - Sound: Rapid poof chain.
- **750–900:** Hoover Tower and Harvard Yard stand alone, spotlit, slightly embarrassed.
  - Caption: "Only the private colleges are left." **[H]** · facts: `v03.h.privates_remain`
  - Sound: Cricket chirps.
- **Muted read:** Public colleges disappear across the map.

### 4. Consequences: 30–48 s (frames 900–1440)

- **MONDAY, 900–1080:** Maya standing in an empty field holding a backpack, worried.
  - Caption: "Problem 1: Most students suddenly have no campus." **[H]** · facts: `v03.c.public_share`
  - Sound: Wind, single tumbleweed roll.
- **SATURDAY, 1080–1260:** Empty stadium, one mascot alone in the stands.
  - Caption: "Problem 2: Game day? Mostly canceled." **[H]**
  - Sound: Lonely kazoo.
- **APPLICATION DAY, 1260–1440:** An admissions page frozen on a spinning loading wheel; admissions staff staring.
  - Caption: "Problem 3: Every private college's website crashes." **[H]**
  - Sound: Error beep, keyboard mashing.
- **Muted read:** Students, sports, and admissions all break.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** A lecture squeezed into a public library; a study group packing a coffee shop.
  - Caption: "So classes move into libraries and coffee shops." **[H]**
  - Sound: Espresso machine hiss.
- **1590–1710:** Split: full campus before (top), parking-lot campus after (bottom).
  - Caption: "Same students. Way fewer buildings." **[H]**
  - Sound: Chime.
- **Muted read:** Students improvise.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Maya looks at the camera holding a tiny model campus.
  - Caption: "Which campus would you miss most?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "Public colleges disappear, most students have nowhere to go, and they rebuild in parking lots."

## Renderer gaps (for Patrick)

- Instanced national college markers with filter-by-control
- Disappearance 'poof' effect
- Giant prop key
- Mailbox explosion particle effect

## Fact notes

- v03.f.public_count, v03.c.public_share: needed before any number goes on screen; captions avoid numbers until then
