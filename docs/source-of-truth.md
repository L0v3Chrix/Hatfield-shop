# Source of Truth — Hatfield McCoy DTF Storefront

> Established 2026-06-11 (slice A0). This repo (`deliverables/Hatfield-shop/`) is the
> canonical workspace. Git is the rollback authority (`baseline-pre-stabilize` tag).

## Rules

1. **Edit sources only.** Never hand-edit `deliverables/production-site/` or `public/` —
   `npm run production:prepare` deletes and rebuilds `production-site/` from sources on
   every run, and the Vercel build (`scripts/vercel-build.mjs`) rebuilds `public/` from it.
2. **`production:prepare` is the sole writer of `production-site/`.** If output looks
   wrong, fix the source and regenerate. The build is deterministic except for
   `generated_at`/`generatedAt` timestamps in `catalog.json`, `readiness-report.json`,
   and `production-readiness-checklist.html`.
3. **The root project tree is frozen.** The Dropbox-level copies of `scripts/`,
   `deliverables/brand-design-pack/`, `deliverables/prototype/`, and
   `deliverables/production-site/` (one level above this repo) are an archive of older
   versions. See `../FROZEN-SEE-Hatfield-shop.md` at that level. Do not edit them; do not
   sync from them without a diff review.
4. **`main` is approval-gated.** Pushing `main` auto-deploys production via Vercel.
   Work on branches; merge only through the launch-gate process.
5. **`Shopify-images-good/` is additive-only.** Never rename, delete, overwrite, or
   compress existing originals. New approved images are added with their
   `IMAGE_ROLES` entry in `scripts/prepare-shopify-images.py`.

## Source map

| Layer | Path |
|---|---|
| Image originals (immutable) | `Shopify-images-good/` |
| Image metadata (roles/alt) | `scripts/prepare-shopify-images.py` → `IMAGE_ROLES` |
| Image routing + curated card overrides | `scripts/competitor/dtfvirginia/asset-map.js` |
| Page templates (shop/product/collection) | `scripts/competitor/dtfvirginia/frontend-generator.js` |
| Route shells (home, builder, wholesale, guides, contact) | `deliverables/brand-design-pack/*.html` |
| JS engine (cart) | `deliverables/prototype/assets/js/` (cpSync'd into output each build) |
| Legacy illustration graphics | `deliverables/prototype/assets/images/product-graphics/` |
| Build orchestrator | `scripts/production-readiness.mjs` |
| Shopify launch catalog (handles/variants/prices/ids) | `scripts/shopify/config/catalog.js` |
| Generated output (never edit) | `deliverables/production-site/`, `public/`, `deliverables/brand-design-pack/assets/shopify-images/*-{hero,card,thumb}.webp`, `manifest.json` |

## Build + verify

```bash
npm run production:prepare        # rebuild derivatives + production-site
npm run production:verify        # readiness audit (no writes)
node scripts/verify-roundtrip.mjs # overrides render, JS parity, noindex, builder URLs, asset refs
npm run competitor:dtfva:test    # generator/catalog test suite
```

All four must pass before a slice commit.

## A0 reconciliation ledger (2026-06-11)

- Imported 41 images that existed only in the frozen root `production-site/assets/shopify-images/`
  into `deliverables/brand-design-pack/assets/shopify-images/` (build inputs now self-contained).
- Encoded the 30 hand-curated shop-card image swaps from the root tree as
  `HANDLE_IMAGE_OVERRIDES` in `asset-map.js` (card slot only; hero stays rule-resolved).
- Justified removals vs the old trees: `production-site/.gitignore` (contained only
  `.vercel`, already covered by the repo root `.gitignore`) and the root tree's
  `production-site/.vercel/` CLI artifacts (machine-local, gitignored).
- Regeneration adds the launch-catalog routes (`/products/dtf-22-sheet`,
  `/collections/dtf-transfers`, …) that HEAD's scripts emit; this also makes the cart
  recommendation URLs resolve.
- Two Dropbox conflicted-copy directories were moved (not deleted) to
  `../_dropbox-conflicts-archive/` at the root level. Pause the second syncing machine
  during active work; git history is the only trusted rollback.
