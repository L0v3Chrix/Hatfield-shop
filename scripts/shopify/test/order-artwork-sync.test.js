import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

import {
  buildDriveFileName,
  buildOrderFolderName,
  collectArtworkEntries,
  shopifyOrderGid,
} from '../../../api/lib/order-artwork-sync.js'
import { verifyWebhookHmac } from '../../../api/shopify-order-artwork-sync.js'

test('collectArtworkEntries pulls artwork URLs from Shopify line item properties', () => {
  const order = {
    id: 998877,
    name: '#1009',
    line_items: [
      {
        title: 'Custom DTF Transfers By Size',
        sku: 'DTF-22-12',
        quantity: 2,
        properties: [
          { name: 'Artwork file', value: 'front-logo.png' },
          { name: 'Artwork upload URL', value: 'https://example.com/artwork/front-logo.png' },
        ],
      },
      {
        title: 'Builder Item',
        properties: [{ name: 'Ignored', value: 'No file' }],
      },
    ],
  }

  const entries = collectArtworkEntries(order)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].sku, 'DTF-22-12')
  assert.equal(entries[0].quantity, 2)
  assert.equal(entries[0].artworkFileName, 'front-logo.png')
  assert.equal(entries[0].artworkUrl, 'https://example.com/artwork/front-logo.png')
})

test('buildOrderFolderName and file names stay stable and order-specific', () => {
  const folderName = buildOrderFolderName({ id: 12345, name: '#1012' })
  assert.match(folderName, /Hatfield McCoy Order - #1012 - 12345/)

  const fileName = buildDriveFileName({
    lineIndex: 0,
    sku: 'DTF-22',
    artworkFileName: 'left chest logo',
  }, 0, 'image/png')
  assert.equal(fileName, 'line-1-DTF-22-left-chest-logo.png')
})

test('shopifyOrderGid and webhook HMAC verification are valid', () => {
  assert.equal(shopifyOrderGid({ id: 554433 }), 'gid://shopify/Order/554433')
  assert.equal(shopifyOrderGid({ admin_graphql_api_id: 'gid://shopify/Order/9988' }), 'gid://shopify/Order/9988')

  const body = JSON.stringify({ id: 1, name: '#1001' })
  const secret = 'top-secret'
  const header = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
  assert.equal(verifyWebhookHmac(body, header, secret), true)
  assert.equal(verifyWebhookHmac(body, 'bad-header', secret), false)
})

test('collectArtworkEntries folds Kixxl builder properties into the manifest', () => {
  const order = {
    line_items: [{
      title: 'DTF 22" Gang Sheet Builder',
      sku: 'DTF-22-24-B',
      quantity: 1,
      properties: [
        { name: '_app_name', value: 'Kixxl' },
        { name: '_actual_gang_sheet', value: 'https://app.gangifyapp.com/preview-sheet/889996155596#/uploads/preview-sheet-1' },
        { name: 'sheet_preview', value: 'https://d3uxk88roi69oj.cloudfront.net/shops/zm1evm-rd.myshopify.com/customer-uploads/temp/Sheet_1_abc.png#/uploads/gang-sheet-1' },
        { name: 'sheet_type', value: 'created' },
      ],
    }],
  }
  const entries = collectArtworkEntries(order)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].sku, 'DTF-22-24-B')
  assert.equal(entries[0].artworkUrl, 'https://app.gangifyapp.com/preview-sheet/889996155596#/uploads/preview-sheet-1')
  assert.match(entries[0].previewUrl, /cloudfront/)
  assert.match(entries[0].artworkFileName, /Sheet_1_abc/)
})

test('collectArtworkEntries still skips lines with no artwork data at all', () => {
  const order = { line_items: [{ title: 'Plain product', sku: 'X', quantity: 1, properties: [{ name: 'Source', value: 'catalog' }] }] }
  assert.equal(collectArtworkEntries(order).length, 0)
})
