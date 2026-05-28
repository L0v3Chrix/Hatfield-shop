import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isCommercePageUrl,
  normalizeCollections,
  normalizeProduct,
  validateNormalizedCatalog,
} from '../normalize.js'

const SCRAPED_AT = '2026-05-27T12:00:00.000Z'

test('normalizes a source product into a Hatfield McCoy draft product with rewritten-safe description', () => {
  const sourceProduct = {
    id: 123,
    title: 'CADLINK Digital Factory 10 DTF Printing',
    handle: 'cadlink-digital-factory-10-dtf-printing',
    body_html: '<p>Original competitor copy that should not ship.</p>',
    vendor: 'DTF Virginia',
    product_type: 'Software',
    tags: ['CADLINK', 'Software'],
    variants: [
      { id: 1, sku: 'CAD-1', title: 'Default Title', price: '399.00', option1: 'Default Title' },
      { id: 2, sku: '', title: 'Trial', price: '0.65', option1: 'Trial' },
    ],
    images: [{ src: 'https://cdn.shopify.com/example.png', alt: 'Competitor image' }],
  }

  const product = normalizeProduct(sourceProduct, {
    canonicalUrlsByHandle: new Map([
      ['cadlink-digital-factory-10-dtf-printing', 'https://dtfvirginia.com/products/cadlink-digital-factory-10-dtf-printing'],
    ]),
    scrapedAt: SCRAPED_AT,
  })

  assert.equal(product.handle, 'dtfva-cadlink-digital-factory-10-dtf-printing')
  assert.equal(product.title, 'CADLINK Digital Factory 10 DTF Printing')
  assert.equal(product.vendor, 'Hatfield McCoy DTF')
  assert.equal(product.status, 'DRAFT')
  assert.equal(product.productType, 'Software')
  assert.match(product.description, /Hatfield McCoy DTF catalog listing/)
  assert.doesNotMatch(product.description, /Original competitor copy/)
  assert.deepEqual(product.options, [{ name: 'Title', values: ['Default Title', 'Trial'] }])
  assert.equal(product.variants[0].price, '398.00')
  assert.equal(product.variants[1].price, '0.98')
  assert.ok(product.variants[1].flags.includes('low_price_floor_0_98'))
  assert.ok(product.tags.includes('competitor-parity'))
  assert.ok(product.tags.includes('needs-fulfillment-review'))
  assert.equal(product.metafields.source_url, 'https://dtfvirginia.com/products/cadlink-digital-factory-10-dtf-printing')
  assert.equal(product.metafields.source_vendor, 'DTF Virginia')
  assert.equal(product.metafields.competitor_image_urls[0], 'https://cdn.shopify.com/example.png')
})

test('normalizes collections and keeps source membership handles mapped to imported product handles', () => {
  const collections = normalizeCollections([
    {
      title: 'CADLINK Digital Factory DTF Software',
      handle: 'cadlink',
      description: '<p>Source copy</p>',
      products_count: 5,
      image: { src: 'https://cdn.shopify.com/collection.png' },
    },
  ])

  assert.deepEqual(collections, [
    {
      handle: 'dtfva-cadlink',
      title: 'CADLINK Digital Factory DTF Software',
      description: 'Hatfield McCoy DTF collection inspired by competitive catalog coverage. Review copy and imagery before publishing.',
      sourceHandle: 'cadlink',
      sourceProductsCount: 5,
      imageReferenceUrl: 'https://cdn.shopify.com/collection.png',
    },
  ])
})

test('filters sitemap pages to commerce/support pages and excludes blogs', () => {
  assert.equal(isCommercePageUrl('https://dtfvirginia.com/pages/dtf-printing-frequently-asked-questions-custom-apparel'), true)
  assert.equal(isCommercePageUrl('https://dtfvirginia.com/pages/uv-dtf-transfer-application-instructions'), true)
  assert.equal(isCommercePageUrl('https://dtfvirginia.com/pages/contact-dtf-virginia-today-get-your-order-started'), true)
  assert.equal(isCommercePageUrl('https://dtfvirginia.com/blogs/blog-articles-and-updates/advantages-of-dtf-printing'), false)
  assert.equal(isCommercePageUrl('https://dtfvirginia.com/pages/mobile-app-privacy-policy'), false)
})

test('validates duplicate handles, duplicate SKUs, missing source URLs, and pricing rules', () => {
  const product = normalizeProduct({
    id: 456,
    title: 'Custom DTF Transfers',
    handle: 'custom-dtf-transfers',
    body_html: '',
    vendor: 'DTF Virginia',
    product_type: 'DTF Transfer',
    tags: ['DTF'],
    variants: [
      { id: 10, sku: 'DTF-1', title: 'Small', price: '6.12', option1: 'Small' },
    ],
    images: [],
  }, { canonicalUrlsByHandle: new Map(), scrapedAt: SCRAPED_AT })

  const productMissingSource = {
    ...product,
    handle: 'dtfva-custom-dtf-transfers-missing-source',
    variants: product.variants.map((variant) => ({ ...variant, sku: 'DTF-2' })),
    metafields: { ...product.metafields, source_url: '' },
  }
  const errors = validateNormalizedCatalog({
    products: [product, { ...product }, productMissingSource],
    collections: [],
    pages: [],
  })

  assert.ok(errors.some((error) => error.includes('Duplicate product handle')))
  assert.ok(errors.some((error) => error.includes('Duplicate SKU')))
  assert.ok(errors.some((error) => error.includes('missing source_url')))
})
