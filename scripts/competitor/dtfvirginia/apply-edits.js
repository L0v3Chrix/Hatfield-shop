#!/usr/bin/env node
// Owner catalog-edits layer.
//
// catalog-edits.json is the single reviewable diff between the competitor
// scrape and what Hatfield McCoy actually sells (offer sheet, 2026-07-08
// owner meeting). Every consumer of the normalized catalog applies these
// edits in-memory so the generated site and the Shopify sync artifacts can
// never disagree. The normalized JSON on disk stays pristine (re-scrape
// safe); only derived artifacts (shopify-catalog.json) are rewritten by
// the --write CLI below.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..')
const DEFAULT_EDITS_PATH = join(__dirname, 'catalog-edits.json')
const DEFAULT_NORMALIZED_PATH = join(PROJECT_ROOT, 'output', 'competitor', 'dtfvirginia', 'normalized-catalog.json')
const DEFAULT_SHOPIFY_CATALOG_PATH = join(PROJECT_ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-catalog.json')

const PRICE_RE = /^\d+\.\d{2}$/

export function loadEdits(path = DEFAULT_EDITS_PATH) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function applyCatalogEdits(normalized, edits) {
  if (!edits) return normalized
  validateEdits(normalized, edits)

  const removalByHandle = new Map((edits.removals ?? []).map((r) => [r.handle, r]))
  const statusDefault = edits.statusDefault || 'ACTIVE'

  const products = (normalized.products ?? []).map((original) => {
    const product = { ...original, tags: [...(original.tags ?? [])], variants: original.variants.map((v) => ({ ...v })) }
    const handle = product.handle

    const removal = removalByHandle.get(handle)
    if (removal) {
      product.publicVisible = false
      product.status = removal.shopifyStatus
    } else {
      product.status = statusDefault
    }

    const retitle = edits.retitles?.[handle]
    if (retitle) product.title = retitle

    const productType = edits.productTypes?.[handle]
    if (productType) product.productType = productType

    const restructure = edits.variantRestructures?.[handle]
    if (restructure) {
      product.options = restructure.options.map((o) => ({ name: o.name, values: [...o.values] }))
      product.variants = restructure.variants.map((v) => ({
        sku: v.sku,
        sourceVariantId: null,
        title: v.title ?? Object.values(v.options).join(' / '),
        options: { ...v.options },
        price: v.price,
        sourcePrice: v.price,
        flags: [],
      }))
    }

    for (const variant of product.variants) {
      const overridePrice = edits.priceOverrides?.[variant.sku]
      if (overridePrice !== undefined) {
        variant.price = overridePrice
        variant.flags = (variant.flags ?? []).filter((flag) => flag !== 'low_price_floor_0_98')
      }
    }

    const tagRemovals = edits.tagRemovals?.[handle]
    if (tagRemovals?.length) {
      product.tags = product.tags.filter((tag) => !tagRemovals.includes(tag))
    }

    const note = edits.notes?.[handle]
    if (note) {
      product.notes = [...(note.pdp ?? [])]
      product.cardNote = note.card ?? ''
    }

    const copyOverride = edits.copyOverrides?.[handle]
    if (copyOverride) product.copyOverrides = { ...copyOverride }

    const offerCopy = edits.offerCopy?.[handle]
    if (offerCopy) product.offerCopy = offerCopy

    if ((edits.directBuy ?? []).includes(handle)) product.forceDirectBuy = true

    return product
  })

  return { ...normalized, products, appliedEdits: { version: edits.version, source: edits.source } }
}

export function validateEdits(normalized, edits) {
  const handles = new Set((normalized.products ?? []).map((p) => p.handle))
  const skus = new Set((normalized.products ?? []).flatMap((p) => p.variants.map((v) => v.sku)))
  const problems = []

  const referencedHandles = [
    ...(edits.removals ?? []).map((r) => r.handle),
    ...Object.keys(edits.retitles ?? {}),
    ...Object.keys(edits.productTypes ?? {}),
    ...Object.keys(edits.variantRestructures ?? {}),
    ...Object.keys(edits.tagRemovals ?? {}),
    ...Object.keys(edits.notes ?? {}),
    ...Object.keys(edits.copyOverrides ?? {}),
    ...(edits.directBuy ?? []),
    ...Object.keys(edits.offerCopy ?? {}),
  ]
  for (const handle of referencedHandles) {
    if (!handles.has(handle)) problems.push(`edits reference unknown handle: ${handle}`)
    if (!handle.startsWith('dtfva-')) problems.push(`edits may only touch dtfva- products, got: ${handle}`)
  }

  for (const removal of edits.removals ?? []) {
    if (!['DRAFT', 'ARCHIVED'].includes(removal.shopifyStatus)) {
      problems.push(`removal ${removal.handle}: shopifyStatus must be DRAFT or ARCHIVED`)
    }
  }

  for (const [handle, restructure] of Object.entries(edits.variantRestructures ?? {})) {
    const seen = new Set()
    for (const variant of restructure.variants ?? []) {
      if (!PRICE_RE.test(variant.price)) problems.push(`${handle} ${variant.sku}: bad price ${variant.price}`)
      if (seen.has(variant.sku)) problems.push(`${handle}: duplicate restructure SKU ${variant.sku}`)
      seen.add(variant.sku)
    }
    if (!restructure.options?.length) problems.push(`${handle}: restructure needs options`)
  }

  for (const [sku, price] of Object.entries(edits.priceOverrides ?? {})) {
    if (!PRICE_RE.test(price)) problems.push(`priceOverride ${sku}: bad price ${price}`)
    if (!skus.has(sku)) {
      // SKUs introduced by a restructure are allowed
      const restructured = Object.values(edits.variantRestructures ?? {})
        .some((r) => r.variants.some((v) => v.sku === sku))
      if (!restructured) problems.push(`priceOverride references unknown SKU: ${sku}`)
    }
  }

  if (problems.length) {
    throw new Error(`catalog-edits validation failed:\n- ${problems.join('\n- ')}`)
  }
}

async function main() {
  const write = process.argv.includes('--write')
  const edits = loadEdits()
  if (!edits) throw new Error(`No edits file at ${DEFAULT_EDITS_PATH}`)
  const normalized = JSON.parse(readFileSync(DEFAULT_NORMALIZED_PATH, 'utf8'))
  const patched = applyCatalogEdits(normalized, edits)

  const removed = patched.products.filter((p) => p.publicVisible === false).length
  console.log(`✓ catalog-edits ${edits.version} valid — ${patched.products.length} products, ${removed} removed from storefront`)

  if (write) {
    const { exportNormalizedCatalog } = await import('./export.js')
    const shopifyCatalog = exportNormalizedCatalog(patched)
    writeFileSync(DEFAULT_SHOPIFY_CATALOG_PATH, JSON.stringify(shopifyCatalog, null, 2))
    console.log(`✓ Rewrote ${DEFAULT_SHOPIFY_CATALOG_PATH} (statuses/prices/titles now match the offer sheet)`)
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isCli) {
  main().catch((error) => {
    console.error(`✗ ${error.message}`)
    process.exit(1)
  })
}
