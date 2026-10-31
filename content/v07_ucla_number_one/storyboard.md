# V07 storyboard: What if UCLA became the number-one university?

Status: draft 1 (Workstream C, task 2). Runtime 60 s, 1800 frames at 30 fps, 1080 × 1920. Same beat grid as V01.
Caption track: [captions.json](captions.json). Research: [`research/`](../../research/) brief and fact pack for V07.

## Fun take (somewhat realistic, funny)

A leaderboard as a sports broadcast. UCLA climbs like it's going for gold, USC sulks. Jokes come from plausible side effects and real details; only the premise is impossible.

**Cast:** Maya as a UCLA student with a foam finger; a sports-announcer lower third.

**Label on every imagined cue:** "Imagined ranking". Numbers on screen only come from `fact` or `calculation` claims.

## Shots

Tags: **[H]** imagined, **[S]** sourced fact or calculation, **[T]** time-scale label.

### 1. Hook: 0–3 s (frames 0–90)

- **0–90:** Royce Hall wearing a giant gold medal; Maya with a foam finger.
  - Caption: "What if UCLA became number one?" **[H]**
  - Sound: Stadium horn.
- **Muted read:** UCLA is celebrating #1.

### 2. Establish: 3–12 s (frames 90–360)

- **90–225:** Royce Hall in sunshine.
  - Caption: "This is UCLA: Royce Hall, sun, blue and gold." **[S]** · facts: `v07.f.royce_hall`
  - Sound: Birds, crowd.
- **225–360:** A leaderboard with UCLA's real position highlighted.
  - Caption: "In real rankings, it's high. Not first." **[S]** · facts: `v07.f.actual_rank`
  - Sound: Ticker sound.
- **Muted read:** UCLA as it really is, with its real rank.

### 3. Transform: 12–30 s (frames 360–900)

- **360–510:** The board flips to a glowing 'IMAGINED RANKING' version.
  - Caption: "Now, an imagined leaderboard." **[H]** · facts: `v07.a.ranking`
  - Sound: Flip clack.
- **510–750:** UCLA's row shoots up the board, passing other rows.
  - Caption: "UCLA starts climbing. Fast." **[H]**
  - Sound: Rising whistle, crowd cheering.
- **750–900:** Top row gets bumped and tumbles off-screen.
  - Caption: "Until it knocks the top school off the board." **[H]** · facts: `v07.h.reorder`
  - Sound: Bowling-pin crash.
- **Muted read:** An imagined ranking climb.

### 4. Consequences: 30–48 s (frames 900–1440)

- **APPLICATION SEASON, 900–1080:** Admissions office buried in laptops showing a rising counter; staff with energy drinks.
  - Caption: "Problem 1: Even more applications pour in." **[H]** · facts: `v07.f.applications`
  - Sound: Notification pings speeding up.
- **RIVALRY WEEK, 1080–1260:** A cardinal-and-gold student sulks with ice cream.
  - Caption: "Problem 2: USC is not taking this well." **[H]**
  - Sound: Sad trombone.
- **TOUR SEASON, 1260–1440:** Line of tourists down Bruin Walk with a ticket dispenser.
  - Caption: "Problem 3: Campus tours need a waitlist." **[H]**
  - Sound: Ticket click.
- **Muted read:** Funny side effects of being #1.

### 5. Reveal: 48–57 s (frames 1440–1710)

- **1440–1590:** Confetti over Royce Hall, Maya celebrating.
  - Caption: "So UCLA throws a party in Westwood." **[H]**
  - Sound: Party horns.
- **1590–1710:** Split: Royce Hall plain (top) vs with a crown (bottom).
  - Caption: "Same campus. Brand-new crown." **[H]**
  - Sound: Chime.
- **Muted read:** Victory lap.

### 6. Resolve: 57–60 s (frames 1710–1800)

- **1710–1800:** Empty #1 slot blinking on the board.
  - Caption: "Who should be number one?" **[H]**
  - Sound: End sting.
- **Muted read:** The question goes to the viewer.

## Muted-comprehension check (paper)

- Premise is on screen by 3 s with a picture that shows it.
- Every caption is a full sentence; every sound doubles a visual.
- Reading load and line count pass `content/tools/check_captions.py`.
- One-sentence retell: "UCLA climbs an imagined leaderboard to #1 and USC is upset."

## Renderer gaps (for Patrick)

- Leaderboard overlay with reorder animation
- Royce Hall in UCLA kit
- Crown prop

## Fact notes

- v07.f.actual_rank must pin one ranking edition before cue 3 ships
- No invented scores or reasons for the climb
