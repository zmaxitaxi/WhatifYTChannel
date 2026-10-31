# Caption + overlay layer (Workstream C, Francis)

HTML overlays drawn over Patrick's WebGL canvas in the same 1080 × 1920
viewport, so Playwright captures both in one screenshot. The engine calls
`OverlayRenderer.update(frameIndex, …)` at the end of `renderFrame`, after it
has projected subject bounds, and merges the overlay's `textBounds` and
`warnings` into `FrameDiagnostics`.

| File | What it does |
|---|---|
| `captionStyle.ts` | V01 design tokens: sizes, colors, motion, limits, pinned font faces |
| `captionLayout.ts` | Pure logic: emphasis tokens, balanced two-line breaking with shrink-to-fit, fade envelope, track validation |
| `OverlayRenderer.ts` | DOM component: badges, metric readout, caption, anchored labels, per-frame checks |
| `overlayCss.ts` | Stylesheet generated from the tokens (injected once at mount) |

## V01 caption design

- **Main caption**: bottom of the safe zone, centered, Source Serif 4 Bold at
  60px (shrinks to fit, never below 52px), at most two balanced lines, dark
  per-line scrim so it reads over sky, snow, and map. Words listed in
  `emphasis` are drawn in gold.
- **Source line**: Inter 36px chip under the caption, `Source: …`.
- **Hypothetical badge**: amber `HYPOTHETICAL` chip at the top-left of the safe
  zone whenever the active caption or metric is hypothetical.
- **Time-scale badge**: outlined chip under it, from the caption's
  `timeScaleLabel`.
- **Metric readout**: under the badges, 104px tabular numbers with the unit,
  a label, and an optional italic source line. Counts with the same
  smoothstep the engine uses; formatted as en-US on every machine.
- **Anchored labels**: pills with a leader line and dot, pinned to a geo point
  (city) or a subject's top edge (landmark). An off-screen place becomes an
  edge pill with an arrow pointing toward it. Labels steer clear of the
  badge stack and the caption.
- **Motion**: 6-frame fade + 22px rise in, 4-frame fade out, all computed from
  the frame index. No CSS transitions.

## Plan fields used

All additions are optional, so older plans still render.

```jsonc
// captions[]
{ "id": "cap_03", "startFrame": 180, "endFrame": 270,
  "text": "Flying 4,329 km to New England.",
  "sourceLabel": "Great-circle coordinate calculation",
  "isHypothetical": true,
  "timeScaleLabel": "TIME SCALE: IMAGINED TRANSIT",
  "emphasis": ["4,329 km"] }                       // new, optional

// metrics[]
{ ..., "sourceLabel": "Great-circle distance" }    // new, optional

// labels[]                                        // new, optional
{ "id": "lbl_boston", "startFrame": 186, "endFrame": 270,
  "text": "Boston, MA", "kind": "place",
  "anchor": { "type": "geo", "coord": { "lat": 42.3601, "lon": -71.0589 } } }
{ "id": "lbl_hoover", "startFrame": 96, "endFrame": 180,
  "text": "Hoover Tower", "kind": "landmark",
  "anchor": { "type": "subject", "subjectId": "campus_stanford" } }
```

## Warnings added to `FrameDiagnostics`

- caption reading load above 2.5 words/second
- two captions active at once, or a caption outside the timeline
- a number in a caption with no `sourceLabel`
- an `emphasis` phrase that is not in the caption text
- a caption still too wide for two lines at 52px
- any overlay outside the safe zone, or two overlays overlapping
- a caption covering more than 20% of a character's projected box
- a label whose anchor is behind the camera or not visible

## Fonts

Pinned in `public/fonts` (SIL OFL 1.1). `mount()` waits for every face and
throws if one fails to load, so capture never screenshots a fallback font.
