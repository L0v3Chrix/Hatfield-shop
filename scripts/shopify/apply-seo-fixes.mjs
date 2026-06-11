#!/usr/bin/env node
// Approved B1 fix: fill empty seo.title/seo.description on ACTIVE products with
// honest copy generated from product data. Logs the inverse (previous values)
// to output/shopify-audit/seo-fix-log.json before mutating.
//
// Usage: node scripts/shopify/apply-seo-fixes.mjs [--dry-run]

import 'dotenv/config'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from './lib/shopify-client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const OUT_DIR = join(ROOT, 'output', 'shopify-audit')
const dryRun = process.argv.includes('--dry-run')

const M_SEO_UPDATE = /* GraphQL */ `
  mutation ProductSeoUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id handle seo { title description } }
      userErrors { field message }
    }
  }
`

function truncate(text, max) {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…'
}

function seoFor(product) {
  const isBuilder = /builder/.test(product.handle)
  const title = truncate(`${product.title} | Hatfield McCoy DTF`, 70)
  const description = truncate(
    isBuilder
      ? `Open the gang sheet builder for ${product.title} — set your sheet size, upload artwork, and check out. Printed in Logan, WV.`
      : `Order ${product.title} from Hatfield McCoy DTF. Upload artwork with your order and check out directly. Printed in Logan, WV.`,
    160
  )
  return { title, description }
}

const audit = JSON.parse(readFileSync(join(OUT_DIR, 'state-report.json'), 'utf8'))
const targets = audit.products.filter(
  (p) => p.status === 'ACTIVE' && (!p.seo?.title || !p.seo?.description)
)
if (!targets.length) {
  console.log('All ACTIVE products already carry SEO fields — nothing to do.')
  process.exit(0)
}

console.log(`${dryRun ? '(dry-run) ' : ''}SEO fixes for ${targets.length} ACTIVE product(s):`)
const applied = []
const client = dryRun ? null : await createClient({
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
  accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || undefined,
  clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
})

for (const product of targets) {
  const seo = seoFor(product)
  console.log(`  ${product.handle}\n    title: ${seo.title}\n    desc:  ${seo.description}`)
  if (dryRun) continue
  const payload = await client.mutate('productUpdate', M_SEO_UPDATE, {
    product: { id: product.id, seo },
  })
  applied.push({
    handle: product.handle,
    id: product.id,
    before: product.seo ?? { title: null, description: null },
    after: payload.product.seo,
  })
}

if (!dryRun) {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'seo-fix-log.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    applied,
  }, null, 2) + '\n')
  console.log(`\nApplied ${applied.length}/${targets.length}. Inverse log: output/shopify-audit/seo-fix-log.json`)
}
