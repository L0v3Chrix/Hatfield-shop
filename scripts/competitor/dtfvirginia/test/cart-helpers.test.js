import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'

function loadCartHelpers() {
  const source = readFileSync(resolve('deliverables/prototype/assets/js/cart-helpers.js'), 'utf8')
  const context = {
    globalThis: {},
  }
  context.window = context.globalThis
  vm.runInNewContext(source, context, { filename: 'cart-helpers.js' })
  return context.globalThis.HMCartHelpers
}

test('classifyCartItem separates checkout-ready, builder, and review-only lines', () => {
  const helpers = loadCartHelpers()

  assert.equal(
    helpers.classifyCartItem({
      handle: 'dtf-22-sheet',
      name: 'DTF 22 Sheet',
      merchandiseId: 'gid://shopify/ProductVariant/1',
    }),
    'checkout-ready',
  )

  assert.equal(
    helpers.classifyCartItem({
      handle: 'custom-dtf-transfers-by-size',
      name: 'Custom DTF Transfers by Size',
    }),
    'review-required',
  )

  assert.equal(
    helpers.classifyCartItem({
      handle: 'party-banners',
      name: 'Party Banners',
    }),
    'review-required',
  )
})

test('classifyCartItem keeps draft sheet products out of the builder bucket unless builder signals are present', () => {
  const helpers = loadCartHelpers()

  assert.equal(
    helpers.classifyCartItem({
      handle: 'dtf-22-sheet',
      name: 'DTF 22 Sheet',
    }),
    'review-required',
  )

  assert.equal(
    helpers.classifyCartItem({
      handle: 'dtf-22-gang-sheet-builder',
      name: 'DTF 22 Gang Sheet Builder',
    }),
    'builder-required',
  )
})

test('summarizeCart reports mixed-cart truthfully and blocks checkout when any non-buyable line remains', () => {
  const helpers = loadCartHelpers()

  const summary = helpers.summarizeCart([
    {
      handle: 'dtf-22-sheet',
      name: 'DTF 22 Sheet',
      merchandiseId: 'gid://shopify/ProductVariant/1',
      price: 12,
      qty: 2,
    },
    {
      handle: 'dtf-22-gang-sheet-builder',
      name: 'DTF 22 Gang Sheet Builder',
      price: 0,
      qty: 1,
    },
    {
      handle: 'party-banners',
      name: 'Party Banners',
      price: 25,
      qty: 1,
    },
  ])

  assert.equal(summary.totalQuantity, 4)
  assert.equal(summary.checkoutReadyQuantity, 2)
  assert.equal(summary.checkoutReadyLineCount, 1)
  assert.equal(summary.artworkPendingLineCount, 1)
  assert.equal(summary.readyLineCount, 0)
  assert.equal(summary.builderLineCount, 1)
  assert.equal(summary.reviewLineCount, 1)
  assert.equal(summary.subtotal, 49)
  assert.equal(summary.checkoutBlocked, true)
  assert.match(summary.statusMessage, /upload artwork on 1 line below to unlock checkout/i)
  assert.match(summary.statusMessage, /1 builder item needs a saved design/i)
  assert.match(summary.statusMessage, /1 line needs a quote/i)
  // Regression (owner-found 2026-07-13): a blocked cart must NEVER claim
  // anything is "ready for checkout" — that contradiction hid the dead end.
  assert.doesNotMatch(summary.statusMessage, /ready for checkout/i)
})

test('summarizeCart never says "ready" while artwork is pending (owner screenshot regression)', () => {
  const helpers = loadCartHelpers()

  // Exactly the 2026-07-13 screenshot state: 4 checkout-ready lines, zero artwork.
  const summary = helpers.summarizeCart([1, 2, 3, 4].map((n) => ({
    handle: `product-${n}`,
    name: `Product ${n}`,
    merchandiseId: `gid://shopify/ProductVariant/${n}`,
    price: 25,
    qty: 1,
  })))

  assert.equal(summary.checkoutBlocked, true)
  assert.equal(summary.artworkPendingLineCount, 4)
  assert.equal(summary.readyLineCount, 0)
  assert.match(summary.statusMessage, /upload artwork on 4 lines below to unlock checkout/i)
  assert.doesNotMatch(summary.statusMessage, /ready for checkout/i)
})

test('summarizeCart reports remaining ready lines while others wait on artwork', () => {
  const helpers = loadCartHelpers()

  const summary = helpers.summarizeCart([
    {
      handle: 'dtf-22-sheet',
      merchandiseId: 'gid://shopify/ProductVariant/1',
      price: 12,
      qty: 1,
      artworkUrl: 'https://blob.example/art.png',
    },
    {
      handle: 'dtf-46-sheet',
      merchandiseId: 'gid://shopify/ProductVariant/2',
      price: 12,
      qty: 1,
    },
  ])

  assert.equal(summary.checkoutBlocked, true)
  assert.equal(summary.readyLineCount, 1)
  assert.match(summary.statusMessage, /upload artwork on 1 line below to unlock checkout/i)
  assert.match(summary.statusMessage, /1 other line is good to go/i)
})

test('summarizeCart marks fully buyable carts as checkout-ready', () => {
  const helpers = loadCartHelpers()

  const summary = helpers.summarizeCart([
    {
      handle: 'glow-dtf-22-sheet',
      name: 'Glow DTF 22 Sheet',
      merchandiseId: 'gid://shopify/ProductVariant/2',
      price: 18,
      qty: 1,
      artworkUrl: 'https://blob.example/file.png',
    },
  ])

  assert.equal(summary.checkoutBlocked, false)
  assert.equal(summary.checkoutReadyQuantity, 1)
  assert.equal(summary.builderLineCount, 0)
  assert.equal(summary.reviewLineCount, 0)
  assert.match(summary.statusMessage, /checkout opens shopify secure payment/i)
})

test('itemHasArtwork and itemNeedsArtwork reflect direct-order upload state', () => {
  const helpers = loadCartHelpers()

  assert.equal(
    helpers.itemNeedsArtwork({
      handle: 'dtf-22-sheet',
      merchandiseId: 'gid://shopify/ProductVariant/1',
    }),
    true,
  )

  assert.equal(
    helpers.itemHasArtwork({
      handle: 'dtf-22-sheet',
      merchandiseId: 'gid://shopify/ProductVariant/1',
      attributes: [{ key: 'Artwork upload URL', value: 'https://blob.example/a.png' }],
    }),
    true,
  )
})
