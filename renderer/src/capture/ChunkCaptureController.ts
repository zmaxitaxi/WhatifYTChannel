import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  CompiledScenePlan,
  FrameDiagnostics,
  SHORTS_FPS,
  SHORTS_HEIGHT,
  SHORTS_WIDTH,
} from "../contracts/types";

export interface ChunkCheckpoint {
  chunkIndex: number;
  startFrame: number;
  endFrame: number;
  filePath: string;
  sha256: string;
  diagnostics: FrameDiagnostics[];
}

/**
 * Deliverable 7: Exact-Format Frame Capture & 5-Second Lossless Chunk Intermediates.
 * - Uses Playwright pinned viewport (1080x1920, deviceScaleFactor: 1)
 * - Streams raw PNG buffers directly into FFmpeg stdin with backpressure
 * - Never writes thousands of permanent PNGs to disk
 * - Checkpoints every 150-frame (5-second) lossless chunk with SHA-256 for restart recovery
 */
export class ChunkCaptureController {
  private static readonly CHUNK_FRAMES = 150; // 5 seconds @ 30fps

  public async capturePlanInChunks(
    serverUrl: string,
    plan: CompiledScenePlan,
    outputDir: string
  ): Promise<ChunkCheckpoint[]> {
    await fs.mkdir(outputDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: SHORTS_WIDTH, height: SHORTS_HEIGHT },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    await page.goto(serverUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__AETHER_READY__ === true);

    // Initialize runtime with the supplied plan
    await page.evaluate(async (p) => {
      await window.__AETHER_RUNTIME__!.initialize(p, {
        engineVersion: "0.1.0",
        stylePackVersion: "1.0.0",
        assets: {},
      });
    }, plan);

    const totalFrames = plan.output.totalFrames;
    const totalChunks = Math.ceil(
      totalFrames / ChunkCaptureController.CHUNK_FRAMES
    );
    const checkpoints: ChunkCheckpoint[] = [];

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const startFrame = chunkIdx * ChunkCaptureController.CHUNK_FRAMES;
      const endFrame = Math.min(
        totalFrames,
        (chunkIdx + 1) * ChunkCaptureController.CHUNK_FRAMES
      );
      const chunkFile = path.join(
        outputDir,
        `chunk_${String(chunkIdx).padStart(3, "0")}.mp4`
      );
      const metaFile = `${chunkFile}.checkpoint.json`;

      // Restart recovery check: skip if validated checkpoint already exists
      try {
        const existingMeta = JSON.parse(
          await fs.readFile(metaFile, "utf-8")
        ) as ChunkCheckpoint;
        const fileHash = await this.computeFileSha256(chunkFile);
        if (fileHash === existingMeta.sha256) {
          checkpoints.push(existingMeta);
          continue;
        }
      } catch {
        // Proceed to render chunk
      }

      const diagnostics = await this.renderSingleChunk(
        page,
        startFrame,
        endFrame,
        chunkFile
      );
      const sha256 = await this.computeFileSha256(chunkFile);

      const checkpoint: ChunkCheckpoint = {
        chunkIndex: chunkIdx,
        startFrame,
        endFrame,
        filePath: chunkFile,
        sha256,
        diagnostics,
      };
      await fs.writeFile(metaFile, JSON.stringify(checkpoint, null, 2));
      checkpoints.push(checkpoint);
    }

    await browser.close();
    return checkpoints;
  }

  private async renderSingleChunk(
    page: import("playwright").Page,
    startFrame: number,
    endFrame: number,
    outPath: string
  ): Promise<FrameDiagnostics[]> {
    const tmpPath = `${outPath}.tmp.mp4`;
    const diagnostics: FrameDiagnostics[] = [];

    // Spawn FFmpeg for lossless H.264 intermediate (-crf 0, BT.709 color tags)
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "-framerate",
      String(SHORTS_FPS),
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-crf",
      "0",
      "-preset",
      "ultrafast",
      "-pix_fmt",
      "yuv420p",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      tmpPath,
    ]);

    for (let f = startFrame; f < endFrame; f++) {
      const diag = await page.evaluate(async (frameIndex) => {
        return await window.__AETHER_RUNTIME__!.renderFrame(frameIndex);
      }, f);
      diagnostics.push(diag);

      const pngBuffer = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: SHORTS_WIDTH, height: SHORTS_HEIGHT },
      });

      // Respect FFmpeg stdin backpressure so memory stays bounded
      const canContinue = ffmpeg.stdin.write(pngBuffer);
      if (!canContinue) {
        await new Promise<void>((resolve) =>
          ffmpeg.stdin.once("drain", () => resolve())
        );
      }
    }

    ffmpeg.stdin.end();
    await new Promise<void>((resolve, reject) => {
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg chunk encode exited with code ${code}`));
      });
    });

    await fs.rename(tmpPath, outPath);
    return diagnostics;
  }

  private async computeFileSha256(filePath: string): Promise<string> {
    const buf = await fs.readFile(filePath);
    return createHash("sha256").update(buf).digest("hex");
  }
}
