#!/usr/bin/env node

import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '../../shopify/lib/shopify-client.js'
import { getProductByHandle } from '../../shopify/lib/products.js'
import { getCollectionByHandle } from '../../shopify/lib/collections.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..')
const DEFAULT_CATALOG_PATH = join(PROJECT_ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-catalog.json')
const DEFAULT_OUTPUT_PATH = join(PROJECT_ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-state.json')

async function main() {
  const flags = parseFlags(process.argv)
  const catalog = JSON.parse(readFileSync(flags.catalogPath || DEFAULT_CATALOG_PATH, 'utf8'))
  const client = await createClient({
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2026-07',
    verbose: flags.verbose,
  })
  const shop = await client.probe()
  const products = []
  const collections = []

  // Core storefront products (defined outside the competitor catalog) are part
  // of the same state so QA can validate every merchandise-id on built pages.
  const CORE_HANDLES = [
    'dtf-22-sheet', 'dtf-46-sheet', 'glitter-dtf-22-sheet', 'glow-dtf-22-sheet', 'sublimation-24',
    'dtf-22-gang-sheet-builder', 'dtf-46-gang-sheet-builder', 'glitter-dtf-22-gang-sheet-builder',
    'glow-dtf-22-gang-sheet-builder', 'sublimation-24-gang-sheet-builder',
  ]
  const sources = [...CORE_HANDLES.map((handle) => ({ handle })), ...(catalog.PRODUCTS ?? [])]
  for (const source of sources) {
    const product = await getProductByHandle(client, source.handle)
    if (!product) {
      products.push({ handle: source.handle, missing: true })
      continue
    }
    products.push({
      handle: product.handle,
      productId: product.id,
      status: product.status,
      variants: (product.variants?.edges ?? []).map((edge) => ({
        sku: edge.node.sku,
        variantId: edge.node.id,
        price: edge.node.price,
        selectedOptions: edge.node.selectedOptions,
      })),
    })
  }

  for (const source of catalog.COLLECTIONS ?? []) {
    const collection = await getCollectionByHandle(client, source.handle)
    collections.push({
      handle: source.handle,
      collectionId: collection?.id ?? '',
      missing: !collection,
    })
  }

  const state = {
    meta: {
      generated_at: new Date().toISOString(),
      shop: shop.myshopifyDomain,
      product_count: products.length,
      collection_count: collections.length,
      missing_products: products.filter((product) => product.missing).length,
      missing_collections: collections.filter((collection) => collection.missing).length,
    },
    products,
    collections,
  }

  const outputPath = flags.outputPath || DEFAULT_OUTPUT_PATH
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(state, null, 2))
  console.log(`✓ Wrote Shopify state to ${outputPath}`)
  console.log(`Products: ${state.meta.product_count} (${state.meta.missing_products} missing)`)
  console.log(`Collections: ${state.meta.collection_count} (${state.meta.missing_collections} missing)`)
}

function parseFlags(argv) {
  const flags = { catalogPath: '', outputPath: '', verbose: false }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--catalog':
        flags.catalogPath = readValue(argv, ++i, arg)
        break
      case '--out':
        flags.outputPath = readValue(argv, ++i, arg)
        break
      case '--verbose':
      case '-v':
        flags.verbose = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
        break
      default:
        throw new Error(`Unknown flag: ${arg}`)
    }
  }
  return flags
}

function readValue(argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
  return value
}

function printHelp() {
  console.log(`Export Shopify IDs for DTF Virginia parity drafts

Usage:
  node scripts/competitor/dtfvirginia/export-shopify-state.js [flags]

Flags:
  --catalog <path>  Shopify catalog JSON
  --out <path>      Output state JSON
  --verbose         Log GraphQL activity`)
}

main().catch((error) => {
  console.error(`✗ ${error.message}`)
  if (process.env.DEBUG) console.error(error.stack)
  process.exit(1)
})
