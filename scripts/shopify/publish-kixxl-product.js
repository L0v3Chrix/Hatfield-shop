#!/usr/bin/env node
// Flips a product DRAFT → ACTIVE and publishes it to the Online Store publication.
// Idempotent. Used for the Custom Gang Sheet product that Kixxl is bound to.
//
// Usage:
//   node scripts/shopify/publish-kixxl-product.js
//   node scripts/shopify/publish-kixxl-product.js --handle custom-gang-sheet
//   node scripts/shopify/publish-kixxl-product.js --dry-run

import 'dotenv/config'
import { createClient } from './lib/shopify-client.js'

const DEFAULT_HANDLE = 'custom-gang-sheet'
const ONLINE_STORE_PUBLICATION_NAME = 'Online Store'

function parseFlags(argv) {
  const flags = { handle: DEFAULT_HANDLE, dryRun: false, verbose: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') flags.dryRun = true
    else if (a === '--verbose' || a === '-v') flags.verbose = true
    else if (a === '--handle') flags.handle = argv[++i]
    else if (a === '--help' || a === '-h') { console.log('--handle <h>  --dry-run  --verbose'); process.exit(0) }
    else { console.error('Unknown flag: ' + a); process.exit(2) }
  }
  return flags
}

const Q_PRODUCT = /* GraphQL */ `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id handle title status
      resourcePublicationsV2(first: 20) {
        edges { node { publication { id name } isPublished } }
      }
    }
  }
`

const Q_PUBLICATIONS = /* GraphQL */ `
  query {
    publications(first: 50) {
      edges { node { id name supportsFuturePublishing } }
    }
  }
`

const M_PRODUCT_UPDATE = /* GraphQL */ `
  mutation ProductUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id handle status }
      userErrors { field message }
    }
  }
`

const M_PUBLISHABLE_PUBLISH = /* GraphQL */ `
  mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable { availablePublicationsCount { count } }
      userErrors { field message }
    }
  }
`

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
  console.log(`✓ Auth OK — ${shop.myshopifyDomain}`)

  // 1. Fetch current product state
  const data = await client.gql(Q_PRODUCT, { handle: flags.handle })
  const p = data.productByHandle
  if (!p) {
    console.error(`✗ Product with handle "${flags.handle}" not found.`)
    process.exit(1)
  }
  console.log(`  product: ${p.id} "${p.title}" — current status: ${p.status}`)

  // 2. Determine what needs changing
  const needsStatusUpdate = p.status !== 'ACTIVE'
  const publishedNames = new Set(
    p.resourcePublicationsV2.edges.filter((e) => e.node.isPublished).map((e) => e.node.publication.name)
  )
  const needsOnlineStorePublish = !publishedNames.has(ONLINE_STORE_PUBLICATION_NAME)

  if (!needsStatusUpdate && !needsOnlineStorePublish) {
    console.log(`→ Already ACTIVE and published to Online Store. Nothing to do.`)
    console.log(`  publications: ${[...publishedNames].join(', ') || '(none)'}`)
    return
  }

  console.log(`  plan:`)
  if (needsStatusUpdate) console.log(`    - flip status: ${p.status} → ACTIVE`)
  if (needsOnlineStorePublish) console.log(`    - publish to: Online Store`)

  if (flags.dryRun) {
    console.log(`\n(dry-run) no mutations executed.`)
    return
  }

  // 3. Update status
  if (needsStatusUpdate) {
    await client.mutate('productUpdate', M_PRODUCT_UPDATE, {
      product: { id: p.id, status: 'ACTIVE' },
    })
    console.log(`  ✓ status: ACTIVE`)
  }

  // 4. Publish to Online Store
  if (needsOnlineStorePublish) {
    const pubsData = await client.gql(Q_PUBLICATIONS)
    const onlineStore = pubsData.publications.edges.find((e) => e.node.name === ONLINE_STORE_PUBLICATION_NAME)
    if (!onlineStore) {
      console.error(`✗ "Online Store" publication not found on this shop.`)
      console.error(`  Available: ${pubsData.publications.edges.map((e) => e.node.name).join(', ')}`)
      process.exit(1)
    }
    await client.mutate('publishablePublish', M_PUBLISHABLE_PUBLISH, {
      id: p.id,
      input: [{ publicationId: onlineStore.node.id }],
    })
    console.log(`  ✓ published to Online Store`)
  }

  // 5. Verify + report
  const after = await client.gql(Q_PRODUCT, { handle: flags.handle })
  const ap = after.productByHandle
  const apPubs = ap.resourcePublicationsV2.edges.filter((e) => e.node.isPublished).map((e) => e.node.publication.name)
  console.log(`\n✓ Done.`)
  console.log(`  status:        ${ap.status}`)
  console.log(`  publications:  ${apPubs.join(', ')}`)
  const shopHost = shop.primaryDomain?.host || shop.myshopifyDomain
  console.log(`  public URL:    https://${shopHost}/products/${ap.handle}`)
  console.log(`  admin URL:     https://admin.shopify.com/store/${shop.myshopifyDomain.replace('.myshopify.com', '')}/products/${ap.id.split('/').pop()}`)
}

main().catch((err) => {
  console.error('✗ Fatal error:')
  console.error(err.stack ?? err.message)
  if (err.userErrors) console.error('userErrors:', JSON.stringify(err.userErrors, null, 2))
  process.exit(1)
})
