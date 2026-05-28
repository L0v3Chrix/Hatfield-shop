# Shopify Catalog Setup — Session Doc

**Date:** 2026-04-16
**Author:** Chrix (via Claude Code)
**Source prompt:** `Shopify product developer prompt.md`
**Plan reference:** `~/.claude/plans/snappy-singing-marshmallow.md`

---

## Context

Hatfield & McCoy DTF needs its Shopify catalog populated programmatically so the live headless storefront at `hatfield-mccoy-dtf.futrbusiness.com` can swap from localStorage-backed JSON to the Shopify Storefront API without any UI changes.

The frontend already serves 75 SKUs from `deliverables/prototype/data/products.json`. The SKU patterns in that file match the Shopify spec in `Shopify product developer prompt.md` **exactly**, so once Shopify contains the catalog, the data-layer swap is a localized refactor to `cart.js` and `content.js` (scope of a separate engagement).

**Keystone deliverable:** `Custom Gang Sheet` product ID — required input for the Kixxl (gang sheet builder) mapping downstream.

---

## Changes (this session)

Building a Node.js seeder that:
- Creates 6 product families with 109 total variants (16 + 21 + 48 + 16 + 7 + 1) in Shopify
- Creates 5 collections (DTF Transfers, Glitter DTF, Glow DTF, Sublimation, Gang Sheets)
- Maps products to collections
- Emits a structured report (JSON + markdown) with all IDs, conflicts, and pricing anomalies

---

## Specs & Instructions

### API

- **Surface:** Shopify Admin GraphQL API
- **Version:** `2025-01`
- **Auth:** `X-Shopify-Access-Token` header with `shpat_...` admin API access token
- **Endpoint:** `https://{SHOP}/admin/api/2025-01/graphql.json`

### Idempotency pattern

1. Query `productByHandle(handle)` — O(1) existence check
2. If missing → `productCreate` (options + metadata) + `productVariantsBulkCreate` (variants with SKUs/prices)
3. If present + no `--update` flag → skip and log SKU diff
4. If present + `--update` flag → use `productVariantsBulkUpdate` to reconcile

### Configuration (immutable inputs from prompt)

All 6 products set to `DRAFT` status. No images on first run.

| Product | Variants | Options | Notes |
|---|---|---|---|
| DTF 22" Sheet | 16 | Length | $12→$150 |
| DTF 46" Sheet | 21 | Length | $12→$240 |
| Glitter DTF 22" Sheet | 48 | Length × Color (Silver/Gold/Multi) | SKU pattern GLT-22-{L}-{SIL\|GLD\|MLT} |
| Glow DTF 22" Sheet | 16 | Length | ⚠ 300" at $153 flagged as likely typo |
| Sublimation 24" | 7 | Length | $8.50→$34 |
| Custom Gang Sheet | 1 | Size (22" Wide Custom) | Price $0.00 placeholder — Kixxl maps downstream |

### Collections

- DTF Transfers → DTF 22" Sheet, DTF 46" Sheet
- Glitter DTF → Glitter DTF 22" Sheet
- Glow DTF → Glow DTF 22" Sheet
- Sublimation → Sublimation 24"
- Gang Sheets → Custom Gang Sheet

### Safety rules (enforced in code)

- No `productDelete` calls anywhere
- Default mode skips existing products (requires `--update` to modify)
- Auth probe aborts with actionable error if shop query fails
- `.env` secrets gitignored
- `DRAFT` status hardcoded — no sales-channel publishing
- No payments/checkout/shipping/domains/customer/app touches

### CLI flags

- `--dry-run` — report what would change, no mutations
- `--update` — allow modifying existing products
- `--products-only` / `--collections-only` — partial runs
- `--verbose` — log raw GraphQL

---

## Current Position

**Phase:** ✅ **Complete** — catalog live in Shopify as DRAFT, ready for Storefront API wiring.

---

## Results (live run 2026-04-16 19:42Z)

**Shop:** `zm1evm-rd.myshopify.com` (canonical) — "Hatfield Mccoy DTF" on Basic plan
**Auth:** Dev Dashboard app via `client_credentials` grant (24h TTL, 104 scopes)
**Mutations:** 6 products created, 5 collections created + populated

### Products (all DRAFT)

| Handle | Variants | Options | Admin URL |
|---|---|---|---|
| `dtf-22-sheet` | 16 | Length | [8780862292150](https://admin.shopify.com/store/zm1evm-rd/products/8780862292150) |
| `dtf-46-sheet` | 21 | Length | [8780862324918](https://admin.shopify.com/store/zm1evm-rd/products/8780862324918) |
| `glitter-dtf-22-sheet` | 48 | Length × Color (Silver/Gold/Multi) | [8780862357686](https://admin.shopify.com/store/zm1evm-rd/products/8780862357686) |
| `glow-dtf-22-sheet` | 16 | Length | [8780862390454](https://admin.shopify.com/store/zm1evm-rd/products/8780862390454) |
| `sublimation-24` | 7 | Length | [8780862423222](https://admin.shopify.com/store/zm1evm-rd/products/8780862423222) |
| **`custom-gang-sheet`** ⭐ | **1** | Size | **[8780862455990](https://admin.shopify.com/store/zm1evm-rd/products/8780862455990)** |

GID format for programmatic use: `gid://shopify/Product/{id}` — the keystone Custom Gang Sheet is `gid://shopify/Product/8780862455990`.

**Total variants:** 109 (matches spec exactly: 16 + 21 + 48 + 16 + 7 + 1).

### Collections

| Handle | Collection ID | Products attached |
|---|---|---|
| `dtf-transfers` | `gid://shopify/Collection/382642651318` | dtf-22-sheet, dtf-46-sheet |
| `glitter-dtf` | `gid://shopify/Collection/382642684086` | glitter-dtf-22-sheet |
| `glow-dtf` | `gid://shopify/Collection/382642716854` | glow-dtf-22-sheet |
| `sublimation` | `gid://shopify/Collection/382642749622` | sublimation-24 |
| `gang-sheets` | `gid://shopify/Collection/382642782390` | custom-gang-sheet |

### Pricing anomalies (require manual confirmation before publishing)

- **`GID-22-300`** (Glow DTF 22" × 300") @ $153.00 — flagged as likely typo per prompt and prototype's `products.json` note. Awaiting intake Q2 confirmation from Nicole.
- **`GS-22-CUSTOM`** (Custom Gang Sheet) @ $0.00 — placeholder. Final price model pending Kixxl builder integration decision.

### Verification

- Auth probe: ✓ (`{ shop { name } }` returns successfully)
- Variant spot-checks: ✓ (first/last SKUs and prices match spec on every product)
- Status check: ✓ (all 6 products in DRAFT; 0 published)
- Idempotency test: ✓ (second run: 0 created, 6 skipped, 0 errors — safe to re-run anytime)
- Collection membership: ✓ (each collection has expected product handles)
- **Full deep verification (`npm run catalog:verify`): ✓** (every SKU, price, option, status compared against spec; 0 drift across 109 variants)

---

## Not configured (intentional — flag for future sessions)

These optional Shopify fields were NOT set by this script because they weren't in the prompt. Capturing the gaps so future work is explicit:

| Field | Current state | Notes |
|---|---|---|
| **Images/media** | 0 per product | Per prompt: "do not block on images". Regen pending Gemini key restoration. Upload via `productCreateMedia` or admin drag-drop. |
| **Tags** | Empty | Consider adding for filtering: `22-inch`, `46-inch`, `glitter`, `glow`, `sublimation`, `print-on-demand`, `gang-sheet` |
| **Category** (Shopify Standard Taxonomy) | None | Affects Google Shopping + internal search filters. Manual set in admin or via `productCategory` field. |
| **SEO title/description overrides** | None (inherits product title/desc) | OK for MVP. Override via `seo { title description }` if Nicole wants search-optimized meta tags. |
| **Variant weight** | `0` grams | Affects weight-based shipping calculations if enabled. Set via `inventoryItem.measurement.weight` on variants. |
| **Compare-at-price** | Not set | Use for sale pricing (strike-through display). |
| **Inventory tracking** | `false` | Correct for print-on-demand; don't enable. |
| **Inventory policy** | `DENY` (can't oversell) | Default; fine as-is. |
| **Barcode / UPC** | Not set | Not applicable for made-to-order DTF products. |
| **Publications / sales channels** | None (DRAFT) | Activate via admin after Nicole approves, OR grant app `write_publications` + use `publishablePublish` mutation. |

---

## Architecture notes (decisions locked during build)

1. **Auth model:** Dev Dashboard app with `client_credentials` grant (not admin-created Custom App). Client ID + secret in `.env`; 24h `shpat_` token acquired per-run. No static long-lived token stored.
2. **API version:** `2025-01` Shopify Admin GraphQL API.
3. **Mutation arg naming gotcha:** `productCreate(product: ProductCreateInput!)` — NOT `input:`. Schema introspection was required to resolve initial type mismatch error.
4. **Safety:** Script never calls `productDelete`. Existing products are skipped by default (requires `--update` flag to modify). Default all-or-nothing collection membership add only — never removes.
5. **Idempotent by handle:** `productByHandle` + `collectionByHandle` lookups before any mutation. Re-runs safely produce zero changes.

---

## Open questions deferred to manual review

1. **Glow DTF 22x300 price** — prompt says $153.00, flagged as likely typo (consistent with prototype's `products.json` flag — awaiting intake Q2 confirmation from Nicole)
2. **Custom Gang Sheet price** — placeholder $0.00; final value depends on Kixxl workflow (quote model vs static)
3. **3D Printing collection** — exists in prototype but omitted from this Shopify prompt; not created
4. **Admin app client secret rotation** — a previously exposed `shpss_...` secret appears in `Shopify product developer prompt.md`; rotation recommended separately from this catalog work
5. **Product images** — none created (prompt said "do not block on images"); image upload pending Gemini key restoration per ship-ready doc
6. **Sales channel publishing** — DRAFT only; publication to Online Store / POS happens at launch

---

## Handoff — Next Steps

1. **Kixxl / gang sheet builder mapping:** use `gid://shopify/Product/8780862455990` as the Custom Gang Sheet reference for the Kixxl integration (single-variant product, 22" wide custom length)
2. **Price anomaly resolution:** once Nicole confirms Q2 (Glow 22x300) and Kixxl workflow (Gang Sheet pricing model), run `npm run catalog:update` to reconcile
3. **Storefront API integration:** rebuild `deliverables/prototype/assets/js/cart.js` and `content.js` to read products/collections from Shopify Storefront API using these handles (zero UI changes expected)
4. **Publishing:** once Nicole approves the catalog in Shopify admin, change `status: 'DRAFT'` → `'ACTIVE'` per product and publish to the Online Store sales channel (separate step, not automated)
5. **Images:** regenerate AI images once Gemini key is restored; upload to the 6 products via `productCreateMedia` (not covered by this script)

**Re-run command (safe, idempotent):** `npm run catalog:run`
**Force update existing:** `npm run catalog:update`
**Report location:** `scripts/shopify/reports/*.{json,md}` (gitignored; each run timestamped)

---

## Open questions deferred to manual review

1. **Glow DTF 22x300 price** — prompt says $153.00, catalog flags as likely typo (consistent with prototype's `products.json` flag — awaiting intake Q2 confirmation from Nicole)
2. **Custom Gang Sheet price** — placeholder $0.00; final value depends on Kixxl workflow (quote model vs static)
3. **3D Printing collection** — exists in prototype but omitted from this Shopify prompt; not created
4. **Admin app client secret rotation** — a previously exposed `shpss_...` secret appears in `Shopify product developer prompt.md`; rotation recommended separately from this catalog work
