# Design Polish Notes — 2026-06-11

## Root cause of the "smashed" look

The CSS declared `Anton` (display) and `Space Grotesk` (body) but **no font file was
ever loaded** — there was no `@font-face` and no font link anywhere in the build.
Every headline rendered in the fallback, **Impact**, with `line-height: .98` and
zero letter-spacing on all-caps text. That combination is the crushed look.

## Font decision

Per the brand-consistency rule, no new face was introduced: the brand's own intended
pairing is now actually loaded, **self-hosted** (no third-party font CDN at runtime):

- **Anton** (display) — single weight, latin subset, 12 KB woff2
- **Space Grotesk** (body) — variable 300–700, latin subset, 22 KB woff2
- `font-display: swap` + `<link rel="preload">` on both (generated pages and shells)
- Files: `assets/fonts/*.woff2`, licensed OFL (safe to ship)

## Typographic rhythm

- H1 `line-height .98 → 1.08` (+ mobile `1.02 → 1.08`), H2 `1 → 1.14`, H3 `1.2`
- `letter-spacing .015em` on display headings (`.01em` at mobile sizes)
- Body copy and list items `line-height 1.6`
- Single-line UI labels (badges, nav) keep `line-height 1` by design

## Merchandising fixes found during screenshot review

- Family cards computed a "From $X" from the cheapest variant in the family — by-size
  catalogs bottom out at cent-level minimums, so the builders card read **"From
  $0.06"**. Family cards now carry descriptive taglines ("Priced by sheet size in
  the builder"), never computed floors.
- The builders family thumbnail (wide-roll photo) went near-black at 88px on the
  dark panel; swapped to the bright gang-sheet canvas image.

## Micro-interactions

Cards and buttons get a 160 ms transform/shadow/border transition (hover lift
−1/−2 px, cyan border glow), wrapped in `@media (prefers-reduced-motion: reduce)`
which disables all transitions and smooth scrolling.

## Accessibility

- `:focus-visible` — 2 px cyan outline with offset, site-wide (keyboard navigation)
- Contrast verified on the dark theme: `--muted #A0A0B0` on `--bg #0E0E12` ≈ 7.4:1,
  `--soft` higher — AA passes for text sizes in use; no palette changes needed
- Type scales with rem/clamp throughout; 44 px touch targets on mobile filters,
  cart controls (from the earlier pass)
- `font-display: swap` keeps text visible during font load

## Pricing audit (the "recording" pass)

No recording/transcript exists in the project, but the client price sheet does:
`assets/products-list.pdf`. Every live Shopify variant was audited against it —
**214 of 216 match exactly.** The only divergence is one cell, twice:

- **Glow 22″ × 300″ — sheet says $153, live store says $225.** Every other glow size
  is exactly 1.5× the standard 22″ price; 1.5× of the $150 standard 300″ is **$225**.
  The sheet's $153 breaks its own pattern, and $153→$225 is the documented typo fix
  from the 2026-05-25 session. Live $225 was left in place. **One-line confirm for
  Jesse:** is Glow 22×300 $225 (pattern) or $153 (sheet)?

The sheet's 3D-printing tables (X1, H2S) correspond to draft products that are not
customer-reachable; their prices are on file for when those activate.
