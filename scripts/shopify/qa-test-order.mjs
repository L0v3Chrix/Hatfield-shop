#!/usr/bin/env node
// QA: create a payment-pending test order with artwork attributes, verify the
// ORDERS_CREATE artwork webhook attached the fulfillment metafield, then cancel.
//
// Usage: node scripts/shopify/qa-test-order.mjs [--keep] [--artwork-url <url>]
import 'dotenv/config'
import { createClient } from './lib/shopify-client.js'

const KEEP = process.argv.includes('--keep')
const urlFlagIndex = process.argv.indexOf('--artwork-url')
const ARTWORK_URL = urlFlagIndex > -1
  ? process.argv[urlFlagIndex + 1]
  : 'https://cdn.shopify.com/s/files/1/0719/9699/7814/files/hm-test-artwork_a908f331-54a2-46d5-8874-7ca317712bee.png?v=1783455121'
const VARIANT_GID = 'gid://shopify/ProductVariant/45063581860022' // DTF-22-24 ($12)

const client = await createClient({
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
  accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 1. Draft order with artwork attributes exactly as the storefront cart sends them
const createMutation = `mutation DraftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder { id name }
    userErrors { field message }
  }
}`
const createResult = await client.mutate('draftOrderCreate', createMutation, {
  input: {
    email: 'chrix+hmtest@1322legacystrategies.com',
    tags: ['test-order', 'fable-rescue-qa'],
    note: 'QA test order — artwork propagation verification. DO NOT FULFILL.',
    lineItems: [{
      variantId: VARIANT_GID,
      quantity: 1,
      customAttributes: [
        { key: 'Source', value: 'Hatfield McCoy DTF catalog page' },
        { key: 'Artwork file', value: 'hm-test-artwork.png' },
        { key: 'Artwork file URL', value: ARTWORK_URL },
        { key: 'Artwork upload URL', value: ARTWORK_URL },
      ],
    }],
  },
})
const draft = createResult.draftOrder
if (!draft) throw new Error('Draft create failed')
console.log('draft created:', draft.name, draft.id)

// 2. Complete as payment-pending → creates a real order → fires ORDERS_CREATE
const completeMutation = `mutation DraftOrderComplete($id: ID!) {
  draftOrderComplete(id: $id, paymentPending: true) {
    draftOrder { order { id name } }
    userErrors { field message }
  }
}`
const completeResult = await client.mutate('draftOrderComplete', completeMutation, { id: draft.id })
const order = completeResult.draftOrder && completeResult.draftOrder.order
if (!order) throw new Error('Complete failed')
console.log('ORDER CREATED:', order.name, order.id)

// 3. Give the webhook time to run, then inspect the order
const orderQuery = `query Order($id: ID!) {
  order(id: $id) {
    id name test displayFinancialStatus tags
    lineItems(first: 5) {
      nodes { title sku quantity customAttributes { key value } }
    }
    metafields(first: 10, namespace: "fulfillment") {
      nodes { namespace key type value }
    }
  }
}`
let final = null
for (let attempt = 1; attempt <= 6; attempt++) {
  await sleep(attempt === 1 ? 8000 : 6000)
  const res = await client.gql(orderQuery, { id: order.id })
  final = res.order
  const hasMetafield = final && final.metafields.nodes.length > 0
  console.log(`poll ${attempt}: metafields=${final ? final.metafields.nodes.length : 'n/a'}`)
  if (hasMetafield) break
}

console.log('=== ORDER EVIDENCE ===')
console.log(JSON.stringify(final, null, 1))

// 4. Cancel the test order (keeps store clean; stays visible tagged test-order)
if (!KEEP) {
  const cancelMutation = `mutation OrderCancel($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean) {
    orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, notifyCustomer: $notifyCustomer) {
      job { id }
      orderCancelUserErrors { field message }
    }
  }`
  const cancelResult = await client.mutate('orderCancel', cancelMutation, {
    orderId: order.id, reason: 'OTHER', refund: false, restock: true, notifyCustomer: false,
  })
  console.log('cancel result:', JSON.stringify(cancelResult))
}
