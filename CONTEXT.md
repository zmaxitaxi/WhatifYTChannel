# AETHER — Project Context

This file gives new contributors and future coding sessions the decisions needed to continue the project. Read [TECHNICAL_PLAN.md](TECHNICAL_PLAN.md) for architecture, interfaces, work assignments, milestones, and acceptance criteria.

Read [docs/CREATIVE_DIRECTION.md](docs/CREATIVE_DIRECTION.md) for the accepted story, model, motion, caption, sound, and export constraints. The storyboard planner consumes that guide. [docs/VIDEO_TOPICS.md](docs/VIDEO_TOPICS.md) contains the new brainstorm; those ideas are proposals rather than supported production capabilities.

## Current creative defaults — October 31 review

The degree-expiry film established the current style; the continuous Stanford-in-Boston rebuild applies it with a curved waterfront route and a hopeful future. The user confirmed three
priorities for future videos: **no cuts, fitting continuous background music,
and a persistent timeline**.

- Use one continuous 3D camera journey with smooth transitions and meaningful
  visible action. Camera choreography varies by story: follow, orbit, push in,
  pull back, move through spaces, or rise into a reveal. A horizontal track or
  one lateral shift is not a required episode template. Delivery remains 9:16.
- Keep the top checkpoint timeline visible throughout, with its red dot moving
  smoothly as time advances. Choose the time scale and checkpoints for the topic.
- Give each story a continuous musical background suited to its mood and arc,
  with restrained contextual effects. Keep the quiet mix and avoid repetitive
  birds, chirps, and wind. The same chord loop is not required in every video.
- Story tone can become brighter and more hopeful. Let lighting, colors, world
  design, character activity, and music reveal that future continuously. A
  pessimistic payoff or repeating the degree story's pressures is not required.
- Retain centered educational serif captions without boxes and engaging causal
  writing. Add a meaningful counter when the premise supports one. The 2026 law,
  five-year checkpoints, renewal count, and specific connected layout belong to
  the degree episode; future topics get their own progression and ending.

## Project identity and current state

- Project: AETHER, a stylized 3D YouTube Shorts production engine.
- Repository: [zmaxitaxi/WhatifYTChannel](https://github.com/zmaxitaxi/WhatifYTChannel).
- Planning date: October 30, 2026, America/Los_Angeles.
- The initial V01 local MVP is implemented on `codex/aether-mvp` (October 31): Pydantic contracts and generated types, a fixture-driven deterministic renderer, SQLite jobs/checkpoints, lossless capture, MP4/audio packaging, Codex CLI planning, and a local review workspace. See [README.md](README.md) for commands and [docs/MVP_STATUS.md](docs/MVP_STATUS.md) for verified results and remaining work.
- Patrick's renderer scaffold was merged upstream in PR #1 and fetched into this branch. After inspecting it, the user chose to retain the models already shown in the MVP. Patrick's package remains available under `renderer/` as a reference; the active MVP renderer is `web/src/renderer.ts`.
- The initial MVP was pushed to main as `9acdf15`, including Francis's PRs #2–#10. Max integrates his caption layout, sound mixer/encoder, and delivery inspector via adapters rather than maintaining parallel implementations. Francis's research/content/review/discovery/analytics packages are available; their wider automated orchestration remains future work. PR #10's winter alternative does not replace the user's explicit creative direction.
- The initial model pass delegated `web/src/models.ts` to an Astra High subagent. Max owns cameras, story, capture, API, and integration. That earlier V01 explored Boston as a tech capital with robots, shuttles, and clean energy. It established a closer Stanford campus, realistic world scale, people, clouds, and sun. The removed production footer/watermark must stay out of exports.
- The user found constant bird/wind noise distracting. Preserve sparse quiet sound and the −22 LUFS target. The earlier tech-capital export (`8b04880c94f1`, `output/v01-boston-tech-capital.mp4`) was revised to two low-level ambience moments and passed all 19 delivery checks. The newer timeline removes the bird/wind bed entirely. `aether remix` supports audio-only revisions without video recompression.
- The user then requested a permanent GPT-6 Astra High modeling chat, created as “WhatifYTChannel 3D Models.” It owns `web/src/timelineModels.ts` and model improvements; this chat owns story, cameras, overlays, contracts, orchestration, export, and UI. Model edits and captures must be coordinated to keep the production bundle stable.
- The previous default was a 72-second alternate history: “What if Stanford started in Boston?” It spans 1885–2050 through 16 shots and 12 distinct scenes, with a fictional HP founding in Boston, a waterfront research park, a quiet Sand Hill Road, “Silicon Harbor,” startup ferries, and an apartment-hunting payoff. The readable script is `content/v01_stanford_boston_timeline.txt`; canonical data is `fixtures/v01_stanford_boston_timeline.json`. Historical anchors are verified separately; outcomes after the location divergence are authored fiction.
- The user explicitly removed the top “Imagined Scenario” label. The older Stanford cut uses a year/location counter, bold DM Sans on a dark plate, authored sentence breaks, selective gold emphasis, and twelve short Foley cues with quiet gaps. Those are archived episode details; the current defaults above use a persistent timeline, unboxed serif captions, and fitting continuous music. Preserve the quiet −22 LUFS sound direction and exclusion of bird/wind beds. “Export MP4” is a prominent control below the website player.
- The user found the initial timeline's subtle motion too static. The permanent Astra modeling chat added translating walking paths with articulated gait and purposeful action throughout all 12 scenes: writing, tools, construction, computer displays, boats, vehicles, cargo, and an advancing housing queue. Model sampling and clearance checks pass; all 48 full-composition samples have no text/resource warnings and all 12 scenes reproduce identical pixels after backward seeking. Verify multiple moments within shots, not only one attractive still.
- In the archived Stanford cut, smooth camera easing produced three 0.5–0.67-second low-motion tails even though every encoded frame was unique. Linear camera travel cleared those intervals. Retain motion inspection alongside duplicate-frame checks; new videos follow the continuous, uncut direction above.
- The completed older Stanford audio/motion draft is job `b0ff921ef658`, `output/v01-stanford-boston-timeline.mp4`: 72 seconds, 2,160 unique frames, all 19 delivery checks passing, no detected frozen intervals of at least 0.5 seconds, −22.12 LUFS / −7.16 dBTP encoded audio. Website MP4 export was clicked and its downloaded hash matches the verified file. That archived job remains available in the local review workspace.
- No automated production schedule or publishing workflow has been activated.
- Captions need narrative momentum: specific curiosity, clear cause and effect, small payoffs between beats, and a resolved ending with an earned next question. Readability alone is insufficient. The older Stanford copy remains a first editorial draft; its generic closing question is not the caption-writing standard.
- The previous default and retained reference is V13, “What if your degree expired every five years?” It replaces cut-based scenes and caption boxes with one connected 3D world, one smooth camera journey, persistent top checkpoints and a smoothly advancing red dot, plain centered educational serif text, a meaningful counter, and quiet continuous music. The fictional law starts in 2026 and the story reaches 2051. Count required renewals for one graduate (0–5), derived from the invented five-year rule; no invented debt figures. Source files are `fixtures/v13_degree_expiry.json` and `content/v13_degree_expiry.txt`. Astra owns new `web/src/degreeModels.ts`; parent owns renderer, camera interpolation, overlays, script, sound, and integration. Keep the older Stanford renderer available.
- The completed V13 is job `2700d2029ab2`, `output/v13-degree-expiry.mp4`: 72 seconds, 2,160 unique frames, all 19 delivery checks passing, no detected 0.5-second freezes in the 3D region, no detected 0.3-second audio gaps, and −22.05 LUFS / −10.97 dBTP encoded sound. The website download hash matches the verified MP4. The timeline is redrawn into a transparent 2D canvas for deterministic seeking; retained SVG overlap antialiasing previously changed a few pixels after backward requests. The corrected six-stage preflight passed three consecutive runs. That degree export remains available; the default render button now creates the continuous Stanford journey.


- The new default is `fixtures/v01_boston_continuous.json`, with script `content/v01_boston_continuous.txt`: a 72-second uncut Stanford-in-Boston journey through seven dated chapters from 1885 to 2050. Astra owns `web/src/bostonJourneyModels.ts`; the parent integrates both worlds through `web/src/continuousRenderer.ts`. The camera curves along a connected waterfront, follows the ferry, and rises above a hopeful harbor with transit housing and clean-energy workshops. A full-length original developing score replaces a repeated loop for this episode; eight brief effects remain subtle. The timeline stays visible and no unsupported numerical counter is added. The completed website-created production is `e22eb0c252cc`, `output/v01-stanford-boston-continuous.mp4`, rendered in 762.3 seconds. All 19 delivery checks pass, all 2,160 decoded frames are unique, no 0.5-second 3D freezes or 0.3-second audio gaps are detected, all eight encoded red-dot checkpoints pass, and encoded sound is −22.0 LUFS / −10.30 dBTP. The actual website download SHA-256 matches the verified export. Playback/seeking and the 831 × 948 workspace pass, with a readable 350-pixel player and empty console warnings/errors. Shared-renderer degree regression matches original pixels at three moments and after backward seeking. Preflight passes 33 composition samples and seven exact backward-seek checks, with 63 total draws / 108,466 triangles. Astra reports 17,340 body/furniture checks with zero overlaps. Boston's longer final camera path uses a wider fog range so the final city remains visible.
- The remaining implementation work is recorded in `docs/BUILD_BACKLOG.md`: reusable journey composition without per-video code edits, remaining scenario families and identity kits, research/content orchestration, rendered visual critique and bounded repair, release reliability/quality trials, then discovery/analytics and scheduling. No production schedule or automatic publishing has been activated.

## User intent and visual direction

The system should turn university hypotheticals into understandable 3D videos without requiring manual scene-code edits for each production job.

The user explicitly clarified:

> The goal of the design isn't realism, it's understandable 3d images. For example a person should just have a face with eyes, hair, nose, mouth that are recognizable, but not extreme detail.

Prioritize strong silhouettes, recognizable faces and campus landmarks, clear actions, readable captions, and consistent styling. Detailed realistic surfaces are unnecessary.

Reference: [What if you dropped 10kg of tungsten from space? — OutwardAnimates](https://www.youtube.com/shorts/uj4plcsfc6k).

Use the reference for camera movement, visual progression, pacing, restrained typography, overlays, and explicit time-scale treatments. It is not a requirement to produce physics content, recreate its assets, or validate its numerical claims.

## Confirmed decisions

| Topic | Decision |
|---|---|
| Primary goal | Polished, repeatable, understandable videos |
| Subject | Universities and college hypotheticals |
| Scenario breadth | All twelve original concepts and their scenario families |
| Visual style | Stylized 3D with recognizable features and modest detail |
| Camera and transitions | One continuous shot; smooth, story-specific routes and world changes |
| Story timeline | Persistent top checkpoints with a smoothly advancing red dot |
| Story tone | Topic-specific; brighter, hopeful futures are welcome |
| Delivered video | YouTube Shorts only |
| Resolution | 1080 × 1920 pixels |
| Frame rate | Constant 30 fps |
| Aspect ratio | 9:16, vertical |
| Runtime | 45–75 seconds; 60-second default |
| Voice | Captions and sound effects; narration optional |
| Music | Continuous background suited to each story, with restrained effects |
| AI access | Codex CLI with ChatGPT authentication; no automatic paid API fallback |
| Rendering | Local |
| Asset creation | Manual creation and refinement of reusable assets is allowed |
| Campus reuse | Generate or configure layouts and environments to fit each story |
| Character reuse | Recurring characters can keep the same identity |
| Build schedule | 16-week build with up to four contingency weeks |
| Publishing | Human-controlled |

The user questioned a separate preview mode. The agreed simplification is one video format and one rendering mode. Fast checks use sampled frames and short segments in the same format. Do not introduce a separate 540 × 960 or 15 fps preview pipeline. Internal diagnostic images and logs are acceptable.

October 31 export correction: omit the chapter footer, production disclaimer footer, AETHER branding, and production progress bars from exported video. The subsequently requested story timeline with checkpoints and red dot stays visible, along with story captions. Keep sources and production metadata in the review workspace.

## Architecture decision and rationale

The original proposal centered on Codex generating unrestricted Three.js code for every video. The revised approach uses validated structured specifications and trusted reusable rendering components. This supports the user's preference for consistency and clarity.

The production flow is:

```text
topic → fact pack → Codex ProductionSpec → validation → scene compilation
      → sampled frames/test segments → evaluation/limited repair
      → full render → audio and Shorts packaging → human review
```

- Python owns orchestration, state, and validation.
- Pydantic models are the authoritative contract source; generate JSON Schema and TypeScript types from them.
- Three.js/TypeScript renders trusted components at absolute frame indices.
- Playwright captures the scene and HTML/SVG overlays together.
- FFmpeg packages the sole Shorts output; FFprobe checks it.
- SQLite stores jobs, attempts, artifact records, and checkpoints.
- FastAPI and server-rendered pages provide a local review interface.
- Avoid additional infrastructure until measured requirements justify it.

Codex handles structured planning, critique, and specification repair. Allow the initial specification plus two repair candidates. Unsupported operations become `needs_development`. New Codex-written engine components are reviewed and tested during development rather than executed automatically inside production.

## Team split and boundaries

| Person | Ownership | Main deliverable |
|---|---|---|
| Max | Contracts, AI integration, Python orchestration, evaluation, jobs, API, scheduling | Reliable topic-to-render orchestration with bounded repair and recovery |
| Patrick | Three.js runtime, characters, campuses, cameras, geography, scenario behaviors, capture | Clear deterministic visual output and lossless visual intermediates |
| Francis | Research, stories, captions, sound, final encoding, review pages, discovery, analytics | Understandable finished Shorts and a usable review workflow |

Max owns API behavior while Francis owns the review pages. Patrick owns visual capture and intermediates while Francis owns final delivery encoding and audio. Francis's captions run inside the shared visual composition rather than an unrelated rendering system. All three review shared-contract changes.

Original availability assumptions: Max 10–12 hours/week, Patrick 10–12, Francis 8–10. The detailed phase-by-phase split and first-three-day assignments are in the technical plan.

## Initial concept queue

| ID | Concept |
|---|---|
| V01 | What if Stanford was in Boston? |
| V02 | What if Berkeley and Stanford switched campuses? |
| V03 | What if every public university disappeared? |
| V04 | What if Harvard moved to California? |
| V05 | What if MIT and Stanford swapped locations? |
| V06 | What if every Ivy League university became public? |
| V07 | What if UCLA became the number-one university? |
| V08 | What if every university became a country? |
| V09 | What if Stanford never existed? |
| V10 | What if all colleges merged into one campus? |
| V11 | What if every student transferred to Harvard? |
| V12 | University battle royale |

These require relocation/swap, disappearance/absence, institutional changes, rankings, fictional territories, mergers, crowd flows, and symbolic competition. Broad map scenarios use grouped or instanced representations and representative close-ups. The battle royale does not require a separate combat simulator.

## Asset and content principles

- Reuse identities and components rather than forcing every story into the same finished campus scene.
- Campus specifications can change layout, density, terrain, vegetation, and environment while retaining recognizable identity anchors.
- Character faces need visible eyes, hair, nose, and mouth in important close-ups.
- When expressions matter, validate them at phone viewing size.
- Give assets stable IDs, version hashes, references, and provenance.
- Bind metrics to sourced data or explicit calculations.
- Separate verified facts, assumptions, and fictional consequences.
- Label imagined rankings, status changes, crowd scaling, and time compression appropriately.
- Population-wide claims identify the dataset year, geographic coverage, and included institutions.
- Videos must remain understandable when muted.

## Milestones and acceptance

The first two weeks prove the visual language with a person reacting, a Stanford landmark, campus movement, a map transition, a redesigned destination, captions, and a synchronized effect. The first full 45–75-second Short is targeted for weeks 3–4. All scenario families are represented by weeks 9–10; reliability, review tools, discovery, and final trials follow.

The release evaluation covers twelve original concepts plus six held-out variations. Require at least 16 of 18 reviewable completions within the repair budget, a passing example for every scenario family, three consecutive unattended completions, no per-video manual animation-code edits, and no unresolved factual-labeling problems.

Human quality target: average at least 4/5 with no dimension below 3 across comprehension, recognition, action clarity, captions, camera motion, visual consistency, and sound timing.

Performance targets, not measured capabilities: render a 60-second final video within 30 minutes and reach median end-to-end production within 60 minutes, excluding human review and account waiting periods.

## Operational limits and future work

Start with one production job and at most two videos awaiting review. Preserve artifacts on failures and usage/authentication interruptions. No automatic switch to paid APIs. Production scheduling is a later implementation milestone: one daily opportunity at 8:00 AM America/Los_Angeles after reliability validation, with no catch-up backlog.

Automatic publishing, general-purpose physics simulation, local speech synthesis, machine-learned topic ranking, arbitrary new code execution, and alternate video export formats are outside the release. A separate physics product is not implied by the reference video.

## How to maintain these documents

Keep this file concise enough for onboarding and use the technical plan for implementation detail. Update both when accepted scope or constraints change. Record measured results as measurements, and keep proposed targets labeled as targets. Do not describe planned features as already implemented. Do not commit credentials, authentication files, personal machine paths, or private account details.
