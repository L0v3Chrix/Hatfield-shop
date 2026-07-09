import test from 'node:test'
import assert from 'node:assert/strict'

import { applyCatalogEdits, validateEdits } from '../apply-edits.js'

function fixtureCatalog() {
  return {
    products: [
      {
        handle: 'dtfva-widget',
        title: 'Widget 9000',
        status: 'DRAFT',
        tags: ['competitor-parity', 'needs-fulfillment-review'],
        options: [{ name: 'Size', values: ['A', 'B'] }],
        variants: [
          { sku: 'DTFVA-WIDGET-A', title: 'A', options: { Size: 'A' }, price: '0.98', sourcePrice: '0.50', flags: ['low_price_floor_0_98'] },
          { sku: 'DTFVA-WIDGET-B', title: 'B', options: { Size: 'B' }, price: '4.00', sourcePrice: '5.00', flags: [] },
        ],
      },
      {
        handle: 'dtfva-gone',
        title: 'Discontinued Thing',
        status: 'DRAFT',
        tags: ['competitor-parity'],
        options: [{ name: 'Title', values: ['Default'] }],
        variants: [{ sku: 'DTFVA-GONE-DEFAULT', title: 'Default', options: { Title: 'Default' }, price: '9.00', sourcePrice: '10.00', flags: [] }],
      },
    ],
    collections: [],
    pages: [],
  }
}

const EDITS = {
  version: 'test',
  statusDefault: 'ACTIVE',
  removals: [{ handle: 'dtfva-gone', shopifyStatus: 'ARCHIVED', reason: 'test' }],
  retitles: { 'dtfva-widget': 'Widget Softstyle' },
  variantRestructures: {
    'dtfva-widget': {
      options: [{ name: 'Pack', values: ['Single', 'Sheet'] }],
      variants: [
        { sku: 'DTFVA-WIDGET-SINGLE', title: 'Single', options: { Pack: 'Single' }, price: '4.00' },
        { sku: 'DTFVA-WIDGET-SHEET', title: 'Sheet', options: { Pack: 'Sheet' }, price: '75.00' },
      ],
    },
  },
  priceOverrides: { 'DTFVA-WIDGET-SINGLE': '5.00' },
  tagRemovals: { 'dtfva-widget': ['needs-fulfillment-review'] },
  notes: { 'dtfva-widget': { pdp: ['Cold peel.'], card: 'Cold peel' } },
  copyOverrides: {},
}

test('removals hide the product and set the Shopify status', () => {
  const patched = applyCatalogEdits(fixtureCatalog(), EDITS)
  const gone = patched.products.find((p) => p.handle === 'dtfva-gone')
  assert.equal(gone.publicVisible, false)
  assert.equal(gone.status, 'ARCHIVED')
})

test('non-removed products get statusDefault (prevents sync-metadata DRAFT demotion)', () => {
  const patched = applyCatalogEdits(fixtureCatalog(), EDITS)
  assert.equal(patched.products.find((p) => p.handle === 'dtfva-widget').status, 'ACTIVE')
})

test('restructure replaces options and variants wholesale', () => {
  const patched = applyCatalogEdits(fixtureCatalog(), EDITS)
  const widget = patched.products.find((p) => p.handle === 'dtfva-widget')
  assert.deepEqual(widget.options, [{ name: 'Pack', values: ['Single', 'Sheet'] }])
  assert.deepEqual(widget.variants.map((v) => v.sku), ['DTFVA-WIDGET-SINGLE', 'DTFVA-WIDGET-SHEET'])
})

test('priceOverrides apply after restructure and clear the low-price floor flag', () => {
  const patched = applyCatalogEdits(fixtureCatalog(), EDITS)
  const widget = patched.products.find((p) => p.handle === 'dtfva-widget')
  const single = widget.variants.find((v) => v.sku === 'DTFVA-WIDGET-SINGLE')
  assert.equal(single.price, '5.00')
  assert.ok(!single.flags.includes('low_price_floor_0_98'))
})

test('retitle, tag removal, and notes land on the product', () => {
  const patched = applyCatalogEdits(fixtureCatalog(), EDITS)
  const widget = patched.products.find((p) => p.handle === 'dtfva-widget')
  assert.equal(widget.title, 'Widget Softstyle')
  assert.ok(!widget.tags.includes('needs-fulfillment-review'))
  assert.deepEqual(widget.notes, ['Cold peel.'])
  assert.equal(widget.cardNote, 'Cold peel')
})

test('apply is idempotent (safe if the patched catalog is written to disk and re-patched)', () => {
  const once = applyCatalogEdits(fixtureCatalog(), EDITS)
  const twice = applyCatalogEdits(once, EDITS)
  assert.deepEqual(JSON.parse(JSON.stringify(twice.products)), JSON.parse(JSON.stringify(once.products)))
})

test('validation rejects unknown handles and non-dtfva handles', () => {
  assert.throws(() => validateEdits(fixtureCatalog(), { removals: [{ handle: 'dtfva-nope', shopifyStatus: 'DRAFT' }] }), /unknown handle/)
  assert.throws(() => validateEdits(fixtureCatalog(), { retitles: { 'dtf-22-sheet': 'X' } }), /only touch dtfva-/)
})

test('validation rejects malformed prices', () => {
  assert.throws(() => validateEdits(fixtureCatalog(), { priceOverrides: { 'DTFVA-WIDGET-A': '5' } }), /bad price/)
})

test('original catalog object is not mutated', () => {
  const original = fixtureCatalog()
  const snapshot = JSON.stringify(original)
  applyCatalogEdits(original, EDITS)
  assert.equal(JSON.stringify(original), snapshot)
})
