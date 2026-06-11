#!/usr/bin/env node
// Read-only Shopify Admin state audit. Dumps products/variants/publications/media/
// collections/webhooks into output/shopify-audit/state-report.json and prints a
// rollup. Never mutates. Never writes tokens. Sections that fail on missing scopes
// are recorded in sectionErrors instead of aborting the run.
//
// Usage: npm run shopify:audit   (requires .env with SHOPIFY_SHOP_DOMAIN + auth)

import 'dotenv/config'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from './lib/shopify-client.js'
import { PRODUCTS as CONFIG_PRODUCTS, COLLECTIONS as CONFIG_COLLECTIONS } from './config/catalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const OUT_DIR = join(ROOT, 'output', 'shopify-audit')
const STATE_JSON = join(ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-state.json')

const sectionErrors = []
async function section(name, fn, fallback = null) {
  try {
    return await fn()
  } catch (err) {
    sectionErrors.push({ section: name, message: err.message })
    console.error(`  ✗ ${name}: ${err.message.split('\n')[0]}`)
    return fallback
  }
}

const client = await createClient({
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
  accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || undefined,
  clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
})

console.error(`Auditing ${client.shopDomain} (auth: ${client.tokenMeta.source}) — read-only`)

const shop = await section('shop probe', () => client.probe())

const publications = await section('publications list', async () => {
  const data = await client.gql(`{ publications(first: 10) { nodes { id name } } }`)
  return data.publications.nodes
}, [])

const products = await section('products dump', async () => {
  const all = []
  let cursor = null
  do {
    const data = await client.gql(
      `query($cursor: String) {
        products(first: 25, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id handle title status vendor productType tags
            seo { title description }
            mediaCount { count }
            variantsCount { count }
            variants(first: 100) { nodes { id sku price } }
            collections(first: 20) { nodes { handle title } }
            resourcePublications(first: 10) { nodes { publication { id name } isPublished } }
          }
        }
      }`,
      { cursor }
    )
    const page = data.products
    for (const p of page.nodes) {
      all.push({
        id: p.id,
        handle: p.handle,
        title: p.title,
        status: p.status,
        vendor: p.vendor,
        productType: p.productType,
        tags: p.tags,
        seo: p.seo,
        mediaCount: p.mediaCount?.count ?? null,
        variantsCount: p.variantsCount?.count ?? null,
        variants: p.variants.nodes.map((v) => ({ id: v.id, sku: v.sku, price: v.price })),
        variantsTruncated: (p.variantsCount?.count ?? 0) > p.variants.nodes.length,
        collections: p.collections.nodes.map((c) => c.handle),
        publications: p.resourcePublications?.nodes
          ?.filter((r) => r.isPublished)
          .map((r) => r.publication.name) ?? [],
      })
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
  } while (cursor)
  return all
}, [])

const collections = await section('collections dump', async () => {
  const all = []
  let cursor = null
  do {
    const data = await client.gql(
      `query($cursor: String) {
        collections(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { id handle title productsCount { count } image { url } }
        }
      }`,
      { cursor }
    )
    for (const c of data.collections.nodes) {
      all.push({
        id: c.id,
        handle: c.handle,
        title: c.title,
        productsCount: c.productsCount?.count ?? null,
        hasImage: Boolean(c.image?.url),
      })
    }
    cursor = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null
  } while (cursor)
  return all
}, [])

const webhooks = await section('webhook subscriptions', async () => {
  const data = await client.gql(
    `{ webhookSubscriptions(first: 25) { nodes {
        id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } }
    } } }`
  )
  return data.webhookSubscriptions.nodes.map((w) => ({
    topic: w.topic,
    endpoint: w.endpoint?.callbackUrl ?? w.endpoint?.__typename ?? null,
  }))
}, [])

// ---------- Analysis (pure, local) ----------
const skuMap = new Map()
for (const p of products) {
  for (const v of p.variants) {
    if (!v.sku) continue
    if (!skuMap.has(v.sku)) skuMap.set(v.sku, [])
    skuMap.get(v.sku).push(p.handle)
  }
}
const duplicateSkus = [...skuMap.entries()]
  .filter(([, handles]) => handles.length > 1)
  .map(([sku, handles]) => ({ sku, handles: [...new Set(handles)], count: handles.length }))

const active = products.filter((p) => p.status === 'ACTIVE')
const zeroMedia = active.filter((p) => (p.mediaCount ?? 0) === 0)
const activeZeroPriced = active.filter((p) =>
  p.variants.some((v) => !(parseFloat(v.price) > 0))
)
const missingSeo = active.filter((p) => !p.seo?.title || !p.seo?.description)

const liveHandles = new Set(products.map((p) => p.handle))
const configHandles = CONFIG_PRODUCTS.map((p) => p.handle)
const configMissingLive = configHandles.filter((h) => !liveHandles.has(h))
const configCollectionHandles = CONFIG_COLLECTIONS.map((c) => c.handle)
const liveCollectionHandles = new Set(collections.map((c) => c.handle))
const configCollectionsMissingLive = configCollectionHandles.filter((h) => !liveCollectionHandles.has(h))

let parityState = null
if (existsSync(STATE_JSON)) {
  const parity = JSON.parse(readFileSync(STATE_JSON, 'utf8'))
  const parityHandles = Object.keys(parity.products ?? parity ?? {})
  parityState = {
    file: 'output/competitor/dtfvirginia/shopify-state.json',
    handleCount: parityHandles.length,
    missingLive: parityHandles.filter((h) => !liveHandles.has(h)).length,
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  shop: shop ? { name: shop.name, domain: shop.myshopifyDomain, plan: shop.plan?.displayName } : null,
  auth: { source: client.tokenMeta.source, apiVersion: client.apiVersion },
  counts: {
    products: products.length,
    byStatus: products.reduce((acc, p) => ((acc[p.status] = (acc[p.status] ?? 0) + 1), acc), {}),
    collections: collections.length,
    publications: publications.map((p) => p.name),
    webhooks: webhooks.length,
  },
  analysis: {
    duplicateSkus,
    activeZeroMedia: zeroMedia.map((p) => p.handle),
    activeZeroPriced: activeZeroPriced.map((p) => ({
      handle: p.handle,
      publications: p.publications,
    })),
    activeMissingSeo: missingSeo.map((p) => p.handle),
    configProductsMissingLive: configMissingLive,
    configCollectionsMissingLive,
    collectionsWithoutImage: collections.filter((c) => !c.hasImage).map((c) => c.handle),
    parityState,
  },
  webhooks,
  products,
  collections,
  sectionErrors,
}

mkdirSync(OUT_DIR, { recursive: true })
const outPath = join(OUT_DIR, 'state-report.json')
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n')

console.log(`\nShop: ${report.shop?.name ?? '(probe failed)'} [${report.shop?.plan ?? '?'}]`)
console.log(`Products: ${products.length} ${JSON.stringify(report.counts.byStatus)}`)
console.log(`Collections: ${collections.length} (${report.analysis.collectionsWithoutImage.length} without image)`)
console.log(`Publications: ${report.counts.publications.join(', ') || '(none readable)'}`)
console.log(`Webhooks: ${webhooks.length}`)
console.log(`ACTIVE w/ zero media: ${zeroMedia.length}`)
console.log(`ACTIVE w/ a non-positive-price variant: ${activeZeroPriced.length}`)
console.log(`ACTIVE missing SEO title/description: ${missingSeo.length}`)
console.log(`Duplicate SKUs: ${duplicateSkus.length}`)
console.log(`Config launch products missing live: ${configMissingLive.length} ${JSON.stringify(configMissingLive)}`)
console.log(`Section errors: ${sectionErrors.length}${sectionErrors.length ? ' — ' + sectionErrors.map((e) => e.section).join(', ') : ''}`)
console.log(`Report: ${outPath}`)
