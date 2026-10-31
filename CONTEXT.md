# AETHER — Project Context

This file gives new contributors and future coding sessions the decisions needed to continue the project. Read [TECHNICAL_PLAN.md](TECHNICAL_PLAN.md) for architecture, interfaces, work assignments, milestones, and acceptance criteria.

## Project identity and current state

- Project: AETHER, a stylized 3D YouTube Shorts production engine.
- Repository: [zmaxitaxi/WhatifYTChannel](https://github.com/zmaxitaxi/WhatifYTChannel).
- Planning date: October 30, 2026, America/Los_Angeles.
- The initial V01 local MVP is implemented on `codex/aether-mvp` (October 31): Pydantic contracts and generated types, a fixture-driven deterministic renderer, SQLite jobs/checkpoints, lossless capture, MP4/audio packaging, Codex CLI planning, and a local review workspace. See [README.md](README.md) for commands and [docs/MVP_STATUS.md](docs/MVP_STATUS.md) for verified results and remaining work.
- Patrick's renderer scaffold was merged upstream in PR #1 and fetched into this branch. After inspecting it, the user chose to retain the models already shown in the MVP. Patrick's package remains available under `renderer/` as a reference; the active MVP renderer is `web/src/renderer.ts`.
- Main is synced through `2944d0d`, including Francis's PRs #2–#10. Max integrates his caption layout, sound mixer/encoder, and delivery inspector via adapters rather than maintaining parallel implementations. Francis's research/content/review/discovery/analytics packages are available; their wider automated orchestration remains future work. PR #10 adds humorous research alternatives; its winter V01 does not replace the user's explicit tech-capital direction for this render.
- The user delegated `web/src/models.ts` to an Astra High subagent. Max owns cameras, story, capture, API, and integration. The current V01 is an imaginative Boston tech-capital story with robots, flying shuttles, and clean energy. Stanford fills the frame, the foreground student uses realistic world scale, and campus surroundings, people, clouds, and sun replace the empty backdrop. The removed production footer/watermark must stay out of exports.
- The user found the constant bird/wind noise distracting. Keep ambience sparse and quiet: the current V01 uses two 1.5-second low-level cues, removes the continuous wind/crowd beds, and targets −22 LUFS. Current completed job: `8b04880c94f1`; export: `output/v01-boston-tech-capital.mp4`. The audio-only revision preserves the original encoded video stream and passes all 19 delivery checks. `aether remix` supports further audio-only revisions.
- No automated production schedule or publishing workflow has been activated.

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
| Delivered video | YouTube Shorts only |
| Resolution | 1080 × 1920 pixels |
| Frame rate | Constant 30 fps |
| Aspect ratio | 9:16, vertical |
| Runtime | 45–75 seconds; 60-second default |
| Voice | Captions and sound effects; narration optional |
| AI access | Codex CLI with ChatGPT authentication; no automatic paid API fallback |
| Rendering | Local |
| Asset creation | Manual creation and refinement of reusable assets is allowed |
| Campus reuse | Generate or configure layouts and environments to fit each story |
| Character reuse | Recurring characters can keep the same identity |
| Timeline | 16-week build with up to four contingency weeks |
| Publishing | Human-controlled |

The user questioned a separate preview mode. The agreed simplification is one video format and one rendering mode. Fast checks use sampled frames and short segments in the same format. Do not introduce a separate 540 × 960 or 15 fps preview pipeline. Internal diagnostic images and logs are acceptable.

October 31 export correction: omit the chapter footer, production disclaimer footer, AETHER branding, and progress line from exported video. Keep sources and production metadata in the review workspace. Story captions remain in the video.

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
