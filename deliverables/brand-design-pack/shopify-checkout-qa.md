# Shopify Checkout and Builder QA

Date: 2026-05-27  
Owner: Agent 4, Shopify/cart/builder QA

## Scope Checked

- Runtime config: `deliverables/prototype/data/config.json`
- Cart runtime: `deliverables/prototype/assets/js/cart.js`
- Shopify state: `output/competitor/dtfvirginia/shopify-state.json`
- Builder route: `deliverables/brand-design-pack/gang-sheet-builder.html`
- Generated production preview: `deliverables/production-site`

No products were published and no Shopify status changes were made.

## Build and Config

- `npm run production:prepare` passed after the cart runtime patch:
  - Routes: 7
  - HTML files: 275
  - Manifest warnings: 0
  - Automated blockers: 0
- `npm run production:verify` passed after the cart runtime patch:
  - Routes: 7
  - HTML files: 275
  - Automated blockers: 0
- Storefront config is present in `/data/config.json`:
  - `shopify.store_domain`: `hatfield-mccoy-dtf.myshopify.com`
  - `shopify.storefront_api_version`: `2025-01`
  - `shopify.storefront_access_token`: present as a public Storefront token
  - `cart.mode`: `shopify_storefront_cart_api`

During the sprint there was a transient generator failure in `scripts/competitor/dtfvirginia/frontend-generator.js` (`productCardImage is not defined`). Another edit restored that helper; the final fresh `production:prepare` and `production:verify` both pass with the full 275 HTML-file preview.

## Cart Runtime Findings

Quote-only product smoke check:

- Page: `/products/dtfva-brand-starter-pack/`
- Button: `Request help`
- Result: cart drawer opened.
- Result: item was added as `PRO Branding Kit - Starter Pack / Default Title`.
- Result: checkout stayed disabled.
- Result: cart note displayed: "This cart includes quote/review items. Send a quote request or remove review-only items before Shopify checkout."

Checkout gating:

- `createShopifyCheckout()` rejects carts with no Shopify-ready lines.
- `createShopifyCheckout()` also rejects mixed carts where any line lacks `merchandiseId` / `storefront_variant_id`.
- `renderDrawer()` disables checkout when any line is quote/review-only.
- Patch added a shared checkout-only guard so idle button state also remains disabled for mixed quote carts.
- Patch also updates merged cart lines with Shopify metadata when the same SKU/variant is re-added later with a valid merchandise ID.
- Patch defensively treats generated `data-checkout-ready="false"` quote/review buttons as quote-only even if the markup also contains a Storefront variant ID.

Current catalog state:

- Shopify state contains Storefront variant IDs for imported products.
- All reviewed catalog products remain draft/approval-blocked, so generated PDPs correctly expose quote/review buttons instead of live checkout buttons.
- Because there are no generated buyable PDP buttons in the current draft catalog, live browser checkout enablement could not be exercised from a public PDP without synthetic cart setup.

## Builder Route Findings

Browser smoke check: `/gang-sheet-builder`

- Page loaded with H1: "Launch the Shopify-connected builder for the sheet you need."
- Five live builder cards were present.
- All five route to Shopify `/apps/gangify/builder` with `variant`, `price`, `store`, `product`, `quantity`, and `locale` parameters.

Known builder paths confirmed:

| Builder | Product ID | Variant ID | Price |
|---|---:|---:|---:|
| 22" DTF gang sheet | `8801329938614` | `45134982709430` | `$12.00` |
| 46" DTF gang sheet | `8801338130614` | `45135045198006` | `$12.00` |
| Glitter DTF builder | `8801338327222` | `45135046344886` | `$12.00` |
| Glow DTF builder | `8801338884278` | `45135055650998` | `$18.00` |
| 24" sublimation builder | `8801339211958` | `45135059648694` | `$8.50` |

Builder-like PDP smoke check:

- Page: `/products/dtfva-custom-dtf-gang-sheets-printing-service/`
- H1: `Custom DTF Gang Sheets 22" Builder`
- Finding before integration: PDP showed quote/review buttons and no direct Kixxl/Gangify builder links.
- Integration update: generated builder-like PDPs now route primary and table CTAs to `/gang-sheet-builder`, which then exposes the five direct Kixxl/Gangify builder cards.
- Recommendation: builder-family PDPs should route to `/gang-sheet-builder` or the exact live Kixxl/Gangify URL, not add builder-priced variants to quote/cart.

Shop smoke check:

- Page: `/shop`
- H1: "Custom DTF, stickers, apparel, signs, and print-ready goods."
- 79 catalog cards observed before the generator failure reduced the production preview.
- Builder links were present in shop navigation/CTA areas.

## Products That Should Route to Builder

Route these to one of the five known builder URLs instead of quote/cart once exact product-family mapping is approved:

- `dtfva-custom-dtf-gang-sheets-printing-service` — 22" DTF builder
- `dtfva-custom-dtf-gang-sheets-your-colors-deserve-to-pop` — 22" DTF gang sheet
- `dtfva-custom-dtf-gang-sheets-fast-reliable-transfer-printing` — 46" DTF builder
- `dtfva-custom-dtf-gang-sheets-dtf-virginia` — 46" DTF gang sheet
- `dtfva-glitter-dtf-transfers-builder` — glitter DTF builder
- `dtfva-glitter-dtf-gang-sheet` — glitter DTF gang sheet
- `dtfva-sublimation-gang-sheet-builder` — 24" sublimation builder candidate
- `dtfva-sublimation-gang-sheets-bulk-printing` — 22" sublimation gang sheet candidate
- `dtfva-42-custom-sublimation-gang-sheets-builder` — 42" sublimation builder candidate; needs exact live builder mapping
- `dtfva-custom-sublimation-gang-sheets` — 42" sublimation gang sheet candidate; needs exact live builder mapping
- `dtfva-fluorescent-dtf-printing-build-bold-bright-designs` — glow/fluorescent builder candidate
- `dtfva-fluorescent-dtf-printing-bold-bright-stunning` — glow/fluorescent builder candidate
- `dtfva-custom-dtf-gang-sheets-30-inches-builder` — 30" DTF builder candidate; no known live URL in the five confirmed paths
- `dtfva-custom-dtf-gang-sheets-30-inches` — 30" DTF gang sheet candidate; no known live URL in the five confirmed paths
- `dtfva-22-inch-uv-dtf-sticker-sheet-builder` — UV DTF sticker builder candidate; no known live URL in the five confirmed paths

Keep these as quote/review until there is a confirmed builder path: patches, apparel, signage, sports/promo products, software, vector design services, rush fees, and non-builder custom transfer-by-size products.

## Safe UI Labels

Recommended labels:

- Buyable product with valid Storefront merchandise ID: `Add to cart`; status chip: `Checkout ready`.
- Builder product with known Kixxl/Gangify route: `Open builder`; status chip: `Build in Shopify`.
- Quote-only or review-only product: `Add for quote`; status chip: `Quote review`.
- Mixed cart note: keep the current note; it truthfully explains why Shopify checkout is disabled.

## Follow-Up Blockers

- Fix or coordinate the outside-scope generator regression: `productCardImage is not defined`.
- Add a product-level builder route map so known builder PDPs use `Open builder` links instead of quote/cart buttons.
- Once at least one product is intentionally made Storefront-visible and publishable, rerun browser checkout enablement against a real buyable PDP.
