#!/usr/bin/env node
// Bulk media + SEO for ACTIVE dtfva products that have neither in Shopify.
//
// The 64 competitor-parity products were created as data-only (price/variant)
// rows — zero media, null SEO — which makes the Shopify admin (and any
// Online-Store surface) look half-finished. This backfills each with the SAME
// curated image the headless site already serves (via asset-map) as a Shopify
// product image, plus an SEO title/description from the generated catalog.
// Jessie's real photos replace these whenever he shoots them.
//
// Idempotent: skips products that already have media (and/or SEO). Dry-run by
// default; --execute to write; --limit N for a canary. Writes an inverse log
// to project-ops for rollback.

import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from './lib/shopify-client.js'
import { resolveProductImages } from '../competitor/dtfvirginia/asset-map.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const CATALOG_PATH = join(ROOT, 'deliverables', 'prototype', 'catalog.json')
const SITE_ORIGIN = (process.env.HM_MEDIA_ORIGIN || 'https://www.hatfieldmccoydtf.com').replace(/\/$/, '')
const LOG_PATH = join(ROOT, '..', '..', 'project-ops', 'bulk-media-seo-log-2026-07-09.json')

const execute = process.argv.includes('--execute')
const limitIdx = process.argv.indexOf('--limit')
const limit = limitIdx > -1 ? Number(process.argv[limitIdx + 1]) : Infinity

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
const catalogByHandle = new Map(catalog.products.map((p) => [p.handle, p]))

const client = await createClient({
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
  clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
})
const shop = await client.probe()
console.log(`✓ Auth OK — ${shop.name}`)
console.log(execute ? '▸ EXECUTE' : '▸ DRY RUN')
console.log(`media origin: ${SITE_ORIGIN}`)

// Pull all products with current media count + SEO
let cursor = null
const products = []
while (true) {
  const d = await client.gql(`query($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id handle title status
        media(first: 1) { nodes { id } }
        seo { title description }
      }
    }
  }`, { cursor })
  products.push(...d.products.nodes)
  if (!d.products.pageInfo.hasNextPage) break
  cursor = d.products.pageInfo.endCursor
}

// Targets: ACTIVE dtfva- products missing media OR missing SEO
const targets = products.filter((p) =>
  p.status === 'ACTIVE' &&
  p.handle.startsWith('dtfva-') &&
  (p.media.nodes.length === 0 || !p.seo?.title || !p.seo?.description)
)
console.log(`targets (ACTIVE dtfva missing media/SEO): ${targets.length}`)

const ADD_MEDIA = `mutation($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media { alt mediaContentType status }
    mediaUserErrors { field message }
  }
}`
const SET_SEO = `mutation($input: ProductInput!) {
  productUpdate(input: $input) { product { id seo { title description } } userErrors { field message } }
}`

const log = []
let mediaAdded = 0, seoSet = 0, skippedMedia = 0, failures = 0, processed = 0

for (const p of targets) {
  if (processed >= limit) break
  processed++
  const cat = catalogByHandle.get(p.handle)
  const img = resolveProductImages({ handle: p.handle, title: p.title, productType: cat?.productType })
  const rel = (img.hero?.src || img.card?.src || '').replace(/^\//, '')
  const imageUrl = rel ? `${SITE_ORIGIN}/${rel}` : ''
  const alt = img.hero?.alt || img.card?.alt || p.title
  const seoTitle = cat?.seo?.title || `${p.title} | Hatfield McCoy DTF`
  const seoDesc = (cat?.copy?.shortDescription || cat?.seo?.description || `${p.title} from Hatfield McCoy DTF, printed in Logan, West Virginia.`).slice(0, 320)

  const needMedia = p.media.nodes.length === 0
  const needSeo = !p.seo?.title || !p.seo?.description
  const entry = { handle: p.handle, id: p.id, mediaAdded: false, seoSet: false, imageUrl }

  if (needMedia && !imageUrl) { console.log(`  WARN ${p.handle}: no resolvable image`); }

  if (!execute) {
    console.log(`  plan ${p.handle}${needMedia && imageUrl ? ` +img(${rel})` : ''}${needSeo ? ' +seo' : ''}`)
    log.push(entry)
    continue
  }

  try {
    if (needMedia && imageUrl) {
      const r = await client.mutate('productCreateMedia', ADD_MEDIA, {
        productId: p.id,
        media: [{ alt, mediaContentType: 'IMAGE', originalSource: imageUrl }],
      })
      const errs = r.mediaUserErrors ?? []
      if (errs.length) { console.log(`  ERR media ${p.handle}: ${JSON.stringify(errs)}`); failures++ }
      else { mediaAdded++; entry.mediaAdded = true }
    } else if (!needMedia) skippedMedia++

    if (needSeo) {
      await client.mutate('productUpdate', SET_SEO, { input: { id: p.id, seo: { title: seoTitle, description: seoDesc } } })
      seoSet++; entry.seoSet = true
    }
    console.log(`  ok   ${p.handle}${entry.mediaAdded ? ' +img' : ''}${entry.seoSet ? ' +seo' : ''}`)
    log.push(entry)
  } catch (err) {
    console.log(`  FAIL ${p.handle}: ${String(err.message).slice(0, 120)}`)
    failures++
  }
}

if (execute) writeFileSync(LOG_PATH, JSON.stringify({ ranAt: shop.myshopifyDomain, mediaAdded, seoSet, entries: log }, null, 2))
console.log(`\nmediaAdded=${mediaAdded} seoSet=${seoSet} skippedMedia=${skippedMedia} failures=${failures} processed=${processed}`)
process.exit(failures ? 1 : 0)
