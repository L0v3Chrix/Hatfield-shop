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
const missingOverrides = overrideEntries.filter(([, img]) => !shopHtml.includes(img.src))
check(
  `shop page renders all ${overrideEntries.length} curated card overrides`,
  missingOverrides.length === 0,
  missingOverrides.map(([h]) => h).join(', ')
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
const unindexed = htmlFiles.filter((f) => !readFileSync(f, 'utf8').includes('noindex'))
check(`noindex present in all ${htmlFiles.length} HTML files`, unindexed.length === 0,
  unindexed.slice(0, 5).map((f) => f.replace(PS, '')).join(', '))

// 4. robots.txt stays closed until the launch gate
const robots = readFileSync(join(PS, 'robots.txt'), 'utf8')
check('robots.txt disallows all crawling', /User-agent: \*\s*\nDisallow: \//.test(robots))

// 5. Builder launch URLs intact with populated params
const builderHtml = readFileSync(join(PS, 'gang-sheet-builder', 'index.html'), 'utf8')
const gangifyUrls = builderHtml.match(/https:\/\/[^"']*apps\/gangify\/builder\?[^"']*/g) ?? []
check('gang-sheet-builder page carries 6 builder launch URLs', gangifyUrls.length === 6,
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

// 6. Readiness report gates
const report = JSON.parse(readFileSync(join(PS, 'readiness-report.json'), 'utf8'))
check('readiness report: 0 automated blockers', report.summary?.blockers === 0,
  `blockers=${report.summary?.blockers}`)
check('readiness report: previewNoindex gate true', report.gates?.previewNoindex === true)

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
