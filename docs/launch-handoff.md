# Launch Handoff — Hatfield McCoy DTF Storefront

> Status source: run `npm run production:verify` (build audit + copy scanner) and
> `node scripts/verify-roundtrip.mjs`. Internal reports land in `output/readiness/`.
> Updated 2026-06-11.

## Production defaults selected (implemented — change only if the shop corrects them)

1. **Rush/same-day:** "Rush service available when schedule allows. Contact us before ordering for same-day needs." (replaces the unresolved 3pm-vs-none cutoff)
2. **Pickup:** 311 George Kostas Dr, Logan, WV 25601 — "confirmed with your order"; no cutoff promises.
3. **Wholesale:** minimums and pricing "available by quote"; turnaround "confirmed with each order."
4. **Pressing guidance:** "ships with applicable transfer orders"; specifics on request.
5. **Unpriced/non-checkout products:** route to "Request a quote" (`/contact?product=<handle>`); no "Sold out", no "Coming soon", no fabricated prices (the importer's $0.98 floor renders as quote-path).
6. **Builder language:** customer copy says "gang sheet builder" — tool names never appear in visible text.
7. **Structured data:** products without an honest price carry no offers block (no $0.00 claims).

## Remaining owner actions (each is a hard gate)

| Action | Unblocks | How |
|---|---|---|
| Set a valid Gemini API key for the `gemini-nanobanana-mcp` server | D4/D5 image generation (23 photoreal replacements/gaps; prompts ready) | MCP server env config, then rerun the generation batch |
| ~~Provision `write_products`~~ **DONE 2026-06-11** — client-credentials auth carries write scope (proven by live mutations) | — | — |
| ~~Media replace~~ **DONE 2026-06-11** — all 10 ACTIVE products upgraded to real photos (`--replace` mode; inverse in `output/shopify-audit/media-replace-log.json`); SEO title/description filled on all 10 (inverse in `seo-fix-log.json`). Re-run after D4/D5 imagery lands for the photoreal generation set | — | — |
| Run webhook registration on the deployed endpoint | Order-artwork sync (`api/shopify-order-artwork-sync.js` is inert; registry is empty) | `npm run shopify:webhook:orders:artwork` with `SHOPIFY_ORDER_ARTWORK_WEBHOOK_URL` + HMAC secret set in Vercel |
| Staging runtime checks (C2) | Builder click capture at 390/1440 + designless add-to-cart → checkout must be blocked by the app's order validation | On the Vercel preview; if validation does NOT block, hide native buy buttons on builder templates in a theme DUPLICATE (E2) |
| Verify Vercel project env | First branch-preview deploy (`vercel-build.mjs` throws without `SHOPIFY_STOREFRONT_PUBLIC_TOKEN`) | Vercel dashboard |
| Rotate exposed secrets (app secret, automation token, temp Admin token — flagged 2026-05-28) | Launch | Shopify admin + wherever stored |
| Theme duplicate + brand match + PUBLISH approval (E) | Native Shopify pages matching the headless brand | Duplicate "Builder Brand Match Test - 2026-05-22" first; never edit the published theme |
| Product publishing set + client sign-off | Launch | Shopify admin |
| Payment/checkout activation check, DNS/indexing, noindex removal | Launch only — each its own gate, never bundled | Owner + client |
| Pause the second Dropbox-syncing machine during work windows | Repo safety (conflicted copies came from it) | Coordination |

## Launch checklist (run in order at the gate)

1. `npm run production:prepare` → 0 blockers
2. `npm run production:verify` → audit + copy scanner PASS
3. `node scripts/verify-roundtrip.mjs` → PASS (noindex, builder URLs, honest states, no internal artifacts shipped)
4. `npm run competitor:dtfva:test` → all pass
5. `npm run shopify:audit` + `npm run shopify:storefront:verify` → live-state green
6. `npm run kixxl:verify -- --handle dtf-22-gang-sheet-builder` → 7/7
7. Staging preview: C2 runtime checks + `npm run kixxl:verify:post`
8. Mobile screenshots (390/768/1440) reviewed and accepted
9. Hard-gate approvals recorded → merge to `main` → post-deploy smoke
10. noindex removal is a separate, later approval

## Post-launch improvements

- Rename `dtfva-*` handles via `SHOPIFY_HANDLE_TO_FRONTEND_SLUG` + redirect map (accepted for launch: site is noindexed and handles never appear in visible text)
- Exact pricing for quote-routed categories (UV DTF, banners, sample packs, die-cut stickers) as the shop confirms numbers
- Shipping tool selection (Shopify Shipping / ShipStation / other) + GHL automation scope
- Cart line thumbnails (drawer currently shows a brand gradient tile per line)
- Richer guides content under the conservative-copy rule
