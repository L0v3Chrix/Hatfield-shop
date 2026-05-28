#!/usr/bin/env node

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, ShopifyError } from '../../shopify/lib/shopify-client.js'
import {
  getProductByHandle,
  createProductWithVariants,
  reconcileProduct,
  updateProductMetadata,
} from '../../shopify/lib/products.js'
import {
  getCollectionByHandle,
  createCollection,
  ensureCollectionMembers,
} from '../../shopify/lib/collections.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..')
const DEFAULT_CATALOG_PATH = join(PROJECT_ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-catalog.json')

async function main() {
  const flags = parseFlags(process.argv)
  const catalogPath = flags.catalogPath || DEFAULT_CATALOG_PATH
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  const dryRun = !flags.execute

  assertSafeCatalog(catalog)
  const client = await initShopifyClient(flags.verbose)
  const shop = await client.probe()
  console.log(`✓ Auth OK — shop: "${shop.name}" (${shop.myshopifyDomain})`)
  console.log(dryRun ? '▸ DRY RUN — no Shopify mutations will be executed' : '▸ EXECUTE — draft products/collections may be created')

  const productIdByHandle = {}
  let created = 0
  let skipped = 0
  let updated = 0

  console.log('\n━━━ Products ━━━')
  for (const product of catalog.PRODUCTS ?? []) {
    const existing = await getProductByHandle(client, product.handle)
    let result
    if (!existing) {
      result = await createProductWithVariants(client, product, { dryRun, verbose: flags.verbose })
    } else {
      result = await reconcileProduct(client, product, existing, {
        dryRun,
        allowUpdate: flags.update,
        verbose: flags.verbose,
      })
      if (flags.syncMetadata) {
        const metadataResult = await updateProductMetadata(client, product, existing, { dryRun, verbose: flags.verbose })
        if (metadataResult.action === 'updated') result = metadataResult
      }
    }
    productIdByHandle[product.handle] = result.productId ?? existing?.id ?? null
    if (result.action === 'created') created++
    else if (result.action === 'updated') updated++
    else skipped++
    const suffix = result.reason ? ` (${result.reason})` : ''
    console.log(`  ${result.action.padEnd(7)} ${product.handle}${dryRun ? ' (dry-run)' : ''}${suffix}`)
  }

  console.log('\n━━━ Collections ━━━')
  for (const collection of catalog.COLLECTIONS ?? []) {
    const existing = await getCollectionByHandle(client, collection.handle)
    const collectionResult = existing
      ? { action: 'skipped', collectionId: existing.id, handle: collection.handle }
      : await createCollection(client, collection, { dryRun, verbose: flags.verbose })
    console.log(`  ${collectionResult.action.padEnd(7)} ${collection.handle}${dryRun ? ' (dry-run)' : ''}`)

    const members = collection.members ?? []
    if (members.length && (collectionResult.collectionId || existing?.id)) {
      const memberResult = await ensureCollectionMembers(client, {
        collectionId: collectionResult.collectionId ?? existing.id,
        handle: collection.handle,
        desiredHandles: members,
        desiredProductIds: members.map((handle) => productIdByHandle[handle]),
      }, { dryRun, verbose: flags.verbose })
      console.log(`           members: ${memberResult.addedCount} to add, ${memberResult.alreadyMember?.length ?? 0} already present`)
    }
  }

  console.log('\n━━━ Import summary ━━━')
  console.log(`Created: ${created}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log('All imported products remain DRAFT unless edited manually later.')
}

function assertSafeCatalog(catalog) {
  const products = catalog.PRODUCTS ?? []
  if (!products.length) throw new Error('Catalog has no PRODUCTS entries')
  for (const product of products) {
    if (product.vendor !== 'Hatfield McCoy DTF') throw new Error(`Unsafe vendor on ${product.handle}: ${product.vendor}`)
    if (product.status !== 'DRAFT') throw new Error(`Unsafe status on ${product.handle}: ${product.status}`)
    if (!product.tags?.includes('competitor-parity')) throw new Error(`Missing competitor-parity tag on ${product.handle}`)
    if (!product.metafields?.some((field) => field.key === 'source_url')) throw new Error(`Missing source_url metafield on ${product.handle}`)
    if (product.images?.length) throw new Error(`Competitor import must not include publishable image media on ${product.handle}`)
  }
}

async function initShopifyClient(verbose) {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01'

  try {
    return await createClient({ shopDomain, accessToken, clientId, clientSecret, apiVersion, verbose })
  } catch (error) {
    if (error instanceof ShopifyError) throw error
    throw new Error(`Failed to initialize Shopify client: ${error.message}`)
  }
}

function parseFlags(argv) {
  const flags = {
    catalogPath: '',
    execute: false,
    update: false,
    syncMetadata: false,
    verbose: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--catalog':
        flags.catalogPath = readValue(argv, ++i, arg)
        break
      case '--execute':
        flags.execute = true
        break
      case '--update':
        flags.update = true
        break
      case '--sync-metadata':
        flags.syncMetadata = true
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
  console.log(`Import DTF Virginia parity catalog into Shopify drafts

Usage:
  node scripts/competitor/dtfvirginia/import-drafts.js [flags]

Flags:
  --catalog <path>   Shopify catalog JSON to import
  --execute          Mutate Shopify. Omit for dry-run.
  --update           Allow price updates on existing matching handles
  --sync-metadata    Update title, description, tags, status, and approval metafields on existing matching handles
  --verbose          Log GraphQL activity

Default mode is dry-run and safe.`)
}

main().catch((error) => {
  console.error(`✗ ${error.message}`)
  if (process.env.DEBUG) console.error(error.stack)
  process.exit(1)
})
