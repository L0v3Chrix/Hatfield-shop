#!/usr/bin/env node
// Derive the Kixxl builder deep-link map (length -> variant id + price) from the
// live-state audit export. Output feeds the /gang-sheet-builder page and the
// custom-gang-sheet PDP so buyers pick a fixed sheet size BEFORE the builder opens.
//
//   node scripts/shopify/derive-kixxl-builders.mjs            # write data file
//   node scripts/shopify/derive-kixxl-builders.mjs --check    # verify only

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const STATE = resolve('output/shopify-audit/state-report.json')
// Canonical location — production-readiness.mjs copies this into
// production-site/data/ on every build (the build wipes that directory).
const OUT = resolve('scripts/shopify/config/kixxl-builders.json')
const STORE = 'zm1evm-rd.myshopify.com'
const SHOP_DOMAIN = 'hatfield-mccoy-dtf.myshopify.com'

const FAMILIES = [
  {
    key: 'dtf-22', label: '22" DTF', handle: 'dtf-22-gang-sheet-builder',
    skuPattern: /^DTF-22-(\d+)-B$/, sheetProduct: '/products/dtf-22-sheet', widthInches: 22,
  },
  {
    key: 'dtf-46', label: '46" DTF', handle: 'dtf-46-gang-sheet-builder',
    skuPattern: /^DTF-46-(\d+)-B$/, sheetProduct: '/products/dtf-46-sheet', widthInches: 46,
  },
  {
    key: 'glitter-22', label: '22" Glitter DTF', handle: 'glitter-dtf-22-gang-sheet-builder',
    skuPattern: /^GLT-22-(\d+)-(SIL|GLD|MLT)-B$/, sheetProduct: '/products/glitter-dtf-22-sheet', widthInches: 22,
    colors: { SIL: 'Silver', GLD: 'Gold', MLT: 'Multi' },
  },
  {
    key: 'glow-22', label: '22" Glow DTF', handle: 'glow-dtf-22-gang-sheet-builder',
    skuPattern: /^GID-22-(\d+)-B$/, sheetProduct: '/products/glow-dtf-22-sheet', widthInches: 22,
  },
  {
    key: 'sublimation-24', label: '24" Sublimation', handle: 'sublimation-24-gang-sheet-builder',
    skuPattern: /^SUB-24-(\d+)-B$/, sheetProduct: '/products/sublimation-24', widthInches: 24,
  },
]

const state = JSON.parse(readFileSync(STATE, 'utf8'))
const products = (Array.isArray(state.products) && state.products)
  || Object.values(state).find(Array.isArray)

const numericId = (gid) => String(gid).split('/').pop()

const map = { _meta: { source: 'output/shopify-audit/state-report.json', store: STORE, shopDomain: SHOP_DOMAIN, derived: '2026-07-16' } }
const problems = []

for (const family of FAMILIES) {
  const product = products.find((p) => p.handle === family.handle)
  if (!product) { problems.push(`missing product ${family.handle}`); continue }
  if (product.status !== 'ACTIVE') problems.push(`${family.handle} status ${product.status} (expected ACTIVE)`)
  const sizes = []
  for (const variant of product.variants || []) {
    const match = family.skuPattern.exec(variant.sku || '')
    if (!match) { problems.push(`${family.handle}: unmatched SKU ${variant.sku}`); continue }
    const length = Number(match[1])
    const entry = {
      length,
      label: `${family.widthInches}" x ${length}"`,
      sku: variant.sku,
      variant: numericId(variant.id),
      price: variant.price,
    }
    if (family.colors) entry.color = family.colors[match[2]]
    sizes.push(entry)
  }
  sizes.sort((a, b) => a.length - b.length || String(a.color).localeCompare(String(b.color)))
  if (!sizes.length) problems.push(`${family.handle}: no variants matched`)
  map[family.key] = {
    label: family.label,
    handle: family.handle,
    product: numericId(product.id),
    sheetProduct: family.sheetProduct,
    widthInches: family.widthInches,
    hasColors: Boolean(family.colors),
    sizes,
  }
}

// Cross-check: every builder price must be flat-sheet ladder + $0.60.
const ladders = {
  'dtf-22': { 24: 12, 36: 18, 48: 24, 60: 30, 72: 36, 84: 42, 96: 48, 108: 54, 120: 60, 132: 66, 144: 72, 156: 78, 168: 84, 180: 90, 192: 96, 300: 150 },
  'dtf-46': { 12: 12, 24: 24, 36: 36, 48: 48, 60: 60, 72: 72, 80: 80, 84: 84, 96: 96, 108: 108, 120: 120, 132: 132, 144: 144, 156: 156, 168: 168, 180: 180, 192: 192, 204: 204, 216: 216, 228: 228, 240: 240 },
  'glitter-22': { 24: 12, 36: 18, 48: 24, 60: 30, 72: 36, 84: 42, 96: 48, 108: 54, 120: 60, 132: 66, 144: 72, 156: 78, 168: 84, 180: 90, 192: 96, 300: 150 },
  'glow-22': { 24: 18, 36: 27, 48: 36, 60: 45, 72: 54, 84: 63, 96: 72, 108: 81, 120: 90, 132: 99, 144: 108, 156: 117, 168: 126, 180: 135, 192: 144, 300: 225 },
  'sublimation-24': { 24: 8.5, 36: 12.75, 48: 17, 60: 21.25, 72: 26, 84: 31, 96: 34 },
}
for (const [key, ladder] of Object.entries(ladders)) {
  for (const size of map[key]?.sizes || []) {
    const expected = (ladder[size.length] + 0.6).toFixed(2)
    if (size.price !== expected) problems.push(`${key} ${size.sku}: price ${size.price}, expected ${expected}`)
  }
  const expectedLengths = Object.keys(ladder).length * (map[key]?.hasColors ? 3 : 1)
  if ((map[key]?.sizes || []).length !== expectedLengths) {
    problems.push(`${key}: ${(map[key]?.sizes || []).length} sizes, expected ${expectedLengths}`)
  }
}

if (problems.length) {
  console.error('PROBLEMS:')
  for (const p of problems) console.error(' -', p)
  process.exit(1)
}

if (!process.argv.includes('--check')) {
  writeFileSync(OUT, `${JSON.stringify(map, null, 2)}\n`)
  console.log('wrote', OUT)
}
for (const family of FAMILIES) {
  console.log(`${family.key}: ${map[family.key].sizes.length} sizes, product ${map[family.key].product}`)
}
