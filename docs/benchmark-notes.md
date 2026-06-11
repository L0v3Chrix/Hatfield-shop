# Clean-Room Benchmark Notes — A2 (2026-06-11)

Structural UX lessons only. No copy, assets, design, or trade dress may be reproduced.
Public customer-facing output must never name these competitors (enforced by the
copy-compliance scanner). Reference screenshots from prior sessions live at the
project root (`audit-dtfvirginia-com-390.png`, `audit-ninjatransfers-com-390.png`).

## Ninja Transfers (ninjatransfers.com) — merchandising + flow benchmark

Observed top-level structure (labels paraphrased to intent):
- Product families in nav: DTF transfers · gang sheet builder (top-level!) ·
  ready-to-press designs · specialty transfers · stickers/magnets (incl. cup
  stickers) · patches · supplies/consumables.
- An education hub surfaced in nav (application/pressing, care, design prep,
  "DTF 101") — trust-building, reduces support load.
- A free sample pack as the acquisition hook with permanent nav placement.

Lessons → Hatfield McCoy implementation:
1. **Builder deserves top-level placement** on home + shop nav (D8 family band
   includes "Gang sheet builders" as a primary family; home hero already routes to it).
2. **Plain buyer-intent family names** beat catalog taxonomy — D8's seven families
   follow this (Transfers by size / Gang sheet builders / UV DTF & stickers /
   Apparel & blanks / Signs & graphics / Promo & gifts / Shop services & software).
3. **Guides belong in primary nav**, not a footer afterthought — /guides exists;
   keep it in the header and make pressing-instruction copy conservative (G2 default).
4. **Sample-pack hook**: we have a sample-pack product family; route it to quote
   until priced (G2), then consider nav promotion post-launch.

## DTF Virginia (dtfvirginia.com) — catalog architecture benchmark

- Homepage nav is JS-rendered (thin static HTML); structural reference comes from
  the parity catalog already extracted to
  `output/competitor/dtfvirginia/normalized-catalog.json` (38 collections,
  79 products) and the prior audit screenshot.
- Their architecture is, by construction, our catalog's skeleton: size-based
  transfer products + per-film builder products + service add-ons + apparel blanks.

Lessons → Hatfield McCoy implementation:
1. **Category breadth is already at parity**; the gap is presentation — grouping 38
   collections under ~7 buyer families (D8) instead of a flat list.
2. **Size-first product naming** ("22 inch", "46 inch") matches how print buyers
   think — preserve in titles and family tags; never bury size in variant pickers.
3. Their builder flow expects sheet-size selection before canvas — our live PDP
   masthead already encodes this ("Choose your sheet size first…"); keep that pattern
   on the headless `/gang-sheet-builder` route too.

## Differentiation guardrails (what we deliberately do differently)

- Appalachian neon-industrial identity (near-black + magenta/cyan/lime, Logan WV
  rooted) — neither benchmark owns this space; do not drift toward their look.
- Honest four-state buyer routing (Order online / Open builder / Request a quote /
  Not currently available online) instead of mixed availability signals.
- Local pickup + WV shop identity as a first-class trust signal.
