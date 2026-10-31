import { describe, expect, it } from "vitest";
import {
  cueEnvelope,
  formatMetricValue,
  layoutCaption,
  tokenizeCaption,
  validateCaptionTrack,
  wordsPerSecond,
} from "../src/overlays/captionLayout";
import { CompiledScenePlan } from "../src/contracts/types";
import v01 from "../fixtures/v01_stanford_boston_slice.json";

// Fake monospace measurer: 30px per character.
const mono = (t: string) => t.length * 30;
const lineText = (l: { tokens: { text: string }[] }) =>
  l.tokens.map((t) => t.text).join(" ");

describe("Caption layout (Workstream C)", () => {
  it("marks single words and multi-word phrases for emphasis, ignoring case and punctuation", () => {
    const toks = tokenizeCaption("Flying 4,329 km to boston!", ["4,329 km", "Boston"]);
    expect(toks.filter((t) => t.emphasis).map((t) => t.text)).toEqual([
      "4,329",
      "km",
      "boston!",
    ]);
  });

  it("keeps short captions on one line", () => {
    const layout = layoutCaption(tokenizeCaption("Short line here"), mono, {
      maxLineWidthPx: 600,
    });
    expect(layout.lines).toHaveLength(1);
    expect(layout.overflow).toBe(false);
  });

  it("splits long captions into two balanced lines", () => {
    const layout = layoutCaption(
      tokenizeCaption("What if Stanford suddenly relocated to Boston?"),
      mono,
      { maxLineWidthPx: 800, fontSizePx: 60 }
    );
    expect(layout.lines.map(lineText)).toEqual([
      "What if Stanford suddenly",
      "relocated to Boston?",
    ]);
    expect(layout.fontSizePx).toBe(60);
  });

  it("shrinks the font to fit before reporting overflow, never below the floor", () => {
    const tokens = tokenizeCaption("What if Stanford suddenly relocated to Boston?");
    const fit = layoutCaption(tokens, mono, {
      maxLineWidthPx: 700,
      fontSizePx: 60,
      minFontSizePx: 52,
    });
    expect(fit.fontSizePx).toBeLessThan(60);
    expect(fit.fontSizePx).toBeGreaterThanOrEqual(52);
    expect(fit.overflow).toBe(false);

    const tooLong = layoutCaption(tokens, mono, {
      maxLineWidthPx: 300,
      fontSizePx: 60,
      minFontSizePx: 52,
    });
    expect(tooLong.fontSizePx).toBe(52);
    expect(tooLong.overflow).toBe(true);
  });

  it("fades in and out as a pure function of frame index", () => {
    expect(cueEnvelope(89, 90, 180).opacity).toBe(0);
    expect(cueEnvelope(180, 90, 180).opacity).toBe(0);
    expect(cueEnvelope(90, 90, 180).opacity).toBeGreaterThan(0);
    expect(cueEnvelope(90, 90, 180).opacity).toBeLessThan(1);
    expect(cueEnvelope(135, 90, 180)).toEqual({ opacity: 1, offsetYPx: 0 });
    // Out-of-order sampling gives identical results.
    const a = cueEnvelope(93, 90, 180);
    cueEnvelope(170, 90, 180);
    expect(cueEnvelope(93, 90, 180)).toEqual(a);
  });

  it("formats metric values with fixed en-US grouping", () => {
    expect(formatMetricValue(4334)).toBe("4,334");
    expect(formatMetricValue(2166.6)).toBe("2,167");
  });

  it("flags reading load, overlaps, unsourced numbers and emphasis typos", () => {
    const plan = {
      output: { totalFrames: 300 },
      captions: [
        { id: "a", startFrame: 0, endFrame: 60, text: "one two three four five six seven", isHypothetical: true },
        { id: "b", startFrame: 50, endFrame: 120, text: "It is 4,329 km away", isHypothetical: false, emphasis: ["miles"] },
      ],
    } as unknown as CompiledScenePlan;
    const msgs = validateCaptionTrack(plan).map((i) => i.message).join("\n");
    expect(msgs).toMatch(/'a' reading load 3\.50/);
    expect(msgs).toMatch(/'a' overlaps 'b'/);
    expect(msgs).toMatch(/'b' states a number but has no sourceLabel/);
    expect(msgs).toMatch(/'b' emphasis 'miles'/);
  });

  it("V01 fixture passes every track-level caption check", () => {
    const plan = v01 as unknown as CompiledScenePlan;
    expect(validateCaptionTrack(plan)).toEqual([]);
    for (const cue of plan.captions) {
      expect(wordsPerSecond(cue)).toBeLessThanOrEqual(2.5);
    }
  });
});
