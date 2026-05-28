#!/usr/bin/env node
// Refresh `deliverables/prototype/data/products.json` from live Shopify state.
//
// Strategy: merge mode.
//   - Reads existing products.json as template (preserves marketing copy)
//   - Refreshes product lists per-collection from Shopify Admin API
//   - Adds sku_suffix to color_options for glitter (enables compound SKU on add-to-cart)
//   - Preserves 3D Printing collection as-is (not in Shopify)
//   - Updates _meta.extracted_at, _meta.source, _meta.sku_count
//
// Usage:
//   node scripts/shopify/export-to-json.js              # update products.json
//   node scripts/shopify/export-to-json.js --dry-run    # print planned changes only
//   node scripts/shopify/export-to-json.js --verbose

import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from './lib/shopify-client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const PRODUCTS_JSON = join(PROJECT_ROOT, 'deliverables/prototype/data/products.json')

// Maps Shopify handle → frontend slug (stable contract; HTML hardcodes the frontend slug)
const HANDLE_TO_SLUG = {
  'dtf-22-sheet': 'dtf-22',
  'dtf-46-sheet': 'dtf-46',
  'glitter-dtf-22-sheet': 'glitter-22',
  'glow-dtf-22-sheet': 'glow-22',
  'sublimation-24': 'sublimation-24',
  'custom-gang-sheet': 'gang-sheet',
}
const SLUG_TO_HANDLE = Object.fromEntries(Object.entries(HANDLE_TO_SLUG).map(([h, s]) => [s, h]))

// Collections preserved untouched (not in Shopify scope)
const PRESERVED_SLUGS = new Set(['3d-print'])

// Width in inches per collection slug — used to build "W x L" size strings.
const WIDTH_BY_SLUG = {
  'dtf-22': 22,
  'dtf-46': 46,
  'glitter-22': 22,
  'glow-22': 22,
  'sublimation-24': 24,
  'gang-sheet': 22,
}

// Product title prefix shown in cart/PDP (matches existing products.json wording)
const NAME_PREFIX_BY_SLUG = {
  'dtf-22': 'DTF',
  'dtf-46': 'DTF',
  'glitter-22': 'Glitter DTF',
  'glow-22': 'Glow DTF',
  'sublimation-24': 'Sublimation',
  'gang-sheet': 'Custom Gang Sheet',
}

function parseFlags(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
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
      descriptionHtml
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

function formatSizeLabel(slug, lengthValue) {
  const width = WIDTH_BY_SLUG[slug]
  if (!width) return String(lengthValue)
  return `${width} x ${lengthValue}`
}

function formatProductName(slug, lengthValue, widthOverride) {
  const prefix = NAME_PREFIX_BY_SLUG[slug]
  const width = widthOverride ?? WIDTH_BY_SLUG[slug]
  if (slug === 'gang-sheet') return `${prefix} 22" wide`
  return `${prefix} ${width}" x ${lengthValue}"`
}

// Build a collection's products array from Shopify variants.
// For single-option products (Length-only) → one entry per variant, SKU matches Shopify.
// For two-option products (Length + Color = glitter) → one entry per length (base SKU), color_options carry suffix map.
function buildProducts(slug, shopifyProduct) {
  const options = shopifyProduct.options
  const variants = shopifyProduct.variants.edges.map((e) => e.node)

  // Detect glitter two-option case
  const hasColorOption = options.some((o) => o.name === 'Color')

  if (hasColorOption) {
    const lengths = options.find((o) => o.name === 'Length').values
    const products = []
    for (const length of lengths) {
      // Find every variant at this length to verify same-price contract
      const matchingVariants = variants.filter((v) => {
        const lv = v.selectedOptions.find((o) => o.name === 'Length')?.value
        return lv === length
      })
      if (!matchingVariants.length) continue

      // Contract check: all colors at the same length must share the same price.
      // If this ever breaks, the frontend's single base-SKU model is no longer valid and
      // we must either (a) emit per-color products or (b) carry color-specific prices.
      const priceSet = new Set(matchingVariants.map((v) => String(v.price)))
      if (priceSet.size > 1) {
        throw new Error(
          `Price mismatch across colors for ${slug} length ${length}: ${[...priceSet].join(', ')}. ` +
          `Update export-to-json.js to emit per-color products.`
        )
      }

      const variant = matchingVariants[0]
      // Base SKU: strip the -{COLOR_CODE} suffix using the KNOWN color codes (not a greedy regex).
      // This avoids accidentally stripping a legitimate 3-letter suffix in the future.
      const knownColorCodes = ['SIL', 'GLD', 'MLT']
      let baseSku = variant.sku
      for (const code of knownColorCodes) {
        if (baseSku.endsWith('-' + code)) {
          baseSku = baseSku.slice(0, -(code.length + 1))
          break
        }
      }
      const storefrontVariantIds = Object.fromEntries(
        matchingVariants.map((mv) => {
          const color = mv.selectedOptions.find((o) => o.name === 'Color')?.value
          const code = codeByColorName(color)
          return [code, mv.id]
        }).filter(([code]) => Boolean(code))
      )
      products.push({
        sku: baseSku,
        name: formatProductName(slug, length),
        size: formatSizeLabel(slug, length),
        price: Number(variant.price),
        currency: 'USD',
        storefront_variant_ids: storefrontVariantIds,
      })
    }
    return products
  }

  // Gang Sheet (single-option, one variant, custom price)
  if (slug === 'gang-sheet') {
    const v = variants[0]
    return [{
      sku: v.sku,
      name: formatProductName(slug),
      size: '22 x custom',
      price_model: 'builder',
      currency: 'USD',
      storefront_variant_id: v.id,
      checkout_enabled: false,
      note: 'Priced via Kixxl builder based on length and art layout.',
    }]
  }

  // Standard single-option (Length)
  return variants.map((v) => {
    const length = v.selectedOptions.find((o) => o.name === 'Length')?.value
      const entry = {
      sku: v.sku,
      name: formatProductName(slug, length),
      size: formatSizeLabel(slug, length),
      price: Number(v.price),
      currency: 'USD',
      storefront_variant_id: v.id,
    }
    // Preserve pricing-anomaly note for Glow 22x300
    if (slug === 'glow-22' && length === '300') {
      entry.note = 'Flagged: likely pricing typo, may be $225. Awaiting Q2 intake confirmation.'
    }
    return entry
  })
}

function codeByColorName(name) {
  const codeByName = { Silver: 'SIL', Gold: 'GLD', Multi: 'MLT' }
  return codeByName[name]
}

function buildColorOptions(shopifyProduct) {
  const colorOpt = shopifyProduct.options.find((o) => o.name === 'Color')
  if (!colorOpt) return null
  return colorOpt.values.map((name) => {
    const sku_suffix = codeByColorName(name)
    if (!sku_suffix) {
      // Hard-fail rather than silently producing compound SKUs that won't match Shopify.
      // If a new color is added (e.g. "Rainbow"), update codeByName here AND in Shopify SKU convention.
      throw new Error(
        `Unknown color option "${name}" — no sku_suffix mapping defined. ` +
        `Update export-to-json.js buildColorOptions() with the color code before re-running.`
      )
    }
    return { name, sku_suffix }
  })
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

async function main() {
  const flags = parseFlags(process.argv)

  if (!existsSync(PRODUCTS_JSON)) {
    console.error(`✗ Cannot find ${PRODUCTS_JSON}`)
    process.exit(1)
  }

  const existing = JSON.parse(readFileSync(PRODUCTS_JSON, 'utf8'))
  const collectionsBySlug = new Map(existing.collections.map((c) => [c.slug, c]))

  const client = await createClient({
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
    accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    verbose: flags.verbose,
  })

  const shop = await client.probe()
  console.log(`Refreshing products.json from ${shop.myshopifyDomain}...\n`)

  // Rebuild collections array preserving original order + marketing copy
  const newCollections = []
  let totalSkus = 0
  const changes = []

  for (const existingCol of existing.collections) {
    const slug = existingCol.slug
    if (PRESERVED_SLUGS.has(slug)) {
      newCollections.push(existingCol)
      totalSkus += (existingCol.products ?? []).length
      console.log(`  → preserved ${slug.padEnd(16)} (${(existingCol.products ?? []).length} products, not in Shopify)`)
      continue
    }

    const handle = SLUG_TO_HANDLE[slug]
    if (!handle) {
      newCollections.push(existingCol)
      console.warn(`  ? unmapped ${slug} — leaving untouched (no Shopify handle mapping)`)
      continue
    }

    const data = await client.gql(Q_PRODUCT, { handle })
    const sp = data.productByHandle
    if (!sp) {
      newCollections.push(existingCol)
      console.warn(`  ! missing  ${slug.padEnd(16)} — Shopify has no product for handle ${handle}`)
      continue
    }

    const nextProducts = buildProducts(slug, sp)
    const nextColorOptions = buildColorOptions(sp)

    const before = existingCol.products ?? []
    const addedSkus = nextProducts.map((p) => p.sku).filter((sku) => !before.some((b) => b.sku === sku))
    const removedSkus = before.map((p) => p.sku).filter((sku) => !nextProducts.some((n) => n.sku === sku))
    const priceChanges = []
    for (const np of nextProducts) {
      const old = before.find((b) => b.sku === np.sku)
      if (old && typeof np.price === 'number' && typeof old.price === 'number' && Number(old.price) !== Number(np.price)) {
        priceChanges.push({ sku: np.sku, from: old.price, to: np.price })
      }
    }

    const priceFrom = nextProducts
      .map((p) => (typeof p.price === 'number' ? p.price : null))
      .filter((v) => v !== null)
      .reduce((min, v) => (min === null || v < min ? v : min), null)

    const rebuilt = {
      ...existingCol,
      // refreshed fields
      size_options_count: nextProducts.length,
      price_from: priceFrom ?? existingCol.price_from ?? null,
      products: nextProducts,
    }
    if (nextColorOptions) {
      rebuilt.color_options = nextColorOptions
    } else if ('color_options' in existingCol) {
      // remove color_options if the product is no longer colored (not expected, but defensive)
      delete rebuilt.color_options
    }

    newCollections.push(rebuilt)
    totalSkus += nextProducts.length

    if (addedSkus.length || removedSkus.length || priceChanges.length) {
      changes.push({ slug, addedSkus, removedSkus, priceChanges })
    }
    console.log(`  ✓ refreshed ${slug.padEnd(16)} ${nextProducts.length} products (Shopify handle ${handle})`)
  }

  // Normalize notes: strip any prior "Refreshed from Shopify..." clause so re-runs are idempotent,
  // then append the stable refresh note (no timestamp in the file — that's what run reports are for).
  const REFRESH_MARKER = /\s*\|\s*Refreshed from Shopify Admin API[^|]*/g
  const priorNotes = (existing._meta?.notes || '').replace(REFRESH_MARKER, '').trim()
  const refreshNote = 'Refreshed from Shopify Admin API. Preserved collection marketing copy; refreshed per-variant SKU/price/size. Glitter uses base SKU with color_options.sku_suffix for compound SKU on add-to-cart.'
  const nextNotes = priorNotes ? `${priorNotes} | ${refreshNote}` : refreshNote

  const updated = {
    _meta: {
      ...existing._meta,
      source: `shopify:${shop.myshopifyDomain}`,
      extracted_at: new Date().toISOString().slice(0, 10),
      sku_count: totalSkus,
      notes: nextNotes,
    },
    collections: newCollections,
  }

  // Report
  console.log('\n━━━ Summary ━━━')
  console.log(`  Total collections: ${newCollections.length}`)
  console.log(`  Total SKUs:        ${totalSkus}`)

  if (changes.length === 0) {
    console.log(`\n✓ No drift detected — products.json already matches Shopify.`)
  } else {
    console.log(`\nChanges:`)
    for (const c of changes) {
      console.log(`  [${c.slug}]`)
      if (c.addedSkus.length) console.log(`    + added SKUs: ${c.addedSkus.join(', ')}`)
      if (c.removedSkus.length) console.log(`    - removed SKUs: ${c.removedSkus.join(', ')}`)
      for (const p of c.priceChanges) console.log(`    ~ price ${p.sku}: ${p.from} → ${p.to}`)
    }
  }

  if (deepEqual(existing, updated)) {
    console.log(`\n✓ File content identical — nothing to write.`)
    return
  }

  if (flags.dryRun) {
    console.log(`\n(dry-run) Would update: ${PRODUCTS_JSON}`)
    return
  }

  writeFileSync(PRODUCTS_JSON, JSON.stringify(updated, null, 2) + '\n')
  console.log(`\n✓ Wrote ${PRODUCTS_JSON}`)
}

main().catch((err) => {
  console.error('✗ Fatal error:')
  console.error(err.stack ?? err.message)
  process.exit(1)
})
