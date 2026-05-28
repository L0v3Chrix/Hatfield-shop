# Kixxl Integration — Session Doc

**Date:** 2026-04-17
**Plan:** `~/.claude/plans/now-lets-solve-kixxl-sparkling-twilight.md`
**Scope:** Wire the Kixxl gang-sheet builder into `hatfield-mccoy-dtf.futrbusiness.com`; create a 100% off internal-use discount code; fix the quote form fallback.

---

## Context

Hatfield & McCoy DTF has Kixxl (a Shopify app) installed on `zm1evm-rd.myshopify.com` (primary domain `hatfield-mccoy-dtf.myshopify.com`). The Vercel-hosted marketing site at `hatfield-mccoy-dtf.futrbusiness.com` needs gang-sheet CTAs to reach the Kixxl builder.

Research against Kixxl's own knowledge base confirmed:
- Kixxl is **Shopify-native**, not iframe-embeddable (Shopify sets `X-Frame-Options: DENY` / `frame-ancestors 'none'`)
- Configuration flow: merchant Configures a Product in Kixxl admin → clicks "Add Button" → drops Kixxl's theme app block onto the Shopify product template in the theme editor → Kixxl renders inline on that product's storefront page
- Product Types include Normal/Variant, Rolling Canvas, Single Sticker, Sticker Sheet, Image Upload By Size; **Rolling Canvas** is the match for gang-sheet-with-custom-length (docs: *"expands automatically as you add more designs... Width, Length, and Starting height... Tier-based Pricing for variable dimensions"*)

**Chosen approach:** deep-link redirect. Customers click "Build a Gang Sheet" / gang-sheet card / footer link on futrbusiness.com → land on the Shopify-hosted Kixxl product page → complete via Shopify native checkout.

**Also delivered:** 100% off internal discount code `HMDTF-INTERNAL`; fixed the quote-form 400 error (wrong payload shape) + added multi-file upload.

---

## Correction from earlier this session

My first pass at the redirect URL pointed at `rolling-canvas-gang-sheet`. That was wrong. After seeing the user's Kixxl admin screen, I confirmed:

- `rolling-canvas-gang-sheet` + `rolling-canvas-gang-sheet-1` are Kixxl's install-time demo products — **not** the bound product
- The user is configuring Kixxl around **`custom-gang-sheet`** (SKU `GS-22-CUSTOM`, the product I created earlier via `npm run catalog:run`)

The corrected redirect URL is now:
```
https://hatfield-mccoy-dtf.myshopify.com/products/custom-gang-sheet
```

---

## Decisions locked in this session

| Decision | Value |
|---|---|
| Integration mode | Deep-link redirect (no iframe — confirmed infeasible) |
| Kixxl-bound product | `custom-gang-sheet` (SKU `GS-22-CUSTOM`, GID `gid://shopify/Product/8780862455990`) |
| Redirect URL | `https://hatfield-mccoy-dtf.myshopify.com/products/custom-gang-sheet` |
| Recommended Kixxl Product Type | **Rolling Canvas** (for custom-length gang sheets with tier pricing) |
| Button label | "Launch Gang Sheet Builder" |
| Open behavior | Same tab (`open_in_new_tab: false`) |
| Fallback | Quote form retained as "Need a custom quote instead?" secondary option |
| Internal discount code | `HMDTF-INTERNAL` — 100% off, all products, all customers, evergreen |
| Product status on Shopify | Flipped DRAFT → ACTIVE + published to Online Store publication |

---

## Changes

### New / modified files

| File | Change |
|---|---|
| [scripts/shopify/create-internal-discount.js](scripts/shopify/create-internal-discount.js) | **New** — idempotent `discountCodeBasicCreate` |
| [scripts/shopify/publish-kixxl-product.js](scripts/shopify/publish-kixxl-product.js) | **New** — flips a product to ACTIVE + publishes to Online Store (idempotent) |
| [scripts/shopify/verify-kixxl-live.js](scripts/shopify/verify-kixxl-live.js) | **New** — end-to-end live health check (7 checks pre-deploy, 9 post-deploy) |
| [package.json](package.json) | Added `kixxl:discount`, `kixxl:discount:dry`, `kixxl:publish`, `kixxl:publish:dry`, `kixxl:verify`, `kixxl:verify:post` |
| [deliverables/prototype/data/config.json](deliverables/prototype/data/config.json) | Added `kicksy.mode="redirect"`, `kicksy.redirect_url` (custom-gang-sheet), `kicksy.button_label`, `kicksy.open_in_new_tab` |
| [deliverables/prototype/assets/js/content.js](deliverables/prototype/assets/js/content.js) | `renderBuilder()` redirect mode; `buildLaunchButton()`; `rewriteBuilderAnchors()` (static); `installBuilderClickDelegate()` (dynamic); quote-form payload fix (Discord embed shape); multi-file upload with per-file size validation |
| [deliverables/prototype/index.html](deliverables/prototype/index.html) | CSS for `.builder-launch`, `.builder-launch-btn`, `.builder-alt`, `.quote-file-list`, `.quote-file-row`, `.quote-file-err`, `.quote-status.err/.ok` |

### Shopify mutations executed

| Mutation | What | Result |
|---|---|---|
| `discountCodeBasicCreate` | Create `HMDTF-INTERNAL` 100% off | `gid://shopify/DiscountCodeNode/1382729318582` — [admin](https://admin.shopify.com/store/zm1evm-rd/discounts/1382729318582) |
| `productUpdate` | Flip `custom-gang-sheet` to `status: ACTIVE` | ✓ |
| `publishablePublish` | Publish `custom-gang-sheet` to Online Store publication | ✓ |

---

## Architecture — why this works

### Two-layer anchor redirection (belt + suspenders)

1. **Static rewrite** (`rewriteBuilderAnchors()`) — at `renderBuilder()` time, every `<a href="#builder">` gets its `href` replaced with the Shopify URL + a `data-builder-redirect` flag. Benefits: hover link-preview shows real destination; SEO-visible; modifier-click behavior works natively.
2. **Global click delegate** (`installBuilderClickDelegate()`) — a single document-level `click` listener intercepts clicks on `a[href="#builder"]` no matter when they're injected (shop grid re-renders, cart drawer opens, hash navigation, etc.). Respects modifier/middle/meta-clicks by deferring to browser defaults.

Why both: local E2E showed a "Need a gang sheet?" CTA in a `.cta-row` div that gets rendered after initial page load. The static rewrite misses it; the click delegate catches it. Verified by firing a synthetic `MouseEvent` on the dynamic anchor → `defaultPrevented=true` → real navigation to Shopify URL.

### Quote form — why the 400 was happening

`/api/intake` (Vercel Edge Function) validates incoming bodies against Discord's webhook schema: must include `content` (string) or `embeds` (array). The quote form was POSTing a flat `{dimensions, qty, name, email, message, artwork_filename, ...}` object. Validator returned 400 "Body must contain content or embeds."

Fix: the submit handler now builds Discord's embed shape — `{content, embeds: [{title, color, fields, footer, timestamp}]}` — matching the pattern already used by `catalog-intake.html` (which is known working).

### Multi-file upload

Single `<input type="file">` replaced with `<input type="file" multiple>`. Live preview list under the input shows every selected file with size in MB. Per-file 50MB validation runs on `change`; oversize files block submission client-side with clear error. In the Discord embed, all file names are joined into one "Artwork files (N)" field (capped at Discord's 1024-char field.value limit).

### Customer flow (once manual steps are done)

```
┌────────────────────────────────────────┐  click  ┌──────────────────────────────────────┐
│ hatfield-mccoy-dtf.futrbusiness.com    │ ──────▶ │ hatfield-mccoy-dtf.myshopify.com     │
│  • Hero "Build a Gang Sheet"           │         │  /products/custom-gang-sheet         │
│  • Gang Sheet shop card                │         │  (Kixxl's theme app block renders    │
│  • Footer + "Need a gang sheet?" CTA   │         │   the Rolling Canvas builder)        │
│  • Launch button on #builder           │         │                                      │
│  • Any late-injected #builder anchor   │         │  Upload → auto-layout → Add to Cart  │
└────────────────────────────────────────┘         │                                      │
                                                   │  ↓                                   │
                                                   │  Shopify native checkout             │
                                                   │  (HMDTF-INTERNAL works at this step) │
                                                   └──────────────────────────────────────┘
```

---

## Verification results

### Pre-deploy live check (`npm run kixxl:verify`) — 2026-04-17

| Check | Status | Detail |
|---|---|---|
| [A] Shopify Admin auth | ✓ OK | zm1evm-rd.myshopify.com — plan Basic |
| [B.1] Product status ACTIVE | ✓ OK | custom-gang-sheet |
| [B.2] Published to Online Store | ✓ OK | publications=[Online Store] |
| [C.1] Discount ACTIVE | ✓ OK | HMDTF-INTERNAL |
| [C.2] Discount is 100% off | ✓ OK | percentage=1 |
| [D] Public product URL reachable | ✗ | 302 → /password (storefront password still ON — user action needed) |
| [E] Kixxl markup on product page | ✗ | can't inspect while password is on |

Actions required from user, verified by the check:
1. Disable Shopify storefront password
2. Finish Kixxl configuration + drop the Kixxl theme app block on the `custom-gang-sheet` product template (Configure Product → Add Button flow in Kixxl admin)

### Local Playwright E2E — 2026-04-17 (clean)

| Check | Result |
|---|---|
| config.json mode=redirect | ✓ |
| redirect_url = `.../products/custom-gang-sheet` | ✓ |
| Static `#builder` anchors rewritten | ✓ 5/5 match target URL |
| Dynamic `#builder` anchor caught by click delegate | ✓ `defaultPrevented=true` |
| Launch button rendered ("Launch Gang Sheet Builder →") | ✓ |
| Alt/fallback section ("Need a custom quote instead?") | ✓ |
| Quote form fields (6) + multi-file input | ✓ `multiple=true` |
| Quote submit POST payload = Discord embed shape | ✓ `content + embeds[0].fields` with 6 fields |
| Multi-file (3 files) rendered in preview + Discord payload | ✓ all 3 in `Artwork files (3)` field |
| Oversize (51MB) file blocks submit | ✓ error shown, no fetch called |
| Glitter compound SKU regression | ✓ `GLT-22-108-MLT` @ $54 |
| Glow (non-color) regression | ✓ `GID-22-300` @ $153 |
| Console errors/warnings | ✓ 0 |

---

## User manual steps (to complete ship)

1. **Finish Kixxl product config** in the Shopify admin ([admin.shopify.com/store/zm1evm-rd/apps/kixxl](https://admin.shopify.com/store/zm1evm-rd/apps/kixxl) → Products → Configure):
   - Keep the bound product as **Custom Gang Sheet (GS-22-CUSTOM)**
   - Change Product Type from "Normal / Variant Product" to **"Rolling Canvas"** (enables custom-length canvas + tier-based pricing, which matches the spec: 22" wide × any length)
   - Configure your tier pricing ladder inside Rolling Canvas (if you want Kixxl to override Shopify's $0.00 placeholder; otherwise leave the product at a placeholder price)
   - Allowed File Types: PNG / PDF / SVG / AI / EPS / JPG — already all checked per your screenshot
   - Save
2. **Add the Kixxl button to the theme** (inside Kixxl → Configure Product → **Add Button**):
   - This redirects you to the Horizon theme editor with the Kixxl app block ready to drop
   - Drop the block on the Custom Gang Sheet product template (or the default product template)
   - Save the theme
3. **Disable storefront password**:
   - Shopify Admin → Online Store → Preferences → scroll to "Password protection" → uncheck "Restrict access to visitors with the password" → Save
4. **Deploy the prototype**:
   ```bash
   cd "/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf/deliverables/prototype"
   vercel --prod
   ```
5. **Reply** so I can run the post-deploy verification:
   ```bash
   npm run kixxl:verify:post
   ```
   — this runs all 9 checks (same 7 as pre-deploy PLUS deployed config.json + deployed content.js marker check).

---

## Scripts available

```bash
# Idempotent setup / reconfigure
npm run kixxl:publish           # custom-gang-sheet: flip ACTIVE + publish to Online Store
npm run kixxl:discount          # create/verify HMDTF-INTERNAL 100% off
# Verification
npm run kixxl:verify            # pre-deploy: Shopify admin + public URL (password off) + Kixxl markup
npm run kixxl:verify:post       # post-deploy: same + deployed config.json + deployed content.js
# Existing (unchanged)
npm run catalog:verify          # deep drift check of the 6-product DTF catalog
npm run catalog:export          # refresh products.json from Shopify (idempotent)
```

---

## Risks / open items

| Item | Status |
|---|---|
| Storefront password ON | Blocks public URL access until user disables |
| Kixxl theme block not yet placed | Blocks Kixxl builder rendering until "Add Button" is completed |
| Product Type in Kixxl was set to "Normal / Variant" | User needs to change to "Rolling Canvas" for custom-length flow |
| `custom-gang-sheet` price is $0.00 placeholder | Rolling Canvas tier pricing in Kixxl will override at runtime |
| `HMDTF-INTERNAL` has unlimited usage | If it leaks publicly, rotate: `npm run kixxl:discount -- --code <new-code>` |
| Duplicate `rolling-canvas-gang-sheet-1` + `test-gang` products still exist | Cosmetic; can be deleted from admin when convenient |
| `*.myshopify.com` visible in customer URL bar | Until custom domain set up on Shopify side; cosmetic, not blocking |

---

## Post-deploy verification (after user completes the 4 steps above)

```bash
npm run kixxl:verify:post
```

Expected output: **all 9 checks ✓ OK**:
- [A] Shopify Admin auth
- [B.1] Product status ACTIVE
- [B.2] Published to Online Store
- [C.1] Discount ACTIVE
- [C.2] Discount is 100% off
- [D] Public product URL reachable (no password redirect)
- [E] Kixxl markup on product page (non-zero kixxl keyword hits or create-sheet CTA)
- [F] Deployed config.redirect_url matches Shopify URL
- [G] Deployed content.js has all 4 markers (click delegate, glitter compound SKU, multi-file Discord payload, launch button class)

Manual smoke after the script passes:
1. Open https://hatfield-mccoy-dtf.futrbusiness.com → click "Build a Gang Sheet" → verify land on Kixxl builder
2. Upload 2-3 artwork files → verify auto-layout + Add to Cart
3. Paste `https://hatfield-mccoy-dtf.myshopify.com/products/custom-gang-sheet?discount=HMDTF-INTERNAL` → build sheet → checkout → verify total = $0.00
