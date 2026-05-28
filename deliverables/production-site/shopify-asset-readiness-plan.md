# Hatfield McCoy Shopify Asset Readiness Plan

## Current Assessment

- Source assets live in `Shopify-images-good/`.
- Originals were not removed, renamed, compressed, or overwritten.
- The framework now uses optimized WebP derivatives from `deliverables/brand-design-pack/assets/shopify-images/`.
- `manifest.json` maps each original image to a clean slug, collection role, usage notes, alt text, and generated derivative files.
- The current 20 JPG source files total about 35 MB. Optimized WebP derivatives total about 5.7 MB across hero, card, and thumbnail sizes.

## Required Edits Implemented

1. Added repeatable asset preparation script:
   - File: `scripts/prepare-shopify-images.py`
   - Rationale: keeps source assets untouched and makes optimization repeatable before Shopify upload or static frontend export.

2. Added optimized image derivatives:
   - Path: `deliverables/brand-design-pack/assets/shopify-images/`
   - Sizes: `hero` max 1600 px, `card` max 900 px, `thumb` max 360 px.
   - Format: WebP at quality 84.

3. Added image manifest:
   - File: `deliverables/brand-design-pack/assets/shopify-images/manifest.json`
   - Rationale: gives the Shopify/frontend team one source of truth for source file, derivative file, title, collection, usage, and alt text.

4. Updated framework pages to use optimized assets:
   - Homepage: hero, order-path cards, asset handoff lane.
   - Shop: product-family cards now use prepared Shopify imagery.
   - Product: PDP gallery uses optimized product media.
   - Builder: gang sheet visual now uses prepared gang sheet asset.
   - Wholesale/contact: support imagery added for proof and quote flows.
   - Guides: added asset-readiness handoff link.

5. Improved performance and accessibility:
   - Added width and height attributes to newly wired images.
   - Added `loading="lazy"` and `decoding="async"` for non-critical imagery.
   - Kept `fetchpriority="high"` only on primary hero/PDP images.
   - Added meaningful alt text from the manifest.

## Step-by-Step Implementation Guide

1. Add new source assets to `Shopify-images-good/`.
2. Add a role entry in `scripts/prepare-shopify-images.py` for each important asset:
   - `slug`
   - `title`
   - `collection`
   - `usage`
   - `alt`
3. Run:

```bash
python3 scripts/prepare-shopify-images.py
```

4. Review:

```bash
python3 -m json.tool deliverables/brand-design-pack/assets/shopify-images/manifest.json
```

5. Use `*-hero.webp` for hero/PDP gallery images, `*-card.webp` for cards and collection tiles, and `*-thumb.webp` for swatches, admin review, or compact lists.
6. In Shopify, upload the approved source-quality image or a derivative based on final theme behavior:
   - Shopify product media: source image or `hero` derivative.
   - Collection card: `card` derivative.
   - Theme sections and content pages: `hero` or `card` derivative depending on crop.

## Priority Milestones

1. **Asset QA:** confirm every image matches the right product/collection and does not contain unwanted artifacts.
2. **Product mapping:** connect manifest slugs to Shopify product handles and collection handles.
3. **Theme media upload:** upload approved assets to Shopify product media and collection images.
4. **Frontend data wiring:** replace prototype HTML references with generated Shopify image URLs once the Shopify catalog export is final.
5. **Performance QA:** test mobile page weight, image dimensions, lazy loading, and Lighthouse image warnings.

## Quick Wins Still Recommended

- Add final product-handle fields to `manifest.json` once Shopify draft product handles are locked.
- Add explicit focal point notes for wide banners versus square product cards.
- Replace pending operational claims only after Jesse confirms the final details.
- Add real form endpoints for quote, wholesale, and artwork review flows.

## Risks And Rollback

- **Risk:** an image is assigned to the wrong product category.
  - **Rollback:** update the mapping in `scripts/prepare-shopify-images.py`, rerun the script, and adjust the page reference.

- **Risk:** WebP derivatives are not desired for a specific Shopify theme section.
  - **Rollback:** upload original JPGs to Shopify while keeping the WebP derivatives for static frontend use.

- **Risk:** future file names include special characters or duplicates.
  - **Rollback:** keep originals unchanged, add explicit `slug` values in the script, and regenerate derivatives.

## Conflict Resolution Rule

If a visual polish idea conflicts with performance, accessibility, or Shopify data compatibility, prioritize performance and compatibility first. Use the high-impact visual idea only after it can be implemented with optimized assets, clear alt text, and stable responsive dimensions.
