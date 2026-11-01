# AETHER

Local, stylized 3D university Shorts production. The current draft is **What if Stanford started in Boston?**, rebuilt as a 72-second continuous waterfront journey from an invented 1885 founding to a hopeful 2050 harbor city.

The accepted [creative direction](docs/CREATIVE_DIRECTION.md) defines story, captions, models, motion, sound, and delivery taste. The planner reads it for future drafts. The [next-topic brainstorm](docs/VIDEO_TOPICS.md) explores new story mechanisms; these proposals still require research and scene support.

Future videos carry forward the uncut camera journey, always-visible checkpoint
timeline, and fitting continuous music. Each topic gets its own camera route,
world progression, and emotional arc; some can reveal a brighter, more hopeful
future. The degree reference's horizontal staging and soundtrack are episode
choices. The delivered format stays vertical 9:16.

The controller validates a structured story, renders deterministic Three.js frames, checkpoints five-second lossless chunks, mixes sound, exports one 1080 × 1920 / 30 fps MP4, and opens it for human review. The current film curves past a Charles River campus, Boston workshop, research quay, ferry commute, transit housing, and clean-energy mill, then rises above the connected future harbor. Seven logical chapters share one permanent world without cuts or visibility-switched sets. The Boston history and future are authored fiction; verified historical anchors remain separate.

The top checkpoint timeline stays visible while a red dot advances smoothly. Checkpoints mark 1885, 1891, 1939, 1951, 1996, 2026, 2050, and an open-ended endpoint. Plain white DM Serif Display captions sit at screen center without text boxes, with a fine dark outline for readability over brighter buildings. This story has no invented numerical counter. The “Imagined Scenario” header, production footers, and AETHER watermark are absent. The opening What if question establishes fiction; assumptions and historical evidence remain inspectable in the workspace and script.

Models include distance-driven walking, founders with a map, engineers handling an instrument, computer work, a moving ferry and train, and a solar-panel production line. Animation derives from absolute time and story progress. The camera's position and target follow a continuous spline. An original 72-second score develops toward a brighter final third under eight restrained effects; there are no bird, chirp, or wind beds.

The degree-expiry reference remains in `fixtures/v13_degree_expiry.json` and `content/v13_degree_expiry.txt`, with its own connected world and meaningful 0–5 renewal counter. Both current journeys share `web/src/continuousRenderer.ts`, with independent models, routes, checkpoints, and sound.

The previous cut-based 72-second Stanford-in-Boston timeline remains available in `fixtures/v01_stanford_boston_timeline.json` and `content/v01_stanford_boston_timeline.txt`. Its twelve-scene renderer and earlier caption style are preserved for that production.

Patrick's upstream package is retained under `renderer/`. The user chose the models already shown in this MVP, so the active visual runtime stays in `web/src/renderer.ts`. Accidentally tracked `renderer/node_modules/` files are removed from the index and covered by `.gitignore`; installed dependencies remain local and are reproduced from lock files.

The draft builds on main commit `74cfbf3`, including Francis's PRs #2–#10 and the verified Stanford timeline. The active pipeline reuses his caption layout in `renderer/src/overlays/`, the sound library/mixer/encoder in `audio/`, and the independent delivery inspector in `delivery/`. Thin adapters live in `src/aether/contributors.py`; these packages remain the owners of their media logic. Caption layout preserves authored line breaks. The encoder identifies browser sRGB captures explicitly. Mixer headroom and AAC regression tests protect the encoded soundtrack's peak limit.

## Run the MVP

Requirements: Python 3.12, Node.js 20.19+ or 22.12+, `uv`, and FFmpeg/FFprobe on PATH. Node 25 and FFmpeg 9 were used during the initial build. `uv.lock` and `package-lock.json` pin dependencies.

```sh
uv sync --locked
npm ci
uv run python -m playwright install chromium
uv run aether schema
npm run contracts
npm run build
uv run aether doctor
uv run aether serve
```

Open <http://127.0.0.1:8000> and choose **Render Stanford journey**. The worker renders one production at a time. Once complete, **Export MP4** appears directly under the player and downloads the final video. The workspace also shows claims and assumptions, contact sheets, specifications, and review actions. Earlier failed/cancelled/revised drafts remain available in an expandable history.

The default production works from an included fictional fixture and needs no model request. For a command-line production:

```sh
uv run aether validate fixtures/v01_boston_continuous.json
uv run aether demo --samples-only
uv run aether jobs
uv run aether resume JOB_ID
```

`--samples-only` creates diagnostic stills at the production resolution. Resume the resulting queued job for the full Short. Starting the normal server also processes queued work. Use `serve --no-worker` to inspect saved work without starting it.

## Plan with Codex

The planner uses the pinned project-local Codex CLI when installed, your existing ChatGPT login, and your configured model. It ignores unrelated user configuration and disables plugins, apps, hooks, browser/computer tools, shell tools, and delegation for the planning invocation. It strips API-key credentials from the child environment and never changes billing methods. The structured-output and JSONL flags follow [official non-interactive-mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode).

```sh
node_modules/.bin/codex login
uv run aether plan
uv run aether plan --model YOUR_AVAILABLE_CODEX_MODEL --render
```

The planner is bounded to the supported Stanford relocation/history and continuous Boston/degree-expiry vocabularies and fixed fixture settings. It preserves the supplied fact pack, journey checkpoints, and counter, allows an initial candidate plus two repairs, and retains prompts, events, validation errors, CLI version, model choice, and creative-guide/input hashes under `data/planning/`. A planning failure leaves that evidence available. Account/model availability must be verified by a completed inference; a login check alone does not establish it. See [current model guidance](https://learn.chatgpt.com/docs/models).

`--facts PATH` accepts a separately researched `FactPack` JSON document. Facts are supplied before planning; automatic web research and image critique are later work.

## Recovery and review

```sh
uv run aether cancel JOB_ID
uv run aether resume JOB_ID
uv run aether review JOB_ID approve
uv run aether review JOB_ID revise --note "Make the arrival clearer"
```

Cancellation preserves complete chunks and stops capture/encoding children. Resume verifies checkpoint hashes and frame counts. Changes to the specification, browser version, engine, assets, or dependency locks invalidate reuse. Restarting the server marks abandoned active work recoverable; resume is explicit. A file lock prevents simultaneous CLI/server captures. The worker pauses at two videos awaiting review.

Review approval records a local decision. Revision requests record notes and mark the production rejected; **automatic revision generation is not implemented**. Create a new specification/production for the next pass. Publishing remains manual. Nothing is uploaded or scheduled by this application.

Audio-only revisions can reuse a completed video without recapture or video recompression:

```sh
uv run aether remix SOURCE_JOB_ID edited-audio-spec.json
```

Only `sound` and `audio_loudness_lufs` may differ; visuals, captions, and output settings must match. The controller verifies the source checksum, creates a new job, remixes through Francis's library, copies the encoded video stream, checks stream identity, and runs delivery inspection. The degree film uses a −22 LUFS target, a continuous original twelve-second musical loop, and five short effects. The older Stanford timeline uses twelve short effects with quiet gaps. Other specifications default to −16 LUFS. Mixing and delivery checks share the per-production loudness target.

The job API also exposes Francis's draft review fields, accepts `decision`/`notes`/`rubric`, and persists review history. The existing studio remains the default UI. Francis's separate `review/` pages can consume this API; their full rubric and muted-watch approval gate is not yet enforced by this MVP API.

## Shared interfaces and ownership

| Area | Location | Ongoing owner |
|---|---|---|
| Authoritative Pydantic contracts | `src/aether/contracts.py` | Max; shared changes reviewed by all three |
| Generated JSON Schema / TypeScript | `contracts/production.schema.json`, `web/src/generated/production.ts` | Generated from Python |
| Controller, state, capture integration, API | `src/aether/` | Max |
| Cameras and visual integration | `web/src/renderer.ts`, `web/src/historyRenderer.ts`, `web/src/degreeRenderer.ts`, `web/src/journeyMotion.ts` | Max; Patrick's engine remains in `renderer/` |
| Procedural models and connected worlds | `web/src/models.ts`, `web/src/timelineModels.ts`, `web/src/degreeModels.ts` | Permanent “WhatifYTChannel 3D Models” chat, GPT-6 Astra High |
| Story and caption integration | `fixtures/`, `web/src/renderer.css` | Max, using Francis's caption layout |
| Sound / final encode / delivery checks | `audio/`, `delivery/` | Francis; Max owns the adapter |
| Review workspace | `web/templates/`, `web/public/studio.js`; `review/` | Max's prototype; Francis's separate pages consume the job API |

The renderer exposes `window.aether.ready`, `renderFrame(frameIndex)`, and `dispose()`. Every frame derives from absolute time and seeded layouts; production has no autonomous animation loop. Python and the renderer validate against the same generated schema. The MVP hands the canonical validated spec directly to the trusted runtime; a richer compiled scene-plan layer remains future work.

The Boston film uses `boston_journey` dated logical chapters and `history_journey` checkpoint metadata without a numerical counter. Its original score covers the whole film. The degree film uses the trusted `degree_journey` operation for logical chapters; these do not cut or reset the camera or world. Shared journey metadata defines strictly ordered checkpoints, the five-year rule, and counter label. The full-length musical bed is required. The default specification is `fixtures/v01_boston_continuous.json`; the Boston script is `content/v01_boston_continuous.txt`. The degree specification remains `fixtures/v13_degree_expiry.json`; the readable script and counter derivation are in `content/v13_degree_expiry.txt`. Stanford's `history_scene` and the six legacy relocation operations remain supported. Other scenarios and operations produce `needs_development`.

## Verification

```sh
uv run pytest -q
uv run ruff check src tests scripts/benchmark_capture.py
uv run ruff format --check src tests scripts/benchmark_capture.py
npm run typecheck
npm run build
uv run python scripts/benchmark_capture.py
```

The tests cover invalid formats/timelines, unsupported operations, claim references, reading load, schema drift, artifact access, API transitions, review capacity, Codex repairs, secret exclusion, and process timeouts. The full media export separately checks decoded frame count, duration, dimensions, frame rate, pixel format, BT.709 tags, H.264, and AAC stereo at 48 kHz.

`scripts/benchmark_capture.py` checks that the faster lossless Playwright CDP screenshot path produces exactly the same decoded pixels as the regular screenshot API at 1080 × 1920. It does not introduce another video format.

## Data and limitations

Jobs, attempts, registered artifacts, sample images, checksums, and MP4s live under ignored `data/`. Review uses opaque artifact IDs and binds to loopback. A separate `--data-dir PATH` provides an isolated workspace. No authentication files or private machine configuration belong in the repository.

The map is diagrammatic; no map distance is presented as a measurement. Relocation, the future skyline, inventions, and Boston's imagined tech-capital status are fictional. The Stanford fact uses its university source. The generated review-design image is a development reference only. Font files come from pinned Fontsource packages; effects and geometry are procedurally authored in this repo.

The ordered [remaining build checklist](docs/BUILD_BACKLOG.md) separates the working MVP from release targets. Still planned: all remaining scenario families, a broader capability/asset registry, richer evidence and metric bindings, Codex image critique, automated research/revision, stronger asset and motion quality, full release reliability trials, and production scheduling. Francis's `research/`, `content/`, `discovery/`, and `analytics/` packages are available on main; automatic orchestration of those packages remains future work. The original 16-week release plan remains in [TECHNICAL_PLAN.md](TECHNICAL_PLAN.md).
