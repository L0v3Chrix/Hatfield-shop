import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { rewriteProductCopy } from './copy-seo.js'

export function exportNormalizedCatalog(normalized) {
  return {
    COLLECTIONS: (normalized.collections ?? []).map((collection) => ({
      handle: collection.handle,
      title: collection.title,
      description: collection.description,
      sourceHandle: collection.sourceHandle,
      members: [],
    })),
    PRODUCTS: (normalized.products ?? []).map((product) => {
      const copy = rewriteProductCopy(product)
      const tags = unique([...(product.tags ?? []), ...copy.approvalTags])
      return {
        handle: product.handle,
        title: publicTitle(product.title),
        description: copy.bodyHtml,
        productType: publicProductType(product.productType),
        vendor: product.vendor,
        status: product.status,
        tags,
        metafields: toShopifyMetafields({
          ...(product.metafields ?? {}),
          copy_status: copy.status,
          seo_status: 'draft-noindex',
          approval_required: 'copy,fulfillment,pricing,images,seo',
        }),
        options: product.options,
        variants: product.variants.map((variant) => ({
          sku: variant.sku,
          options: variant.options,
          price: variant.price,
          flags: variant.flags,
        })),
      }
    }),
    PAGES: normalized.pages ?? [],
  }
}

export function buildReviewReport(normalized) {
  const products = normalized.products ?? []
  const variants = products.flatMap((product) => product.variants.map((variant) => ({ product, variant })))
  const lowPriceExceptions = variants
    .filter(({ variant }) => variant.flags?.includes('low_price_floor_0_98'))
    .map(({ product, variant }) => reviewRow(product, variant))
  const fulfillmentRiskProducts = products
    .filter((product) => product.tags?.includes('needs-fulfillment-review'))
    .map((product) => ({
      handle: product.handle,
      title: product.title,
      productType: product.productType,
      sourceUrl: product.metafields?.source_url ?? '',
      reason: 'Product category or title suggests Jesse should confirm fulfillment before publishing.',
    }))

  return {
    summary: {
      products: products.length,
      variants: variants.length,
      collections: normalized.collections?.length ?? 0,
      pages: normalized.pages?.length ?? 0,
      low_price_exceptions: lowPriceExceptions.length,
      fulfillment_risk_products: fulfillmentRiskProducts.length,
      validation_errors: normalized.validationErrors?.length ?? 0,
    },
    priceReviewRows: variants.map(({ product, variant }) => reviewRow(product, variant)),
    lowPriceExceptions,
    fulfillmentRiskProducts,
    pageRewriteQueue: (normalized.pages ?? []).map((page) => ({
      handle: page.handle,
      title: page.title,
      sourceUrl: page.sourceUrl,
      rewriteBrief: page.rewriteBrief,
    })),
    validationErrors: normalized.validationErrors ?? [],
  }
}

export function writeExportArtifacts(normalized, { outputDir }) {
  mkdirSync(outputDir, { recursive: true })
  const catalog = exportNormalizedCatalog(normalized)
  const report = buildReviewReport(normalized)
  const paths = {
    normalized: join(outputDir, 'normalized-catalog.json'),
    shopifyCatalog: join(outputDir, 'shopify-catalog.json'),
    reviewReport: join(outputDir, 'review-report.json'),
    priceReviewCsv: join(outputDir, 'price-review.csv'),
    lowPriceCsv: join(outputDir, 'low-price-exceptions.csv'),
    fulfillmentCsv: join(outputDir, 'fulfillment-risk-products.csv'),
    pagesCsv: join(outputDir, 'page-rewrite-queue.csv'),
  }

  writeFileSync(paths.normalized, JSON.stringify(normalized, null, 2))
  writeFileSync(paths.shopifyCatalog, JSON.stringify(catalog, null, 2))
  writeFileSync(paths.reviewReport, JSON.stringify(report, null, 2))
  writeFileSync(paths.priceReviewCsv, renderCsv(report.priceReviewRows))
  writeFileSync(paths.lowPriceCsv, renderCsv(report.lowPriceExceptions))
  writeFileSync(paths.fulfillmentCsv, renderCsv(report.fulfillmentRiskProducts))
  writeFileSync(paths.pagesCsv, renderCsv(report.pageRewriteQueue))

  return { paths, catalog, report }
}

export function renderCsv(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(','))
  }
  return `${lines.join('\n')}\n`
}

function reviewRow(product, variant) {
  const sourcePrice = Number(variant.sourcePrice)
  const hmPrice = Number(variant.price)
  return {
    handle: product.handle,
    sku: variant.sku,
    title: product.title,
    source_price: sourcePrice.toFixed(2),
    hm_price: hmPrice.toFixed(2),
    delta: (hmPrice - sourcePrice).toFixed(2),
    flags: (variant.flags ?? []).join('|'),
    source_url: product.metafields?.source_url ?? '',
  }
}

function toShopifyMetafields(metafields) {
  const entries = []
  for (const [key, value] of Object.entries(metafields)) {
    if (key === 'competitor_image_urls') {
      entries.push({
        namespace: 'competitor_parity',
        key,
        type: 'json',
        value: JSON.stringify(value),
      })
      continue
    }
    entries.push({
      namespace: 'competitor_parity',
      key,
      type: 'single_line_text_field',
      value: String(value ?? ''),
    })
  }
  return entries
}

function csvCell(value) {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function publicProductType(productType) {
  const raw = String(productType ?? '').trim()
  if (!raw || /kixxl|hidden|competitor parity|mws_fee_generated/i.test(raw)) return 'Custom Print Product'
  return raw
}

function publicTitle(title) {
  return String(title ?? '')
    .replace(/DTF Virginia/gi, 'Hatfield McCoy DTF')
    .replace(/Best in Virginia/gi, 'West Virginia Specialty')
}
