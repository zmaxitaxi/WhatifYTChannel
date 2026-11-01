# V09 storyboard: What if Stanford never existed?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V09.

## Fun take (somewhat realistic, funny)

A giant eraser rubs Stanford out of history. Horses move back in. Everything is phrased as 'might'. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Theo slowly fading out like a photo; a horse named Leland for comic relief.

**Label on every imagined cue:** "Alternate history". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** A giant pencil eraser rubs out Hoover Tower; Theo fades, alarmed.
  - Caption: "What if Stanford never existed?" **[H]**
  - Sound: Eraser squeak.
- **Muted read:** Stanford gets erased.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Sepia scene: a horse farm, a founding sign.
  - Caption: "In 1885, the Stanfords founded a university." **[S]** · facts: `v09.f.stanford_founded`
  - Sound: Old-film flicker.
- **225–360:** Horses grazing where the Main Quad will be.
  - Caption: "They built it on their horse farm. 'The Farm.'" **[S]** · facts: `v09.f.farm`
  - Sound: Neigh.
- **Muted read:** How Stanford started, on a farm.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** Clock spins backward; eraser appears.
  - Caption: "Now rewind the clock and grab an eraser." **[H]**
  - Sound: Tape rewind.
- **510–750:** Buildings dissolve in reverse order of construction.
  - Caption: "Stanford fades out, one building at a time." **[H]**
  - Sound: Soft erase sweeps.
- **750–900:** Horses wander back onto empty fields.
  - Caption: "And the farm might have stayed a farm." **[H]**
  - Sound: Happy neigh.
- **Muted read:** History is rewound.

### 4. Consequences: 30–48 s (frames 900–1440)

- **1939, 900–1080:** An empty garage with a question mark over it.
  - Caption: "Question 1: Would HP's founders have met here?" **[H]** · facts: `v09.f.hp`, `v09.h.hp`
  - Sound: Question 'boop'.
- **1990s, 1080–1260:** A laptop floating over a map, looking for a home.
  - Caption: "Question 2: Would Google start somewhere else?" **[H]** · facts: `v09.f.google`, `v09.h.google`
  - Sound: Typing, then 'hmm'.
- **TODAY, 1260–1440:** Skyline of tech offices flickering in and out.
  - Caption: "Question 3: Would Silicon Valley still be here?" **[H]** · facts: `v09.h.valley`
  - Sound: Glitch sound.
- **Muted read:** Big open questions about tech history.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Leland the horse in sunglasses in front of a barn.
  - Caption: "Maybe it's still horses and hay." **[H]**
  - Sound: Country guitar lick.
- **1590–1710:** Split: campus (top) vs farm (bottom), same angle.
  - Caption: "Same land. A whole different story." **[H]**
  - Sound: Chime.
- **Muted read:** Farm vs campus.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Theo reappears holding a pitchfork, confused.
  - Caption: "What would be there instead?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "Stanford is erased from history and we ask what Silicon Valley would look like without it."

## Renderer gaps (for Patrick)

- Reverse-construction dissolve
- Sepia 'history' environment preset
- Horse asset

## Fact notes

- Consequences are phrased as questions (plan rule: conditional language)
- Changed 'Problem' to 'Question' stamps for this one
- v09.f.hp, v09.f.google, v09.f.farm unverified
