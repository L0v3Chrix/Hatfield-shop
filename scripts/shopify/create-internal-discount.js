#!/usr/bin/env node
// Creates a 100% off discount code for internal use. Idempotent — re-runs detect
// existing codes by title and skip with a 0 exit.
//
// Usage:
//   node scripts/shopify/create-internal-discount.js
//   node scripts/shopify/create-internal-discount.js --code HMDTF-INTERNAL
//   node scripts/shopify/create-internal-discount.js --dry-run

import 'dotenv/config'
import { createClient } from './lib/shopify-client.js'

const DEFAULT_CODE = 'HMDTF-INTERNAL'
const DEFAULT_TITLE = 'Internal Use — 100% Off (Hatfield McCoy)'

function parseFlags(argv) {
  const flags = { code: DEFAULT_CODE, title: DEFAULT_TITLE, dryRun: false, verbose: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') flags.dryRun = true
    else if (a === '--verbose' || a === '-v') flags.verbose = true
    else if (a === '--code') flags.code = argv[++i]
    else if (a === '--title') flags.title = argv[++i]
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
    else { console.error('Unknown flag: ' + a); process.exit(2) }
  }
  return flags
}

function printHelp() {
  console.log(`Create/verify internal 100% off discount code.
Flags:
  --code <CODE>    Discount code (default: ${DEFAULT_CODE})
  --title <TEXT>   Admin-facing title (default: "${DEFAULT_TITLE}")
  --dry-run        Print planned payload, no mutation
  --verbose, -v    Raw GraphQL logs`)
}

// Find an existing code discount by the CODE string (exact match).
const Q_FIND_BY_CODE = /* GraphQL */ `
  query FindByCode($q: String!) {
    codeDiscountNodes(first: 5, query: $q) {
      edges {
        node {
          id
          codeDiscount {
            __typename
            ... on DiscountCodeBasic {
              title status
              codes(first: 5) { nodes { code } }
              customerGets {
                value { __typename ... on DiscountPercentage { percentage } }
              }
            }
          }
        }
      }
    }
  }
`

const M_CREATE = /* GraphQL */ `
  mutation DiscountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            title status
            codes(first: 1) { nodes { code } }
          }
        }
      }
      userErrors { field message code }
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

  // 1. Check if the code already exists
  const query = `code:${flags.code}`
  const found = await client.gql(Q_FIND_BY_CODE, { q: query })
  const existing = found.codeDiscountNodes.edges.find((e) => {
    const codes = e.node.codeDiscount?.codes?.nodes ?? []
    return codes.some((c) => c.code === flags.code)
  })

  if (existing) {
    const d = existing.node.codeDiscount
    const pct = d.customerGets?.value?.percentage
    const pctStr = pct != null ? `${Math.round(pct * 100)}%` : '(unknown %)'
    console.log('→ already exists (skipping):')
    console.log('   id:    ', existing.node.id)
    console.log('   title: ', d.title)
    console.log('   status:', d.status)
    console.log('   code:  ', flags.code)
    console.log('   value: ', pctStr)
    const numericId = existing.node.id.split('/').pop()
    console.log(`   admin: https://admin.shopify.com/store/${shop.myshopifyDomain.replace('.myshopify.com', '')}/discounts/${numericId}`)
    return
  }

  // 2. Create
  const now = new Date().toISOString()
  const input = {
    title: flags.title,
    code: flags.code,
    startsAt: now,
    customerSelection: { all: true },
    customerGets: {
      items: { all: true },
      value: { percentage: 1.0 },
    },
    appliesOncePerCustomer: false,
  }

  console.log('Creating code discount:')
  console.log('  title:', input.title)
  console.log('  code: ', input.code)
  console.log('  value: 100% off')
  console.log('  scope: all products, all customers')
  console.log('  starts:', input.startsAt)
  console.log('  ends:  (evergreen)')

  if (flags.dryRun) {
    console.log('\n(dry-run) No mutation executed.')
    return
  }

  const res = await client.mutate('discountCodeBasicCreate', M_CREATE, { basicCodeDiscount: input })
  const node = res.codeDiscountNode
  const d = node?.codeDiscount
  const numericId = (node?.id || '').split('/').pop()

  console.log('\n✓ Created:')
  console.log('   id:    ', node?.id)
  console.log('   title: ', d?.title)
  console.log('   status:', d?.status)
  console.log('   code:  ', d?.codes?.nodes?.[0]?.code)
  console.log(`   admin: https://admin.shopify.com/store/${shop.myshopifyDomain.replace('.myshopify.com', '')}/discounts/${numericId}`)
  console.log(`\nUsage: share the URL  ?discount=${flags.code}  appended to any Shopify product URL to auto-apply at checkout.`)
}

main().catch((err) => {
  console.error('✗ Fatal error:')
  console.error(err.stack ?? err.message)
  if (err.userErrors) console.error('userErrors:', JSON.stringify(err.userErrors, null, 2))
  process.exit(1)
})
