# Pinned overlay fonts

Caption and overlay fonts are vendored here so every machine renders the same
glyphs and line breaks (TECHNICAL_PLAN.md: "Pin engine, assets, fonts, browser,
and dependencies for reproducibility"). Do not swap these for system fonts.

| File | Family in CSS | Use | Source |
|---|---|---|---|
| `source-serif-4-latin-700-normal.woff2` | `AETHER Serif` 700 | Main captions | @fontsource/source-serif-4 5.3.1 |
| `inter-latin-500-normal.woff2` | `AETHER Sans` 500 | Source lines, labels | @fontsource/inter 5.3.0 |
| `inter-latin-600-normal.woff2` | `AETHER Sans` 600 | Badges, units | @fontsource/inter 5.3.0 |
| `inter-latin-700-normal.woff2` | `AETHER Sans` 700 | Metric numbers, pills | @fontsource/inter 5.3.0 |

Both families are licensed under the SIL Open Font License 1.1 (see the
`OFL-*.txt` files). These are the Latin subsets, which do not include arrow
glyphs such as U+2192, so overlays draw arrows with CSS instead.
