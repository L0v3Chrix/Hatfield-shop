#!/usr/bin/env node
// One-off: point the ORDERS_CREATE artwork webhook at a new callback URL.
// Usage: node scripts/shopify/update-artwork-webhook-url.mjs <webhook-gid> <callback-url>
import 'dotenv/config'
import { createClient } from './lib/shopify-client.js'

const [, , id, callbackUrl] = process.argv
if (!id || !callbackUrl) {
  console.error('Usage: node scripts/shopify/update-artwork-webhook-url.mjs <webhook-gid> <callback-url>')
  process.exit(2)
}

const client = await createClient({
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
  accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
})

const mutation = `mutation Update($id: ID!, $sub: WebhookSubscriptionInput!) {
  webhookSubscriptionUpdate(id: $id, webhookSubscription: $sub) {
    webhookSubscription {
      id
      topic
      endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } }
    }
    userErrors { field message }
  }
}`

const result = await client.mutate('webhookSubscriptionUpdate', mutation, {
  id,
  sub: { callbackUrl },
})
console.log(JSON.stringify(result.webhookSubscription, null, 2))
