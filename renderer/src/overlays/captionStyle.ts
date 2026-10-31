import { STYLE_PACK_V1 } from "../style/stylePack";

/**
 * V01 caption and overlay design tokens (Workstream C, Francis).
 *
 * Rules from TECHNICAL_PLAN.md "Style and captions":
 * - main captions >= 52px, supporting labels >= 36px, numbers ~80-110px
 * - at most two caption lines, at most 2.5 words/second reading load
 * - restrained serif display text, readable sans supporting labels
 * - consistent source, hypothetical, and time-compression treatments
 *
 * Every size here is in output pixels on the 1080 x 1920 frame.
 */
export const CAPTION_STYLE_V01 = {
  version: "v01.1",

  safe: STYLE_PACK_V1.safeMarginsPx,

  /** Pinned, vendored fonts (public/fonts). No system-font fallbacks are
   *  relied on, so line breaks match on every machine. */
  fonts: {
    display: "'AETHER Serif', serif",
    support: "'AETHER Sans', sans-serif",
    numeric: "'AETHER Sans', sans-serif",
    faces: [
      { family: "AETHER Serif", weight: 700, file: "/fonts/source-serif-4-latin-700-normal.woff2" },
      { family: "AETHER Sans", weight: 500, file: "/fonts/inter-latin-500-normal.woff2" },
      { family: "AETHER Sans", weight: 600, file: "/fonts/inter-latin-600-normal.woff2" },
      { family: "AETHER Sans", weight: 700, file: "/fonts/inter-latin-700-normal.woff2" },
    ],
  },

  caption: {
    fontSizePx: 60,
    /** Shrink-to-fit floor; the plan's minimum for main captions is 52px. */
    minFontSizePx: 52,
    fontWeight: 700,
    lineHeight: 1.22,
    maxLines: 2,
    /** Usable text width inside the safe zone, minus the scrim padding. */
    maxLineWidthPx: 1080 - 90 - 180 - 2 * 22,
    scrimPadXPx: 22,
    scrimPadYPx: 6,
    textColor: "#ffffff",
    emphasisColor: "#fbbf24",
    scrimColor: "rgba(8, 12, 20, 0.84)",
    /** Gap between the caption block and the bottom safe margin. */
    bottomGapPx: 16,
  },

  source: {
    fontSizePx: 36,
    color: "#e2e8f0",
    prefix: "Source",
    hypotheticalPrefix: "Imagined",
  },

  badge: {
    fontSizePx: 36,
    hypotheticalText: "Hypothetical",
    hypotheticalBg: "rgba(217, 119, 6, 0.95)",
    timeScaleBg: "rgba(15, 23, 42, 0.88)",
    timeScaleBorder: "rgba(255, 255, 255, 0.35)",
  },

  metric: {
    valueSizePx: 104,
    unitSizePx: 52,
    labelSizePx: 36,
    accent: "#8c1515",
    bg: "rgba(8, 12, 20, 0.82)",
  },

  label: {
    fontSizePx: 40,
    placeDot: "#fbbf24",
    landmarkDot: "#ffffff",
    bg: "rgba(8, 12, 20, 0.86)",
    /** Height of the leader line between the pill and its anchor point. */
    leaderPx: 46,
  },

  motion: {
    /** All motion is a pure function of frame index; no CSS transitions. */
    fadeInFrames: 6,
    fadeOutFrames: 4,
    riseInPx: 22,
    /** Counters land on their final (sourced) value this many frames before
     *  the readout ends, then hold, so viewers read the real number. */
    metricHoldFrames: 24,
  },

  limits: {
    maxWordsPerSecond: 2.5,
    /** Warn when a caption covers more than this share of a character's box. */
    maxCharacterCoverage: 0.2,
  },
} as const;

export type CaptionStyle = typeof CAPTION_STYLE_V01;
