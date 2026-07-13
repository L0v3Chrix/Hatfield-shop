import test from 'node:test'
import assert from 'node:assert/strict'

import { parseSitemapXml, scrapeDtfVirginia } from '../scrape.js'
import { buildReviewReport, exportNormalizedCatalog, renderCsv } from '../export.js'

test('parses sitemap XML loc entries including escaped query strings', () => {
  const urls = parseSitemapXml(`<?xml version="1.0"?>
    <urlset>
      <url><loc>https://dtfvirginia.com/products/example</loc></url>
      <url><loc>https://dtfvirginia.com/sitemap_products_1.xml?from=1&amp;to=2</loc></url>
    </urlset>`)

  assert.deepEqual(urls, [
    'https://dtfvirginia.com/products/example',
    'https://dtfvirginia.com/sitemap_products_1.xml?from=1&to=2',
  ])
})

test('scrapes configured JSON endpoints and child sitemaps with injected fetch', async () => {
  const responses = new Map([
    ['https://dtfvirginia.com/products.json?limit=250', jsonResponse({ products: [{ handle: 'one' }] })],
    ['https://dtfvirginia.com/collections.json?limit=250', jsonResponse({ collections: [{ handle: 'all' }] })],
    ['https://dtfvirginia.com/robots.txt', textResponse('User-agent: *\nDisallow: /checkout\nSitemap: https://dtfvirginia.com/sitemap.xml')],
    ['https://dtfvirginia.com/sitemap.xml', textResponse('<sitemapindex><sitemap><loc>https://dtfvirginia.com/sitemap_products_1.xml?from=1&amp;to=2</loc></sitemap><sitemap><loc>https://dtfvirginia.com/sitemap_pages_1.xml</loc></sitemap><sitemap><loc>https://dtfvirginia.com/sitemap_blogs_1.xml</loc></sitemap></sitemapindex>')],
    ['https://dtfvirginia.com/sitemap_products_1.xml?from=1&to=2', textResponse('<urlset><url><loc>https://dtfvirginia.com/products/one</loc></url></urlset>')],
    ['https://dtfvirginia.com/sitemap_pages_1.xml', textResponse('<urlset><url><loc>https://dtfvirginia.com/pages/contact</loc></url></urlset>')],
    ['https://dtfvirginia.com/sitemap_blogs_1.xml', textResponse('<urlset><url><loc>https://dtfvirginia.com/blogs/blog/post</loc></url></urlset>')],
  ])
  const fetcher = async (url) => {
    assert.ok(responses.has(url), `unexpected URL ${url}`)
    return responses.get(url)
  }

  const scrape = await scrapeDtfVirginia({ fetcher, scrapedAt: '2026-05-27T12:00:00.000Z' })

  assert.equal(scrape.products.length, 1)
  assert.equal(scrape.collections.length, 1)
  assert.equal(scrape.sitemaps.products[0], 'https://dtfvirginia.com/products/one')
  assert.equal(scrape.sitemaps.pages[0], 'https://dtfvirginia.com/pages/contact')
  assert.equal(scrape.sitemaps.blogs[0], 'https://dtfvirginia.com/blogs/blog/post')
})

test('builds review report and CSV rows for normalized catalog', () => {
  const normalized = {
    meta: { normalized_product_count: 1, normalized_collection_count: 1, normalized_page_count: 1 },
    products: [{
      handle: 'dtfva-low-price',
      title: 'Low Price',
      status: 'DRAFT',
      productType: 'Patch',
      variants: [
        { sku: 'LOW-1', price: '0.98', sourcePrice: '0.65', flags: ['low_price_floor_0_98'] },
        { sku: 'LOW-2', price: '4.00', sourcePrice: '5.00', flags: [] },
      ],
      tags: ['needs-fulfillment-review'],
      metafields: {
        source_url: 'https://dtfvirginia.com/products/low-price',
        competitor_image_urls: ['https://cdn.shopify.com/low.png'],
      },
    }],
    collections: [{ handle: 'dtfva-patches', title: 'Patches' }],
    pages: [{ handle: 'dtfva-contact', title: 'Contact', sourceUrl: 'https://dtfvirginia.com/pages/contact' }],
    validationErrors: [],
  }

  const report = buildReviewReport(normalized)
  const csv = renderCsv(report.priceReviewRows)

  assert.equal(report.summary.products, 1)
  assert.equal(report.summary.variants, 2)
  assert.equal(report.lowPriceExceptions.length, 1)
  assert.equal(report.fulfillmentRiskProducts.length, 1)
  assert.match(csv, /handle,sku,title,source_price,hm_price,delta,flags,source_url/)
  assert.match(csv, /dtfva-low-price,LOW-1/)
})

test('exports Shopify-ready catalog config without competitor copy or image media', () => {
  const normalized = {
    products: [{
      handle: 'dtfva-product',
      title: 'Product',
      description: 'Safe HM copy',
      productType: 'DTF Transfer',
      vendor: 'Hatfield McCoy DTF',
      status: 'DRAFT',
      options: [{ name: 'Title', values: ['Default Title'] }],
      variants: [{ sku: 'SKU-1', options: { Title: 'Default Title' }, price: '9.00', flags: [] }],
      tags: ['competitor-parity'],
      metafields: { source_url: 'https://dtfvirginia.com/products/product', competitor_image_urls: ['https://cdn.shopify.com/product.png'] },
    }],
    collections: [{ handle: 'dtfva-all', title: 'All' }],
    pages: [],
  }

  const exported = exportNormalizedCatalog(normalized)

  assert.match(exported.PRODUCTS[0].description, /printed to order in Logan, West Virginia/)
  assert.equal(exported.PRODUCTS[0].status, 'DRAFT')
  assert.equal(exported.PRODUCTS[0].images, undefined)
  assert.ok(!exported.PRODUCTS[0].tags.includes('copy-needs-review'))
  assert.ok(!exported.PRODUCTS[0].tags.includes('seo-draft'))
  assert.ok(exported.PRODUCTS[0].metafields.some((field) => field.key === 'copy_status' && field.value === 'launch-ready'))
  assert.ok(exported.PRODUCTS[0].metafields.some((field) => field.key === 'seo_status' && field.value === 'draft-noindex'))
  assert.equal(exported.COLLECTIONS[0].handle, 'dtfva-all')
})

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'application/json']]),
    async json() { return data },
    async text() { return JSON.stringify(data) },
  }
}

function textResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'text/xml']]),
    async json() { return JSON.parse(data) },
    async text() { return data },
  }
}
