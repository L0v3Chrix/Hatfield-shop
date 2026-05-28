# Hatfield McCoy DTF Overnight Site Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current production preview into a complete Hatfield McCoy ecommerce site that uses the proven layout framework of DTF Virginia and DTF Ninjas without copying protected logos, copy, or imagery.

**Architecture:** Keep Shopify as the backend source of truth and keep the static/Vercel frontend as the public storefront. Improve the generated catalog layer, image mapping, PDPs, collection pages, builder routing, and launch QA in small independent passes so agents can work in parallel without clobbering each other.

**Tech Stack:** Static HTML/CSS/JS production preview, Node catalog generator, Python asset optimizer, Shopify Storefront API, Shopify Admin import/export scripts, Vercel deployment, Playwright/browser verification.

---

## Current Truth

- Repo: `/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf`
- Production preview directory: `deliverables/production-site/`
- Brand framework directory: `deliverables/brand-design-pack/`
- Source image vault: `Shopify-images-good/`
- Optimized image output: `deliverables/brand-design-pack/assets/shopify-images/`
- Catalog generator: `scripts/competitor/dtfvirginia/frontend-generator.js`
- Copy/SEO generator: `scripts/competitor/dtfvirginia/copy-seo.js`
- Cart runtime: `deliverables/prototype/assets/js/cart.js`
- Build command: `npm run production:prepare`
- Verification command: `npm run production:verify`
- Competitor pipeline tests: `npm run competitor:dtfva:test`
- Live alias: `https://production-site-flax.vercel.app`

## What Is Still Wrong

- The shop has all 79 products, but it does not yet feel like a polished competitor-grade Shopify storefront.
- Product and collection pages still need a deeper merchandising pass, not just generated cards and tables.
- Image coverage is too thin for 79 products and 38 collections; reusable category art is not enough.
- The catalog needs a DTF Virginia / DTF Ninjas-style framework adaptation: dense product discovery, product-family navigation, trust strips, proof/print workflow cues, price/variant clarity, and obvious builder/quote paths.
- Shopify checkout is intentionally gated for unapproved products, but the UI needs clearer separation between buyable, builder, and quote-only paths.
- The gang sheet builder route exists and links to Kixxl/Gangify, but the broader catalog does not consistently route builder-like products into that flow.

## Overnight Workstreams

### Agent 1: Competitor Layout Extraction

**Purpose:** Extract layout/framework patterns from DTF Virginia and DTF Ninjas, then convert them into Hatfield McCoy-specific implementation notes.

**Write scope:** `deliverables/brand-design-pack/competitor-framework-extraction.md` only.

**Prompt:**

```markdown
You are Agent 1 for the Hatfield McCoy DTF overnight build sprint.

Work in `/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf`.

Your job is research and documentation only. Do not edit site templates or scripts.

Study the public ecommerce layout/framework of:
- https://dtfvirginia.com
- https://dtfninjas.com

Extract reusable ecommerce framework patterns only. Do not copy logos, protected assets, exact copy, or brand claims.

Deliver `deliverables/brand-design-pack/competitor-framework-extraction.md` with:
- Homepage structure patterns.
- Shop/category grid patterns.
- Product detail page patterns.
- Collection/product-family navigation patterns.
- Builder/quote workflow patterns.
- Header/nav/cart/search/filter patterns.
- Trust, urgency, proof, turnaround, and service-message patterns.
- Image usage patterns: hero, product cards, product detail, collection tile, process, social proof.
- Mobile layout observations.
- A Hatfield McCoy adaptation checklist with exact implementation recommendations.

Use screenshots or browser inspection if available. If a site blocks scraping, document the blocked route and use only accessible public pages. Keep the output concrete enough for implementation.
```

### Agent 2: Asset Coverage and Image System

**Purpose:** Build a complete image coverage plan for all 79 products and 38 collections using Hatfield McCoy-owned, generated, or existing assets.

**Write scope:** `deliverables/brand-design-pack/asset-coverage-plan.md`, `scripts/competitor/dtfvirginia/asset-map.js`, and updates to `scripts/competitor/dtfvirginia/frontend-generator.js` only if needed for image mapping.

**Prompt:**

```markdown
You are Agent 2 for the Hatfield McCoy DTF overnight build sprint.

Work in `/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf`.

You are responsible for product and collection image coverage. You are not alone in the codebase; do not revert others' edits. Keep changes in your assigned files.

Inputs:
- Product catalog: `output/competitor/dtfvirginia/normalized-catalog.json`
- Current optimized assets: `deliverables/brand-design-pack/assets/shopify-images/manifest.json`
- Source image vault: `Shopify-images-good/` (do not rename, delete, or overwrite source files)
- Frontend generator: `scripts/competitor/dtfvirginia/frontend-generator.js`

Deliver:
1. `deliverables/brand-design-pack/asset-coverage-plan.md`
2. `scripts/competitor/dtfvirginia/asset-map.js`
3. If needed, patch `frontend-generator.js` to use the asset map instead of the current coarse category-only image fallback.

The asset plan must:
- Inventory every existing optimized image family.
- Classify all 79 products into visual families.
- Classify all 38 collections into visual families.
- Identify product groups that need new generated assets.
- Specify safe generated-image prompts for each missing visual family.
- Avoid competitor images and protected competitor styling.
- Prefer Hatfield McCoy neon/industrial/print-shop visual language.

The asset map must:
- Export a function that returns product card, product hero, collection card, and collection hero image paths.
- Map by handle/title/product type rules.
- Use existing images where they fit.
- Provide deterministic fallbacks.
- Avoid broken image paths.

Run:
- `npm run production:prepare`
- `npm run production:verify`

Return:
- Files changed.
- Counts of product image families covered.
- Remaining missing image groups.
```

### Agent 3: Catalog Merchandising UI

**Purpose:** Make the generated shop, product index, collection index, PDP, and collection pages feel like a conversion-focused ecommerce site instead of generated review pages.

**Write scope:** `scripts/competitor/dtfvirginia/frontend-generator.js` and `scripts/competitor/dtfvirginia/copy-seo.js`.

**Prompt:**

```markdown
You are Agent 3 for the Hatfield McCoy DTF overnight build sprint.

Work in `/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf`.

You own the generated catalog UI. You are not alone in the codebase; do not revert others' edits. Keep changes scoped to:
- `scripts/competitor/dtfvirginia/frontend-generator.js`
- `scripts/competitor/dtfvirginia/copy-seo.js`

Goal:
Make `/shop`, `/products`, `/collections`, `/pages`, generated PDPs, and generated collection pages feel like a competitor-grade ecommerce experience adapted to Hatfield McCoy branding.

Implement:
- Shop page with stronger DTF/product-family merchandising sections.
- Product cards with clearer price, variant count, order path, and CTA.
- Collection cards with product family context and count.
- PDP hero with image, price, CTA, variant selector/table, product details, artwork/production notes, related links, and quote/cart path.
- Collection pages with hero image, subcategory navigation, filtered product grid, and internal links.
- Customer-facing copy. Avoid internal phrases like "draft", "SEO queued", "review-gated", or "competitor parity" in public UI.
- Keep noindex for unapproved pages.
- Preserve Hatfield McCoy palette and navigation-first framework.

Verification:
- `npm run production:prepare`
- `npm run production:verify`
- `npm run competitor:dtfva:test`
- Local browser check `/shop`, one PDP, one collection, `/products`, `/collections`, mobile 390px.

Return:
- Files changed.
- Visual/UX decisions made.
- Any remaining pages that still look weak.
```

### Agent 4: Shopify, Cart, Builder, and Checkout QA

**Purpose:** Verify backend connectivity, cart behavior, builder routing, and checkout gating.

**Write scope:** `deliverables/brand-design-pack/shopify-checkout-qa.md`, `deliverables/prototype/assets/js/cart.js`, and generated route config only if needed.

**Prompt:**

```markdown
You are Agent 4 for the Hatfield McCoy DTF overnight build sprint.

Work in `/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf`.

You own Shopify/cart/builder QA. You are not alone in the codebase; do not revert others' edits.

Inputs:
- `deliverables/prototype/assets/js/cart.js`
- `deliverables/prototype/data/config.json`
- `output/competitor/dtfvirginia/shopify-state.json`
- `deliverables/brand-design-pack/gang-sheet-builder.html`
- `scripts/competitor/dtfvirginia/frontend-generator.js`

Tasks:
- Confirm Storefront config is present in `/data/config.json` after build.
- Confirm cart opens, adds quote-only products, disables checkout for quote-only products, and enables checkout only when every line has a valid merchandise ID.
- Confirm builder route links to Kixxl/Gangify for the five known builder paths.
- Identify catalog products that should route to builder instead of quote/cart.
- Recommend or implement safe UI labels for buyable, builder, and quote-only products.
- Do not publish products or change Shopify status.

Run:
- `npm run production:prepare`
- `npm run production:verify`
- Browser smoke checks for `/gang-sheet-builder`, `/shop`, one quote-only PDP, and one builder-like PDP.

Deliver:
- `deliverables/brand-design-pack/shopify-checkout-qa.md`
- Any small cart runtime patch required to make behavior truthful and stable.
```

### Agent 5: Final QA and Launch Report

**Purpose:** After Agents 1-4 return, verify the integrated site and produce the punch list.

**Write scope:** `deliverables/brand-design-pack/overnight-build-report.md` only unless a small verification script is clearly needed.

**Prompt:**

```markdown
You are Agent 5 for the Hatfield McCoy DTF overnight build sprint.

Work in `/Users/chrixcolvard/Library/CloudStorage/Dropbox/MDS/hatfield-mccoy-dtf`.

Do not start until the other agent work has been integrated.

Your job is final QA and reporting. Do not make broad design changes.

Verify:
- `/`
- `/shop`
- `/products`
- `/collections`
- `/pages`
- `/gang-sheet-builder`
- `/wholesale`
- `/guides`
- `/contact`
- Three generated PDPs from different product families.
- Three generated collection pages.
- Mobile 390px, tablet 768px, desktop 1440px.

Check:
- Navigation present and consistent.
- No horizontal overflow.
- Product counts correct: 79 products, 38 collections, 2,768 variants.
- Image paths resolve.
- Cart/quote behavior is truthful.
- Builder links work.
- Public UI does not expose internal implementation language.
- SEO metadata exists and unapproved pages remain noindex.

Deliver `deliverables/brand-design-pack/overnight-build-report.md` with:
- Pass/fail table by route.
- Screenshot paths if taken.
- Remaining launch blockers.
- Remaining polish tasks.
- Clear "ready for client review" status.
```

## Integration Order

- [x] Run Agent 1 and Agent 2 first. They can run in parallel.
- [x] Run Agent 3 while Agent 1/2 are working, but keep its write scope limited to generated UI and copy.
- [x] Run Agent 4 in parallel with Agent 3 because cart/builder QA is mostly separate.
- [x] Integrate asset-map changes into generated UI.
- [x] Run `npm run production:prepare`.
- [x] Run `npm run production:verify`.
- [x] Run `npm run competitor:dtfva:test`.
- [x] Start local server from `deliverables/production-site` and visually check desktop/mobile.
- [x] Deploy with `vercel deploy --prod --yes`.
- [x] Verify `https://production-site-flax.vercel.app/shop` and at least one live PDP.
- [x] Run Agent 5 final QA. Local integrated report created while final QA sub-agent remains pending.

## Definition Of Done For Overnight Sprint

- `/shop` visually resembles a serious DTF ecommerce shop adapted to Hatfield McCoy, not a generated catalog report.
- All 79 products are reachable.
- All 38 collections are reachable.
- Product pages have image, price, ordering path, useful copy, variant information, and related links.
- Collection pages have product-family context and filtered product grids.
- Product and collection image coverage is mapped, with no broken images.
- Quote-only, builder-only, and checkout-ready products have truthful CTAs.
- Kixxl/Gangify builder paths are visible and functional.
- Build and tests pass.
- Site is redeployed to the Vercel production alias.

## Known Constraints

- Do not copy DTF Virginia or DTF Ninjas logos, copy, or proprietary imagery.
- Do not mutate Shopify product publish status without explicit approval.
- Do not rename, delete, or overwrite files in `Shopify-images-good/`.
- Keep unapproved pages/products noindex.
- Keep Hatfield McCoy brand palette, navigation-first header, Logan/WV + nationwide positioning.
