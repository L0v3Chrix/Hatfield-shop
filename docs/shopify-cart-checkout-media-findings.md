# Shopify Cart, Checkout, and Media Findings

Generated: 2026-05-28

## What is happening

The gray "You may also like" product cards are caused by missing Shopify product media, not by CSS alone.

Public Shopify product JSON currently shows all 10 live online-store products have:

- `featured_image: null`
- `images: []`

This includes:

- `dtf-22-gang-sheet-builder`
- `dtf-22-sheet`
- `dtf-46-gang-sheet-builder`
- `dtf-46-sheet`
- `glitter-dtf-22-gang-sheet-builder`
- `glitter-dtf-22-sheet`
- `glow-dtf-22-gang-sheet-builder`
- `glow-dtf-22-sheet`
- `sublimation-24-gang-sheet-builder`
- `sublimation-24`

## Checkout summary

The Shopify checkout does have an order summary. On mobile it appears as the collapsed "Order summary" row at the top of checkout.

Deep checkout layout changes are limited by Shopify plan and Checkout Extensibility availability. The store is currently reporting as Basic via Admin probe, so storefront cart and product media are the right first fixes. Checkout UI extensions can add blocks at checkout targets, but they are app-extension work, not theme-only edits.

## Gang sheet validation message

The checkout warning:

> No gang sheet design attached for this gang sheet order.

means a builder product entered checkout without the Kixxl/Gangify design payload attached. Builder SKUs should only enter checkout through the builder app flow, or they should be blocked/routed back to the builder from storefront cart/recommendations.

## Work completed

Added `scripts/shopify/upload-live-product-media.js`, which maps all 10 live Shopify products to Hatfield McCoy-owned/generated media hosted on the production preview.

Added npm scripts:

- `npm run catalog:media:dry`
- `npm run catalog:media:upload`

Dry-run currently succeeds and shows all intended product media mappings.

## Current blocker

The supplied Admin token is missing product scopes. Upload mode fails with:

```text
scope-blocked: <handle> - token needs read_products and write_products.
```

Required Admin API scopes:

- `read_products`
- `write_products`

After a token with those scopes is available:

```bash
SHOPIFY_ADMIN_ACCESS_TOKEN='...' npm run catalog:media:upload
```

## Recommended next fix order

1. Enable/provide Admin API token with `read_products` and `write_products`.
2. Run `npm run catalog:media:upload`.
3. Verify public product JSON shows non-empty `images`.
4. Re-test cart recommendations so "You may also like" cards show media.
5. Disable or filter builder products in cart recommendations unless they route to Kixxl/Gangify builder.
6. Keep checkout validation active so orders cannot proceed without a gang sheet design payload.
