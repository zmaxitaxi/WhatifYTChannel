# V01 MVP — October 31, 2026

## Implemented

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

The current export is `output/v01-boston-tech-capital.mp4` (job `8b04880c94f1`): 60.0 seconds, 1,800 decoded frames, 1080 × 1920 at 30 fps, H.264 High/yuv420p/BT.709, AAC stereo at 48 kHz, fast-start MP4, 24,812,929 bytes. All 19 independent delivery checks pass with zero warnings. Per the user's request for quieter, less frequent bird/wind noise, final encoded audio measures −22.02 LUFS and −6.28 dBTP.

Continuous bird/wind/crowd beds were removed. Bird/breeze ambience now appears in two faded 1.5-second cues (3 seconds total, previously ambience covered the whole minute). Their source gains are 18 dB lower, and the production loudness target is −22 LUFS instead of −16. A sampled ambience-only window measures 36.9 dB quieter. The encoded video stream is byte-identical to source job `22abd9ccdb22`; this audio revision took 7.8 seconds and did not recapture or recompress the 3D footage. The `aether remix` command validates that only sound/loudness changed before allowing stream reuse.

The first render/encode attempt took 702.1 seconds and exposed the AAC peak issue. The corrected retry took 170.3 seconds, reused all 12 visual chunks (unchanged hashes and files predating the retry), and passed delivery. Reports are in `output/verification/`, including the initial failure, AAC recovery, final export, and HTTP range/download checks. The new production awaits the user's review; no publishing or approval was automated.

## Design verification

Reference: [review-studio-concept.png](design/review-studio-concept.png), generated with the built-in Image Gen tool. The actual video is code-rendered Three.js, rather than the raster illustration in the design reference.

The comparison covers the three-column queue/workspace/inspector arrangement, serif wordmark and title, DM Sans controls, ivory/red palette, restrained dividers, vertical-media proportions, and review-action placement. Corrections made during implementation include shifting the video/title to match the reference alignment, fitting the video and controls to the desktop height, and allowing the inspector to scroll independently.

Intentional operational additions are extra source claims, real production states, cancellation/resume, artifact links, and revision notes. These account for copy beyond the reference. Mobile stacks the same regions. The original render footer was removed at the user's request. The reference illustration is replaced by the user's preferred procedural 3D models, refined by Astra High.

## Scope and team handoff

Patrick's upstream contribution contains 4,382 added project lines across 17 files, plus a mistakenly tracked dependency directory with 1,840,557 lines across 3,225 files. The dependency directory is untracked locally without deleting installed files or rewriting shared history. His campus, character, geography, and engine package remains intact as a reference; the user selected the MVP models for the active export.

Main is synced through `2944d0d`, including Francis's nine merged PRs (#2–#10). Caption layout (`renderer/src/overlays`), sound/encoding (`audio`), and delivery inspection (`delivery`) are reused directly. The sound adapter translates the controller's authoritative contract into Francis's cue contract, so there is one mixer and one final encoder. PR #10 landed during final capture and only changed research Markdown; it introduced no code overlap. Its winter V01 remains an alternative, following the user's explicit request for the active imaginative tech-capital story.

Francis's `research`, `content`, `review`, `discovery`, and `analytics` packages remain available in their original locations. Their broader scheduling/automatic orchestration is not part of the active V01 slice. Existing research facts are distinguished from the revised fictional tech-capital story; old winter captions and removed production footers are not reintroduced.

The job API exposes the fields and opaque artifact URLs expected by Francis's review pages. It accepts `decision`/`notes`/`rubric`, persists review history, and sends `allowed_actions`. Revision requests become `rejected` with notes rather than automatically queuing an unimplemented repair. The two-video cap is enforced by the controller. The prototype studio still has a simpler approval action; the full rubric and muted-watch gate is not yet enforced server-side.

The remaining scenario families, automatic research/revision, image critique, production scheduling, and full release reliability/quality trials are unfinished. Human approval and publishing remain manual.
