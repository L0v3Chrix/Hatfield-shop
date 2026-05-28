# Deploy Runbook — Shopify-Connected Site

**Context:** `data/products.json` now sources from Shopify (zm1evm-rd.myshopify.com). The static prototype at `deliverables/prototype/` was rebuilt and verified locally. This runbook is the deploy handoff — run it to push the Shopify-connected catalog to the live site.

**What changed:**
- `deliverables/prototype/data/products.json` — regenerated from Shopify Admin API (94 SKUs across 7 collections)
- `deliverables/prototype/assets/js/content.js` — patched to build compound SKUs for glitter (e.g. `GLT-22-24` + `SIL` → `GLT-22-24-SIL`)

**Status of the prototype folder:** not git-tracked locally (lives only in Dropbox). Deploy is a single `vercel --prod` call. Vercel is already linked to the project from the Draft 1 deploy (commit `034bb5c` per ship-ready doc).

---

## Fastest path (~3 minutes)

```bash
# 1. Install Vercel CLI if you don't have it
npm i -g vercel

# 2. cd into the prototype folder
cd "/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf/deliverables/prototype"

# 3. If first time: link to the existing Vercel project
vercel link           # choose "L0v3Chrix" scope → "hatfield-mccoy-dtf" project

# 4. Deploy to production
vercel --prod
```

Vercel prints the production URL. Expected: `https://hatfield-mccoy-dtf.futrbusiness.com` flips to the new build within ~30–60 seconds after the CLI completes.

---

## Post-deploy verification (2 minutes)

After `vercel --prod` finishes, run each of these — all must match:

### 1. products.json is live

```bash
curl -s https://hatfield-mccoy-dtf.futrbusiness.com/data/products.json | python3 -c "import sys, json; d = json.load(sys.stdin); print('source:', d['_meta']['source']); print('sku_count:', d['_meta']['sku_count']); print('collections:', len(d['collections']))"
```

**Expect:**
```
source: shopify:zm1evm-rd.myshopify.com
sku_count: 94
collections: 7
```

### 2. Glitter color picker uses compound SKUs

```bash
curl -s https://hatfield-mccoy-dtf.futrbusiness.com/data/products.json | python3 -c "import sys, json; d = json.load(sys.stdin); g = next(c for c in d['collections'] if c['slug'] == 'glitter-22'); print(json.dumps(g['color_options'], indent=2))"
```

**Expect:**
```json
[
  { "name": "Silver", "sku_suffix": "SIL" },
  { "name": "Gold",   "sku_suffix": "GLD" },
  { "name": "Multi",  "sku_suffix": "MLT" }
]
```

### 3. content.js patch is deployed

```bash
curl -s https://hatfield-mccoy-dtf.futrbusiness.com/assets/js/content.js | grep -c "data-sku-suffix"
```

**Expect:** `1` (the new compound-SKU attribute)

### 4. Manual smoke: open each PDP in the browser

- https://hatfield-mccoy-dtf.futrbusiness.com/#pdp-dtf-22
- https://hatfield-mccoy-dtf.futrbusiness.com/#pdp-dtf-46
- https://hatfield-mccoy-dtf.futrbusiness.com/#pdp-glitter-22 ← verify 3 color buttons appear
- https://hatfield-mccoy-dtf.futrbusiness.com/#pdp-glow-22
- https://hatfield-mccoy-dtf.futrbusiness.com/#pdp-sublimation-24
- https://hatfield-mccoy-dtf.futrbusiness.com/#pdp-3d-print
- https://hatfield-mccoy-dtf.futrbusiness.com/#builder ← gang sheet builder section

### 5. Cart test: Glitter Gold 22x84

1. Open https://hatfield-mccoy-dtf.futrbusiness.com/#pdp-glitter-22
2. Click **Gold** color
3. Click **22 x 84** size
4. Click **Add to Cart**
5. Open the cart drawer (header cart icon)
6. Open devtools → Application → Local Storage → `hm_cart_v1` → expect the added item to have `sku: "GLT-22-84-GLD"`

---

## Rollback (if something breaks)

Previous deployment is still available on Vercel:

```bash
cd "/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf/deliverables/prototype"
vercel rollback
```

Or promote the previous good deployment from the Vercel dashboard: Project → Deployments → select previous → "Promote to Production".

The old products.json (with PDF-sourced data) is preserved at `/tmp/products.json.before` on this machine, and can also be restored by reverting `data/products.json` to commit `034bb5c` via the git history of the repo at `/Users/chrixcolvard/projects/Hatfield-and-McCoy-DTF/` (if synced).

---

## Re-running the sync later

When Shopify changes (price update, new SKU, etc.):

```bash
cd "/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf"
npm run catalog:verify       # confirms Shopify live still matches our spec
npm run catalog:export       # regenerates products.json from Shopify
cd deliverables/prototype
vercel --prod                # ship
```

The export script is idempotent — re-running produces an identical file if Shopify state hasn't changed.

---

## Things NOT changed (intentionally out of scope)

- Shopify products remain in **DRAFT status** — not published to the Online Store channel yet (no Storefront API exposure)
- Cart is still localStorage-based; no Shopify Cart API wiring (this is the post-launch swap)
- Images still use branded ImageMagick placeholders (Gemini regen blocked on API key fix)
- `catalog-intake.html` unchanged
- `content.json`, `config.json`, `chip-labels.json` unchanged
