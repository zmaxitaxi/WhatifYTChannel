# AETHER Renderer (`aether/renderer/`) — Patrick's Workstream B

This package implements **Workstream B (3D engine, assets, and frame capture)** from `TECHNICAL_PLAN.md`, specifically targeting the **First Three Working Days** and **Weeks 1–2 Critical Visual Experiment**.

## Included Deliverables

1. **Authoritative Runtime Interface (`src/contracts/types.ts` & `src/engine/AetherEngine.ts`)**
   - Implements `AetherRuntime` (`initialize(plan, assets)`, `renderFrame(frameIndex)`, `dispose()`).
   - Enforces the single Shorts output mode (`1080 × 1920`, `30 fps`, `9:16`) and half-open intervals `[startFrame, endFrame)`.
   - Returns complete `FrameDiagnostics` including 2D screen-space bounding boxes and safe-zone warnings (`90px left, 180px right, 180px top, 300px bottom`).

2. **Deterministic Animation & Seeded PRNG (`src/engine/prng.ts`)**
   - `SeededRNG` (Mulberry32) replaces `Math.random()`.
   - Out-of-order frame sampling (`renderFrame(210)` followed by `renderFrame(45)`) yields identical scene state.

3. **Stylized Character System (`src/components/character/StylizedCharacter.ts`)**
   - Recognizable eyes, eyebrows, nose, mouth, and hair silhouette designed for the 360px-wide phone test.
   - Supports `neutral`, `happy`, `surprised`, `worried`, and `confused` expressions plus `idle`, `walking`, `pointing`, and `celebrating` actions.

4. **Stanford Identity Kit (`src/components/campus/StanfordCampusKit.ts`)**
   - Hoover Tower landmark silhouette, Main Quad sandstone/red-tile modules, seeded trees, and deterministic time-addressable snow particles for Boston arrival.

5. **Geography & True Coordinate Measurements (`src/components/geography/USMapStage.ts`)**
   - Separates geographic coordinates (`lat/lon`) from presentation coordinates (`meters`).
   - Computes real Haversine great-circle distances (`4,334 km` Palo Alto → Boston) and parabolic relocation arcs.

6. **5-Second Lossless Chunk Capture (`src/capture/ChunkCaptureController.ts`)**
   - Uses Playwright (`1080 × 1920`, `deviceScaleFactor: 1`) to capture WebGL + HTML/SVG overlays together.
   - Pipes PNG buffers directly to FFmpeg stdin with backpressure (no disk flood of PNG files) and writes SHA-256 checkpointed 5-second lossless chunks.

## Quick Start

```bash
cd aether/renderer
npm install
npm run test:determinism
npm run dev
```
