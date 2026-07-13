# Hatfield McCoy DTF — Operator's Manual

Last updated: 2026-07-13. The one document for how the store works, how to change it, and how to launch/rollback. Written for Chrix (and future maintainers).

---

## 1. How a customer orders (two paths)

### Path A — Direct-buy products (transfers by size, banners, stickers, patches, balls, tumblers, apparel, services)
1. Customer lands on a product page → a dashed **"Upload your artwork"** box sits right in the purchase panel.
2. They upload (PNG/JPG/PDF/AI/EPS, 50MB) → file goes to `/api/upload-artwork` → stored in **Shopify Files** → "✓ attached" confirmation.
3. Any "Add to cart" click attaches the artwork to that cart line automatically.
4. If they skipped the upload, the cart drawer blocks checkout per-line ("Upload artwork before checkout") with its own upload button — nobody can pay without artwork on artwork-required items.
5. Checkout is Shopify's own — the order line carries `Artwork file` + `Artwork upload URL` properties.

### Path B — Gang sheet builders (22"/46" DTF, glitter, glow, sublimation-24)
1. `/gang-sheet-builder` deep-links into the **Kixxl** editor with the size/variant/price preset.
2. Customer uploads multiple files (Kixxl allows up to 1GB), arranges the sheet, Add to Cart → Shopify cart/checkout.
3. The order line carries Kixxl's design payload: `_actual_gang_sheet` (print-ready sheet), `sheet_preview`, edit links, DPI/overlap flags.

### Where fulfillment finds the artwork (every order)
- **Order line item properties** (both paths, visible in Shopify admin on the order).
- **`fulfillment.artwork_manifest` metafield** on the order — a JSON manifest written seconds after every order by the webhook (`ORDERS_CREATE` → `https://production-site-flax.vercel.app/api/shopify-order-artwork-sync`). Covers both direct uploads AND Kixxl sheets. Do **not** repoint this webhook at www.hatfieldmccoydtf.com — Shopify refuses callbacks on the shop's own domains.
- Kixxl orders additionally appear in the **Kixxl app dashboard**.

## 2. Architecture in one paragraph

The public site (www.hatfieldmccoydtf.com) is a static storefront + serverless APIs deployed from `deliverables/Hatfield-shop` (repo root) to Vercel project **`enterweb-guru/production-site`** via CLI (`npx vercel deploy --prod`) — git pushes do NOT deploy. Static pages are generated: `catalog-edits.json` (owner truth) patches the scraped catalog → `competitor:dtfva:frontend` writes pages into `deliverables/prototype` → `production:prepare` promotes into `deliverables/production-site` → deploy. Checkout runs on Shopify (Storefront API cartCreate); the myshopify Online Store theme ("Builder Brand Match Test") only serves the Kixxl pass-through pages (builder PDPs, cart).

**Routing note:** `/shop` is the one canonical listing (owner decision 2026-07-13). `/products` 308-redirects to `/shop` via root `vercel.json`; product detail pages stay at `/products/<handle>`.

## 3. Changing prices / products (the only sanctioned way)

Edit **`scripts/competitor/dtfvirginia/catalog-edits.json`** (removals, retitles, variant restructures, per-SKU priceOverrides, PDP notes, directBuy list, and the copy layer: `copyOverrides` = per-product `{shortDescription, bodyHtml}`, `offerCopy` = the one-sentence pricing offer shown in the lime block). Core non-dtfva products (dtf-22-sheet etc.) take the same copy shape from **`scripts/shopify/config/core-copy.json`**. Then:
```bash
node scripts/competitor/dtfvirginia/apply-edits.js --write     # sync Shopify-side artifacts
node scripts/shopify/offer-sheet-sync.mjs --execute            # statuses/restructures/builder upcharge (dry-run first without --execute)
node scripts/competitor/dtfvirginia/import-drafts.js --execute --update --sync-metadata
npm run competitor:dtfva:shopify-state                         # ALWAYS re-export before regenerating pages
npm run competitor:dtfva:frontend && npm run production:prepare
npm run qa:gate -- --skip-build                                # must print LOCAL_READY
npx vercel deploy --prod
npm run qa:journeys -- --base https://www.hatfieldmccoydtf.com # must print N/N journeys passed
```
After copy changes also run `node scripts/shopify/refresh-seo-descriptions.mjs --execute` so Shopify admin SEO descriptions match the site.
Update `offer-sheet-2026-07-08.json` when prices change so QA asserts the new truth. Never run import-drafts before offer-sheet-sync restructures. Never hand-edit `public/` or `deliverables/production-site` pages (regenerated every build).

## 4. QA — what runs automatically

`npm run qa:gate -- --skip-build` runs: unit/generator tests (48), readiness + copy compliance, round-trip integrity (JS mirror parity, curated image = card AND PDP hero, robots state), **offer-sheet conformance** (prices/variants/removals/buyability/live merchandise-IDs/duplicate titles/competitor-branding sweep/Kixxl protection), Shopify audit, storefront cartCreate, Kixxl live check. All must be green before any deploy.

**Buyer-journey E2E (post-deploy, mandatory):** `npm run qa:journeys -- --base <url>` — real Playwright journeys for every public product: direct-buy add→(guided if artwork missing)→upload→Shopify checkout reached, builder routing, quote routing, mobile 390×844 pass, zero console errors. Built 2026-07-13 after the cart→checkout dead end shipped past selector-level tests.

Test order without touching a card: `node scripts/shopify/qa-test-order.mjs [--variant-gid gid://…]` — creates a payment-pending order with artwork attributes, verifies the webhook manifest, auto-cancels.

## 5. Going live / going dark (the two switches)

**The store is transactable the moment Shopify Payments test mode is OFF** (Settings → Payments → Shopify Payments → Manage → Test mode). Search visibility is separate:

- **Go live to Google** (only after payments are live):
  1. `python3 - <<'E'` … or simply: remove the three `X-Robots-Tag` entries from the repo-root **`vercel.json`** (this root file is the live header config — the generated copy inside production-site is NOT used).
  2. `HM_LAUNCHED=1 npm run production:prepare` (flips robots.txt → Allow, populates sitemap.xml with ~113 URLs, sets `index, follow` meta on buyable products/collections/key pages; thin quote/proxy pages intentionally stay noindex).
  3. `HM_LAUNCHED=1 npm run qa:gate -- --skip-build` → LOCAL_READY → `npx vercel deploy --prod`.
- **Go dark**: re-add the noindex headers to root `vercel.json`, rebuild *without* `HM_LAUNCHED`, deploy. (Current state as of 2026-07-10: **dark**, awaiting payments-live.)

## 6. Shopify state (as left on 2026-07-10)

- 74/93 products ACTIVE, published to Online Store + Headless; every ACTIVE product has media + SEO.
- Intentionally hidden: 8 dedupe drafts, 4 legacy placeholders, 7 archived software products. Don't resurrect without a pricing decision.
- 5 Kixxl builder products: default template (Kixxl app block), priced flat-sheet + $0.60.
- Drip "Build a Gang Sheet": **uninstalled** (owner, 2026-07-10). Never re-add the `Gang Sheet` product tag — it fed Drip's checkout banner.
- Theme fixes live in `assets/hm-builder-brand-match-r2.css` (byte-exact pre-surgery backups: `project-ops/theme-backup-2026-07-09/`).

## 7. Rollback cheatsheet

| What | How |
|---|---|
| Bad deploy | `npx vercel rollback` (or redeploy previous commit) |
| Theme regression | re-upsert files from `project-ops/theme-backup-2026-07-09/` |
| Catalog mistake | revert `catalog-edits.json`, rerun §3 pipeline |
| Media/SEO backfill | inverse log `project-ops/bulk-media-seo-log-2026-07-09.json` |
| Indexing | §5 go-dark |

## 8. Production-ready punch list (live tracking)

- [x] Upload visible on every buyable PDP (2026-07-10)
- [x] Kixxl-only (Drip uninstalled), builder E2E green
- [x] Pink dot + cart transparency fixed on OS theme
- [x] All ACTIVE products have media + SEO in Shopify
- [x] Site dark while payments in test mode
- [ ] **Chrix: end-to-end human test order in test mode** (upload on PDP → checkout with 4242 card) — the sign-off gate
- [ ] **Chrix: shipping rates** (only "Express $32.00" exists — set real rates in Settings → Shipping)
- [ ] Chrix: payments test mode OFF → tell Claude → indexing flip (§5)
- [ ] Chrix: delete test orders #1001–#1007; rotate the May-exposed admin token; git push local commits
- [ ] Jessie: real product photos (drop-in replacements); branding-pack copy review
