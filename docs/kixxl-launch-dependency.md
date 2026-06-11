# Gang Sheet Builder — Launch Dependency Status (C1, 2026-06-11)

Supersedes the 2026-05-25 "blank params" blocker report. Full evidence in
`docs/theme-audit.md` and `output/shopify-audit/`.

## Verified working today

| Surface | Check | Result |
|---|---|---|
| Headless `/gang-sheet-builder` | 6 launch URLs, params populated, prices match visible copy | ✓ `verify-roundtrip.mjs` (runs every build) |
| Launch URL IDs vs live store | all 5 variant/product ID pairs match live Shopify GIDs | ✓ B2 cross-check vs A1 state report |
| Builder app proxy | `/apps/gangify/builder?…` serves the full builder (HTTP 200) | ✓ live fetch 2026-06-11 |
| Online Store PDP wiring | `hm-builder-brand-match-r2.js` populates the app's hidden inputs and launches with full params (the May-25 bug's fix, deployed on the published theme) | ✓ static analysis of the live theme asset |
| Shopify state | builder product ACTIVE, published to Headless + Online Store, internal discount intact, password gate OFF | ✓ `kixxl:verify -- --handle dtf-22-gang-sheet-builder` 7/7 |

Note: `kixxl:verify` without flags still targets `custom-gang-sheet`, which is now a
DRAFT — always pass `--handle dtf-22-gang-sheet-builder` (or another ACTIVE builder)
until the default is updated.

## Remaining items (staging gate — browser/runtime)

1. **Runtime click confirmation** (phone + desktop width): on the live/preview
   Online Store builder PDP, click the create/upload CTA and capture the launched
   URL — confirm the deployed intercept wins and params are populated end-to-end.
   The mechanism is verified present in the live theme JS; this is confirm-only.
2. **Designless-order test**: the native PDP renders a standard add-to-cart form,
   and the raw Storefront API allows builder-variant carts (B4). On the staging
   preview, attempt add-to-cart → checkout WITHOUT opening the builder and confirm
   the gang-sheet app's order validation blocks it. **If it does not block,** hide
   native buy buttons on builder product templates in the theme duplicate (E2 —
   admin-gated) before launch.
3. The headless cart classifier already blocks builder-required lines from checkout
   (`cart-helpers.js`); D9 adds the per-line "Finish in builder" CTA.

## Post-change verification (run after any builder/theme change)

```bash
node scripts/verify-roundtrip.mjs                       # site-wide URL param checks
npm run kixxl:verify -- --handle dtf-22-gang-sheet-builder
npm run kixxl:verify:post                               # against the deployed preview
npm run shopify:storefront:verify                       # visibility + cartCreate
```
