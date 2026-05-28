# DTF Virginia Competitive Parity Workflow

This workflow captures DTF Virginia's public Shopify catalog data, converts it into Hatfield McCoy DTF draft products, and writes review artifacts before any Shopify mutation.

## Commands

```bash
npm run competitor:dtfva
```

Fetches public products, collections, robots.txt, and sitemap data, then writes artifacts to `output/competitor/dtfvirginia/`.

```bash
npm run competitor:dtfva:with-collections
```

Also fetches `/collections/<handle>/products.json?limit=250` for collection-membership research.

```bash
npm run competitor:dtfva:test
```

Runs the workflow tests.

```bash
npm run competitor:dtfva:frontend
```

Generates crawlable draft SEO pages under `deliverables/prototype/products/`, `deliverables/prototype/collections/`, and `deliverables/prototype/pages/`. Draft pages include canonical URLs, metadata, JSON-LD, and `noindex` until review gates are cleared.

```bash
npm run competitor:dtfva:import:dry
```

Authenticates with Shopify and reports what draft products/collections would be created. This is the safe default and does not mutate Shopify.

```bash
npm run competitor:dtfva:import
```

Creates missing imported products and collections in Shopify as `DRAFT`. Use only after reviewing the artifacts.

## Review Artifacts

- `raw-scrape.json` — public source payloads and sitemap URLs.
- `normalized-catalog.json` — Hatfield McCoy draft catalog with source metadata.
- `shopify-catalog.json` — Shopify-ready product/collection payload without competitor image media.
- `review-report.json` — product, variant, low-price, fulfillment-risk, and page summary.
- `price-review.csv` — every variant with source price, Hatfield McCoy price, and delta.
- `low-price-exceptions.csv` — variants where the `$0.98` rule was applied.
- `fulfillment-risk-products.csv` — products Jesse should confirm before publishing.
- `page-rewrite-queue.csv` — commerce/support pages to rewrite in Hatfield McCoy voice.
- `deliverables/prototype/catalog.json` — generated frontend catalog for the expanded SEO layer.
- `deliverables/prototype/products/*.html` — crawlable product draft pages.
- `deliverables/prototype/collections/*.html` — crawlable collection draft pages.
- `deliverables/prototype/pages/*.html` — rewritten service/support draft pages.

## Safety Rules

- Products import as `DRAFT`.
- Product vendor is rewritten to `Hatfield McCoy DTF`.
- Descriptions are safe placeholders, not competitor copy.
- Competitor image URLs are stored as internal reference metadata only; no image media is published.
- Prices are source price minus `$1.00` when source price is above `$1.00`; source prices at or below `$1.00` become `$0.98` and are flagged.
- The import script never deletes products and only updates existing products when explicitly run with `--update`.
- Generated SEO pages stay `noindex` until copy, fulfillment, pricing, image, and SEO approvals are complete.
- Virginia city pages are rewritten as West Virginia production + nationwide shipping pages, not Virginia-local landing pages.

## Pencil / UX Review

The local Pencil CLI is available as `pencil 0.2.6`, but this shell may require `pencil login` or `PENCIL_CLI_KEY` before AI design review can run. Use this prompt once authenticated:

```bash
pencil --out output/competitor/dtfvirginia/hatfield-seo-layer.pen \
  --prompt "Review the Hatfield McCoy DTF generated product and collection SEO pages for best-in-market DTF ecommerce UI/UX. Preserve the Appalachian Neon Commerce identity, improve scannability, mobile buying confidence, product variant ergonomics, and trust signals. Do not introduce competitor copy or assets." \
  --prompt-file deliverables/prototype/products/dtfva-custom-dtf-transfers-by-size.html \
  --prompt-file deliverables/prototype/collections/dtfva-dtf-transfers.html
```
