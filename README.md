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
- `BLOB_READ_WRITE_TOKEN` for direct artwork uploads; if omitted the site uploads artwork into Shopify Files instead
- `ARTWORK_UPLOAD_MAX_BYTES` if you need a non-default upload cap
- `SHOPIFY_ORDER_WEBHOOK_SECRET` if you want a webhook secret separate from the Shopify app client secret
- Shopify admin variables from `.env.example` for local catalog tooling

## Order artwork sync

The storefront now supports a two-step artwork flow:

1. `/api/upload-artwork` stores customer files durably and attaches the hosted file URL to Shopify cart line-item attributes. It prefers Vercel Blob when configured, and otherwise uploads directly into Shopify Files via Admin API.
2. `/api/shopify-order-artwork-sync` receives the Shopify `orders/create` webhook and writes an order-level artwork manifest metafield so fulfillment can review all artwork URLs directly in Shopify.

Register the webhook after deploy:

- `npm run shopify:webhook:orders:artwork -- --callback-url https://www.hatfieldmccoydtf.com/api/shopify-order-artwork-sync`

Required env for the webhook route:

- `SHOPIFY_ADMIN_CLIENT_SECRET` or `SHOPIFY_ORDER_WEBHOOK_SECRET`

Required env for artwork uploads and order metafield attachment:

- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN` or `SHOPIFY_ADMIN_CLIENT_ID` + `SHOPIFY_ADMIN_CLIENT_SECRET`

## Important current state

- This repo mirrors the current most complete storefront build.
- The storefront is still configured as a preview/noindex deployment.
- Shopify publication, live media upload, and builder verification still need Admin API access before final launch.
