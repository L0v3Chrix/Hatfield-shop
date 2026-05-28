# Hatfield McCoy DTF Asset Coverage Plan

Generated: 2026-05-28  
Scope: production catalog imagery for the 79-product / 38-collection DTF Virginia parity catalog.

## Source Asset Rules

- Do not rename, delete, overwrite, or compress anything in `Shopify-images-good/`.
- Do not use DTF Virginia or DTF Ninjas product photos, logos, exact art, or proprietary visual assets.
- Use Hatfield McCoy-owned assets, prepared derivatives, generated art, or safe internal product graphics.
- Keep all generated catalog image paths deterministic so rebuilds do not create broken images.

## Current Image Inventory

The production build now uses two safe asset pools:

- `deliverables/brand-design-pack/assets/shopify-images/`: 25 prepared source families, exported as card/hero/thumb WebP derivatives.
- `deliverables/prototype/assets/images/product-graphics/`: 16 additional Hatfield McCoy product graphics copied into production as `/assets/images/product-graphics/*.webp`.

Combined usable visual families: 41 source-style families before card/hero variants.

## Product Family Coverage

The current asset resolver maps all 79 products into these visual groups:

| Family | Products | Primary asset |
|---|---:|---|
| Signage and magnets | 15 | `/assets/images/product-graphics/wide-format-roll.webp` |
| Sublimation transfers / tumblers | 8 | `/assets/images/product-graphics/sublimation-tumbler.webp` |
| Gang sheets | 7 | `/assets/images/product-graphics/gang-sheet-roll.webp` |
| Apparel blanks | 6 | `/assets/images/product-graphics/apparel-samples-stack.webp` |
| UV DTF and stickers | 5 | `/assets/shopify-images/cute-sticker-sheet-card.webp` |
| Software and RIP support | 5 | `/assets/images/product-graphics/printer-output-film.webp` |
| DTF transfers | 4 | `/assets/images/product-graphics/dtf-transfer-peel.webp` |
| Patches | 4 | `/assets/shopify-images/custom-patches-card.webp` |
| Fluorescent/neon transfers | 4 | `/assets/images/product-graphics/glow-film-sheet.webp` |
| Artwork and brand services | 4 | `/assets/images/product-graphics/service-sample-bundle.webp` |
| Specialty glitter/foil transfers | 4 | `/assets/images/product-graphics/glitter-film-sheet.webp` |
| Sports products | 4 | `/assets/shopify-images/neon-basketball-card.webp` |
| Hat patches | 3 | `/assets/shopify-images/hat-transfer-card.webp` |
| 3D puff transfers | 3 | `/assets/shopify-images/puff-shirt-card.webp` |
| Sweatshirts/fleece | 2 | `/assets/shopify-images/blank-sweatshirt-card.webp` |
| Labels and tags | 1 | `/assets/shopify-images/quality-tags-card.webp` |

## Collection Coverage

All 38 collections resolve to a collection image family. The largest groups are:

- DTF/transfer collections: 11 routes.
- Glitter/foil/specialty collections: 8 routes.
- UV/sticker collections: 5 routes.
- Signage/banner/magnet/window collections: 3 routes.
- Gang/builder collections: 2 routes.
- Remaining collections are single-family coverage for apparel, patches, sports, software, artwork, puff, sublimation, and neon/fluorescent.

## Remaining Asset Needs

The site is now safe from broken or obviously repeated single-image coverage, but it still needs richer final client-facing assets before launch:

- 6-10 real or generated gang sheet screenshots showing DTF, UV DTF, glitter, puff, sublimation, and fluorescent workflows.
- 5 apparel blanks/decorated apparel photos for the Gildan, Bella+Canvas, Next Level, Shaka Wear, hoodie, and sweatshirt product families.
- 4 signage/magnet/window graphic images.
- 4 product-specific promo/sports/tumbler images.
- 3 brand/artwork service visuals.
- 3 software/RIP support visuals that avoid implying Hatfield McCoy is an authorized reseller unless confirmed.

## Safe Generated Image Prompts

Use these when producing new assets:

- `Hatfield McCoy DTF neon print shop product photo, wide DTF gang sheet roll with colorful transfer designs, black industrial table, magenta cyan lime highlights, no readable brand names except Hatfield McCoy DTF if needed`
- `Custom UV DTF sticker sheet product photo, glossy decals on transparent carrier sheet, neon Appalachian print-shop aesthetic, black background, no competitor logos`
- `Glitter DTF transfer film sheet close-up, sparkle texture, heat transfer production table, Hatfield McCoy neon palette, no copied artwork`
- `3D puff transfer applied to black shirt, raised texture visible, professional ecommerce product photo, magenta cyan lime accent lighting`
- `Custom window graphic and magnet print samples on a print-shop counter, bold neon colors, Hatfield McCoy DTF style, no competitor branding`
- `Apparel blanks and decorated shirt samples stacked neatly for ecommerce catalog, industrial print shop lighting, black cyan magenta lime palette`
- `Artwork setup service bundle with vector grid, color swatches, printed transfer samples, Hatfield McCoy DTF brand palette, no external logos`

## Implementation Notes

- Image routing lives in `scripts/competitor/dtfvirginia/asset-map.js`.
- Generated catalog pages consume `resolveProductImages()` and `resolveCollectionImages()` from that file.
- The production build copies both `assets/shopify-images/` and `assets/images/product-graphics/` into `deliverables/production-site/`.
- Final Shopify media upload should use only approved assets after Jesse/Hatfield McCoy confirms fulfillment and imagery.
