# Hatfield McCoy DTF — Operator's Manual

Last updated: 2026-07-17. THE SITE IS LIVE WITH PAYING CUSTOMERS — see §0 before changing anything. The one document for how the store works, how to change it, and how to launch/rollback. Written for Chrix (and future maintainers).

---

## 0. LIVE-SITE PROTOCOL (site has active customers as of 2026-07-16)

Every change follows this or it doesn't ship:
1. **Never test payments on prod** — journeys stop at the Shopify checkout page; no card entry; no test orders without flagging the owner first.
2. **Preview first for checkout-path changes** (cart.js, config, generator purchase-panel, api/): `npx vercel deploy` (no --prod) → run `npm run qa:journeys -- --base <preview-url>` → only then promote (push or --prod).
3. **Post-deploy canary is mandatory and instant:** `npm run qa:journeys` Pass 0a fetches /data/config.json and probes the Storefront API — it hard-fails in seconds if checkout is dead. Run it after EVERY deploy, whoever/whatever deployed.
4. **Checkout-outage lesson (2026-07-16):** a deploy shipped the literal `__SHOPIFY_STOREFRONT_PUBLIC_TOKEN__` placeholder → every cartCreate 401'd → no customer could check out for ~20h (reported as "pickup broken"). Fixes now in place: the committed config carries the real public Storefront token (public-by-design; env still overrides when present), vercel-build warns instead of relying on env, and the canary exists. If checkout ever fails again: `curl https://www.hatfieldmccoydtf.com/data/config.json` and check the token first.
5. **Rollback beats debugging on prod:** `npx vercel rollback` to the last deployment that passed journeys.
6. Multiple people/sessions deploy to this project. Deploy = CLI `npx vercel deploy --prod` from REPO ROOT only (never from inside production-site/), or push to main. Either way, run the canary after.

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

### Path C — Local pickup orders (live since 2026-07-15; first real pickup #1008 completed)
Shopify handles pickup natively — no code of ours creates orders. What happens:
1. Customer picks "Pickup" at checkout → order is created with NO shipping address and NO shipping charge; delivery method = Pickup at oaks plaza.
2. Shopify auto-sends the **order confirmation email** (order #, items, total paid) — the pickup instructions inside it say "Your order confirmation email is your receipt — show it at the counter."
3. **Counter workflow for Jessie:** admin (or POS) → order → **Mark as ready for pickup** when printed → Shopify auto-emails the customer "Your order is ready" (second proof-of-payment email). At the counter: customer shows either email → verify the order # and PAID status in admin → **Mark as picked up** (closes the order).
4. Pickup orders appear in admin filtered by delivery method "Local pickup"; the artwork manifest webhook fires for them like any order.
Optional (admin UI only, not API-editable): Settings → Notifications → Order confirmation, to add louder "show this at the counter" wording directly in the email template. The default template already shows the pickup section with our instructions, so this is cosmetic.

### Where fulfillment finds the artwork (every order)
- **Order line item properties** (both paths, visible in Shopify admin on the order).
- **`fulfillment.artwork_manifest` metafield** on the order — a JSON manifest written seconds after every order by the webhook (`ORDERS_CREATE` → `https://production-site-flax.vercel.app/api/shopify-order-artwork-sync`). Covers both direct uploads AND Kixxl sheets. Do **not** repoint this webhook at www.hatfieldmccoydtf.com — Shopify refuses callbacks on the shop's own domains.
- Kixxl orders additionally appear in the **Kixxl app dashboard**.

## 2. Architecture in one paragraph

The public site (www.hatfieldmccoydtf.com) is a static storefront + serverless APIs on Vercel project **`enterweb-guru/production-site`**. **The Vercel project is connected to GitHub (`L0v3Chrix/Hatfield-shop`): a push to `main` triggers a production deploy** (confirmed 2026-07-14). The Vercel build (`scripts/vercel-build.mjs`) is deterministic — it copies the committed `deliverables/production-site/` into `public/` and injects the storefront token from env; it does NOT regenerate from source. So the deployed site is exactly whatever `deliverables/production-site/` was committed. `npx vercel deploy --prod` from the repo root produces the identical result (same build) and is the fallback when you want to deploy without a push. **Discipline: always regenerate + commit `deliverables/production-site/` before pushing**, or the deploy serves stale HTML. Static pages are generated: `catalog-edits.json` (owner truth) patches the scraped catalog → `competitor:dtfva:frontend` writes pages into `deliverables/prototype` → `production:prepare` promotes into `deliverables/production-site` → commit → push (or CLI deploy). Checkout runs on Shopify (Storefront API cartCreate); the myshopify Online Store theme ("Builder Brand Match Test") only serves the Kixxl pass-through pages (builder PDPs, cart).

**Routing note:** `/shop` is the one canonical listing (owner decision 2026-07-13). `/products` 308-redirects to `/shop` via root `vercel.json`; product detail pages stay at `/products/<handle>`.

## 3. Changing prices / products (the only sanctioned way)

Edit **`scripts/competitor/dtfvirginia/catalog-edits.json`** (removals, retitles, variant restructures, per-SKU priceOverrides, PDP notes, directBuy list, `shopGroups` = the consolidated /shop category cards (move a handle between groups by editing its members array), and the copy layer: `copyOverrides` = per-product `{shortDescription, bodyHtml}`, `offerCopy` = the one-sentence pricing offer shown in the lime block). Core non-dtfva products (dtf-22-sheet etc.) take the same copy shape from **`scripts/shopify/config/core-copy.json`**. Then:
```bash
node scripts/competitor/dtfvirginia/apply-edits.js --write     # sync Shopify-side artifacts
node scripts/shopify/offer-sheet-sync.mjs --execute            # statuses/restructures/builder upcharge (dry-run first without --execute)
node scripts/competitor/dtfvirginia/import-drafts.js --execute --update --sync-metadata
npm run competitor:dtfva:shopify-state                         # ALWAYS re-export before regenerating pages
npm run competitor:dtfva:frontend && npm run production:prepare
npm run qa:gate -- --skip-build                                # must print LOCAL_READY
git add -A && git commit -m "..." && git push origin main       # push = production deploy (Vercel auto-builds from main)
# (or `npx vercel deploy --prod` for a deploy without a push — identical build)
npm run qa:journeys -- --base https://www.hatfieldmccoydtf.com # must print N/N journeys passed (after the deploy goes live)
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
  3. `HM_LAUNCHED=1 npm run qa:gate -- --skip-build` → LOCAL_READY → commit + `git push origin main` (Vercel deploys), or `npx vercel deploy --prod`.
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
- [x] Shipping options (2026-07-13): Flat Rate $10 (7-10 business days), Express $32 (next day), in-store pickup at Oaks Plaza, 311 George Kostas Drive, Logan WV ("ready in 2-4 days" — adjust in Settings → Shipping → Local pickup if needed). Accidental $0 free-shipping rate deleted; weight condition that hid the $10 rate removed.
- [ ] Chrix: payments test mode OFF → tell Claude → indexing flip (§5)
- [x] git push (2026-07-14): SSH auth now works in the build env; all commits on GitHub (L0v3Chrix/Hatfield-shop, main). Reconciled Sarah's stale 2026-06-12 commit via `-s ours` merge.
- [ ] Chrix: delete test orders #1001–#1007; rotate the May-exposed admin token
- [ ] Jessie: real product photos (drop-in replacements); branding-pack copy review
