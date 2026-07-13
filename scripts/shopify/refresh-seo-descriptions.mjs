#!/usr/bin/env node
// Force-refresh Shopify SEO descriptions from the current generated catalog copy.
// bulk-media-seo.mjs is idempotent (skips products that already have SEO), so after
// a copy rewrite the admin-side SEO goes stale — this script overwrites descriptions
// for ACTIVE dtfva products whose catalog copy changed. Dry-run by default; --execute
// to write. Title is left alone.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createShopifyClient } from './lib/shopify-client.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const execute = process.argv.includes('--execute')
const catalog = JSON.parse(readFileSync(join(ROOT, 'deliverables', 'prototype', 'catalog.json'), 'utf8'))
const copyByHandle = new Map(catalog.products.map((p) => [p.handle, p.copy?.shortDescription || '']))

const client = await createShopifyClient()
const QUERY = `query Products($cursor: String) {
  products(first: 100, after: $cursor, query: "status:ACTIVE") {
    pageInfo { hasNextPage endCursor }
    nodes { id handle seo { title description } }
  }
}`
const SET_SEO = `mutation SetSeo($input: ProductInput!) {
  productUpdate(input: $input) { product { id } userErrors { field message } }
}`

let cursor = null
let planned = 0
let updated = 0
while (true) {
  const data = await client.gql(QUERY, { cursor })
  for (const product of data.products.nodes) {
    if (!product.handle.startsWith('dtfva-')) continue
    const fresh = (copyByHandle.get(product.handle) || '').slice(0, 320)
    if (!fresh || fresh === product.seo?.description) continue
    planned += 1
    console.log(`${execute ? 'set ' : 'plan'} ${product.handle}`)
    if (execute) {
      await client.mutate('productUpdate', SET_SEO, { input: { id: product.id, seo: { title: product.seo?.title || undefined, description: fresh } } })
      updated += 1
    }
  }
  if (!data.products.pageInfo.hasNextPage) break
  cursor = data.products.pageInfo.endCursor
}
console.log(`\n${execute ? `updated=${updated}` : `planned=${planned} (dry run — pass --execute)`}`)
