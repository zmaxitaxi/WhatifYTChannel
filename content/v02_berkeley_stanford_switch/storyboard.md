# V02 storyboard: What if Berkeley and Stanford switched campuses?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V02.

## Fun take (somewhat realistic, funny)

Two rivals 31 miles apart trade homes overnight and both hate it. The buildings and students swap; nobody gets a vote. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Maya (Berkeley student, hoodie), Theo (Stanford student, quarter-zip). Sather Tower and Hoover Tower as characters with faces painted on in the hook only.

**Label on every imagined cue:** "Imagined swap". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Sather Tower and Hoover Tower float past each other mid-air and do an awkward side-eye.
  - Caption: "What if Berkeley and Stanford switched campuses?" **[H]**
  - Sound: Two whooshes crossing, record scratch.
- **Muted read:** Two famous towers are trading places.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Sather Tower in morning fog; students with hand-painted signs.
  - Caption: "Berkeley: the Campanile, foggy hills, and big opinions." **[S]** · facts: `v02.f.sather_tower`
  - Sound: Bells, light crowd chatter.
- **225–360:** Sunny Main Quad, a golf cart putters past palm trees.
  - Caption: "Stanford: Hoover Tower, palm trees, and golf carts." **[S]** · facts: `v02.f.stanford_founded`
  - Sound: Golf cart beep, birds.
- **Muted read:** These are two different, very real campuses.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** Both campuses rise slowly out of the ground, dust and sprinklers still running.
  - Caption: "One night, both campuses lift off and swap." **[H]**
  - Sound: Low rumble, sprinkler hiss.
- **510–750:** Map: the two campuses inch past each other over a jammed Bay Area freeway. Counter 0 → 31 mi.
  - Caption: "Only 31 miles apart, and still stuck in traffic." **[S]** **[T]** · facts: `v02.c.distance`
  - Sound: Car horns, brake squeal.
- **750–900:** Maya wakes in a Stanford dorm, sees palm trees out the window, confused.
  - Caption: "Everyone wakes up on the wrong campus." **[H]**
  - Sound: Alarm clock, single 'huh?' sting.
- **Muted read:** The campuses physically swap.

### 4. Consequences: 30–48 s (frames 900–1440)

- **DAY 1, 900–1080:** Maya and friends joyride a golf cart through the Quad, celebrating.
  - Caption: "Problem 1: Berkeley students discover free golf carts." **[H]**
  - Sound: Engine putter, cheering.
- **DAY 2, 1080–1260:** Theo holds a neat sign reading 'Mild Concerns'. Crowd of three.
  - Caption: "Problem 2: Stanford students try protesting. Politely." **[H]**
  - Sound: Polite golf clap.
- **DAY 3, 1260–1440:** Stadium split down the middle, both bands confused which side is home.
  - Caption: "Problem 3: The Big Game is a home game for both." **[H]** · facts: `v02.f.big_game`
  - Sound: Marching band clash, crowd 'ohh'.
- **Muted read:** Each group of students is out of place.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Fog rolls onto the palm trees; murals appear on sandstone arches.
  - Caption: "By week two, the campuses start to blend." **[H]**
  - Sound: Ambient swell.
- **1590–1710:** Split: Sather Tower among palms (top) vs Hoover Tower in fog (bottom).
  - Caption: "Same towers. Totally swapped vibes." **[H]**
  - Sound: Single chime.
- **Muted read:** Same landmarks, new surroundings.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Maya and Theo point at each other's tower, shrug.
  - Caption: "Which campus would you pick?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "Berkeley and Stanford swap campuses, everyone is confused, and the rivalry gets weird."

## Renderer gaps (for Patrick)

- Building-to-box fold effect
- Two campus kits moving at once on the map
- Split stadium with two crowds

## Fact notes

- v02.f.sather_tower (307 ft / 1914, unverified, not shown as a number)
- v02.f.big_game (1892, unverified)
- v02.c.distance: brief says 50 km; 31 mi = 50 km, consistent
