# QA Gate Ladder — Hatfield McCoy DTF

Run `npm run qa:gate` for the deterministic verdict (evidence in
`output/readiness/qa-gate.json`). Both halves of the combined rule apply at every
rung: an API pass without a browser pass is not done, and vice versa.

**Post-deploy, MANDATORY:** `npm run qa:journeys -- --base <deployed-url>`
(`scripts/qa/e2e-journeys.mjs`; needs Playwright — `npm i playwright` once, or
`HM_PLAYWRIGHT_DIR=<dir with node_modules/playwright>`). It walks real buyer
journeys: add-without-artwork -> guided (never a dead checkout button) -> upload in
cart -> Shopify checkout reached; pre-upload -> checkout reached for EVERY buyable;
builder + quote routing; a 390x844 mobile pass; console errors fail the product.
This suite exists because selector-level smoke tests passed for a week while the
human cart->checkout path was dead (owner-found, 2026-07-13). A deploy is not done
until it prints `N/N journeys passed` against the deployed URL.

| Gate | Conditions | Owner | Evidence |
|---|---|---|---|
| **BLOCKED** | Any local step red (tests, build, readiness audit, copy scanner, round-trip) | build | `qa-gate.json` |
| **LOCAL_READY** | All local steps green; network evidence recorded when credentials present | build | `qa-gate.json`, `output/readiness/*` |
| **STAGING_READY** | Work branch pushed (never `main`) → Vercel preview deploys → on the preview: `kixxl:verify:post`, C2 runtime checks (builder click capture at 390/1440; designless add-to-cart → checkout blocked by app validation), real add-to-cart returns a Shopify checkout URL, mobile screenshots at 390/768/1440 captured | build + owner | preview URL, screenshots, command output |
| **LAUNCH_READY_PENDING_APPROVAL** | Staging green + every hard-gate row in `docs/launch-handoff.md` either done or explicitly accepted; mobile screenshots reviewed and accepted; merge approval requested | owner + client | signed-off handoff doc |
| **LAUNCH_READY** | Approvals recorded → merge to `main` (auto-deploys) → post-deploy smoke (5 routes + `kixxl:verify:post`) → noindex headers still served. noindex REMOVAL is a separate later approval — never bundled with launch | owner + client | deploy log, smoke output |

## Rollback anchor

Record the current production deployment ID from the Vercel dashboard **before the
first push that triggers any deploy** (owner action — fill in here): `____________`.
Rollback = Vercel instant rollback to that deployment, or `git revert` on `main`.

## Screenshot matrix note

The browser-automation MCP is not connected in this environment; the screenshot
matrix (headless `/`, `/shop`, `/collections`, one PDP per buyer state,
`/gang-sheet-builder`, open cart drawer, plus native theme product/collection/cart —
at 390/768/1440) is a STAGING_READY step against the preview URL. Prior-session
baselines live at the project root (`hm-*-390.png`, `audit-*.png`).
