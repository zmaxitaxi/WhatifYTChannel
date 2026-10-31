/**
 * Deterministic Mulberry32 PRNG.
 * Never use Math.random() anywhere in the renderer.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }
}

export function sampleNormalizedFrame(
  frameIndex: number,
  startFrame: number,
  endFrame: number,
  easing: "linear" | "smoothstep" | "easeInOutCubic" = "smoothstep"
): number {
  if (frameIndex <= startFrame) return 0;
  if (frameIndex >= endFrame) return 1;
  const t = (frameIndex - startFrame) / Math.max(1, endFrame - startFrame);
  switch (easing) {
    case "linear":
      return t;
    case "smoothstep":
      return t * t * (3 - 2 * t);
    case "easeInOutCubic":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
