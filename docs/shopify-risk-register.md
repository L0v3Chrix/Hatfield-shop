# Shopify Backend Risk Register — A1 Audit (2026-06-11)

Source data: `output/shopify-audit/state-report.json` (regenerate with `npm run shopify:audit`).
Read-only audit via client-credentials Admin auth. No values/secrets recorded here.

## Verified green

- **Auth:** client-credentials grant works; products (incl. publications), collections,
  and webhook reads all succeeded — read scopes are sufficient for every audit section.
- **Live catalog:** 10 ACTIVE products = 5 sheet products + 5 `-gang-sheet-builder`
  products. Every one: ≥1 media item, all variants priced > 0, published to both
  `Hatfield Mccoy Dtf Headless` and `Online Store` (plus Microsoft Copilot channel).
- **Integrity:** 0 duplicate SKUs across all 93 products; 0 ACTIVE products with a
  non-positive-price variant; `catalog:verify` 0 drift / 0 missing; `catalog:export:dry`
  reports products.json already matches Shopify (94 SKUs, 7 config collections).
- **Drafts are unreachable:** all 83 DRAFT products (79 `dtfva-*` parity imports + 4
  others) are unpublished — not customer-visible on any channel.

## Fix list (Admin mutations — each is gated, applied with a logged inverse)

| # | Item | Detail | Owner action |
|---|---|---|---|
| 1 | SEO fields empty on all 10 ACTIVE products | No `seo.title` / `seo.description` | Approve B1 fix-list (safe copy, generated from product data) |
| 2 | All 45 collections have no collection image | Affects Shopify-side collection cards | B3 media-map covers collections; apply with media upload approval |
| 3 | Webhook registry is EMPTY | `api/shopify-order-artwork-sync.js` is dead code until `shopify:webhook:orders:artwork` is run with `SHOPIFY_ORDER_ARTWORK_WEBHOOK_URL` + HMAC secret set | Run registration (mutation) at staging gate |
| 4 | Draft cleanup candidates | `test-gang`, `rolling-canvas-gang-sheet-1` (duplicate of `rolling-canvas-gang-sheet`) | Archive (never delete) when convenient — currently harmless drafts |

## Stale tooling found

- `scripts/shopify/verify-kixxl-live.js` defaults to `--handle custom-gang-sheet`, but
  that product is now **DRAFT** — the Kixxl binding lives on the 5 ACTIVE
  `*-gang-sheet-builder` products. C1 updates the verifier target(s); until then run
  it as `npm run kixxl:verify -- --handle dtf-22-gang-sheet-builder`.

## Scope needs (names only)

- Confirmed working: read of products/variants/publications/collections/webhooks via
  `SHOPIFY_ADMIN_CLIENT_ID`/`SHOPIFY_ADMIN_CLIENT_SECRET` exchange.
- Unverified until first gated mutation attempt: `write_products` (media upload, SEO
  fixes), `write_publications` (status flips), webhook write. If a mutation fails on
  scope, the runner must name the exact scope and stop.
- Theme read/write scope: untested as of this audit (A2/E1 will probe; browser
  fallback documented if absent).

## Corrections to prior docs

- "All live products have zero media" (2026-05-28 reports) is **no longer true** —
  every ACTIVE product now has exactly 1 media item. B3's job narrows to: verify the
  existing media is family-correct, extend coverage to richer per-product imagery,
  and add collection images.
- Catalog count is 93 in Shopify (79 dtfva + 10 live + 4 other drafts), not 79.
