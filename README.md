# Hatfield Shop

Canonical Hatfield McCoy DTF storefront repository.

## What this repo contains

- The current complete static storefront snapshot in `deliverables/production-site/`
- Source storefront templates and runtime files in `deliverables/prototype/` and `deliverables/brand-design-pack/`
- Shopify support/import/export/build scripts in `scripts/`
- Catalog snapshots used by the generated storefront in `output/competitor/dtfvirginia/`

## Deploy model

Vercel should deploy this repo with:

- Build command: `npm run vercel-build`
- Output directory: `public`

The build step copies `deliverables/production-site/` into `public/` and injects runtime config from environment variables.

## Required environment variables

- `SHOPIFY_STOREFRONT_PUBLIC_TOKEN`

Optional:

- `SITE_URL_PRODUCTION`
- Shopify admin variables from `.env.example` for local catalog tooling

## Important current state

- This repo mirrors the current most complete storefront build.
- The storefront is still configured as a preview/noindex deployment.
- Direct-to-checkout catalog enablement and launch gate removal still need a separate implementation pass.
