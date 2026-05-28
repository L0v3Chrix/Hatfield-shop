# Hatfield McCoy DTF Overnight Build QA Report

Generated: 2026-05-28

## Status

**Ready for client review: YES**

**Ready for public launch: NO**. The build is review-ready, but launch remains gated by client confirmations, production form endpoints, Shopify publish approval, and robots/sitemap release.

## Required QA Commands

| Command | Result | Notes |
|---|---:|---|
| `npm run production:prepare` | PASS | Generated production preview. 275 HTML files, 25 source images preserved, 75 optimized images, 0 manifest warnings, 0 automated blockers. |
| `npm run production:verify` | PASS | 0 automated blockers, 0 placeholders requiring confirmation, 6 pending launch confirmations. |
| `npm run competitor:dtfva:test` | PASS | 15/15 node tests passing. |

## Catalog Counts

| Check | Expected | Actual | Result |
|---|---:|---:|---|
| Products | 79 | 79 | PASS |
| Collections | 38 | 38 | PASS |
| Variants | 2,768 | 2,768 | PASS |

Source checked: `output/competitor/dtfvirginia/normalized-catalog.json`.

## Route QA Matrix

Tested at mobile 390px, tablet 768px, and desktop 1440px. Browser checks covered navigation presence/consistency, horizontal overflow, metadata, noindex, rendered image health, internal-language scan, and builder/cart CTA visibility.

| Route | Viewports | Result | Findings |
|---|---|---:|---|
| `/` | 390 / 768 / 1440 | PASS | Navigation consistent, no overflow, images resolve, SEO/noindex present. |
| `/shop` | 390 / 768 / 1440 | PASS | Navigation consistent, no overflow, product grid images resolve. |
| `/products` | 390 / 768 / 1440 | PASS | Generated product index loads, no overflow, images resolve. |
| `/collections` | 390 / 768 / 1440 | PASS | Generated collection index loads, no overflow, images resolve. |
| `/pages` | 390 / 768 / 1440 | PASS | Generated pages index loads, no overflow, metadata/noindex present. |
| `/gang-sheet-builder` | 390 / 768 / 1440 | PASS | Builder route loads, local builder CTAs work, live Shopify/Gangify builder links present. |
| `/wholesale` | 390 / 768 / 1440 | PASS | Review-gated wholesale copy is truthful; form launch endpoint remains a launch gate. |
| `/guides` | 390 / 768 / 1440 | PASS | Guide hub loads with noindex and structured data; final pressing details still need confirmation. |
| `/contact` | 390 / 768 / 1440 | PASS | Contact route loads; quote/contact endpoint remains a launch gate. |
| `/products/dtfva-42-custom-sublimation-gang-sheets-builder` | 390 / 768 / 1440 | PASS | Gang sheet PDP routes builder-like CTAs to `/gang-sheet-builder`; no overflow. |
| `/products/dtfva-uv-dtf-transfer-by-size` | 390 / 768 / 1440 | PASS | UV DTF PDP loads; checkout CTA present only for checkout-ready flow. |
| `/products/dtfva-digital-factory-dtf-desktop-edition` | 390 / 768 / 1440 | PASS | Software-family PDP loads; no overflow, images resolve. |
| `/collections/dtfva-custom-dtf-transfers` | 390 / 768 / 1440 | PASS | Generated collection page loads; product cards/images resolve. |
| `/collections/dtfva-gang-builder-collection` | 390 / 768 / 1440 | PASS | Generated builder collection loads; no overflow. |
| `/collections/dtfva-custom-stickers-promotional-items` | 390 / 768 / 1440 | PASS | Generated stickers/promotional collection loads; no overflow. |

## Screenshot Evidence

Screenshots were captured for all 15 tested routes at all 3 breakpoints.

- Directory: `tmp/browser-screenshots/overnight-qa-2026-05-28/`
- Result JSON: `tmp/browser-screenshots/overnight-qa-2026-05-28/qa-results.json`
- Naming pattern: `{viewport}__{route-name}.png`
- Example paths:
  - `tmp/browser-screenshots/overnight-qa-2026-05-28/mobile-390__home.png`
  - `tmp/browser-screenshots/overnight-qa-2026-05-28/tablet-768__shop.png`
  - `tmp/browser-screenshots/overnight-qa-2026-05-28/desktop-1440__gang-sheet-builder.png`
  - `tmp/browser-screenshots/overnight-qa-2026-05-28/desktop-1440__pdp-sublimation-gang.png`
  - `tmp/browser-screenshots/overnight-qa-2026-05-28/desktop-1440__collection-gang-builder.png`

## SEO / Indexing

| Check | Result | Notes |
|---|---:|---|
| HTML pages have `noindex, nofollow` | PASS | 275/275 HTML files include noindex. |
| Canonical tags exist | PASS | 275/275 HTML files include canonical tags. |
| JSON-LD exists | PASS | 275/275 HTML files include structured data. |
| Preview robots remains closed | PASS | `robots.txt` is `Disallow: /`. |
| Public sitemap remains closed | PASS | `sitemap.xml` has 0 URLs; `sitemap.launch-preview.xml` has 139 preview URLs for later approval. |

## Image and Link Checks

| Check | Result | Notes |
|---|---:|---|
| Static asset/link scan | PASS | 18,311 local refs scanned across HTML/CSS/JS; 0 broken local refs. |
| Browser rendered image check | PASS | 0 broken rendered images across tested route/viewports. |
| Lazy image handling | PASS | Static paths resolve; rendered checks covered loaded viewport images. |

## Cart / Quote / Builder Truthfulness

| Check | Result | Notes |
|---|---:|---|
| Empty cart state | PASS | Checkout is disabled when cart is empty. |
| Quote/review-only behavior | PASS | Cart code disables Shopify checkout when items lack checkout-ready merchandise IDs and shows quote/review guidance. |
| Checkout-ready behavior | PASS | Checkout flow requires Storefront API config and Shopify merchandise IDs before redirecting. |
| Builder PDP routing | PASS | Builder-like PDP CTAs route to `/gang-sheet-builder`. |
| Builder page links | PASS | `/gang-sheet-builder` exposes local builder section links plus live Shopify/Gangify builder URLs. |

## Public UI Language

Visible UI text passed the internal-language scan for the tested routes. Terms checked included `competitor parity`, `source-dtf`, `kixxl_rolling_canvas_product_hidden`, `mws_fee_generated`, `implementation`, `draft competitive-parity`, and `internal review`.

Note: generated URLs and non-visible data attributes still use `dtfva-` prefixes. Because the preview is noindex and client-review gated, this is a launch polish task rather than a review blocker.

## Remaining Launch Blockers

- Confirm pickup address, pickup hours, cutoff policy, and expected response time.
- Confirm final DTF pressing instructions: time, temperature, pressure, peel, and wash guidance.
- Confirm wholesale minimum order threshold or remove threshold claims.
- Confirm wholesale turnaround and cutoff policy.
- Connect quote, wholesale, artwork review, and contact forms to production destinations.
- Approve Shopify product publishing: fulfillment, pricing, copy, images, SEO, checkout behavior.
- Open robots/sitemap only after launch approval; current preview intentionally blocks indexing.

## Remaining Polish Tasks

- Consider replacing generated `dtfva-` URL handles before public launch.
- Review generated product/collection titles for brand tone and remove any source-catalog phrasing that the client dislikes.
- Replace or approve any reference-style product imagery before publishing products.
- Do a final live Shopify checkout smoke test after production Storefront API and product publish approval are complete.
- Run one post-approval SEO crawl after robots/sitemap are opened.

## Files Changed / Generated During QA

- `deliverables/brand-design-pack/overnight-build-report.md`
- `deliverables/brand-design-pack/assets/shopify-images/manifest.json`
- `deliverables/brand-design-pack/production-readiness-summary.md`
- `deliverables/production-site/**` regenerated by `npm run production:prepare`
- `tmp/browser-screenshots/overnight-qa-2026-05-28/**` screenshot evidence and QA JSON

