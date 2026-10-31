import { AetherEngine } from "./engine/AetherEngine";
import { AssetManifest, CompiledScenePlan } from "./contracts/types";
import v01SliceFixture from "../fixtures/v01_stanford_boston_slice.json";

declare global {
  interface Window {
    __AETHER_RUNTIME__?: AetherEngine;
    __AETHER_READY__?: boolean;
  }
}

async function bootstrap() {
  const canvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
  const viewport = document.getElementById("aether-viewport") as HTMLElement;
  const engine = new AetherEngine(canvas);
  window.__AETHER_RUNTIME__ = engine;

  const plan = v01SliceFixture as unknown as CompiledScenePlan;
  const defaultManifest: AssetManifest = {
    engineVersion: "0.1.0",
    stylePackVersion: "1.0.0",
    assets: {},
  };

  await engine.initialize(plan, defaultManifest);
  await engine.renderFrame(0);
  window.__AETHER_READY__ = true;

  // If running interactively in a normal browser window (not headless Playwright capture),
  // scale the 1080x1920 viewport to fit the screen and show a frame scrubber bar.
  if (!navigator.webdriver) {
    const applyViewportFit = () => {
      const scale = Math.min(
        (window.innerHeight - 80) / 1920,
        (window.innerWidth - 40) / 1080
      );
      viewport.style.position = "fixed";
      viewport.style.top = "16px";
      viewport.style.left = "50%";
      viewport.style.transformOrigin = "top center";
      viewport.style.transform = `translateX(-50%) scale(${scale})`;
      viewport.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.15), 0 20px 50px rgba(0,0,0,0.8)";
      viewport.style.borderRadius = "12px";
    };
    applyViewportFit();
    window.addEventListener("resize", applyViewportFit);

    const bar = document.createElement("div");
    bar.style.cssText =
      "position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f8fafc;padding:8px 16px;border-radius:8px;display:flex;gap:12px;align-items:center;font-family:system-ui,sans-serif;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.5);";

    const btn = document.createElement("button");
    btn.textContent = "▶ Play";
    btn.style.cssText =
      "background:#8c1515;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:600;";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = String(plan.output.totalFrames - 1);
    slider.value = "0";
    slider.style.width = "320px";

    const label = document.createElement("span");
    label.textContent = `Frame: 0 / ${plan.output.totalFrames - 1} (0.00s)`;

    let playing = false;
    let currentFrame = 0;

    const updateToFrame = async (f: number) => {
      currentFrame = f;
      slider.value = String(f);
      label.textContent = `Frame: ${f} / ${plan.output.totalFrames - 1} (${(f / 30).toFixed(2)}s)`;
      await engine.renderFrame(f);
    };

    slider.addEventListener("input", () => {
      playing = false;
      btn.textContent = "▶ Play";
      updateToFrame(Number(slider.value));
    });

    btn.addEventListener("click", () => {
      playing = !playing;
      btn.textContent = playing ? "⏸ Pause" : "▶ Play";
    });

    setInterval(() => {
      if (playing) {
        const next = (currentFrame + 1) % plan.output.totalFrames;
        updateToFrame(next);
      }
    }, 1000 / 30);

    bar.append(btn, slider, label);
    document.body.appendChild(bar);
  }
}

bootstrap();