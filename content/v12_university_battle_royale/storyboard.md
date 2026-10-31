# V12 storyboard: University battle royale

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V12.

## Fun take (somewhat realistic, funny)

A game-show battle royale with a shrinking zone. No weapons: trivia, robots, chants and money. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Five landmarks as contestants; an announcer lower third; Maya commentating.

**Label on every imagined cue:** "Fictional competition". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Five towers on a game-show stage under spotlights, 'FIGHT!' banner (playful).
  - Caption: "What if colleges had a battle royale?" **[H]**
  - Sound: Game-show buzzer.
- **Muted read:** A game-show battle of colleges.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Contestant cards slam in one by one.
  - Caption: "Five schools enter: Stanford, Berkeley, Harvard, MIT, UCLA." **[H]** · facts: `v12.f.roster`
  - Sound: Five slams.
- **225–360:** Rules card with three icons.
  - Caption: "No weapons. Just trivia, robots, and dance-offs." **[H]** · facts: `v12.a.rules`
  - Sound: Ding ding ding.
- **Muted read:** Who is playing and the rules.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** Glowing circle closing in on the map.
  - Caption: "The zone starts shrinking." **[H]**
  - Sound: Rising hum.
- **ROUND 1, 510–750:** Robot breakdancing; Royce Hall greyed out.
  - Caption: "Round 1: MIT's robot out-dances UCLA." **[H]**
  - Sound: Beat drop, 'eliminated' buzz.
- **ROUND 2, 750–900:** Berkeley crowd chanting; MIT dome greyed out.
  - Caption: "Round 2: Berkeley wins the chant battle." **[H]**
  - Sound: Chant, buzz.
- **Muted read:** The zone shrinks and schools get knocked out.

### 4. Consequences: 30–48 s (frames 900–1440)

- **ROUND 3, 900–1080:** Library book stack; Berkeley greyed out.
  - Caption: "Round 3: Harvard wins trivia. It's been studying since 1636." **[H]** · facts: `v12.f.harvard_oldest`
  - Sound: Quiz bell.
- **ROUND 4, 1080–1260:** Hoover Tower running laps around the shrinking zone.
  - Caption: "Round 4: Stanford uses its 8,353 acres to dodge." **[H]** · facts: `v12.f.stanford_acres`
  - Sound: Running footsteps.
- **FINAL, 1260–1440:** Hoover Tower and Widener Library face off in the tiny zone.
  - Caption: "Final two: Stanford vs. Harvard." **[H]**
  - Sound: Drumroll.
- **Muted read:** Each round knocks out a school.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Zone closes to a pinpoint; screen flashes white.
  - Caption: "Winner takes the whole map." **[H]** · facts: `v12.h.outcomes`
  - Sound: Explosion of confetti (not a blast).
- **1590–1710:** Silhouette of a tower holding a trophy, face hidden.
  - Caption: "And the winner is…" **[H]**
  - Sound: Drumroll stops.
- **Muted read:** The final two.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Two-option poll card: Stanford / Harvard.
  - Caption: "Who do you think wins?" **[H]**
  - Sound: End sting.
- **Muted read:** The viewer picks the winner.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "Five colleges compete in a silly battle royale, and the viewer picks the winner."

## Renderer gaps (for Patrick)

- Shrinking zone overlay
- Elimination grey-out state for campus kits
- Game-show stage environment

## Fact notes

- Whole video labeled 'Fictional competition'; winner never revealed so it can't read as a ranking
- Cue 7 reuses v12.f.harvard_oldest (1636, unverified)
