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
