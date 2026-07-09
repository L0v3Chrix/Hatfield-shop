#!/usr/bin/env node
// Offer-sheet Shopify executor (2026-07-08 owner meeting).
//
// Applies the parts of catalog-edits.json that the price-sync path
// (import-drafts.js) cannot: product status changes, declarative variant
// restructures (productSet), and the +$0.60 builder upcharge on the five
// Kixxl builder products (priced as flat-sheet SKU + 0.60, so re-runs are
// idempotent).
//
// Dry-run by default. Pass --execute to mutate.

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from './lib/shopify-client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EDITS_PATH = join(__dirname, '..', 'competitor', 'dtfvirginia', 'catalog-edits.json')

const BUILDER_UPCHARGE = 0.60
const BUILDER_HANDLES = [
  'dtf-22-gang-sheet-builder',
  'dtf-46-gang-sheet-builder',
  'glitter-dtf-22-gang-sheet-builder',
  'glow-dtf-22-gang-sheet-builder',
  'sublimation-24-gang-sheet-builder',
]
// Builder SKU -> flat-sheet SKU: strip the trailing -B.
const FLAT_SHEET_HANDLES = ['dtf-22-sheet', 'dtf-46-sheet', 'glitter-dtf-22-sheet', 'glow-dtf-22-sheet', 'sublimation-24']

const execute = process.argv.includes('--execute')
const edits = JSON.parse(readFileSync(EDITS_PATH, 'utf8'))

const client = await createClient({
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
  accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
})
const shop = await client.probe()
console.log(`✓ Auth OK — ${shop.name} (${shop.myshopifyDomain})`)
console.log(execute ? '▸ EXECUTE — Shopify will be mutated' : '▸ DRY RUN — printing planned mutations only')

async function productByHandle(handle) {
  const data = await client.gql(`query($handle: String!) {
    productByHandle(handle: $handle) {
      id handle status
      variants(first: 250) { nodes { id sku price } }
    }
  }`, { handle })
  return data.productByHandle
}

let failures = 0

// ── 1. Status changes for removals ─────────────────────────────────────────
console.log('\n━━━ Removals (status changes) ━━━')
for (const removal of edits.removals ?? []) {
  if (!removal.handle.startsWith('dtfva-')) throw new Error(`refusing non-dtfva removal: ${removal.handle}`)
  const product = await productByHandle(removal.handle)
  if (!product) { console.log(`  MISSING ${removal.handle}`); failures++; continue }
  if (product.status === removal.shopifyStatus) {
    console.log(`  ok      ${removal.handle} already ${removal.shopifyStatus}`)
    continue
  }
  if (!execute) {
    console.log(`  plan    ${removal.handle}: ${product.status} -> ${removal.shopifyStatus}`)
    continue
  }
  const result = await client.mutate('productUpdate', `mutation($input: ProductInput!) {
    productUpdate(input: $input) { product { id status } userErrors { field message } }
  }`, { input: { id: product.id, status: removal.shopifyStatus } })
  console.log(`  set     ${removal.handle} -> ${result.product.status}`)
}

// ── 2. Variant restructures via productSet ─────────────────────────────────
console.log('\n━━━ Variant restructures (productSet) ━━━')
for (const [handle, restructure] of Object.entries(edits.variantRestructures ?? {})) {
  if (!handle.startsWith('dtfva-')) throw new Error(`refusing non-dtfva restructure: ${handle}`)
  const product = await productByHandle(handle)
  if (!product) { console.log(`  MISSING ${handle}`); failures++; continue }

  const wantedSkus = restructure.variants.map((v) => v.sku).sort()
  const currentSkus = product.variants.nodes.map((v) => v.sku).sort()
  if (JSON.stringify(wantedSkus) === JSON.stringify(currentSkus)) {
    console.log(`  ok      ${handle} already restructured (${wantedSkus.length} variants)`)
    continue
  }

  const input = {
    id: product.id,
    productOptions: restructure.options.map((option, index) => ({
      name: option.name,
      position: index + 1,
      values: option.values.map((value) => ({ name: value })),
    })),
    variants: restructure.variants.map((variant) => ({
      optionValues: Object.entries(variant.options).map(([optionName, name]) => ({ optionName, name })),
      price: variant.price,
      sku: variant.sku,
      inventoryPolicy: 'CONTINUE',
    })),
  }

  if (!execute) {
    console.log(`  plan    ${handle}: ${product.variants.nodes.length} variants -> ${restructure.variants.length}`)
    restructure.variants.forEach((v) => console.log(`            ${v.sku} @ $${v.price}`))
    continue
  }

  const result = await client.mutate('productSet', `mutation($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      product { id variants(first: 100) { nodes { id sku price selectedOptions { name value } } } }
      userErrors { field message }
    }
  }`, { input, synchronous: true })
  const after = result.product.variants.nodes
  const afterSkus = after.map((v) => v.sku).sort()
  if (JSON.stringify(afterSkus) !== JSON.stringify(wantedSkus)) {
    console.log(`  FAIL    ${handle}: post-restructure SKUs ${afterSkus.join(',')} != wanted ${wantedSkus.join(',')}`)
    failures++
  } else {
    console.log(`  done    ${handle}: now ${after.length} variants`)
    after.forEach((v) => console.log(`            ${v.sku} @ $${v.price}`))
  }
}

// ── 3. Builder upcharge (+$0.60 over flat sheet, by SKU mapping) ───────────
console.log('\n━━━ Builder upcharge (flat + $0.60) ━━━')
const flatPriceBySku = new Map()
for (const handle of FLAT_SHEET_HANDLES) {
  const product = await productByHandle(handle)
  if (!product) throw new Error(`flat sheet product missing: ${handle}`)
  for (const variant of product.variants.nodes) flatPriceBySku.set(variant.sku, Number(variant.price))
}

for (const handle of BUILDER_HANDLES) {
  const product = await productByHandle(handle)
  if (!product) { console.log(`  MISSING ${handle}`); failures++; continue }
  const updates = []
  for (const variant of product.variants.nodes) {
    const flatSku = variant.sku.replace(/-B$/, '')
    const flatPrice = flatPriceBySku.get(flatSku)
    if (flatPrice === undefined) {
      console.log(`  WARN    ${handle} ${variant.sku}: no flat sheet SKU ${flatSku}; leaving price $${variant.price}`)
      continue
    }
    const target = (flatPrice + BUILDER_UPCHARGE).toFixed(2)
    if (Number(variant.price).toFixed(2) !== target) {
      updates.push({ id: variant.id, sku: variant.sku, from: variant.price, price: target })
    }
  }
  if (!updates.length) { console.log(`  ok      ${handle} already at flat+${BUILDER_UPCHARGE}`); continue }
  if (!execute) {
    console.log(`  plan    ${handle}: ${updates.length} variant price updates`)
    updates.slice(0, 5).forEach((u) => console.log(`            ${u.sku}: $${u.from} -> $${u.price}`))
    if (updates.length > 5) console.log(`            ... +${updates.length - 5} more`)
    continue
  }
  const result = await client.mutate('productVariantsBulkUpdate', `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id sku price }
      userErrors { field message }
    }
  }`, { productId: product.id, variants: updates.map((u) => ({ id: u.id, price: u.price })) })
  console.log(`  done    ${handle}: ${result.productVariants.length} variants updated (e.g. ${result.productVariants[0]?.sku} @ $${result.productVariants[0]?.price})`)
}

console.log(`\n${failures ? `✗ ${failures} failure(s)` : '✓ offer-sheet sync complete'}`)
process.exit(failures ? 1 : 0)
