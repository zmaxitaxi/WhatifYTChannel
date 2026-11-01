# V01 MVP — October 31, 2026

## Current continuous Stanford-in-Boston rebuild

The default is now `fixtures/v01_boston_continuous.json`, with readable script
`content/v01_boston_continuous.txt`. The 72-second story begins with an invented
Boston founding in 1885 and reaches a hopeful 2050 harbor. Seven dated logical
chapters share a single permanently connected waterfront. The camera curves past
campus, workshop, labs, ferry, transit housing and a clean-energy mill before a
continuous final rise. The timeline and smooth red dot remain visible; centered
serif captions have no boxes. No unsupported numerical counter is invented.

The permanent Astra modeling chat supplied `web/src/bostonJourneyModels.ts`:
30 continuous camera anchors, 62 model draws / 108,464 triangles, and 17,340
body/furniture checks with zero reported overlaps and minimum 8.2 cm clearance.
Parent integration uses `web/src/continuousRenderer.ts`, shared with the degree
film. Lighting opens toward a brighter final third; the Boston fog range is
extended so the long final camera reveal stays visible. Caption copy matches the
final graduate walking toward her workshop, without claiming she boards a ferry
or goes upstairs.

An original full-length 72-second warm chamber/electronic score develops with the
story, under eight brief effects. All 29 sound-library assets have provenance and
hash records; the existing 28 remain unchanged. The historical anchors were
rechecked against Stanford and HP primary sources. All Boston consequences and
future events remain explicitly hypothetical in the evidence pack.

The build and typecheck pass. Controller tests pass (56), renderer/caption/motion
tests pass (18), and the sound suite passes 17 tests with the same host-incompatible
optional diagnostic slate excluded. Full-composition preflight passes 33 samples,
zero warnings/errors, and exact backward-seeking checks for all seven chapters.
The complete composition uses 63 draws / 108,466 triangles.

Production **`e22eb0c252cc`** was started through the website's **Render Stanford
journey** control and completed in 762.3 seconds. The result is
`output/v01-stanford-boston-continuous.mp4`: 72.0 seconds, 2,160 frames,
1080 × 1920 at 30 fps, H.264 High/yuv420p/BT.709, AAC stereo at 48 kHz,
fast-start MP4, 42,106,345 bytes. All 19 delivery checks pass with zero warnings;
encoded sound measures −22.0 LUFS / −10.30 dBTP.

All 2,160 decoded frames are unique, with no adjacent repeats. The lower 3D
region (1080 × 700 beginning at y=950, excluding the timeline/captions) has no
detected freeze of at least 0.5 seconds at −50 dB. The encoded soundtrack has no
detected silence of at least 0.3 seconds at −55 dB. All eight encoded checkpoint
images locate the red dot at its expected position.

The actual website **Export MP4** click downloaded a file whose SHA-256 matches
the verified export:
`db4af03f5a9a2af13f6dde36c069f4d91d67535f05bdef232f8f30a665286e0d`.
Playback and chapter seeking work. The native 831 × 948 studio viewport has no
horizontal overflow and the 350-pixel player shows readable captions. Console
warnings/errors are empty. The video is left paused at its opening, awaiting
human review; approval and publishing were not automated. The previous Stanford
job records the user's revision request and remains available as an earlier draft.

Shared-renderer regression also reproduces the original degree export's pixels
exactly at frames 0, 720, and 2159, with an identical backward seek. The degree
models, counter, and existing MP4 remain available.

See [BUILD_BACKLOG.md](BUILD_BACKLOG.md) for the ordered work still required for
the broader release. This authored example does not establish arbitrary
no-code-per-video story generation or the full reliability gate.

## Verified V13 degree-expiry reference

The latest review promotes its uncut journey, fitting continuous background
music, and always-visible checkpoint timeline to shared creative defaults.
Future camera routes and story moods vary by premise, including brighter,
hopeful futures. The degree film's horizontal staging is one example; new
worlds and choreography remain subject to capability development and review.

The selected next film is “What if your degree expired every five years?” The fictional law starts in 2026 and the 72-second story reaches 2051. `fixtures/v13_degree_expiry.json` is the retained degree specification, with the readable script in `content/v13_degree_expiry.txt`. Six logical chapters share one connected world and one continuous camera path; they do not switch sets or cut the camera. The top timeline retains seven checkpoints and a smoothly advancing red dot. A counter derives required renewals for one graduate from the invented five-year rule, reaching 5. No debt or population figures are invented.

The exported composition uses centered white DM Serif Display text without caption boxes. A quiet original twelve-second musical loop covers the whole film with entry/exit fades, plus five brief effects. The mix measures −22.0 LUFS / −11.0 dBTP and has no detected silence of at least 0.3 seconds at −55 dB. The controller tests pass (46), renderer/caption/motion tests pass (17), and the sound suite passes 17 tests plus 39 subtests with the same host-incompatible optional diagnostic slate excluded. Camera interpolation is continuous in position and velocity, the dot advances on every frame, and counter changes match five-year checkpoints.

Fourteen initial full-resolution composition samples have no text/resource warnings. Model review then checked 289 moments with no actor overlaps or graduate-framing failures. The final connected world uses 59 model draws and 109,230 triangles; the complete composition uses 63 draws and 109,238 triangles. The first production preflight caught a retained-SVG antialiasing mismatch in a few timeline pixels after backward seeking. Redrawing the timeline into a transparent 2D canvas on every requested frame removes that state dependence. The exact 36-frame/six-stage preflight passed three consecutive runs after the fix.

Production **`2700d2029ab2`** was created and resumed through the website after that correction. The completed film is `output/v13-degree-expiry.mp4`: 72.0 seconds, 2,160 frames, 1080 × 1920 at 30 fps, H.264 High/yuv420p/BT.709, AAC stereo at 48 kHz, fast-start MP4, 27,430,457 bytes. The successful render/encode attempt took 616.2 seconds. All 19 delivery checks pass with zero warnings; encoded audio measures −22.05 LUFS and −10.97 dBTP.

All 2,160 decoded frames are unique. A motion scan of the lower 3D region (1080 × 700 pixels beginning at y=950, excluding the timeline and captions) detects no frozen interval of at least 0.5 seconds at −50 dB. Encoded audio has no silence of at least 0.3 seconds at −55 dB. Pixel checks locate the red dot at every checkpoint and the endpoint. The counter reaches 5 under the stipulated five-year rule.

The actual website **Export MP4** click downloaded `aether-2700d2029ab2.mp4` with the same SHA-256 as the verified export: `fc30e07e56f15de1b27d162da83589ec4b4b04b43d83696da7d39a490a8c7337`. Browser playback and chapter seeking work, metadata reports the correct dimensions/runtime, and console warnings/errors are empty. The native 831 × 948 studio viewport has no horizontal overflow; the 350-pixel-wide player provides a phone-width composition check. This film awaits human review; no approval or publishing was automated. The prior Stanford media results below apply to that older production.

## Archived Stanford alternate-history draft

The previous default asks **What if Stanford started in Boston?** It is 72 seconds with 16 camera beats across 12 distinct 3D scenes, from the 1885 founding decision to a fictional 2050 Boston. The story follows a relocated HP origin, a waterfront research park, investment moving east, “Silicon Harbor,” startup ferries, global shipping/network connections, and a housing punchline. The exact script and primary historical sources are in `content/v01_stanford_boston_timeline.txt`; canonical production data is in `fixtures/v01_stanford_boston_timeline.json`.

The permanent **WhatifYTChannel 3D Models** chat uses GPT-6 Astra High and owns `web/src/timelineModels.ts`. Model review corrected portrait edge framing and desk/character overlaps. The parent owns history cameras, year/location counter, bold captions, script, controller, and export UI. The top “Imagined Scenario” label is removed at the user's request. The What if opening establishes fiction; sources and hypothetical outcomes are distinguished in the inspector.

Current validation: 36 controller tests, 13 caption/renderer tests, Ruff, TypeScript, and the production frontend build pass. The audio suite passes 17 tests and 37 subtests (the host-incompatible optional diagnostic slate is excluded). Captions preserve authored sentence breaks, use selective emphasis, fit two lines at readable sizes, and remain within safe margins.

The combined production passed all 48 sampled-frame text/resource checks with zero warnings. Repeated pixels and diagnostics match after out-of-order requests for all 12 scenes. Full composition complexity, including the sky and ground, peaks at 73 draws and 86,144 triangles.

The motion revision adds distance-driven walking with coordinated limbs, a writing hand, workshop tool handling, construction lifts and deliveries, scrolling computer displays, departing ferries, cargo loading, an advancing housing queue, and future-campus traffic. Astra checked 36 scene moments and 360 unique sampled video frames, out-of-order seeking, actor/furniture clearance, and water-only shipping lanes. Every scene has moving model instances on each sampled frame; maximum model complexity is 67 draws and 83,838 triangles. Pixel uniqueness alone is insufficient: the initial timeline also had 2,160 unique decoded frames, but its motion was too slight to read clearly.

The new soundtrack uses twelve original procedural scene effects: stamp, campus bell, garage latch, workshop dial, construction taps, suitcase wheels, keyboard, harbor bell, ferry departure, crate/latches, housing keys, and a final musical resolution. Each lasts 0.8–1.4 seconds, totaling 13.7 seconds in the 72-second cut. There are no ambience loops, birds, chirps, or continuous wind. All twelve fixed-seed asset hashes reproduce exactly, and the existing fifteen library assets are unchanged. The production loudness target remains −22 LUFS.

The website places **Export MP4** directly below the player, supports byte-range downloads with a meaningful filename, and groups failed/cancelled/revised versions in expandable history. Its default selection prioritizes a current or playable production over failed diagnostics. The corrected full cut is **`b0ff921ef658`**, started through the website's **Render timeline draft** control and completed in 490.7 seconds. The final video is `output/v01-stanford-boston-timeline.mp4`: 72.0 seconds, 2,160 frames, 1080 × 1920 at 30 fps, H.264 High/yuv420p/BT.709, AAC stereo at 48 kHz, fast-start MP4, 23,902,662 bytes. All 19 delivery checks pass with zero warnings; encoded audio measures −22.12 LUFS and −7.16 dBTP.

Final motion inspection finds 2,160 unique decoded frames, no exact adjacent repeats, and no frozen intervals of 0.5 seconds or longer at a −50 dB detector threshold. The preceding combined pass had three 0.5–0.67-second low-motion tails from camera easing; continuous camera travel through cuts clears those intervals in both targeted H.264 segments and the complete final video. Model motion remains deterministic and independent of camera interpolation.

An actual click on the website's **Export MP4** downloaded `aether-b0ff921ef658.mp4`. Its SHA-256 matches the verified video: `40daa3ba5cb42d8049ee523ece046a9dc06a6a725a3d05772e710a78691b14d5`. The browser loads and seeks the 72-second 1080 × 1920 media without errors; console warnings/errors are empty and the native 831 × 948 viewport has no horizontal overflow. The earlier desktop/mobile layout checks also passed at 390 × 844. Final reports are under `output/verification/timeline-*.json`; the studio screenshot is saved in the Codex visualizations directory. This cut awaits the user's review; approval and publishing remain manual.

Editorial follow-up: the user's latest direction calls for stronger caption hooks, causal transitions, small payoffs, and an ending that answers the premise while leaving a specific consequence to explore. [The creative guide](CREATIVE_DIRECTION.md) now defines that standard and is supplied to future planner requests with a recorded hash. [The topic brainstorm](VIDEO_TOPICS.md) adds eight proposals. The current rendered caption copy remains a first editorial draft; documenting the standard does not establish that the existing cut meets it.

## Earlier MVP implementation and verification

- Strict Pydantic production/evidence/timeline contracts, canonical JSON Schema, and generated TypeScript.
- Six deterministic visual operations covering Stanford-to-Boston: a foreground student, a closer Stanford campus, relocation map, robot demonstration, flying shuttles/clean energy, global ideas, and a future-facing ending. The new story imagines Boston as the world's tech capital; it is not a winter story.
- Astra High owns `web/src/models.ts`: detailed students, sandstone/red-roof architecture, crowds, trees, paths, sun/clouds, research towers, robotics, and flying pods. Max owns the cameras and other integration code. Camera QA caught and corrected trees obscuring the robot demonstration.
- A fixed 1080 × 1920, 30 fps output; no alternate preview video mode.
- SQLite job/attempt/artifact state, a process lock, cancellation, hash-checked five-second FFV1 chunks, and explicit resume.
- Francis's sound library, frame-timed mixer, H.264/AAC encoder, and independent delivery inspector are connected through a narrow controller adapter. His caption layout balances the story text into two lines.
- A server-rendered local review studio with source claims, playback, shot seeking, downloads, approval, revision notes, and recovery controls.
- A Codex CLI adapter with ChatGPT authentication, structured output, three-candidate limit, preserved logs, cancellation/timeouts, and excluded API credentials.
- A pinned project-local Codex CLI (0.166.0). A real storyboard request completed and validated using the configured model. The initial global CLI (0.142.4) rejected the configured current model; the project-local update resolved that test.

## Verified during implementation

- 30 controller Python tests pass. TypeScript checking, Ruff, and the production frontend build pass.
- Francis's delivery tests: 11 passed; caption/renderer tests: 12 passed; sound-library/mixing tests: 17 passed (25 subtests); discovery: 11 passed; analytics: 14 passed.
- The optional diagnostic-slate audio packaging test is excluded on this host because its FFmpeg build has no `drawtext` filter and its hardcoded Linux font is absent. The real Three.js-to-audio packaging path was exercised separately: a 150-frame lossless RGB input and a 90-frame existing YUV input both encoded with correct dimensions and BT.709 tags. The encoder keeps its existing YUV behavior; browser sRGB conversion is opt-in.
- Francis's review list and two detail pages returned HTTP 200 against the real controller API, not the mock. Review aliases, persisted notes/rubric, and duplicate-decision rejection are covered by the controller lifecycle test.
- The first new full export passed visual/format checks but failed the independent AAC peak check at +0.11 dBTP. The shared mixer's codec headroom was raised from 0.5 to 2.5 dB. A new regression test encodes the full production soundtrack to AAC and measures it with the same loudness analyzer as the delivery inspector; it passes both peak and integrated-loudness limits. All 12 visual chunk hashes and the visual fingerprint remain valid for repackaging.
- Exact repeated frame pixels and diagnostics match after visiting another shot in the pinned local browser environment.
- A capture benchmark compared regular PNG screenshots with the faster lossless Playwright CDP path. Decoded pixels matched; median capture time was 0.214 seconds versus 0.037 seconds for that ten-frame sample. These are sample measurements, not a full-production throughput guarantee.
- Cancellation after 300 completed frames preserved the chunks. Resume proceeded past 750 frames, and the saved chunk hashes still matched.
- The review workspace was checked in Browser/IAB at 1536 × 1024 and 390 × 844. No horizontal overflow was observed. The mobile primary button measured about 48 pixels high.
- The exported-frame footer requested for removal is absent from the updated sample images. The active models remain the MVP models selected by the user.

The previous quiet export is `output/v01-boston-tech-capital.mp4` (job `8b04880c94f1`): 60.0 seconds, 1,800 decoded frames, 1080 × 1920 at 30 fps, H.264 High/yuv420p/BT.709, AAC stereo at 48 kHz, fast-start MP4, 24,812,929 bytes. All 19 independent delivery checks pass with zero warnings. Per the user's request for quieter, less frequent bird/wind noise, final encoded audio measures −22.02 LUFS and −6.28 dBTP.

Continuous bird/wind/crowd beds were removed. Bird/breeze ambience now appears in two faded 1.5-second cues (3 seconds total, previously ambience covered the whole minute). Their source gains are 18 dB lower, and the production loudness target is −22 LUFS instead of −16. A sampled ambience-only window measures 36.9 dB quieter. The encoded video stream is byte-identical to source job `22abd9ccdb22`; this audio revision took 7.8 seconds and did not recapture or recompress the 3D footage. The `aether remix` command validates that only sound/loudness changed before allowing stream reuse.

The first render/encode attempt took 702.1 seconds and exposed the AAC peak issue. The corrected retry took 170.3 seconds, reused all 12 visual chunks (unchanged hashes and files predating the retry), and passed delivery. Reports are in `output/verification/`, including the initial failure, AAC recovery, final export, and HTTP range/download checks. The new production awaits the user's review; no publishing or approval was automated.

## Design verification

Reference: [review-studio-concept.png](design/review-studio-concept.png), generated with the built-in Image Gen tool. The actual video is code-rendered Three.js, rather than the raster illustration in the design reference.

The comparison covers the three-column queue/workspace/inspector arrangement, serif wordmark and title, DM Sans controls, ivory/red palette, restrained dividers, vertical-media proportions, and review-action placement. Corrections made during implementation include shifting the video/title to match the reference alignment, fitting the video and controls to the desktop height, and allowing the inspector to scroll independently.

Intentional operational additions are extra source claims, real production states, cancellation/resume, artifact links, and revision notes. These account for copy beyond the reference. Mobile stacks the same regions. The original render footer was removed at the user's request. The reference illustration is replaced by the user's preferred procedural 3D models, refined by Astra High.

## Scope and team handoff

Patrick's upstream contribution contains 4,382 added project lines across 17 files, plus a mistakenly tracked dependency directory with 1,840,557 lines across 3,225 files. The dependency directory is untracked locally without deleting installed files or rewriting shared history. His campus, character, geography, and engine package remains intact as a reference; the user selected the MVP models for the active export.

The alternate-history work builds on main commit `9acdf15`, including Francis's nine merged PRs (#2–#10), the dependency cleanup, and the initial MVP. A fresh fetch during the audio/motion revision found no additional main commits or overlap to reconcile. Caption layout (`renderer/src/overlays`), sound/encoding (`audio`), and delivery inspection (`delivery`) are reused directly. The sound adapter translates the controller's authoritative contract into Francis's cue contract, so there is one mixer and one final encoder. PR #10's winter V01 remains an alternative, following the user's explicit request for the active imaginative tech-capital story.

Francis's `research`, `content`, `review`, `discovery`, and `analytics` packages remain available in their original locations. Their broader scheduling/automatic orchestration is not part of the active V01 slice. Existing research facts are distinguished from the revised fictional tech-capital story; old winter captions and removed production footers are not reintroduced.

The job API exposes the fields and opaque artifact URLs expected by Francis's review pages. It accepts `decision`/`notes`/`rubric`, persists review history, and sends `allowed_actions`. Revision requests become `rejected` with notes rather than automatically queuing an unimplemented repair. The two-video cap is enforced by the controller. The prototype studio still has a simpler approval action; the full rubric and muted-watch gate is not yet enforced server-side.

The remaining scenario families, automatic research/revision, image critique, production scheduling, and full release reliability/quality trials are unfinished. Human approval and publishing remain manual.
