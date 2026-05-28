# Hatfield McCoy DTF Proxy Product Cleanup Report

Generated: 2026-05-28

## Summary

The storefront generator now separates Shopify/backend builder proxy products from normal customer-facing product pages.

- Total catalog records preserved for backend/review: 79 products
- Public storefront product cards/pages: 57 products
- Internal proxy/guided-order records: 22 products
- Public storefront variants represented in normal PDPs: 1,304 variants

Proxy products are no longer shown in `/shop`, `/products`, collection grids, sitemap output, or launch-preview indexing lists. Existing proxy URLs still resolve to clean noindex guided-order pages so old links do not show raw backend/Kixxl variant data.

## Fixed Behavior

- Hidden Kixxl/Gangify proxy products are detected from raw product type, proxy tags, Kixxl option names, and generated random-code variant labels.
- Transfer-style proxy products route to `/gang-sheet-builder`.
- Non-transfer proxy products route to `/contact`.
- Normal high-variant products render a capped starting set instead of a page-length spreadsheet.
- Public generated HTML was checked for `kixxl-size` and random backend variant-code leakage.

## Internal Proxy Records

- `dtfva-custom-dtf-transfers-by-size-1` - Custom DTF Transfers by Size (250 variants) -> `/gang-sheet-builder`
- `dtfva-uv-printed-custom-leather-hat-patches` - UV-Printed Custom Leather Hat Patches (3 variants) -> `/contact`
- `dtfva-custom-dtf-transfers-by-size` - Custom DTF Transfers by Size (250 variants) -> `/gang-sheet-builder`
- `dtfva-uv-printed-custom-tpu-patches-1` - UV-Printed Custom TPU Patches (7 variants) -> `/contact`
- `dtfva-custom-fluorescent-dtf-transfers-by-size-1` - Custom Fluorescent DTF Transfers by Size (16 variants) -> `/gang-sheet-builder`
- `dtfva-custom-glitter-dtf-transfer-by-size-1` - Custom Glitter DTF Transfer by Size (191 variants) -> `/gang-sheet-builder`
- `dtfva-custom-sublimation-transfers-by-size-1` - Custom Sublimation Transfers by Size (113 variants) -> `/gang-sheet-builder`
- `dtfva-9-color-dtf-transfers-by-size-1` - 9 Color DTF Transfers By Size (38 variants) -> `/gang-sheet-builder`
- `dtfva-party-banners-1` - Party Banners (19 variants) -> `/contact`
- `dtfva-uv-dtf-transfer-by-size-189` - UV DTF Transfer By Size (250 variants) -> `/gang-sheet-builder`
- `dtfva-uv-printed-custom-leather-hat-patches-7` - UV-Printed Custom Leather Hat Patches (105 variants) -> `/contact`
- `dtfva-photo-magnets-4` - Photo Magnets (3 variants) -> `/contact`
- `dtfva-car-magnets-2` - Car Magnets (6 variants) -> `/contact`
- `dtfva-business-magnets-2` - Business Magnets (9 variants) -> `/contact`
- `dtfva-perforated-window-vinyl-window-perf-graphics-3` - Perforated Window Vinyl (Window Perf Graphics) (8 variants) -> `/contact`
- `dtfva-custom-window-graphics-2` - Custom Window Graphics (10 variants) -> `/contact`
- `dtfva-window-clings-6` - Window Clings (21 variants) -> `/contact`
- `dtfva-truck-magnets-1` - Truck Magnets (3 variants) -> `/contact`
- `dtfva-indoor-floor-graphics-4` - Indoor Floor Graphics (9 variants) -> `/contact`
- `dtfva-custom-posters-3` - Custom Posters (7 variants) -> `/contact`
- `dtfva-uv-printed-custom-tpu-patches-84` - UV-Printed Custom TPU Patches (99 variants) -> `/contact`
- `dtfva-3d-puff-transfers-best-in-virginia-42` - 3D Puff Transfers - West Virginia Specialty (47 variants) -> `/gang-sheet-builder`

## Verification

- `npm run competitor:dtfva:test` passed with 20 tests.
- `npm run production:prepare` passed with 0 automated blockers.
- `npm run production:verify` passed with 0 automated blockers.
- `npm run catalog:media:dry` confirmed all 10 live Shopify products have mapped media.
- `npm run catalog:verify` confirmed Shopify catalog drift is 0 for the current live product spec.
- Browser smoke passed on 390px and 1440px for `/shop`, proxy URLs, and a large-variant apparel PDP.

