# Session Notes — Hatfield-shop

## Session: 2026-07-07 (Fable 5 production rescue)

### Accomplished
- Diagnosed both reported bugs as deployment gaps: production domain served a stale May-28 static build with no API routes; the built upload/artwork pipeline had never shipped anywhere.
- Fixed a real cart.js bug (artwork file input created but never mounted in the cart drawer) — in both `deliverables/production-site` and the `deliverables/prototype` mirror.
- Ported `api/intake.js` (Discord quote-form proxy) from the prototype; quote form had been 404ing in production.
- Linked repo root to Vercel project `production-site`, added `.vercelignore`, copied env vars (Discord webhook; Shopify vars to preview scope), deployed static + serverless functions together.
- Registered the `ORDERS_CREATE` artwork webhook → `production-site-flax.vercel.app/api/shopify-order-artwork-sync` (Shopify refuses callbacks on the shop's own domains, so the Vercel alias is the correct permanent endpoint).
- Cut `hatfieldmccoydtf.com` + `www.hatfieldmccoydtf.com` over from the stale `hatfield-mccoy-dtf` Vercel project to `production-site`.
- Verified end-to-end with headless browser + Admin API: PDP → upload (Shopify Files CDN) → cart attributes → Storefront cartCreate → checkout line properties → orders #1001/#1002 → webhook → `fulfillment.artwork_manifest` metafield. Kixxl builder flows proven for DTF-22, DTF-46, Sublimation-24 (multi-file upload, design URLs in cart properties).
- QA gate green end-to-end: `qa:gate` = LOCAL_READY, network evidence 3/3; round-trip, storefront, builder, unit suites all pass.

### Decisions Made
- Webhook endpoint stays on the flax project alias (Shopify constraint, documented in the rescue report).
- Site remains `noindex` until launch owner approves indexing.
- DRAFT dtfva-parity products remain quote-only by design; they cannot enter Shopify checkout.

### Blockers/Issues
- Final captcha-gated "Pay now" click needs one human run-through (test-mode card was vaulted fine; hCaptcha blocks automation by design).
- `git push` blocked — no GitHub SSH key in the automation environment; commits `9b6fe4e`, `7b0745e`, `<qa-gate-fix>` are local-only.
- Shipping rates show only "Express $32.00" — owner must review Shopify shipping profiles.
- 6 content confirmations pending (see `public/data/pending-confirmations.json`).

### Next Session
- Push local commits from an authenticated machine.
- Human test-mode order (confirm Shopify Payments test mode in dashboard first).
- Review shipping profiles; decide indexing; glitter builder manual pass.

Full report: `../../project-ops/2026-07-07-fable5-production-rescue-report.md`

## Session: 2026-07-09 (catalog truth-up)

### Accomplished
- Applied Jessie's full offer sheet (2026-07-08 meeting transcript) via new catalog-edits layer: 15 removals, 4 variant restructures (productSet), outsourced-line reprice to competitor parity, +$0.60 builder upcharge, retitles, peel/lead-time notes, contact phone.
- Fixed card-vs-PDP image mismatch structurally (asset-map hero honors curated overrides); dropped the competitor-branded Gildan photo.
- New permanent QA: verify-offer-sheet.mjs in qa:gate + card==hero roundtrip check.
- /shop 57 -> 48 cards, zero duplicate titles. Live test order #1007 on restructured banner variant with webhook manifest.

### Decisions Made
- Chrix: +$0.60 builder upcharge; approve competitor-parity pricing on outsourced lines (fluorescent/TPU/UV), $12 UV rung fix, junk variant deletion.
- catalog-edits.json is the single edit surface for future catalog changes; offer-sheet JSON is the independent QA truth.

### Next Session
- Branding-pack copy drafts with Jessie (copyOverrides slot ready); real apparel photos; standing launch list (test mode off, shipping rates, Drip uninstall, git push, indexing, token rotation).

## Session: 2026-07-09 (LAUNCH)

### Accomplished
- Theme surgery: pink disc (zoom-button caught broad magenta button rule) + transparent cart drawer (invalid --color-background triple) fixed in hm-builder-brand-match-r2.css via themeFilesUpsert; backups in project-ops/theme-backup-2026-07-09/.
- Kixxl-only: 5 builders templateSuffix->null (default template carries Kixxl block), Drip template deleted, Chrix uninstalled Drip app (monitor confirmed).
- 64 ACTIVE products backfilled with media+SEO in Shopify (0 gaps, all READY).
- Full visual sweep: 49 pages, 0 broken images, 0 console errors, correct CTAs; stale 'Software' family label retired.
- GO-LIVE EXECUTED: HM_LAUNCHED build deployed; robots Allow, sitemap 113 URLs, index/follow meta, X-Robots noindex headers removed from ROOT vercel.json (the live config — generated production-site/vercel.json is vestigial). Security headers intact.

### Notes
- Root vercel.json is the header source of truth for the deployment; HM_LAUNCHED flips everything else. To go dark again: re-add X-Robots noindex to root vercel.json + rebuild without HM_LAUNCHED.
- Test mode: not API-verifiable; Chrix instructed to flip off as step 1 of his dashboard pass (Drip uninstall = step 2 was observed done).

### Next
- Confirm test mode off + delete test orders #1001-#1007; rotate private admin token; shipping rates; git push; Jessie photos; Search Console submission (optional).

## Session: 2026-07-13 (evening) — functionality truth-up

### Accomplished
- Cart→checkout dead end fixed and proven (owner screenshot reproduced exactly): order lines own the drawer, honest "Needs artwork" summary/badges, checkout button never dead (guides to the blocked line), upsells only when nothing is blocked. Root causes: flex space theft by recommendations, contradictory summary copy, and a phantom-line bug — every Checkout click on a PDP silently added a sku-less "custom-item" line (buy-button delegation matched the checkout button). localStorage sanitizer purges legacy phantoms.
- Full copy rewrite: all 43 public products carry owner-grounded copy (what it is, exact offer with dollars, how to order on that page, peel type, lead times, WV shipping/pickup). Multi-agent write→fact-check→fix→critic pipeline; 9 entries redone after reclassification. QA Q5d bans the old boilerplate site-wide.
- Route truth-up (owner: "builders where we don't need them, no quantity where we do"): 8 variant products moved to direct-buy with on-page QUANTITY stepper; 6 duplicate/dead pages removed (incl. "Best in Virginia 42"); core custom-gang-sheet routes to the builder; honest product-type labels (softballs are not "Gang Sheet"); source-tag-gang-sheet stripped from 17 mislabeled products.
- /products listing removed — /shop is canonical (308 redirect at the edge).
- New mandatory post-deploy QA: `npm run qa:journeys` (scripts/qa/e2e-journeys.mjs) — real buyer journeys for every public product incl. the blocked→resolve cart scenario and a mobile pass. Final run: 48/48 PASS on production.
- Shopify SEO descriptions re-synced to the new copy (58 products).

### Decisions Made
- Only the 5 Kixxl gang-sheet builders are "builders"; every dtfva variant product is direct-buy or quote.
- Deploy gate now includes the boilerplate ban + journey suite; a deploy is not done until N/N journeys pass on the deployed URL.

### Blockers/Issues
- Payments still in TEST mode; site dark (noindex) by design until owner sign-off.

### Next Session
- Owner sign-off gate per OPERATORS-MANUAL §8: Chrix human test order (phone+desktop), shipping rates, test orders cleanup, token rotation, git push, payments live → indexing flip.

## Session: 2026-07-14 — senior-audit remediation

### Accomplished
Actioned an independent senior-dev review. Fixed & deployed:
- **Cart artwork identity (HIGH):** same sku+variant with different artwork collapsed to one line, first artwork lost at fulfillment. Rekeyed cart to stable lineId; merge only on identical artwork (or no-artwork products). Verified live: two designs = two lines. Legacy carts migrate losslessly.
- **Anonymous upload abuse (HIGH):** /api/upload-artwork now origin-allowlists, magic-byte sniffs (rejects renamed non-images — verified 400 live), generic 500. Rate limiting flagged as owner infra (Vercel KV).
- **API version (MED):** 2025-01 → 2026-07 across Storefront + Admin + webhook tooling; gate cartCreate/audit pass on new version.
- **Token print (MED):** capture-admin-token.js → 0600 .env.local + masked preview.
- **Card image weight (MED):** 6.4MB card JPG → 284KB; 20 -card.webp derivatives generated, overrides repointed, new QA cap (Q5e) fails build >500KB.
- **Low/spec:** cart storage-key drift aligned; webhook 2MB body cap before HMAC; intake allowed_mentions:{parse:[]}.
All: 50/50 unit tests, gate LOCAL_READY, 48/48 journeys green post-deploy.

### Not done (owner decisions)
- Upload rate limiting / CAPTCHA (needs Vercel KV or WAF; CAPTCHA can't be auto-completed).
- Single-builder/catalog-unification plan (2026-07-14) — validated separately; theme half sound, "archive all dtfva" would nuke live catalog, needs explicit scope decision.

### Next Session
Owner sign-off gate unchanged: human test order (phone+desktop), test-order cleanup, token rotation, git push, payments off-test → indexing flip.

## Session: 2026-07-16

### Accomplished
- Length-first gang sheet ordering shipped (owner request, customer waiting): /gang-sheet-builder and /products/custom-gang-sheet now let buyers pick sheet type + length BEFORE the Kixxl builder opens; every launch URL deep-links the exact fixed-size variant (flat + $0.60).
- New data layer: scripts/shopify/config/kixxl-builders.json (canonical) derived from the state audit by scripts/shopify/derive-kixxl-builders.mjs (--check verifies price ladders); production-readiness copies it to production-site/data/ for the builder page's fetch.
- custom-gang-sheet PDP rebuilt as a generator special case (frontend-generator.js renderCustomGangSheetPage): picker + full 22"/46" price ladder table + "we build it for you" cards linking the 5 direct-buy sheet PDPs; core-copy.json rewritten for the two paths.
- Found + fixed: dtf-46-gang-sheet-builder was DRAFT on Shopify (live 46" tile was a dead purchase path) — re-activated/published via publish-kixxl-product.js.
- QA: journeys classify() accepts apps/gangify CTAs; new custom-gang-sheet picker assertions; roundtrip expects 5 builder-page launch URLs. qa:gate green; post-deploy qa:journeys 48/48 on production.

### Decisions Made
- Kixxl stays in fixed-variant ("regular") mode — verified in the live Gangify payload; no rolling sheets, matching owner's distrust of Kixxl's calculation.
- No Shopify surgery on the custom-gang-sheet product (stays DRAFT $0 placeholder); the static PDP does the routing, checkout flows through the 5 Kixxl builder products or direct-buy sheets.
- "We build it for you" path routes to existing direct-buy PDPs rather than duplicating width/length variants on custom-gang-sheet.

### Blockers/Issues
- gang-sheet-builder page source is deliverables/brand-design-pack/gang-sheet-builder.html — production:prepare WIPES production-site and rebuilds (first edit went to the generated copy and was lost; re-applied to the true source).
- Local qa:journeys vs npx serve fails all upload journeys (/api/* 404s — serverless functions only exist on Vercel); use the deployed URL for the real gate.

### Next Session
- Owner: hands-on order through the new length-first flow + "sign-off" (definition of done).
- Confirm inside Kixxl that changing size mid-build re-prices to the matching fixed variant (spot-check on a real order).
- Owner sign-off gate unchanged: human test order, test-order cleanup, token rotation, payments off-test → indexing flip.
