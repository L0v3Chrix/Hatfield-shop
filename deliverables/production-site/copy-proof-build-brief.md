# Hatfield McCoy DTF Copy Proof + Build Brief

## Copy Status

- Core production-preview pages have been proofed for customer-facing clarity.
- Framework-only language has been removed from public page copy.
- Placeholder tokens have been removed from the build preview.
- Operational claims that still require Jesse/Hatfield McCoy confirmation now read as pending confirmation instead of invented facts.
- Competitor wording and competitor image use remain blocked from public launch.

## Pages Proofed

- Home: clear order-path copy for shop, gang sheet builder, quote, wholesale, and support.
- Shop: product-family browsing copy, filter labels, card copy, and CTAs.
- Product: custom DTF transfer PDP copy, artwork review states, related resources, and support links.
- Gang sheet builder: upload/build/review copy and builder placement notes.
- Wholesale: reseller/repeat-buyer positioning, account review copy, and pending operations details.
- Guides: pressing, artwork prep, asset-readiness, and service-page copy.
- Contact: quote, artwork review, pickup/deadline support, and form guidance.
- Production readiness checklist: build-facing launch gates and QA copy.

## Pending Client Confirmations

These are launch gates, not build blockers. Build the full site now using fallback copy, draft Shopify states, noindex rules, and disabled/test form destinations where needed.

- Pickup address, pickup hours, cutoff policy, and response time.
- Final DTF pressing time, temperature, pressure, peel, and wash instructions.
- Wholesale minimum order threshold.
- Wholesale turnaround and cutoff policy.
- Final form endpoints for quote, wholesale, artwork review, and contact requests.
- Shopify publish approval for products that will be public at launch.

## Build Preparation Notes

- Use `deliverables/production-site/` as the build preview source.
- Use `deliverables/production-site/readiness-report.json` as the automated readiness gate.
- Use `deliverables/production-site/data/pending-confirmations.json` as the structured list of launch-only confirmation fields.
- Keep `robots.txt` as `Disallow: /` until launch approval.
- Use `sitemap.launch-preview.xml` only as a launch-preview route list; do not expose it as the public sitemap until approvals are complete.
- Keep Shopify products draft until copy, fulfillment, pricing, images, SEO, and checkout are approved.
- Keep `Shopify-images-good/` untouched as the source asset vault.
- Use optimized WebP derivatives from `deliverables/brand-design-pack/assets/shopify-images/` or Shopify CDN equivalents in production.

## Build Definition

Ready to build means the production preview has zero automated blockers and no placeholder tokens. The six pending client confirmations may remain open during the build.

Ready to launch means the pending client confirmations are resolved, Shopify checkout works for approved buyable variants, quote-only/builder-only flows do not break checkout, and public SEO/indexing gates are intentionally opened.
