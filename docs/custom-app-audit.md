# Custom App Audit — B4 (2026-06-11)

The "custom app" surface = two Vercel serverless functions + one registration script.
Verification data: `output/shopify-audit/storefront-visibility.json` and
`output/shopify-audit/state-report.json`.

## Components

| Component | Path | What it does |
|---|---|---|
| Artwork upload endpoint | `api/upload-artwork.js` | `POST /api/upload-artwork` multipart; extension whitelist `png/jpg/jpeg/pdf/ai/eps`; size cap 50 MB (`ARTWORK_UPLOAD_MAX_BYTES`); stores to Vercel Blob (`BLOB_READ_WRITE_TOKEN`) and Shopify Files (`api/lib/shopify-files.js` via Admin auth) |
| Order artwork sync | `api/shopify-order-artwork-sync.js` | Shopify orders webhook receiver; HMAC-SHA256 verification (`SHOPIFY_ORDER_WEBHOOK_SECRET`, falls back to `SHOPIFY_ADMIN_CLIENT_SECRET`); collects artwork entries from the order and writes the order metafield `fulfillment.artwork_manifest` (namespace/key overridable via `SHOPIFY_ORDER_ARTWORK_METAFIELD_NAMESPACE`/`_KEY`) |
| Webhook registration | `scripts/shopify/register-order-artwork-webhook.js` (`npm run shopify:webhook:orders:artwork`) | Registers the orders webhook pointing at `SHOPIFY_ORDER_ARTWORK_WEBHOOK_URL` |

## Current state

- **Webhook registry is EMPTY** (A1 audit) → the order-artwork sync is inert until
  registration runs. Registration is an Admin mutation: run at the staging gate with
  the deployed endpoint URL and confirm one test webhook delivery (HMAC accepted).
- **Storefront API (B4, verified 2026-06-11):** all 10 ACTIVE products visible to the
  public token the frontend uses; `cartCreate` returns a valid `checkoutUrl` for a
  normal product (create-and-abandon — no order placed).
- **Builder safety layer map (verified):** the raw Storefront API ALLOWS adding a
  builder variant to a cart. Designless-order protection therefore depends on:
  1. the headless cart classifier (`cart-helpers.js` blocks checkout for
     builder-required lines), and
  2. the gang-sheet app's order validation on the Shopify side — **staging test**
     required on the Online Store path, because the native PDP renders a normal
     add-to-cart form (see `docs/theme-audit.md`).
- **Secret placement:** scan of `production-site/` + `public/` found zero private
  credential patterns; only the public Storefront token is ever injected into
  runtime config (by `scripts/vercel-build.mjs` at deploy).

## Env the deployed Vercel project must carry (names only)

`SHOPIFY_SHOP_DOMAIN`, Admin auth (`SHOPIFY_ADMIN_ACCESS_TOKEN` or
`SHOPIFY_ADMIN_CLIENT_ID`+`SHOPIFY_ADMIN_CLIENT_SECRET`), `BLOB_READ_WRITE_TOKEN`,
`SHOPIFY_ORDER_WEBHOOK_SECRET`, `SHOPIFY_ORDER_ARTWORK_WEBHOOK_URL`,
`SHOPIFY_STOREFRONT_PUBLIC_TOKEN`. Verify presence in the Vercel dashboard before
the first staging deploy (owner action — cannot be checked from this filesystem).
