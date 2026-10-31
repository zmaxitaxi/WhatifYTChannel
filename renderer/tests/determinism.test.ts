import { describe, expect, it } from "vitest";
import { SeededRNG, sampleNormalizedFrame } from "../src/engine/prng";
import { USMapStage } from "../src/components/geography/USMapStage";
import { StylizedCharacter } from "../src/components/character/StylizedCharacter";

describe("AETHER Determinism & Measurement Suite (Deliverable 8)", () => {
  it("produces identical PRNG sequences for identical seeds", () => {
    const rngA = new SeededRNG(20261031);
    const rngB = new SeededRNG(20261031);
    for (let i = 0; i < 100; i++) {
      expect(rngA.nextFloat()).toBe(rngB.nextFloat());
    }
  });

  it("produces identical character transforms when requesting frames out-of-order", () => {
    const char = new StylizedCharacter("student_test");

    // Request Frame 45 first
    char.applyState("surprised", "pointing", 45 / 30);
    const firstPassHeadY = char.root.children[1].position.y;
    const firstPassArmRotX = char.root.children[3].rotation.x;

    // Jump to Frame 210 with different expression/action, then return to Frame 45
    char.applyState("worried", "walking", 210 / 30);
    char.applyState("surprised", "pointing", 45 / 30);

    expect(char.root.children[1].position.y).toBeCloseTo(firstPassHeadY, 8);
    expect(char.root.children[3].rotation.x).toBeCloseTo(firstPassArmRotX, 8);
  });

  it("computes accurate Haversine distance from Stanford (Palo Alto) to Boston", () => {
    const stanford = { lat: 37.4275, lon: -122.1697 };
    const boston = { lat: 42.3601, lon: -71.0589 };
    const km = USMapStage.calculateGreatCircleKm(stanford, boston);
    // True great-circle distance is ~4,329 km (haversine, R = 6371 km)
    expect(km).toBeGreaterThan(4300);
    expect(km).toBeLessThan(4370);
  });

  it("enforces half-open frame intervals [startFrame, endFrame)", () => {
    expect(sampleNormalizedFrame(90, 90, 180, "linear")).toBe(0);
    expect(sampleNormalizedFrame(135, 90, 180, "linear")).toBeCloseTo(0.5, 6);
    expect(sampleNormalizedFrame(180, 90, 180, "linear")).toBe(1);
  });
});
