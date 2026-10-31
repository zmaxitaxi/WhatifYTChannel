import type { CaptionStyle } from "./captionStyle";

/** Stylesheet for the overlay layer, generated from the style tokens. */
export function overlayCss(s: CaptionStyle): string {
  const m = s.safe;
  const faces = s.fonts.faces
    .map(
      (f) => `@font-face { font-family: "${f.family}"; font-weight: ${f.weight};
  font-style: normal; font-display: block; src: url("${f.file}") format("woff2"); }`
    )
    .join("\n");
  return `
${faces}
.aether-overlays {
  position: absolute; inset: 0; width: 1080px; height: 1920px;
  pointer-events: none; overflow: hidden;
}

/* ---- Top-left stack: badges + metric ---- */
.ov-badges {
  position: absolute; top: ${m.top}px; left: ${m.left}px;
  max-width: ${1080 - m.left - m.right}px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 14px;
}
.ov-badge {
  font-family: ${s.fonts.support};
  font-size: ${s.badge.fontSizePx}px; line-height: 1.15; font-weight: 700;
  padding: 8px 20px; border-radius: 10px; white-space: nowrap;
}
.ov-badge-hyp {
  background: ${s.badge.hypotheticalBg}; color: #fff;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.ov-badge-time {
  background: ${s.badge.timeScaleBg}; color: #f1f5f9;
  border: 2px solid ${s.badge.timeScaleBorder};
  font-weight: 600; letter-spacing: 0.04em;
}

.ov-metric {
  margin-top: 10px;
  background: ${s.metric.bg};
  border-left: 8px solid ${s.metric.accent};
  border-radius: 0 16px 16px 0; /* square left edge: no AA seam that varies by raster tiling */
  padding: 14px 28px 18px 24px; color: #f8fafc;
}
.ov-metric-row { display: flex; align-items: baseline; gap: 14px; }
.ov-metric-value {
  font-family: ${s.fonts.numeric}; font-size: ${s.metric.valueSizePx}px;
  font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.ov-metric-unit {
  font-family: ${s.fonts.support}; font-size: ${s.metric.unitSizePx}px;
  font-weight: 600; color: #cbd5e1;
}
.ov-metric-label, .ov-metric-source {
  font-family: ${s.fonts.support}; font-size: ${s.metric.labelSizePx}px; font-weight: 500;
  line-height: 1.2; margin-top: 8px; color: #e2e8f0;
}
.ov-metric-source { color: #94a3b8; font-style: italic; }

/* ---- Main caption ---- */
.ov-caption {
  position: absolute; left: ${m.left}px; right: ${m.right}px;
  bottom: ${m.bottom + s.caption.bottomGapPx}px;
  text-align: center;
}
.ov-caption-line { line-height: ${s.caption.lineHeight}; }
.ov-caption-scrim {
  display: inline;
  font-family: ${s.fonts.display};
  font-size: var(--cap-size, ${s.caption.fontSizePx}px); font-weight: ${s.caption.fontWeight};
  color: ${s.caption.textColor};
  background: ${s.caption.scrimColor};
  padding: ${s.caption.scrimPadYPx}px ${s.caption.scrimPadXPx}px;
  border-radius: 14px;
  -webkit-box-decoration-break: clone; box-decoration-break: clone;
  white-space: nowrap;
}
.ov-caption-line + .ov-caption-line { margin-top: 6px; }
.ov-em { color: ${s.caption.emphasisColor}; }

.ov-source {
  display: inline-block; margin-top: 16px;
  font-family: ${s.fonts.support}; font-size: ${s.source.fontSizePx}px;
  line-height: 1.2; color: ${s.source.color};
  background: rgba(8, 12, 20, 0.72); border-radius: 10px; padding: 6px 16px;
}
.ov-source-prefix { font-weight: 700; color: #94a3b8; }
.ov-source { font-weight: 500; }

/* ---- Anchored labels ---- */
.ov-labels { position: absolute; inset: 0; }
.ov-label { position: absolute; inset: 0; }
.ov-label-pill {
  position: absolute; left: 0; top: 0; white-space: nowrap;
  font-family: ${s.fonts.support}; font-size: ${s.label.fontSizePx}px;
  font-weight: 700; line-height: 1.15; color: #fff;
  background: ${s.label.bg}; border-radius: 999px; padding: 8px 22px;
  border: 2px solid rgba(255, 255, 255, 0.22);
}
.ov-label-leader {
  position: absolute; left: 0; top: 0; width: 2px; height: ${s.label.leaderPx}px;
  transform-origin: 1px 0;
  background: rgba(255, 255, 255, 0.85);
}
.ov-label-dot {
  position: absolute; left: 0; top: 0; width: 18px; height: 18px;
  border-radius: 50%; border: 3px solid #0b1220;
}
/* Edge-indicator arrows are CSS triangles (the pinned Latin subsets have no arrow glyphs). */
.ov-arrow {
  display: inline-block; width: 0; height: 0; vertical-align: middle;
  border-top: 13px solid transparent; border-bottom: 13px solid transparent;
  position: relative; top: -2px;
}
.ov-arrow-l { border-right: 18px solid ${s.label.placeDot}; margin-right: 14px; }
.ov-arrow-r { border-left: 18px solid ${s.label.placeDot}; margin-left: 14px; }
.ov-label-place .ov-label-dot { background: ${s.label.placeDot}; }
.ov-label-landmark .ov-label-dot { background: ${s.label.landmarkDot}; }
`;
}
