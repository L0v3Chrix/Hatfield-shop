# Hatfield McCoy DTF Production Readiness Summary

Generated: 2026-06-11T06:23:18.433Z

## Status

- Ready to implement: yes
- Ready to build before confirmations: yes
- Ready to launch: no
- Production preview routes: 7
- Source images preserved: 57
- Optimized WebP derivatives: 180
- Manifest images: 57
- Manifest warnings: 0
- Automated blockers: 0
- Client-confirmation placeholders: 0
- Client-confirmation statements: 6

## Required Before Launch

- Client confirmation required for operational public claims; build may proceed with fallback copy.
- Shopify products must remain draft until copy, fulfillment, pricing, imagery, SEO, and checkout approvals pass.
- robots.txt is intentionally Disallow: / for preview; launch requires approval-gated sitemap and robots update.
- Artwork upload and Shopify publication must be verified before public launch.

## Build-Now Rule

Build the complete site now using fallback copy for pending operational details. Do not open indexing, publish products, or enable production form destinations until the matching confirmation is supplied.

## Pending Confirmation Fields

- `pickup-details`: Confirm pickup address, hours, order cutoff policy, and expected response time.
- `pressing-instructions`: Confirm final time, temperature, pressure, peel, and wash instructions for published guide copy.
- `wholesale-minimum`: Confirm minimum order threshold or remove the threshold claim entirely.
- `wholesale-turnaround`: Confirm wholesale turnaround language and cutoff policy before publishing.
- `artwork-upload-endpoint`: Connect the direct-order artwork upload endpoint and confirm files are attached to order metadata.
- `shopify-publish-approval`: Approve fulfillment, pricing, copy, images, SEO, and checkout for every published product.

## Route Map

- `/` -> `index.html`
- `/shop` -> `shop/index.html`
- `/products/sample-dtf-transfer` -> `products/sample-dtf-transfer/index.html`
- `/gang-sheet-builder` -> `gang-sheet-builder/index.html`
- `/wholesale` -> `wholesale/index.html`
- `/guides` -> `guides/index.html`
- `/contact` -> `contact/index.html`

## Asset Policy

Original files in `Shopify-images-good` remain untouched. The production preview uses optimized derivatives from `deliverables/brand-design-pack/assets/shopify-images`, mapped by `deliverables/brand-design-pack/assets/shopify-images/manifest.json`.
