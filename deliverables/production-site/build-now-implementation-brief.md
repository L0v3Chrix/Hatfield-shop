# Hatfield McCoy DTF Build-Now Implementation Brief

## Decision

Build the entire site before the six client-confirmation items are finalized.

The missing confirmations are launch gates only. They should not block frontend buildout, Shopify data wiring, page routing, media mapping, SEO scaffolding, cart integration, or form UI development.

## Build With These Defaults

- Keep public indexing closed with `noindex` and `robots.txt` `Disallow: /`.
- Keep Shopify products draft or review-gated until approved.
- Use fallback copy already present in the production preview for unconfirmed operational details.
- Build forms with disabled, draft, or test endpoints until final destinations are confirmed.
- Build product, collection, builder, wholesale, guide, and contact routes now.
- Use prepared optimized images and the image manifest for media mapping.
- Do not invent pickup, pressing, wholesale, turnaround, or fulfillment claims.

## Six Launch-Only Confirmation Fields

1. Pickup address, hours, cutoff policy, and response time.
2. Final DTF pressing time, temperature, pressure, peel, and wash instructions.
3. Wholesale minimum order threshold.
4. Wholesale turnaround and cutoff policy.
5. Production destinations for quote, wholesale, artwork review, and contact forms.
6. Shopify publish approval for products, pricing, copy, images, SEO, and checkout.

## Implementation Priority

1. Build the route structure and shared layout system.
2. Wire Shopify catalog data as the backend source of truth.
3. Map prepared image assets to products, collections, guides, and content sections.
4. Build cart, checkout, builder, quote, and wholesale UI states.
5. Add SEO metadata, schema, noindex preview gates, and sitemap generation.
6. Run QA with pending confirmation fields still open.
7. Swap fallback copy and gates only after Hatfield McCoy approval.

## Launch Rule

The site can be fully built, reviewed, and staged before the six confirmations arrive. It cannot be publicly indexed, publish products, or process production forms until the relevant confirmation fields are resolved.
