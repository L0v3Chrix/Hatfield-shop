#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from './lib/shopify-client.js'

function parseFlags(argv) {
  const flags = {
    callbackUrl: process.env.SHOPIFY_ORDER_ARTWORK_WEBHOOK_URL || '',
    verbose: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--callback-url') flags.callbackUrl = argv[++index] || ''
    else if (arg === '--verbose' || arg === '-v') flags.verbose = true
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage:
  node scripts/shopify/register-order-artwork-webhook.js --callback-url https://your-site.vercel.app/api/shopify-order-artwork-sync

Env fallback:
  SHOPIFY_ORDER_ARTWORK_WEBHOOK_URL
`)
      process.exit(0)
    } else {
      console.error(`Unknown flag: ${arg}`)
      process.exit(2)
    }
  }

  return flags
}

async function main() {
  const flags = parseFlags(process.argv)
  if (!flags.callbackUrl) {
    throw new Error('Provide --callback-url or set SHOPIFY_ORDER_ARTWORK_WEBHOOK_URL.')
  }

  const client = await createClient({
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
    verbose: flags.verbose,
  })

  const mutation = `mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
      webhookSubscription {
        id
        topic
        endpoint {
          __typename
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
      userErrors { field message }
    }
  }`

  const payload = await client.mutate('webhookSubscriptionCreate', mutation, {
    topic: 'ORDERS_CREATE',
    subscription: {
      format: 'JSON',
      callbackUrl: flags.callbackUrl,
    },
  })

  const subscription = payload.webhookSubscription
  const endpoint = subscription && subscription.endpoint && subscription.endpoint.callbackUrl
  console.log('Shopify orders/create artwork webhook registered.')
  console.log(`ID: ${subscription.id}`)
  console.log(`Topic: ${subscription.topic}`)
  console.log(`Endpoint: ${endpoint}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
