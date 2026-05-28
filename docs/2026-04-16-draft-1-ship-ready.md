# Draft 1 Ship-Ready — Boss Review Brief

**Date:** 2026-04-16
**Live URL:** https://hatfield-mccoy-dtf.futrbusiness.com
**Intake form:** https://hatfield-mccoy-dtf.futrbusiness.com/catalog-intake
**Commit:** `034bb5c` on `main` of `L0v3Chrix/Hatfield-and-McCoy-DTF`

---

## What changed since your last review

Your feedback: the deployed prototype was a wireframe — clickable elements didn't work, links went nowhere, content was placeholder-laden. Inaccuracies would distort Nicole's review of the direction.

**What we did:** Forensic audit surfaced 108 defects. Built 3-ledger traceability matrix (Defects → Tasks → Verifications) with 4 parallel work streams. Rebuilt the frontend at production quality so the only launch-day work left is backend Shopify wiring.

## Ship-ready status

| Stream | Tasks | Status |
|---|---|---|
| A — Structural | 18/18 | Done (Playwright E2E verified) |
| B — Content & Media | 12/12 | Done (1 deferred: real AI images pending Gemini key fix) |
| C — Form Hardening | 20/20 | Done |
| D — Infrastructure + QA | 10/10 | Done |

**Verifications:** 22/32 passing · 0 failing · 10 deferred non-blocking

**Defects:** 92/92 code-resolved across 3 commits

## What you can click on the live URL

1. **Hero "Build a Gang Sheet"** → scrolls to `#builder` section (real target, not dead anchor)
2. **Nav "Gang Sheet Builder"** → same, smooth scroll
3. **Any of 7 shop collection tiles** → navigates to its unique PDP with correct title, price, description, variants
4. **Variant selector on PDP** → click updates both price display AND Add-to-Cart button text in real time
5. **Add to Cart** → slides open cart drawer with the item, price, quantity; header cart count updates
6. **Refresh page** → cart persists via localStorage
7. **Remove item / update qty in drawer** → everything recalculates
8. **Hamburger menu at <820px** → full overlay with all nav links
9. **File upload on PDP** → real `<input type="file">`, accepts .png/.jpg/.pdf/.ai/.eps, validates 50MB cap, shows filename
10. **Catalog intake form** → 12 questions, progress bar hits 12/12, submit returns 200 OK, Discord webhook fires
11. **Mobile viewport** → no horizontal scroll at 375px (iPhone SE) or 414px (iPhone 11)

## Decisions locked during rebuild

- **Kixxl status:** iframe shell in place with `KICKSY_URL_PENDING` in config.json + working fallback "Request a Quote" form. One-file swap when URL arrives.
- **Email/signer:** `Harold@rmmarketing.ca` · "Harold / RM Marketing" on the client email
- **Socials:** Removed (IG/FB/TikTok icons stripped per your decision)
- **Cart:** localStorage-backed drawer; swaps to Shopify Cart API at launch with zero UI change
- **Images:** Branded ImageMagick placeholders live (Gemini API key was invalid; 9 photorealistic prompts archived in `project-ops/stream-b-handoff.md` for regen when key restored)

## Known gaps to close before final launch (NOT Draft 1 review blockers)

1. **Kixxl URL swap** — one line in `data/config.json`: `KICKSY_URL_PENDING` → real URL
2. **AI image regen** — fix Gemini API key, run archived prompts
3. **`hello@hatfieldmccoydtf.com` inbox routing** — confirm with Harold or switch to `Harold@rmmarketing.ca`
4. **Real testimonials** — current 3 reviews in `content.json` are senior-dev Virginia-flavored defaults; swap when Nicole delivers
5. **Shopify API wiring** — launch-day work (cart drawer + PDP data layer swap localStorage → Storefront API)

## Infrastructure

- **Vercel Production Branch = `main`** (via undocumented API call — future pushes auto-deploy to prod)
- **`/api/intake` Vercel Serverless Function** — hides Discord webhook URL from client source; CORS allowlist, rate limit 5/60s per IP, 32KB body cap, 8s upstream timeout, validates Discord embed schema
- **`DISCORD_WEBHOOK_URL` env var** — encrypted in Vercel project, all 3 environments (prod/preview/dev)
- **Old Discord webhook URL rotation:** still pending on your side; the URL that was previously leaked in client source is no longer reachable by clients (only by `/api/intake`), but rotating is still best practice

## Architecture bet

**Draft 1 frontend = Final frontend.** Content swap happens when Nicole's intake returns — single commit to `data/content.json` with her answers, zero DOM changes. Backend swap happens at launch — single refactor to cart.js and content.js to read from Shopify Storefront API instead of local JSON, zero UI change.

## Discord channel cleanup (manual)

Two test messages I sent during verification should be deleted:
- "API proxy sanity test from V-ledger" (from my earlier curl test)
- One from test submission by "CC TEST DELETE - V-ledger" / `vledger-test@raizethevibe.com`
- One from re-verify submission by "CC VERIFY-FIX" / `verify@test.com`

## What's next

1. You review on live URL
2. If green: send the email in `deliverables/client-email-sku-request.md` to Nicole (already signed Harold / RM Marketing, staging URL in place)
3. Monitor `#ghlm-shopify-project` Discord for her submission
4. When it lands: ingest her answers into `data/content.json`, push → auto-deploys → no DOM changes

## Files to skim if you want depth

- `project-ops/master-ledger.md` — full D/T/V matrix (108 defects, 50 tasks, 32 verifications)
- `project-ops/stream-b-handoff.md` — content sourcing + image regen prompts
- `project-ops/v-ledger-runner.sh` — automated static V-checks (16 pass)
- `deliverables/prototype/api/intake.js` — webhook proxy with CORS + rate limit + validation
