#!/usr/bin/env node
// Deep verification: pulls every product from Shopify and diffs against the spec.
// Flags missing products, extra/missing SKUs, price drift, option drift, status drift.
// Exit code 0 = clean, 1 = drift detected.
//
// Usage:
//   node scripts/shopify/verify-catalog.js
//   node scripts/shopify/verify-catalog.js --verbose

import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from './lib/shopify-client.js'
import { PRODUCTS, COLLECTIONS } from './config/catalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORTS_DIR = join(__dirname, 'reports')

function parseFlags(argv) {
  return {
    verbose: argv.includes('--verbose') || argv.includes('-v'),
  }
}

const Q_PRODUCT = /* GraphQL */ `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      handle
      title
      status
      productType
      vendor
      options { name values }
      variants(first: 250) {
        edges {
          node {
            id
            sku
            price
            selectedOptions { name value }
          }
        }
      }
    }
  }
`

const Q_COLLECTION = /* GraphQL */ `
  query CollectionByHandle($handle: String!) {
    collectionByHandle(handle: $handle) {
      id
      handle
      title
      products(first: 250) { edges { node { handle } } }
    }
  }
`

function variantKeyFromSelected(selected) {
  return selected.map((o) => `${o.name}=${o.value}`).sort().join('|')
}

function variantKeyFromConfig(v) {
  return Object.entries(v.options).map(([k, val]) => `${k}=${val}`).sort().join('|')
}

async function main() {
  const flags = parseFlags(process.argv)

  const client = await createClient({
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
    accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    verbose: flags.verbose,
  })

  const shop = await client.probe()
  const shopName = shop.myshopifyDomain.replace('.myshopify.com', '')
  const adminBase = `https://admin.shopify.com/store/${shopName}`
  console.log(`Verifying "${shop.name}" (${shop.myshopifyDomain}) against spec...\n`)

  const findings = {
    products: [],
    collections: [],
    adminBase,
    shop: shop.myshopifyDomain,
    generated_at: new Date().toISOString(),
    summary: { ok: 0, drift: 0, missing: 0, total: 0 },
  }

  // ─── Products ───
  console.log('━━━ Products ━━━')
  for (const spec of PRODUCTS) {
    findings.summary.total++
    const data = await client.gql(Q_PRODUCT, { handle: spec.handle })
    const live = data.productByHandle

    if (!live) {
      findings.summary.missing++
      findings.products.push({ handle: spec.handle, status: 'missing', issues: ['Product does not exist in Shopify'] })
      console.log(`  ✗ MISSING ${spec.handle}`)
      continue
    }

    const issues = []
    const numericId = live.id.split('/').pop()
    const adminUrl = `${adminBase}/products/${numericId}`

    // Status
    if (live.status !== spec.status) {
      issues.push(`status: live=${live.status}, spec=${spec.status}`)
    }

    // Title, productType, vendor
    if (live.title !== spec.title) issues.push(`title: live="${live.title}", spec="${spec.title}"`)
    if (live.productType !== spec.productType) issues.push(`productType: live="${live.productType}", spec="${spec.productType}"`)
    if (live.vendor !== spec.vendor) issues.push(`vendor: live="${live.vendor}", spec="${spec.vendor}"`)

    // Option names (order matters in Shopify)
    const liveOptNames = live.options.map((o) => o.name)
    const specOptNames = spec.options.map((o) => o.name)
    if (JSON.stringify(liveOptNames) !== JSON.stringify(specOptNames)) {
      issues.push(`option names: live=[${liveOptNames.join(', ')}], spec=[${specOptNames.join(', ')}]`)
    } else {
      // Option values (per option)
      for (let i = 0; i < specOptNames.length; i++) {
        const liveVals = [...live.options[i].values].sort()
        const specVals = [...spec.options[i].values].sort()
        if (JSON.stringify(liveVals) !== JSON.stringify(specVals)) {
          const missing = specVals.filter((v) => !liveVals.includes(v))
          const extra = liveVals.filter((v) => !specVals.includes(v))
          if (missing.length) issues.push(`option "${specOptNames[i]}" missing values: ${missing.join(', ')}`)
          if (extra.length) issues.push(`option "${specOptNames[i]}" extra values: ${extra.join(', ')}`)
        }
      }
    }

    // Variants: compare by SKU, and by option-key
    const liveVariants = live.variants.edges.map((e) => e.node)
    const liveBySku = new Map(liveVariants.map((v) => [v.sku, v]))
    const liveByOptKey = new Map(liveVariants.map((v) => [variantKeyFromSelected(v.selectedOptions), v]))
    const specBySku = new Map(spec.variants.map((v) => [v.sku, v]))

    // Missing from live
    for (const sv of spec.variants) {
      if (!liveBySku.has(sv.sku)) {
        issues.push(`SKU missing in live: ${sv.sku}`)
        continue
      }
      const liveV = liveBySku.get(sv.sku)
      // Price comparison (normalize to Number)
      if (Number(liveV.price) !== Number(sv.price)) {
        issues.push(`price drift on ${sv.sku}: live=$${liveV.price}, spec=$${sv.price}`)
      }
      // Option coverage check
      const specKey = variantKeyFromConfig(sv)
      const liveKey = variantKeyFromSelected(liveV.selectedOptions)
      if (specKey !== liveKey) {
        issues.push(`option drift on ${sv.sku}: live=[${liveKey}], spec=[${specKey}]`)
      }
    }

    // Extras in live (present on store but not in our spec)
    for (const lv of liveVariants) {
      if (!specBySku.has(lv.sku)) {
        issues.push(`extra SKU in live (not in spec): ${lv.sku}`)
      }
    }

    const status = issues.length === 0 ? 'ok' : 'drift'
    if (status === 'ok') findings.summary.ok++
    else findings.summary.drift++

    findings.products.push({
      handle: spec.handle,
      status,
      productId: live.id,
      adminUrl,
      liveVariantCount: liveVariants.length,
      specVariantCount: spec.variants.length,
      issues,
    })

    const badge = status === 'ok' ? '✓ OK     ' : `✗ DRIFT (${issues.length})`
    console.log(`  ${badge} ${spec.handle.padEnd(26)} ${live.variants.edges.length} variants`)
    if (status === 'drift') for (const i of issues) console.log(`    - ${i}`)
  }

  // ─── Collections ───
  console.log('\n━━━ Collections ━━━')
  for (const spec of COLLECTIONS) {
    const data = await client.gql(Q_COLLECTION, { handle: spec.handle })
    const live = data.collectionByHandle

    if (!live) {
      findings.collections.push({ handle: spec.handle, status: 'missing', issues: ['Collection does not exist in Shopify'] })
      console.log(`  ✗ MISSING ${spec.handle}`)
      continue
    }

    const numericId = live.id.split('/').pop()
    const adminUrl = `${adminBase}/collections/${numericId}`
    const liveHandles = live.products.edges.map((e) => e.node.handle)
    const specHandles = spec.members
    const missing = specHandles.filter((h) => !liveHandles.includes(h))
    const extra = liveHandles.filter((h) => !specHandles.includes(h))

    const issues = []
    if (missing.length) issues.push(`missing members: ${missing.join(', ')}`)
    if (extra.length) issues.push(`extra members (left untouched): ${extra.join(', ')}`)

    const status = issues.length === 0 ? 'ok' : 'drift'
    findings.collections.push({
      handle: spec.handle,
      status,
      collectionId: live.id,
      adminUrl,
      liveMembers: liveHandles,
      specMembers: specHandles,
      issues,
    })

    const badge = status === 'ok' ? '✓ OK    ' : `✗ DRIFT (${issues.length})`
    console.log(`  ${badge} ${spec.handle.padEnd(16)} ${liveHandles.length} products`)
    if (status === 'drift') for (const i of issues) console.log(`    - ${i}`)
  }

  // ─── Summary ───
  console.log('\n━━━ Summary ━━━')
  console.log(`  OK:      ${findings.summary.ok}`)
  console.log(`  Drift:   ${findings.summary.drift}`)
  console.log(`  Missing: ${findings.summary.missing}`)

  console.log('\n━━━ Admin URLs ━━━')
  for (const p of findings.products) {
    if (p.adminUrl) console.log(`  ${p.handle.padEnd(26)} ${p.adminUrl}`)
  }

  // Write report
  mkdirSync(REPORTS_DIR, { recursive: true })
  const stamp = findings.generated_at.replace(/[:.]/g, '-')
  const jsonPath = join(REPORTS_DIR, `${stamp}-verify.json`)
  writeFileSync(jsonPath, JSON.stringify(findings, null, 2))
  console.log(`\nReport: ${jsonPath}`)

  const hasIssues = findings.summary.drift > 0 || findings.summary.missing > 0
  process.exit(hasIssues ? 1 : 0)
}

main().catch((err) => {
  console.error('✗ Fatal error:')
  console.error(err.stack ?? err.message)
  process.exit(1)
})
