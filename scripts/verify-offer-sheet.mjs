#!/usr/bin/env node
// Offer-sheet conformance gate (owner pricing meeting 2026-07-08).
//
// Asserts the BUILT site matches scripts/competitor/dtfvirginia/
// offer-sheet-2026-07-08.json — an assertion source deliberately authored
// independently of catalog-edits.json, so a mistake in the edits file
// cannot silently become the QA truth. Runs after round-trip integrity in
// qa-gate; requires generated deliverables/prototype + production-site and
// a current output/competitor/dtfvirginia/shopify-state.json.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PS = join(ROOT, 'deliverables', 'production-site')
const OFFER = JSON.parse(readFileSync(join(__dirname, 'competitor', 'dtfvirginia', 'offer-sheet-2026-07-08.json'), 'utf8'))
const EDITS = JSON.parse(readFileSync(join(__dirname, 'competitor', 'dtfvirginia', 'catalog-edits.json'), 'utf8'))
const CATALOG = JSON.parse(readFileSync(join(ROOT, 'deliverables', 'prototype', 'catalog.json'), 'utf8'))
const STATE = JSON.parse(readFileSync(join(ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-state.json'), 'utf8'))

const failures = []
function check(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

const productByHandle = new Map(CATALOG.products.map((p) => [p.handle, p]))
const stateProducts = Array.isArray(STATE.products) ? STATE.products : Object.values(STATE.products ?? {})
const stateVariantBySku = new Map()
const statePriceBySku = new Map()
for (const product of stateProducts) {
  for (const variant of product.variants ?? []) {
    stateVariantBySku.set(variant.sku, variant.variantId)
    if (variant.price !== undefined) statePriceBySku.set(variant.sku, Number(variant.price).toFixed(2))
  }
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
const htmlFiles = walkHtml(PS)

// Q1 — removed handles: no PDP directory, absent from sitemap, no hrefs anywhere
{
  const sitemap = existsSync(join(PS, 'sitemap.xml')) ? readFileSync(join(PS, 'sitemap.xml'), 'utf8') : ''
  const launchSitemap = existsSync(join(PS, 'sitemap.launch-preview.xml')) ? readFileSync(join(PS, 'sitemap.launch-preview.xml'), 'utf8') : ''
  const offenders = []
  for (const handle of OFFER.removedHandles) {
    if (existsSync(join(PS, 'products', handle, 'index.html'))) offenders.push(`${handle}: PDP still built`)
    if (sitemap.includes(`/products/${handle}`) || launchSitemap.includes(`/products/${handle}`)) offenders.push(`${handle}: in sitemap`)
  }
  // href sweep (batch: one pass over all files)
  const needles = OFFER.removedHandles.map((handle) => `href="/products/${handle}"`)
  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf8')
    for (const needle of needles) {
      if (content.includes(needle)) offenders.push(`${needle} referenced in ${file.slice(PS.length)}`)
    }
  }
  check(`removed handles (${OFFER.removedHandles.length}) absent from pages, sitemaps, and links`, offenders.length === 0, offenders.slice(0, 5).join('; '))
}

// Q2/Q3/Q4 — per-product variant counts, prices, buyability, titles
for (const [handle, expect] of Object.entries(OFFER.products)) {
  const product = productByHandle.get(handle)
  if (!product) { check(`${handle} present in built catalog`, false); continue }

  if (expect.variantCount !== undefined) {
    check(`${handle} has ${expect.variantCount} variants`, product.variants.length === expect.variantCount,
      `got ${product.variants.length}`)
  }
  for (const [sku, price] of Object.entries(expect.prices ?? {})) {
    const variant = product.variants.find((v) => v.sku === sku)
    check(`${handle} ${sku} @ $${price}`, !!variant && Number(variant.price).toFixed(2) === price,
      variant ? `got $${variant.price}` : 'SKU missing')
  }
  if (expect.buyable) {
    const enabled = product.variants.filter((v) => v.checkoutEnabled && v.merchandiseId)
    check(`${handle} is buyable (checkout-enabled variants with merchandiseIds)`, enabled.length > 0,
      `publishable=${product.publishable} blockers=${JSON.stringify(product.blockers)}`)
    const pdpPath = join(PS, 'products', handle, 'index.html')
    const pdp = existsSync(pdpPath) ? readFileSync(pdpPath, 'utf8') : ''
    check(`${handle} PDP renders buy buttons`, pdp.includes('data-checkout-ready="true"'))
  }
}
for (const [handle, rule] of Object.entries(OFFER.titles ?? {})) {
  const product = productByHandle.get(handle)
  const title = product?.title ?? ''
  if (rule.mustInclude) check(`${handle} title includes "${rule.mustInclude}"`, title.includes(rule.mustInclude), title)
  if (rule.mustExclude) check(`${handle} title excludes "${rule.mustExclude}"`, !title.includes(rule.mustExclude), title)
}

// Q5 — required notes render on PDPs
for (const [handle, needles] of Object.entries(OFFER.notesRequired ?? {})) {
  const pdpPath = join(PS, 'products', handle, 'index.html')
  const pdp = existsSync(pdpPath) ? readFileSync(pdpPath, 'utf8').toLowerCase() : ''
  for (const needle of needles) {
    check(`${handle} PDP mentions "${needle}"`, pdp.includes(needle.toLowerCase()))
  }
}

// Q5b — offer pricing appears in PDP PROSE (not just the variant selector)
for (const [handle, needles] of Object.entries(OFFER.offerCopyRequired ?? {})) {
  const pdpPath = join(PS, 'products', handle, 'index.html')
  const pdp = existsSync(pdpPath) ? readFileSync(pdpPath, 'utf8') : ''
  const summaryBlocks = pdp.match(/class="offer-summary"[^>]*>([^<]*)</g)?.join(' ') ?? ''
  for (const needle of needles) {
    check(`${handle} offer copy states "${needle}"`, summaryBlocks.includes(needle))
  }
}
// Q5c — every buyable PDP carries an offer-summary prose block
{
  const missing = []
  for (const product of CATALOG.products.filter((p) => p.publicVisible && p.publishable)) {
    const pdpPath = join(PS, 'products', product.handle, 'index.html')
    if (!existsSync(pdpPath)) continue
    if (!readFileSync(pdpPath, 'utf8').includes('class="offer-summary"')) missing.push(product.handle)
  }
  check('every buyable PDP has offer-summary prose', missing.length === 0, missing.slice(0, 5).join(', '))
}

// Q5e — card/collection images stay light (senior-audit 2026-07-13: a 6.3MB JPG
// was served in a card slot). Every image referenced by the shop + collection
// pages must be under the cap, so a heavy original can never sneak back in.
{
  const MAX_CARD_BYTES = Number(process.env.CARD_IMAGE_MAX_BYTES || 500 * 1024)
  const pages = [join(PS, 'shop', 'index.html'), ...readdirSync(join(PS, 'collections')).filter((f) => f.endsWith('.html')).map((f) => join(PS, 'collections', f))]
  const offenders = []
  const seen = new Set()
  for (const page of pages) {
    if (!existsSync(page)) continue
    const html = readFileSync(page, 'utf8')
    for (const m of html.matchAll(/src="(\/assets\/shopify-images\/[^"]+)"/g)) {
      const rel = m[1]
      if (seen.has(rel)) continue
      seen.add(rel)
      const abs = join(PS, rel)
      if (!existsSync(abs)) continue
      const bytes = statSync(abs).size
      if (bytes > MAX_CARD_BYTES) offenders.push(`${rel} (${Math.round(bytes / 1024)}KB)`)
    }
  }
  check(`card/collection images under ${Math.round(MAX_CARD_BYTES / 1024)}KB`, offenders.length === 0, offenders.slice(0, 4).join(', '))
}

// Q5d — the lazy boilerplate template is banned from product copy (owner, 2026-07-13:
// "rewrite every product with the information that the user needs")
{
  const BOILERPLATE = 'with nationwide shipping, direct checkout, and artwork upload attached to the order'
  const offenders = []
  for (const file of htmlFiles) {
    if (readFileSync(file, 'utf8').includes(BOILERPLATE)) offenders.push(relative(PS, file))
  }
  check('no page uses the retired boilerplate product lede', offenders.length === 0, `${offenders.length} pages, e.g. ${offenders.slice(0, 3).join(', ')}`)
}

// Q6 — every data-merchandise-id in built HTML exists in current shopify-state with matching price
{
  const offenders = []
  const buttonRe = /data-sku="([^"]+)"[^>]*data-price="([^"]+)"[^>]*data-merchandise-id="(gid:[^"]+)"/g
  for (const file of htmlFiles) {
    const content = readFileSync(file, 'utf8')
    for (const match of content.matchAll(buttonRe)) {
      const [, sku, price, gid] = match
      const stateGid = stateVariantBySku.get(sku)
      if (!stateGid) { offenders.push(`${sku}: not in shopify-state`); continue }
      if (stateGid !== gid) offenders.push(`${sku}: page gid ${gid} != state ${stateGid}`)
      const statePrice = statePriceBySku.get(sku)
      if (statePrice && Number(price).toFixed(2) !== statePrice) offenders.push(`${sku}: page $${price} != state $${statePrice}`)
    }
  }
  check('every merchandise-id/price in built HTML matches current shopify-state', offenders.length === 0,
    [...new Set(offenders)].slice(0, 5).join('; '))
}

// Q7 — no duplicate titles among public storefront products
{
  const seen = new Map()
  const dupes = []
  for (const product of CATALOG.products.filter((p) => p.publicVisible)) {
    const key = product.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (seen.has(key)) dupes.push(`${seen.get(key)} <> ${product.handle}`)
    else seen.set(key, product.handle)
  }
  check('no duplicate titles among public products', dupes.length === 0, dupes.join('; '))
}

// Q8 — competitor branding sweep: image filenames + manifest alt text
{
  const offenders = []
  // 'West Virginia' is the shop's own state — only bare 'virginia' (the
  // competitor) counts as competitor branding.
  const brandRe = /(?<!west[ -])virginia|dtf[-_ ]?va(?![a-z])|cadlink/i
  const imgDir = join(PS, 'assets', 'shopify-images')
  if (existsSync(imgDir)) {
    for (const file of readdirSync(imgDir)) {
      if (brandRe.test(file)) offenders.push(`filename: ${file}`)
    }
    const manifestPath = join(imgDir, 'manifest.json')
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const strings = JSON.stringify(manifest).match(/"[^"]+"/g) ?? []
      const hits = strings.filter((value) => brandRe.test(value))
      offenders.push(...hits.slice(0, 3).map((s) => `manifest: ${s}`))
    }
  }
  check('no competitor branding in image filenames/manifest', offenders.length === 0, offenders.slice(0, 5).join('; '))
}

// Q9 — Kixxl protection: edits only touch dtfva-, protected builder handles still wired
{
  const editHandles = [
    ...(EDITS.removals ?? []).map((r) => r.handle),
    ...Object.keys(EDITS.variantRestructures ?? {}),
  ]
  check('catalog edits only touch dtfva- handles', editHandles.every((h) => h.startsWith('dtfva-')))
  const builderPage = readFileSync(join(PS, 'gang-sheet-builder', 'index.html'), 'utf8')
  const missingProtected = OFFER.protectedHandles.filter((handle) => {
    const stateProduct = stateProducts.find((p) => p.handle === handle)
    return !stateProduct
  })
  check('protected builder products present in shopify-state', missingProtected.length === 0, missingProtected.join(', '))
  check('builder page still deep-links to gangify', (builderPage.match(/apps\/gangify\/builder\?variant=/g) ?? []).length >= 5)
}

// Q10 — builder upcharge sentinels vs live state prices
for (const [sku, price] of Object.entries(OFFER.builderUpcharge?.sentinels ?? {})) {
  const statePrice = statePriceBySku.get(sku)
  check(`builder ${sku} @ $${price}`, statePrice === price, `state has $${statePrice ?? 'missing'}`)
}

// Q11 — contact page phone
{
  const contact = readFileSync(join(PS, 'contact', 'index.html'), 'utf8')
  check('contact page shows shop phone', contact.includes(OFFER.contactRequirements.phoneDisplay))
  check('contact page has tel: link', contact.includes(OFFER.contactRequirements.phoneHref))
}

// Q12 — edits <-> offer cross-coverage: every removed handle in the offer sheet is declared in edits
{
  const editRemovals = new Set((EDITS.removals ?? []).map((r) => r.handle))
  const uncovered = OFFER.removedHandles.filter((h) => !editRemovals.has(h))
  check('every offer-sheet removal is declared in catalog-edits', uncovered.length === 0, uncovered.join(', '))
}

console.log(failures.length ? `\nOFFER SHEET FAIL: ${failures.length} check(s) failed` : '\nOFFER SHEET PASS')
process.exit(failures.length ? 1 : 0)
