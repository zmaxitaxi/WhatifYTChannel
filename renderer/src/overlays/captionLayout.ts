/**
 * Pure caption layout and timing logic. No DOM access here, so every rule is
 * unit-testable and the same input always produces the same layout.
 */
import type {
  CaptionCueSpec,
  CompiledScenePlan,
} from "../contracts/types";
import { SHORTS_FPS } from "../contracts/types";
import { CAPTION_STYLE_V01 } from "./captionStyle";

export type MeasureText = (text: string) => number;

export interface CaptionToken {
  text: string;
  emphasis: boolean;
}

export interface CaptionLine {
  tokens: CaptionToken[];
  widthPx: number;
}

export interface CaptionLayout {
  lines: CaptionLine[];
  overflow: boolean;
  /** Font size the lines were laid out at (after any shrink-to-fit). */
  fontSizePx: number;
}

const normalize = (word: string) =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Split caption text into words and mark the ones listed in `emphasis`. */
export function tokenizeCaption(
  text: string,
  emphasis: readonly string[] = []
): CaptionToken[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const tokens = words.map((w) => ({ text: w, emphasis: false }));
  const norm = words.map(normalize);

  for (const phrase of emphasis) {
    const target = phrase.trim().split(/\s+/).map(normalize).filter(Boolean);
    if (target.length === 0) continue;
    for (let i = 0; i + target.length <= norm.length; i++) {
      if (target.every((t, j) => norm[i + j] === t)) {
        for (let j = 0; j < target.length; j++) tokens[i + j].emphasis = true;
      }
    }
  }
  return tokens;
}

/**
 * Break tokens into at most two lines. One line if it fits, otherwise the
 * two-line split whose longer line is shortest (a balanced split, which
 * avoids a lone orphan word on the second line).
 *
 * `measure` returns widths at `fontSizePx`. If even the best split is too
 * wide, the font shrinks (text width scales linearly with size) down to
 * `minFontSizePx`; only then is the layout flagged as overflowing.
 */
export function layoutCaption(
  tokens: CaptionToken[],
  measure: MeasureText,
  opts: {
    maxLineWidthPx?: number;
    fontSizePx?: number;
    minFontSizePx?: number;
    /** Keep an authored sentence break when the caller supplies one. */
    lineBreakAfter?: number;
  } = {}
): CaptionLayout {
  const maxW = opts.maxLineWidthPx ?? CAPTION_STYLE_V01.caption.maxLineWidthPx;
  const size = opts.fontSizePx ?? CAPTION_STYLE_V01.caption.fontSizePx;
  const minSize = opts.minFontSizePx ?? CAPTION_STYLE_V01.caption.minFontSizePx;

  const lineOf = (ts: CaptionToken[]): CaptionLine => ({
    tokens: ts,
    widthPx: measure(ts.map((t) => t.text).join(" ")),
  });

  let lines: CaptionLine[];
  const single = lineOf(tokens);
  const authoredBreak = opts.lineBreakAfter;
  if (authoredBreak !== undefined && Number.isInteger(authoredBreak) && authoredBreak > 0 && authoredBreak < tokens.length) {
    lines = [lineOf(tokens.slice(0, authoredBreak)), lineOf(tokens.slice(authoredBreak))];
  } else if (single.widthPx <= maxW || tokens.length < 2) {
    lines = [single];
  } else {
    let best: CaptionLine[] = [single];
    let bestWidest = Infinity;
    for (let k = 1; k < tokens.length; k++) {
      const a = lineOf(tokens.slice(0, k));
      const b = lineOf(tokens.slice(k));
      const widest = Math.max(a.widthPx, b.widthPx);
      // On a tie, prefer the longer top line (pyramid shape reads better).
      if (widest < bestWidest || (widest === bestWidest && a.widthPx >= b.widthPx)) {
        best = [a, b];
        bestWidest = widest;
      }
    }
    lines = best;
  }

  const widest = Math.max(...lines.map((l) => l.widthPx));
  if (widest <= maxW) return { lines, overflow: false, fontSizePx: size };

  const fitted = Math.max(minSize, Math.floor((size * maxW) / widest));
  const scale = fitted / size;
  return {
    lines: lines.map((l) => ({ ...l, widthPx: l.widthPx * scale })),
    overflow: widest * scale > maxW,
    fontSizePx: fitted,
  };
}

export interface CueEnvelope {
  opacity: number;
  offsetYPx: number;
}

/**
 * Fade/rise for a cue at a frame. A pure function of the frame index so that
 * out-of-order sampling gives identical pixels.
 */
export function cueEnvelope(
  frameIndex: number,
  startFrame: number,
  endFrame: number,
  motion = CAPTION_STYLE_V01.motion
): CueEnvelope {
  if (frameIndex < startFrame || frameIndex >= endFrame) {
    return { opacity: 0, offsetYPx: 0 };
  }
  const smooth = (t: number) => {
    const c = Math.min(1, Math.max(0, t));
    return c * c * (3 - 2 * c);
  };
  const inT = smooth((frameIndex - startFrame + 1) / motion.fadeInFrames);
  const outT = smooth((endFrame - frameIndex) / motion.fadeOutFrames);
  return {
    opacity: Math.min(inT, outT),
    offsetYPx: Math.round((1 - inT) * motion.riseInPx * 100) / 100,
  };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function wordsPerSecond(cue: CaptionCueSpec): number {
  const seconds = Math.max(1, cue.endFrame - cue.startFrame) / SHORTS_FPS;
  return countWords(cue.text) / seconds;
}

export interface CaptionIssue {
  cueId: string;
  message: string;
}

/**
 * Track-level checks that do not need a browser: reading load, cue overlap,
 * emphasis typos, and unsourced numbers.
 */
export function validateCaptionTrack(
  plan: Pick<CompiledScenePlan, "captions" | "output">,
  limits = CAPTION_STYLE_V01.limits
): CaptionIssue[] {
  const issues: CaptionIssue[] = [];
  const cues = [...plan.captions].sort((a, b) => a.startFrame - b.startFrame);

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.endFrame <= cue.startFrame) {
      issues.push({ cueId: cue.id, message: `Caption '${cue.id}' has an empty interval.` });
      continue;
    }
    if (cue.startFrame < 0 || cue.endFrame > plan.output.totalFrames) {
      issues.push({ cueId: cue.id, message: `Caption '${cue.id}' runs outside the timeline.` });
    }

    const wps = wordsPerSecond(cue);
    if (wps > limits.maxWordsPerSecond) {
      issues.push({
        cueId: cue.id,
        message: `Caption '${cue.id}' reading load ${wps.toFixed(2)} words/s exceeds ${limits.maxWordsPerSecond}.`,
      });
    }

    const next = cues[i + 1];
    if (next && next.startFrame < cue.endFrame) {
      issues.push({
        cueId: cue.id,
        message: `Caption '${cue.id}' overlaps '${next.id}' in time.`,
      });
    }

    for (const phrase of cue.emphasis ?? []) {
      const hit = tokenizeCaption(cue.text, [phrase]).some((t) => t.emphasis);
      if (!hit) {
        issues.push({
          cueId: cue.id,
          message: `Caption '${cue.id}' emphasis '${phrase}' does not appear in its text.`,
        });
      }
    }

    if (/\d/.test(cue.text) && !cue.sourceLabel) {
      issues.push({
        cueId: cue.id,
        message: `Caption '${cue.id}' states a number but has no sourceLabel.`,
      });
    }
  }
  return issues;
}

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  return w > 0 && h > 0 ? w * h : 0;
}

export function rectArea(r: Rect): number {
  return Math.max(0, r.maxX - r.minX) * Math.max(0, r.maxY - r.minY);
}

/** Format a metric value the same way on every machine (no locale drift). */
export function formatMetricValue(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
