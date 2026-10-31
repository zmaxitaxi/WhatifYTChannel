/**
 * Caption + overlay layer for the shared AETHER composition (Workstream C).
 *
 * Draws HTML on top of Patrick's WebGL canvas in the same 1080 x 1920
 * viewport, so Playwright captures both in one screenshot. Every visual state
 * is a pure function of the frame index and the frame's projected anchors.
 *
 * Elements:
 *   - hypothetical / time-scale badges (top-left of the safe zone)
 *   - metric readout under the badges, with an optional source line
 *   - main caption: centered, max two balanced lines, accent emphasis,
 *     per-line scrim, source/assumption line underneath
 *   - anchored labels: city pins and landmark names that follow the 3D scene
 */
import {
  CaptionCueSpec,
  CompiledScenePlan,
  FrameDiagnostics,
  GeoCoord,
  MetricBindingSpec,
  OverlayLabelSpec,
  ProjectedBounds2D,
  SHORTS_HEIGHT,
  SHORTS_WIDTH,
} from "../contracts/types";
import { sampleNormalizedFrame } from "../engine/prng";
import {
  CaptionIssue,
  Rect,
  cueEnvelope,
  formatMetricValue,
  intersectionArea,
  layoutCaption,
  rectArea,
  tokenizeCaption,
  validateCaptionTrack,
} from "./captionLayout";
import { CAPTION_STYLE_V01 } from "./captionStyle";
import { overlayCss } from "./overlayCss";

export interface ScreenPoint {
  x: number;
  y: number;
  /** False when the point is behind the camera. */
  inFront: boolean;
}

export interface OverlayFrameContext {
  projectedBounds: ProjectedBounds2D[];
  visibleSubjects: string[];
  /** Ids of character subjects; captions should not cover their faces. */
  characterIds: string[];
  projectGeo: (coord: GeoCoord) => ScreenPoint;
}

export interface OverlayFrameResult {
  textBounds: FrameDiagnostics["textBounds"];
  warnings: string[];
}

type TextBound = FrameDiagnostics["textBounds"][number];

const S = CAPTION_STYLE_V01;

const active = <T extends { startFrame: number; endFrame: number }>(
  items: readonly T[] | undefined,
  f: number
) => (items ?? []).filter((i) => f >= i.startFrame && f < i.endFrame);

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function toBound(id: string, r: DOMRect, wordCount: number): TextBound {
  return {
    id,
    minX: Math.round(r.left),
    minY: Math.round(r.top),
    maxX: Math.round(r.right),
    maxY: Math.round(r.bottom),
    wordCount,
  };
}

/**
 * Apply fade/rise. Fully visible elements get no opacity/transform at all so
 * the browser rasterizes them identically no matter which frame came before
 * (a leftover compositing layer can shift anti-aliased edges by a pixel).
 */
function applyEnvelope(node: HTMLElement, opacity: number, offsetYPx = 0): void {
  node.style.opacity = opacity >= 1 ? "" : opacity.toFixed(3);
  node.style.transform = offsetYPx === 0 ? "" : `translateY(${offsetYPx}px)`;
}

export class OverlayRenderer {
  private readonly root: HTMLElement;
  private plan!: CompiledScenePlan;
  private trackIssues: CaptionIssue[] = [];
  private measureCtx!: CanvasRenderingContext2D;

  private badges!: HTMLElement;
  private badgeHyp!: HTMLElement;
  private badgeTime!: HTMLElement;
  private metric!: HTMLElement;
  private metricValue!: HTMLElement;
  private metricUnit!: HTMLElement;
  private metricLabel!: HTMLElement;
  private metricSource!: HTMLElement;
  private caption!: HTMLElement;
  private labelsLayer!: HTMLElement;

  private captionKey = "";
  private metricKey = "";
  private labelEls = new Map<string, HTMLElement>();

  constructor(root: HTMLElement) {
    this.root = root;
  }

  /** Build the DOM, check the caption track, and wait for fonts. */
  public async mount(plan: CompiledScenePlan): Promise<void> {
    this.plan = plan;
    this.trackIssues = validateCaptionTrack(plan);

    if (!document.getElementById("aether-overlay-css")) {
      const style = document.createElement("style");
      style.id = "aether-overlay-css";
      style.textContent = overlayCss(S);
      document.head.appendChild(style);
    }

    this.root.replaceChildren();
    this.root.classList.add("aether-overlays");

    this.badges = el("div", "ov-badges");
    this.badgeHyp = el("div", "ov-badge ov-badge-hyp", S.badge.hypotheticalText);
    this.badgeTime = el("div", "ov-badge ov-badge-time");
    this.metric = el("div", "ov-metric");
    const valueRow = el("div", "ov-metric-row");
    this.metricValue = el("span", "ov-metric-value");
    this.metricUnit = el("span", "ov-metric-unit");
    valueRow.append(this.metricValue, this.metricUnit);
    this.metricLabel = el("div", "ov-metric-label");
    this.metricSource = el("div", "ov-metric-source");
    this.metric.append(valueRow, this.metricLabel, this.metricSource);
    this.badges.append(this.badgeHyp, this.badgeTime, this.metric);

    this.labelsLayer = el("div", "ov-labels");
    this.caption = el("div", "ov-caption");
    this.root.append(this.labelsLayer, this.badges, this.caption);

    const canvas = document.createElement("canvas");
    this.measureCtx = canvas.getContext("2d")!;
    this.measureCtx.font = `${S.caption.fontWeight} ${S.caption.fontSizePx}px ${S.fonts.display}`;

    if (document.fonts) {
      // Load every pinned face before the first frame; capture must never
      // screenshot a fallback font.
      await Promise.all(
        S.fonts.faces.map((f) => document.fonts.load(`${f.weight} 40px "${f.family}"`))
      );
      await document.fonts.ready;
      for (const f of S.fonts.faces) {
        if (!document.fonts.check(`${f.weight} 40px "${f.family}"`)) {
          throw new Error(`Overlay font '${f.family}' ${f.weight} failed to load from ${f.file}.`);
        }
      }
      // Re-assign so the canvas measures with the now-loaded face.
      this.measureCtx.font = `${S.caption.fontWeight} ${S.caption.fontSizePx}px ${S.fonts.display}`;
    }
  }

  public update(frameIndex: number, ctx: OverlayFrameContext): OverlayFrameResult {
    const warnings: string[] = [];
    const textBounds: TextBound[] = [];

    const cues = active(this.plan.captions, frameIndex);
    const metrics = active(this.plan.metrics, frameIndex);
    const labels = active(this.plan.labels, frameIndex);
    const cue = cues[0];
    const metric = metrics[0];

    for (const issue of this.trackIssues) {
      if (cues.some((c) => c.id === issue.cueId)) warnings.push(issue.message);
    }

    // Badges
    const hyp = Boolean(cue?.isHypothetical || metric?.isHypothetical);
    this.badgeHyp.style.display = hyp ? "" : "none";
    this.badgeTime.style.display = cue?.timeScaleLabel ? "" : "none";
    this.badgeTime.textContent = cue?.timeScaleLabel ?? "";

    // Metric
    this.renderMetric(frameIndex, metric);

    // Caption
    let overflow = false;
    if (cue) overflow = this.renderCaption(frameIndex, cue);
    else {
      this.caption.style.display = "none";
      this.captionKey = "";
    }

    // Anchored labels
    this.renderLabels(frameIndex, labels, ctx, warnings);

    // ---- Measure (forces layout once) and check ----
    const rects: { id: string; rect: Rect }[] = [];
    const push = (id: string, node: HTMLElement, words: number) => {
      if (node.style.display === "none") return;
      const b = toBound(id, node.getBoundingClientRect(), words);
      if (b.maxX - b.minX <= 0) return;
      textBounds.push(b);
      rects.push({ id, rect: b });
    };

    // Caption box is full-width; measure the ink (line scrims + source chip).
    const pushInk = (id: string, node: HTMLElement, words: number) => {
      const parts = Array.from(node.querySelectorAll<HTMLElement>(".ov-caption-scrim, .ov-source"));
      const rs = parts.map((p) => p.getBoundingClientRect()).filter((r) => r.width > 0);
      if (rs.length === 0) return;
      const b: TextBound = {
        id,
        minX: Math.round(Math.min(...rs.map((r) => r.left))),
        minY: Math.round(Math.min(...rs.map((r) => r.top))),
        maxX: Math.round(Math.max(...rs.map((r) => r.right))),
        maxY: Math.round(Math.max(...rs.map((r) => r.bottom))),
        wordCount: words,
      };
      textBounds.push(b);
      rects.push({ id, rect: b });
    };

    if (hyp) push("badge_hypothetical", this.badgeHyp, 1);
    if (cue?.timeScaleLabel) push(`timescale_${cue.id}`, this.badgeTime, cue.timeScaleLabel.split(/\s+/).length);
    if (metric) push(metric.id, this.metric, metric.label.split(/\s+/).length + 2);
    if (cue) {
      pushInk(cue.id, this.caption, cue.text.split(/\s+/).length + (cue.sourceLabel ? cue.sourceLabel.split(/\s+/).length : 0));
      if (overflow) {
        warnings.push(`Caption '${cue.id}' is wider than the safe zone even on two lines at ${S.caption.minFontSizePx}px.`);
      }
    }
    for (const l of labels) {
      const node = this.labelEls.get(l.id);
      if (node && node.style.display !== "none") {
        push(l.id, node.querySelector(".ov-label-pill") as HTMLElement, l.text.split(/\s+/).length);
      }
    }

    const m = S.safe;
    for (const { id, rect } of rects) {
      if (rect.minX < m.left - 1 || rect.maxX > SHORTS_WIDTH - m.right + 1 ||
          rect.minY < m.top - 1 || rect.maxY > SHORTS_HEIGHT - m.bottom + 1) {
        warnings.push(`Overlay '${id}' extends outside the safe zone at frame ${frameIndex}.`);
      }
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (intersectionArea(rects[i].rect, rects[j].rect) > 0) {
          warnings.push(`Overlays '${rects[i].id}' and '${rects[j].id}' overlap at frame ${frameIndex}.`);
        }
      }
    }

    if (cue) {
      const capRect = rects.find((r) => r.id === cue.id)?.rect;
      for (const b of ctx.projectedBounds) {
        if (!capRect || !ctx.characterIds.includes(b.subjectId)) continue;
        const area = rectArea(b);
        if (area > 0 && intersectionArea(capRect, b) / area > S.limits.maxCharacterCoverage) {
          warnings.push(`Caption '${cue.id}' covers character '${b.subjectId}' at frame ${frameIndex}.`);
        }
      }
    }

    return { textBounds, warnings };
  }

  private renderMetric(frameIndex: number, metric: MetricBindingSpec | undefined) {
    if (!metric) {
      this.metric.style.display = "none";
      this.metricKey = "";
      return;
    }
    this.metric.style.display = "";
    if (this.metricKey !== metric.id) {
      this.metricKey = metric.id;
      this.metricUnit.textContent = metric.unit;
      this.metricLabel.textContent = metric.label;
      this.metricSource.textContent = metric.sourceLabel ?? "";
      this.metricSource.style.display = metric.sourceLabel ? "" : "none";
    }
    const p = sampleNormalizedFrame(frameIndex, metric.startFrame, metric.endFrame, "smoothstep");
    this.metricValue.textContent = formatMetricValue(
      metric.startValue + (metric.endValue - metric.startValue) * p
    );
    const env = cueEnvelope(frameIndex, metric.startFrame, metric.endFrame);
    applyEnvelope(this.metric, env.opacity);
  }

  /** Returns true when the caption overflows the safe width. */
  private renderCaption(frameIndex: number, cue: CaptionCueSpec): boolean {
    const tokens = tokenizeCaption(cue.text, cue.emphasis);
    const layout = layoutCaption(tokens, (t) => this.measureCtx.measureText(t).width);

    if (this.captionKey !== cue.id) {
      this.captionKey = cue.id;
      const block = el("div", "ov-caption-lines");
      block.style.setProperty("--cap-size", `${layout.fontSizePx}px`);
      for (const line of layout.lines) {
        const row = el("div", "ov-caption-line");
        const scrim = el("span", "ov-caption-scrim");
        line.tokens.forEach((tok, i) => {
          if (i > 0) scrim.append(document.createTextNode(" "));
          scrim.append(tok.emphasis ? el("span", "ov-em", tok.text) : document.createTextNode(tok.text));
        });
        row.append(scrim);
        block.append(row);
      }
      const children: HTMLElement[] = [block];
      if (cue.sourceLabel) {
        const src = el("div", "ov-source");
        const prefix = el("span", "ov-source-prefix", `${S.source.prefix}:`);
        src.append(prefix, document.createTextNode(` ${cue.sourceLabel}`));
        children.push(src);
      }
      this.caption.replaceChildren(...children);
    }

    const env = cueEnvelope(frameIndex, cue.startFrame, cue.endFrame);
    this.caption.style.display = "";
    applyEnvelope(this.caption, env.opacity, env.offsetYPx);
    return layout.overflow;
  }

  private renderLabels(
    frameIndex: number,
    labels: OverlayLabelSpec[],
    ctx: OverlayFrameContext,
    warnings: string[]
  ) {
    const live = new Set(labels.map((l) => l.id));
    for (const [id, node] of this.labelEls) {
      if (!live.has(id)) {
        node.remove();
        this.labelEls.delete(id);
      }
    }
    if (labels.length === 0) return;

    const m = S.safe;
    const safe: Rect = {
      minX: m.left,
      minY: m.top,
      maxX: SHORTS_WIDTH - m.right,
      maxY: SHORTS_HEIGHT - m.bottom,
    };
    // Areas labels must stay clear of: the top-left stack and the caption.
    const reserved: Rect[] = [this.badges, this.caption]
      .filter((n) => n.style.display !== "none")
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => ({ minX: r.left - 12, minY: r.top - 12, maxX: r.right + 12, maxY: r.bottom + 12 }));

    for (const label of labels) {
      const anchor = this.resolveAnchor(label, ctx);
      let node = this.labelEls.get(label.id);
      if (!node) {
        node = el("div", `ov-label ov-label-${label.kind}`);
        const pill = el("div", "ov-label-pill");
        pill.append(el("span", "ov-arrow ov-arrow-l"), el("span", "", label.text), el("span", "ov-arrow ov-arrow-r"));
        node.append(el("div", "ov-label-leader"), el("div", "ov-label-dot"), pill);
        this.labelsLayer.append(node);
        this.labelEls.set(label.id, node);
      }
      const [leader, dot, pill] = Array.from(node.children) as HTMLElement[];
      const [arrowL, , arrowR] = Array.from(pill.children) as HTMLElement[];

      if (!anchor || !anchor.inFront) {
        node.style.display = "none";
        warnings.push(`Label '${label.id}' has no visible anchor at frame ${frameIndex}.`);
        continue;
      }
      node.style.display = "";

      const onScreen =
        anchor.x >= safe.minX && anchor.x <= safe.maxX &&
        anchor.y >= 0 && anchor.y <= SHORTS_HEIGHT;

      // Off-screen place: pin the pill to the nearest safe edge with an arrow
      // pointing toward it (an edge indicator), and drop the leader and dot.
      const offLeft = !onScreen && anchor.x < safe.minX;
      const offRight = !onScreen && anchor.x > safe.maxX;
      arrowL.style.display = offLeft ? "" : "none";
      arrowR.style.display = offRight ? "" : "none";
      leader.style.display = onScreen ? "" : "none";
      dot.style.display = onScreen ? "" : "none";

      const pillW = pill.offsetWidth;
      const pillH = pill.offsetHeight;
      const clampX = (x: number) => Math.min(Math.max(x, safe.minX), safe.maxX - pillW);
      const clampY = (y: number) => Math.min(Math.max(y, safe.minY), safe.maxY - pillH);

      let left: number;
      let top: number;
      if (onScreen) {
        left = clampX(anchor.x - pillW / 2);
        top = anchor.y - S.label.leaderPx - pillH;
        if (top < safe.minY) top = anchor.y + S.label.leaderPx; // flip below
      } else {
        left = offLeft ? safe.minX : offRight ? safe.maxX - pillW : clampX(anchor.x - pillW / 2);
        top = clampY(anchor.y - pillH / 2);
      }

      // Nudge clear of reserved areas: first sideways, then vertically.
      for (const r of reserved) {
        const box = { minX: left, minY: top, maxX: left + pillW, maxY: top + pillH };
        if (intersectionArea(box, r) === 0) continue;
        if (r.maxX + pillW <= safe.maxX) left = r.maxX;
        else if (r.minY - pillH >= safe.minY && r.minY > SHORTS_HEIGHT / 2) top = r.minY - pillH;
        else top = clampY(r.maxY);
      }
      left = Math.round(left);
      top = Math.round(top);
      pill.style.transform = `translate(${left}px, ${top}px)`;

      if (onScreen) {
        // Leader from the anchor to the nearest point on the pill.
        const tx = Math.min(Math.max(anchor.x, left + 24), left + pillW - 24);
        const ty = anchor.y < top ? top : top + pillH;
        const dx = tx - anchor.x;
        const dy = ty - anchor.y;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) - Math.PI / 2;
        leader.style.height = `${len.toFixed(1)}px`;
        leader.style.transform =
          `translate(${(anchor.x - 1).toFixed(1)}px, ${anchor.y.toFixed(1)}px) rotate(${angle.toFixed(4)}rad)`;
        dot.style.transform = `translate(${Math.round(anchor.x) - 9}px, ${Math.round(anchor.y) - 9}px)`;
      }

      const env = cueEnvelope(frameIndex, label.startFrame, label.endFrame);
      applyEnvelope(node, env.opacity);
    }
  }

  private resolveAnchor(label: OverlayLabelSpec, ctx: OverlayFrameContext): ScreenPoint | null {
    if (label.anchor.type === "geo") return ctx.projectGeo(label.anchor.coord);
    const id = label.anchor.subjectId;
    if (!ctx.visibleSubjects.includes(id)) return null;
    const b = ctx.projectedBounds.find((p) => p.subjectId === id);
    if (!b) return null;
    // Top-center of the subject's projected box, clamped onto the frame.
    return {
      x: (b.minX + b.maxX) / 2,
      y: Math.max(b.minY, S.safe.top + 120),
      inFront: true,
    };
  }
}
