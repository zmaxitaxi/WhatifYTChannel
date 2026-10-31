# AETHER

Local, stylized 3D university Shorts production. The first MVP covers **V01: What if Stanford made Boston the world's tech capital?**

The controller validates a structured story, renders deterministic Three.js frames, checkpoints five-second lossless chunks, mixes sound cues, exports one 1080 × 1920 / 30 fps MP4, and opens it for human review. Astra's procedural models add detailed students, Stanford architecture, campus surroundings, robots, flying shuttles, and clean-energy inventions. This is the first integration slice, not the full twelve-concept release.

Exported video contains the story visuals and captions, with no chapter footer, production disclaimer footer, AETHER watermark, or progress line. Sources and production details stay in the review workspace.

Patrick's upstream package is retained under `renderer/`. The user chose the models already shown in this MVP, so the active visual runtime stays in `web/src/renderer.ts`. Accidentally tracked `renderer/node_modules/` files are removed from the index and covered by `.gitignore`; installed dependencies remain local and are reproduced from lock files.

Main is integrated through `2944d0d` (Francis's PRs #2–#10). The active pipeline reuses his caption layout in `renderer/src/overlays/`, the sound library/mixer/encoder in `audio/`, and the independent delivery inspector in `delivery/`. Thin adapters live in `src/aether/contributors.py`; these packages remain the owners of their media logic. The encoder's optional `input_is_srgb` flag identifies browser RGB captures without changing its existing YUV-input behavior. Mixer headroom was increased after the full AAC export exposed an overshoot; a round-trip regression test checks the actual encoded soundtrack.

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

Open <http://127.0.0.1:8000> and choose **New V01 production**. The worker renders one production at a time. Live progress appears in the workspace; finished video, source claims, contact sheet, specification, review actions, and MP4 download appear when ready.

The first production works from an included, sourced fixture and needs no model request. For a command-line production:

```sh
uv run aether validate fixtures/v01_stanford_boston.json
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

The planner is intentionally bounded to the MVP's Stanford-to-Boston vocabulary and fixed fixture output settings. It preserves the supplied fact pack, allows an initial candidate plus two repairs, and retains prompts, events, validation errors, CLI version, model choice, and input hashes under `data/planning/`. A planning failure leaves that evidence available. Account/model availability must be verified by a completed inference; a login check alone does not establish it. See [current model guidance](https://learn.chatgpt.com/docs/models).

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
uv run aether remix SOURCE_JOB_ID fixtures/v01_stanford_boston.json
```

Only `sound` and `audio_loudness_lufs` may differ; visuals, captions, and output settings must match. The controller verifies the source checksum, creates a new job, remixes through Francis's library, copies the encoded video stream, checks stream identity, and runs delivery inspection. The quieter V01 fixture uses a −22 LUFS target, two brief ambience cues, and quiet gaps. Other specifications default to −16 LUFS. The per-production target is used by both mixing and delivery checks, so normalization preserves the requested volume.

The job API also exposes Francis's draft review fields, accepts `decision`/`notes`/`rubric`, and persists review history. The existing studio remains the default UI. Francis's separate `review/` pages can consume this API; their full rubric and muted-watch approval gate is not yet enforced by this MVP API.

## Shared interfaces and ownership

| Area | Location | Ongoing owner |
|---|---|---|
| Authoritative Pydantic contracts | `src/aether/contracts.py` | Max; shared changes reviewed by all three |
| Generated JSON Schema / TypeScript | `contracts/production.schema.json`, `web/src/generated/production.ts` | Generated from Python |
| Controller, state, capture integration, API | `src/aether/` | Max |
| Cameras and visual integration | `web/src/renderer.ts` | Max; Patrick's engine remains in `renderer/` |
| Procedural models and surroundings | `web/src/models.ts` | Astra High, delegated by the user |
| Story and caption integration | `fixtures/`, `web/src/renderer.css` | Max, using Francis's caption layout |
| Sound / final encode / delivery checks | `audio/`, `delivery/` | Francis; Max owns the adapter |
| Review workspace | `web/templates/`, `web/public/studio.js`; `review/` | Max's prototype; Francis's separate pages consume the job API |

The renderer exposes `window.aether.ready`, `renderFrame(frameIndex)`, and `dispose()`. Every frame derives from absolute time and seeded layouts; production has no autonomous animation loop. Python and the renderer validate against the same generated schema. The MVP hands the canonical validated spec directly to the trusted runtime; a richer compiled scene-plan layer remains future work.

The six implemented operations are `character_react`, `campus_establish`, `campus_relocate`, `campus_arrive`, `campus_compare`, and `campus_close`. Other scenario families and operations produce `needs_development`. See the fixture for parameter bounds, shot ranges, caption and sound examples.

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

Still planned: all remaining scenario families, a broader capability/asset registry, richer evidence and metric bindings, Codex image critique, automated research/revision, stronger asset and motion quality, full release reliability trials, and production scheduling. Francis's `research/`, `content/`, `discovery/`, and `analytics/` packages are available on main; automatic orchestration of those packages remains future work. The original 16-week release plan remains in [TECHNICAL_PLAN.md](TECHNICAL_PLAN.md).
