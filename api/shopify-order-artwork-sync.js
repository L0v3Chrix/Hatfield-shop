import crypto from 'node:crypto'
import { collectArtworkEntries, shopifyOrderGid } from './lib/order-artwork-sync.js'
import { createClient } from '../scripts/shopify/lib/shopify-client.js'

export const config = {
  runtime: 'nodejs',
}

const DEFAULT_METAFIELD_NAMESPACE = 'fulfillment'
const DEFAULT_METAFIELD_KEY = 'artwork_manifest'

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  const secret = process.env.SHOPIFY_ORDER_WEBHOOK_SECRET || process.env.SHOPIFY_ADMIN_CLIENT_SECRET || ''
  if (!secret) {
    return json({ error: 'Shopify webhook secret is not configured.' }, 500)
  }

  let rawBody = ''
  try {
    rawBody = await request.text()
  } catch {
    return json({ error: 'Could not read webhook body.' }, 400)
  }

  if (!verifyWebhookHmac(rawBody, request.headers.get('x-shopify-hmac-sha256') || '', secret)) {
    return json({ error: 'Invalid Shopify webhook signature.' }, 401)
  }

  let order
  try {
    order = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Webhook body was not valid JSON.' }, 400)
  }

  const artworkEntries = collectArtworkEntries(order)
  if (!artworkEntries.length) {
    return json({ ok: true, skipped: true, reason: 'No artwork uploads found on this order.' }, 200)
  }

  try {
    const uploadedFiles = artworkEntries.map((entry) => ({
      id: '',
      name: entry.artworkFileName,
      url: entry.artworkUrl,
      sourceUrl: entry.artworkUrl,
      lineIndex: entry.lineIndex,
      sku: entry.sku,
    }))
    const metafieldResult = await attachArtworkManifestToOrder(order, uploadedFiles)

    return json({
      ok: true,
      orderId: order.id || null,
      orderName: order.name || null,
      folder: null,
      filesSynced: uploadedFiles.length,
      metafieldAttached: metafieldResult.attached,
      metafieldReason: metafieldResult.reason,
    }, 200)
  } catch (error) {
    return json({
      error: error && error.message ? error.message : 'Order artwork sync failed.',
    }, 500)
  }
}

export function verifyWebhookHmac(rawBody, headerValue, secret) {
  if (!rawBody || !headerValue || !secret) return false
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const left = Buffer.from(digest)
  const right = Buffer.from(String(headerValue))
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

async function attachArtworkManifestToOrder(order, uploadedFiles) {
  const ownerId = shopifyOrderGid(order)
  if (!ownerId) {
    return { attached: false, reason: 'Order webhook payload did not include a Shopify order GID.' }
  }

  if (!process.env.SHOPIFY_SHOP_DOMAIN || (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN && !process.env.SHOPIFY_ADMIN_CLIENT_ID)) {
    return { attached: false, reason: 'Shopify Admin credentials are not configured in this environment.' }
  }

  const client = await createClient({
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
  })

  const namespace = process.env.SHOPIFY_ORDER_ARTWORK_METAFIELD_NAMESPACE || DEFAULT_METAFIELD_NAMESPACE
  const key = process.env.SHOPIFY_ORDER_ARTWORK_METAFIELD_KEY || DEFAULT_METAFIELD_KEY
  const manifestNamespace = namespace
  const manifestKey = `${key}_manifest`.slice(0, 30)
  const mutation = `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key value type }
      userErrors { field message code }
    }
  }`

  const metafields = [{
    ownerId,
    namespace,
    key,
    type: 'json',
    value: JSON.stringify({
      files: uploadedFiles.map((file) => ({
        id: file.id,
        name: file.name,
        url: file.url,
        sourceUrl: file.sourceUrl,
        lineIndex: file.lineIndex,
        sku: file.sku,
      })),
    }),
  }, {
    ownerId,
    namespace: manifestNamespace,
    key: manifestKey,
    type: 'json',
    value: JSON.stringify({
      files: uploadedFiles.map((file) => ({
        id: file.id,
        name: file.name,
        url: file.url,
        sourceUrl: file.sourceUrl,
        lineIndex: file.lineIndex,
        sku: file.sku,
      })),
    }),
  }]

  await client.mutate('metafieldsSet', mutation, { metafields })

  return { attached: true, reason: '' }
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
