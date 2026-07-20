#!/usr/bin/env node
// Round-trip integrity checks for the generated production-site tree.
// Run after `npm run production:prepare`. Exits 1 on any failure.
//
// Covers what production-readiness.mjs --verify-only does not:
//   - curated HANDLE_IMAGE_OVERRIDES actually render on the shop page
//   - prototype ↔ production-site JS engine parity (the 9d2b1e9 revert class of bug)
//   - local /assets/ paths referenced from JS strings exist on disk
//   - noindex on every generated HTML file, robots.txt disallow, gangify URL params

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HANDLE_IMAGE_OVERRIDES } from './competitor/dtfvirginia/asset-map.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PS = join(ROOT, 'deliverables', 'production-site')
const PROTO_JS = join(ROOT, 'deliverables', 'prototype', 'assets', 'js')

const failures = []
function check(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

function walkHtml(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walkHtml(full, out)
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

// 1. Curated card overrides render on the shop page
const shopHtml = readFileSync(join(PS, 'shop', 'index.html'), 'utf8')
const overrideEntries = Object.entries(HANDLE_IMAGE_OVERRIDES)
  .filter(([handle]) => existsSync(join(PS, 'products', handle, 'index.html')))
// Grouped members (catalog-edits shopGroups, owner consolidation 2026-07-15)
// render inside ONE group card — their curated card image intentionally does
// not appear on /shop. They still must match on their own PDP (checked below).
const EDITS_FOR_GROUPS = JSON.parse(readFileSync(join(ROOT, 'scripts', 'competitor', 'dtfvirginia', 'catalog-edits.json'), 'utf8'))
const groupedShopHandles = new Set((EDITS_FOR_GROUPS.shopGroups ?? []).flatMap((group) => group.members))
const shopCardEntries = overrideEntries.filter(([handle]) => !groupedShopHandles.has(handle))
const missingOverrides = shopCardEntries.filter(([, img]) => !shopHtml.includes(img.src))
check(
  `shop page renders all ${shopCardEntries.length} curated card overrides (non-grouped)`,
  missingOverrides.length === 0,
  missingOverrides.map(([h]) => h).join(', ')
)

// Card and PDP hero must show the same curated image (owner QA, 2026-07-08).
// Only check overrides whose PDP is actually built (removed products have no PDP).
const heroMismatches = overrideEntries.filter(([handle, img]) => {
  const pdpPath = join(PS, 'products', handle, 'index.html')
  if (!existsSync(pdpPath)) return false
  return !readFileSync(pdpPath, 'utf8').includes(img.src)
})
check(
  'curated override image appears on each product\'s own PDP (card == hero)',
  heroMismatches.length === 0,
  heroMismatches.map(([h]) => h).join(', ')
)

// 2. JS engine parity: prototype is the source of truth, production must match
for (const file of ['cart.js', 'cart-helpers.js']) {
  const proto = readFileSync(join(PROTO_JS, file))
  const prod = readFileSync(join(PS, 'assets', 'js', file))
  check(`assets/js/${file} matches prototype (${proto.length} bytes)`, proto.equals(prod),
    `prototype ${proto.length}B vs production ${prod.length}B`)
}

// 3. Every generated HTML file carries noindex
const htmlFiles = walkHtml(PS)
const LAUNCHED = process.env.HM_LAUNCHED === '1'
const unindexed = htmlFiles.filter((f) => !readFileSync(f, 'utf8').includes('noindex'))
if (!LAUNCHED) check(`noindex present in all ${htmlFiles.length} HTML files`, unindexed.length === 0,
  unindexed.slice(0, 5).map((f) => f.replace(PS, '')).join(', '))

// 3b. Honest buyer states: no fabricated floor price, no stock claims
const bannedCopy = []
for (const f of htmlFiles) {
  const text = readFileSync(f, 'utf8')
  if (text.includes('From $0.98')) bannedCopy.push({ file: f.replace(PS, ''), term: 'From $0.98' })
  if (/Sold out|Coming soon/.test(text)) bannedCopy.push({ file: f.replace(PS, ''), term: 'Sold out/Coming soon' })
}
check('no fabricated "From $0.98" / "Sold out" / "Coming soon" in built output', bannedCopy.length === 0,
  bannedCopy.slice(0, 5).map((b) => `${b.file} (${b.term})`).join(', '))

// 3c. Builder PDPs never render an add-to-cart path
const builderPdps = htmlFiles.filter((f) =>
  readFileSync(f, 'utf8').includes('class="btn primary feature-cta" href="/gang-sheet-builder"'))
// The cart drawer's checkout button also carries .buy-button on every page;
// only add-to-cart buttons (data-handle) are an offense on builder PDPs.
const builderOffenders = builderPdps.filter((f) => readFileSync(f, 'utf8').includes('class="buy-button" data-handle='))
check(`builder PDPs (${builderPdps.length}) render no buy-button markup`, builderOffenders.length === 0,
  builderOffenders.slice(0, 5).map((f) => f.replace(PS, '')).join(', '))

// 4. robots.txt stays closed until the launch gate
const robots = readFileSync(join(PS, 'robots.txt'), 'utf8')
if (!LAUNCHED) check('robots.txt disallows all crawling', /User-agent: \*\s*\nDisallow: \//.test(robots))
else check('robots.txt allows crawling in launched mode', /User-agent: \*\s*\nAllow: \//.test(robots))

// 5. Builder launch URLs intact with populated params
const builderHtml = readFileSync(join(PS, 'gang-sheet-builder', 'index.html'), 'utf8')
const gangifyUrls = builderHtml.match(/https:\/\/[^"']*apps\/gangify\/builder\?[^"']*/g) ?? []
// One static smallest-size launch URL per family card (the hero CTA now scrolls
// to the size picker instead of deep-linking a size).
check('gang-sheet-builder page carries 5 builder launch URLs', gangifyUrls.length === 5,
  `found ${gangifyUrls.length}`)
const badUrls = gangifyUrls.filter((raw) => {
  const params = new URL(raw.replace(/&amp;/g, '&')).searchParams
  return !/^\d+$/.test(params.get('variant') ?? '') ||
    !/^\d+$/.test(params.get('product') ?? '') ||
    !(parseFloat(params.get('price') ?? '0') > 0) ||
    !(params.get('store') ?? '').endsWith('.myshopify.com')
})
check('every builder URL has numeric variant/product, price>0, store set', badUrls.length === 0,
  badUrls.join(' | '))

// 5b. No gangify URL anywhere in built output may carry missing/blank params,
//     and the builder page's visible prices must match its URL price params
const allGangify = []
for (const f of htmlFiles) {
  const text = readFileSync(f, 'utf8')
  for (const url of text.match(/https:\/\/[^"']*apps\/gangify\/builder\?[^"']*/g) ?? []) {
    allGangify.push({ file: f.replace(PS, ''), url })
  }
}
const configJson = join(PS, 'data', 'config.json')
if (existsSync(configJson)) {
  const text = readFileSync(configJson, 'utf8')
  for (const url of text.match(/https:\/\/[^"\\]*apps\/gangify\/builder\?[^"\\]*/g) ?? []) {
    allGangify.push({ file: '/data/config.json', url })
  }
}
const badAnywhere = allGangify.filter(({ url }) => {
  const params = new URL(url.replace(/&amp;/g, '&')).searchParams
  return !/^\d+$/.test(params.get('variant') ?? '') ||
    !/^\d+$/.test(params.get('product') ?? '') ||
    !(parseFloat(params.get('price') ?? '0') > 0)
})
check(`all ${allGangify.length} gangify URLs site-wide have populated params`, badAnywhere.length === 0,
  badAnywhere.slice(0, 3).map((b) => b.file).join(', '))
const builderPagePrices = new Set(
  (builderHtml.match(/From \$([0-9.]+)/g) ?? []).map((m) => parseFloat(m.replace('From $', '')))
)
const builderUrlPrices = gangifyUrls.map((raw) =>
  parseFloat(new URL(raw.replace(/&amp;/g, '&')).searchParams.get('price'))
)
const priceMismatch = builderUrlPrices.filter((p) => !builderPagePrices.has(p))
check('builder page visible "From $" prices match launch-URL price params', priceMismatch.length === 0,
  `url prices ${[...new Set(builderUrlPrices)].join(',')} vs visible ${[...builderPagePrices].join(',')}`)

// 6. Readiness report gates (internal artifact — lives outside the deploy tree)
const report = JSON.parse(readFileSync(join(ROOT, 'output', 'readiness', 'readiness-report.json'), 'utf8'))
check('readiness report: 0 automated blockers', report.summary?.blockers === 0,
  `blockers=${report.summary?.blockers}`)
check('readiness report: previewNoindex gate matches launch state', report.gates?.previewNoindex === (process.env.HM_LAUNCHED !== '1'))

// 6b. No internal audit artifacts may ship in the deployable tree
const INTERNAL_ARTIFACTS = [
  'readiness-report.json', 'production-readiness-checklist.html',
  'data/pending-confirmations.json', 'shopify-asset-readiness-plan.md',
  'copy-proof-build-brief.md', 'build-now-implementation-brief.md',
]
const shippedInternal = INTERNAL_ARTIFACTS.filter((f) => existsSync(join(PS, f)))
check('no internal audit artifacts in production-site/', shippedInternal.length === 0,
  shippedInternal.join(', '))

// 7. Local asset paths referenced from JS strings + shop img tags exist on disk
const cartJs = readFileSync(join(PS, 'assets', 'js', 'cart.js'), 'utf8')
const assetRefs = new Set([
  ...(cartJs.match(/\/assets\/[A-Za-z0-9/_.-]+\.(?:webp|png|jpe?g|svg)/g) ?? []),
  ...[...shopHtml.matchAll(/<img src="(\/assets\/[^"]+)"/g)].map((m) => m[1]),
])
const missingAssets = [...assetRefs].filter((ref) => !existsSync(join(PS, ref)))
check(`all ${assetRefs.size} locally-referenced assets exist on disk`, missingAssets.length === 0,
  missingAssets.slice(0, 5).join(', '))

console.log(failures.length === 0
  ? `\nROUND-TRIP PASS (${htmlFiles.length} HTML files checked)`
  : `\nROUND-TRIP FAIL: ${failures.length} check(s) failed`)
process.exit(failures.length === 0 ? 0 : 1)
