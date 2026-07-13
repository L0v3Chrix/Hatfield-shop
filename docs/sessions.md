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
