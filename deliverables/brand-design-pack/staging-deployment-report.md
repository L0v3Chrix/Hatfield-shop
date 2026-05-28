# Hatfield McCoy DTF Staging Deployment Report

## Deployment

- Public staging URL: https://production-site-flax.vercel.app
- Latest protected preview URL: https://production-site-71u3ttbuq-enterweb-guru.vercel.app
- Latest inspect URL: https://vercel.com/enterweb-guru/production-site/5zmTeuSFM5vFRqDi8AWogSqmtprr
- Vercel project: `enterweb-guru/production-site`
- Source directory: `deliverables/production-site`

## Safety Gates

- The public staging deployment is reachable for review, but it is not launch-open.
- The latest preview deployment is protected by Vercel authentication and may return 401 without access.
- `robots.txt` returns `Disallow: /`.
- Vercel headers return `X-Robots-Tag: noindex, nofollow`.
- Shopify products remain draft/review-gated.
- The six pending confirmation fields remain launch-only gates.

## Verified Live Routes

- `/`
- `/shop`
- `/products/dtfva-42-custom-sublimation-gang-sheets-builder`
- `/collections/dtfva-all-1`
- `/pages/dtf-transfers-shipped-nationwide`
- `/robots.txt`
- `/readiness-report.json`
- `/data/pending-confirmations.json`

## Build Result

- Full production package generated.
- 272 HTML files.
- 79 products.
- 38 collections.
- 15 commerce/support pages.
- 2,768 variants in `catalog.json`.
- 0 automated blockers.
- 0 placeholder tokens.
- 6 launch-only confirmation fields.

## Next Launch Gates

Resolve the six confirmation fields, connect production form endpoints, confirm Shopify publishing approvals, then intentionally open robots/sitemap/indexing.
