#!/usr/bin/env node
// Shopify catalog seeder — main orchestrator.
//
// Usage:
//   node scripts/shopify/create-catalog.js [--dry-run] [--update] [--probe]
//                                          [--products-only] [--collections-only] [--verbose]
//
// Env (loaded from .env at project root):
//   SHOPIFY_SHOP_DOMAIN            e.g. hatfield-mccoy-dtf.myshopify.com
//   Auth — ONE of:
//     (A) SHOPIFY_ADMIN_ACCESS_TOKEN   static shpat_ token (admin-created Custom App)
//     (B) SHOPIFY_ADMIN_CLIENT_ID
//         SHOPIFY_ADMIN_CLIENT_SECRET  Dev Dashboard app — exchanged via client_credentials
//   SHOPIFY_API_VERSION            optional, defaults to 2026-07

import 'dotenv/config'
import { createClient, ShopifyError } from './lib/shopify-client.js'
import { createReport } from './lib/reporter.js'
import {
  getProductByHandle,
  createProductWithVariants,
  reconcileProduct,
} from './lib/products.js'
import {
  getCollectionByHandle,
  createCollection,
  ensureCollectionMembers,
} from './lib/collections.js'
import { PRODUCTS, COLLECTIONS, validateCatalog, totalVariantCount } from './config/catalog.js'

function parseFlags(argv) {
  const flags = {
    dryRun: false,
    update: false,
    probe: false,
    productsOnly: false,
    collectionsOnly: false,
    verbose: false,
  }
  for (const arg of argv.slice(2)) {
    switch (arg) {
      case '--dry-run': flags.dryRun = true; break
      case '--update': flags.update = true; break
      case '--probe': flags.probe = true; break
      case '--products-only': flags.productsOnly = true; break
      case '--collections-only': flags.collectionsOnly = true; break
      case '--verbose':
      case '-v': flags.verbose = true; break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
        break
      default:
        console.error(`Unknown flag: ${arg}`)
        printHelp()
        process.exit(2)
    }
  }
  return flags
}

function printHelp() {
  console.log(`Shopify catalog seeder
Usage:
  node scripts/shopify/create-catalog.js [flags]

Flags:
  --probe              Run auth probe only (no mutations, no catalog load)
  --dry-run            Report what would change without mutating
  --update             Allow updates to existing products (off by default)
  --products-only      Skip collection mutations
  --collections-only   Skip product mutations (assumes products already exist)
  --verbose, -v        Log raw GraphQL activity

Environment:
  Reads .env at project root. See .env.example for required variables.`)
}

async function main() {
  const flags = parseFlags(process.argv)
  const startedAt = new Date().toISOString()

  // Validate env
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-07'

  if (!shopDomain) {
    console.error('✗ Missing SHOPIFY_SHOP_DOMAIN. Copy .env.example to .env and fill it in.')
    process.exit(1)
  }
  const hasStatic = !!accessToken
  const hasClientCreds = !!(clientId && clientSecret)
  if (!hasStatic && !hasClientCreds) {
    console.error('✗ Missing auth. Set EITHER:')
    console.error('    SHOPIFY_ADMIN_ACCESS_TOKEN  (static shpat_ token)')
    console.error('  OR')
    console.error('    SHOPIFY_ADMIN_CLIENT_ID')
    console.error('    SHOPIFY_ADMIN_CLIENT_SECRET  (Dev Dashboard app — exchanged via client_credentials)')
    process.exit(1)
  }

  let client
  try {
    client = await createClient({ shopDomain, accessToken, clientId, clientSecret, apiVersion, verbose: flags.verbose })
  } catch (err) {
    console.error('✗ Failed to initialize Shopify client.')
    if (err instanceof ShopifyError) {
      console.error(`  ${err.message}`)
    } else {
      console.error(`  ${err.stack ?? err.message}`)
    }
    process.exit(1)
  }

  if (client.tokenMeta?.source === 'client_credentials') {
    const ttlH = client.tokenMeta.expiresIn ? Math.round(client.tokenMeta.expiresIn / 3600) : '?'
    const scopeCount = (client.tokenMeta.scope || '').split(',').filter(Boolean).length
    console.log(`✓ Token acquired via client_credentials (ttl=${ttlH}h, ${scopeCount} scopes)`)
  }

  // Always probe
  let shop
  try {
    shop = await client.probe()
    console.log(`✓ Auth OK — shop: "${shop.name}" (${shop.myshopifyDomain}), plan: ${shop.plan?.displayName ?? 'unknown'}`)
  } catch (err) {
    console.error('✗ Auth probe failed.')
    if (err instanceof ShopifyError) {
      console.error(`  ${err.message}`)
      if (err.errors) console.error('  errors:', JSON.stringify(err.errors, null, 2))
    } else {
      console.error(`  ${err.stack ?? err.message}`)
    }
    console.error('\nRecovery:')
    console.error('  1. Confirm SHOPIFY_SHOP_DOMAIN is *.myshopify.com (not the custom .com domain)')
    console.error('  2. For Dev Dashboard apps: confirm app is installed on the store and Admin API scopes are configured (write_products, read_products, write_publications, read_publications)')
    console.error('  3. For static tokens: confirm SHOPIFY_ADMIN_ACCESS_TOKEN starts with shpat_')
    process.exit(1)
  }

  if (flags.probe) {
    console.log('Probe mode — no catalog work attempted.')
    process.exit(0)
  }

  // Validate catalog config
  const validationErrors = validateCatalog()
  if (validationErrors.length) {
    console.error('✗ Catalog config validation failed:')
    for (const e of validationErrors) console.error(`  - ${e}`)
    process.exit(1)
  }
  console.log(`✓ Config valid — ${PRODUCTS.length} products, ${totalVariantCount()} total variants, ${COLLECTIONS.length} collections`)

  if (flags.dryRun) console.log('▸ DRY RUN — no mutations will be executed')
  if (flags.update) console.log('▸ UPDATE mode — existing products may be modified')

  const report = createReport({
    shop: shop.myshopifyDomain,
    apiVersion,
    dryRun: flags.dryRun,
    updateMode: flags.update,
    productsOnly: flags.productsOnly,
    collectionsOnly: flags.collectionsOnly,
    startedAt,
  })

  // Track productId by handle for collection assembly
  const productIdByHandle = {}

  // ───── Products ─────
  if (!flags.collectionsOnly) {
    console.log('\n━━━ Products ━━━')
    for (const product of PRODUCTS) {
      try {
        const existing = await getProductByHandle(client, product.handle)
        let result
        if (!existing) {
          result = await createProductWithVariants(client, product, { dryRun: flags.dryRun, verbose: flags.verbose })
        } else {
          result = await reconcileProduct(client, product, existing, {
            dryRun: flags.dryRun,
            allowUpdate: flags.update,
            verbose: flags.verbose,
          })
        }
        report.addProductResult(result, product)
        productIdByHandle[product.handle] = result.productId ?? existing?.id ?? null

        const badge = result.action === 'created' ? '✓ created'
          : result.action === 'updated' ? '✓ updated'
          : '→ skipped'
        const idStr = (result.productId ?? existing?.id) ?? (result.dryRun ? '(dry-run)' : '—')
        const reasonStr = result.reason ? ` (${result.reason})` : ''
        console.log(`  ${badge} ${product.handle.padEnd(26)} ${idStr}${reasonStr}`)
      } catch (err) {
        const errResult = {
          action: 'error',
          handle: product.handle,
          error: {
            message: err.message,
            userErrors: err.userErrors ?? null,
            errors: err.errors ?? null,
          },
        }
        report.addProductResult(errResult, product)
        console.error(`  ✗ ERROR on ${product.handle}: ${err.message}`)
        if (flags.verbose && err.stack) console.error(err.stack)
      }
    }
  } else {
    console.log('\n(skipping product mutations — --collections-only)')
    // Still need product IDs for collection work
    for (const product of PRODUCTS) {
      try {
        const existing = await getProductByHandle(client, product.handle)
        productIdByHandle[product.handle] = existing?.id ?? null
      } catch (err) {
        report.addError(`lookup:${product.handle}`, err)
      }
    }
  }

  // ───── Collections ─────
  if (!flags.productsOnly) {
    console.log('\n━━━ Collections ━━━')
    for (const collection of COLLECTIONS) {
      try {
        let live = await getCollectionByHandle(client, collection.handle)
        let creationResult = null

        if (!live) {
          creationResult = await createCollection(client, collection, { dryRun: flags.dryRun, verbose: flags.verbose })
          if (!flags.dryRun) {
            // Re-fetch to get id reliably
            live = await getCollectionByHandle(client, collection.handle)
          }
        }

        const collectionId = live?.id ?? creationResult?.collectionId ?? null
        const desiredHandles = collection.members
        const desiredProductIds = desiredHandles.map((h) => productIdByHandle[h]).filter(Boolean)
        const missing = desiredHandles.filter((h) => !productIdByHandle[h])

        let memberSync = { handle: collection.handle, addedCount: 0, alreadyMember: [] }
        if (collectionId && desiredProductIds.length) {
          memberSync = await ensureCollectionMembers(
            client,
            { collectionId, handle: collection.handle, desiredProductIds, desiredHandles: desiredHandles.filter((h) => productIdByHandle[h]) },
            { dryRun: flags.dryRun, verbose: flags.verbose }
          )
        }

        const mergedResult = {
          action: creationResult ? creationResult.action : 'matched',
          collectionId,
          ...memberSync,
          dryRun: flags.dryRun,
        }
        report.addCollectionResult(mergedResult, collection)

        const badge = creationResult?.action === 'created' ? '✓ created' : '→ matched'
        const addedStr = memberSync.addedCount ? ` (+${memberSync.addedCount} products)` : ''
        const missingStr = missing.length ? ` [missing: ${missing.join(', ')}]` : ''
        console.log(`  ${badge} ${collection.handle.padEnd(16)} ${collectionId ?? '(dry-run)'}${addedStr}${missingStr}`)
      } catch (err) {
        report.addCollectionResult({ action: 'error', error: err.message }, collection)
        report.addError(`collection:${collection.handle}`, err)
        console.error(`  ✗ ERROR on collection ${collection.handle}: ${err.message}`)
      }
    }
  } else {
    console.log('\n(skipping collection mutations — --products-only)')
  }

  // ───── Finalize ─────
  const { jsonPath, mdPath, record } = report.finalize()

  console.log('\n━━━ Summary ━━━')
  console.log(`  Created: ${record.summary.created}`)
  console.log(`  Updated: ${record.summary.updated}`)
  console.log(`  Skipped: ${record.summary.skipped}`)
  console.log(`  Errors:  ${record.summary.errors}`)

  if (record.keystone_products.length) {
    console.log('\n━━━ Keystone product IDs ━━━')
    for (const k of record.keystone_products) {
      console.log(`  ${k.title}: ${k.productId ?? '(dry-run)'}`)
    }
  }

  if (record.pricing_anomalies.length) {
    console.log('\n━━━ Pricing anomalies (manual review required) ━━━')
    for (const a of record.pricing_anomalies) {
      console.log(`  ${a.sku} ($${a.price}) — ${a.flag}`)
    }
  }

  console.log(`\nReport: ${mdPath}`)
  console.log(`JSON:   ${jsonPath}`)

  process.exit(record.summary.errors ? 1 : 0)
}

main().catch((err) => {
  console.error('✗ Fatal error:')
  console.error(err.stack ?? err.message)
  process.exit(1)
})
