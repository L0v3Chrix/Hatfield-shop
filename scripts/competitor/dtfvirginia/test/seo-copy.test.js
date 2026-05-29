import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildApprovalState,
  buildSeoRecord,
  rewriteProductCopy,
  rewriteServicePageCopy,
} from '../copy-seo.js'
import {
  buildFrontendCatalog,
  publicStorefrontProducts,
  renderCollectionPage,
  renderProductPage,
  renderShopPage,
  renderRobotsTxt,
  renderSitemapXml,
} from '../frontend-generator.js'

const product = {
  handle: 'dtfva-custom-dtf-transfers',
  sourceHandle: 'custom-dtf-transfers',
  title: 'Custom DTF Transfers by Size',
  description: 'Hatfield McCoy DTF catalog listing for Custom DTF Transfers by Size.',
  productType: 'DTF Transfer',
  vendor: 'Hatfield McCoy DTF',
  status: 'ACTIVE',
  tags: ['competitor-parity', 'source-dtf-virginia'],
  options: [{ name: 'Size', values: ['2 x 2', '4 x 4'] }],
  variants: [
    {
      sku: 'DTFVA-2X2',
      sourceVariantId: '111',
      title: '2 x 2',
      options: { Size: '2 x 2' },
      price: '4.00',
      sourcePrice: '5.00',
      flags: [],
      storefront_variant_id: 'gid://shopify/ProductVariant/111',
    },
  ],
  metafields: {
    source_url: 'https://dtfvirginia.com/products/custom-dtf-transfers',
    competitor_image_urls: ['https://cdn.shopify.com/source.png'],
  },
}

test('rewrites product copy in Hatfield McCoy voice without competitor phrasing', () => {
  const rewritten = rewriteProductCopy(product, {
    sourceText: 'Original DTF Virginia phrase about fast reliable transfer printing.',
  })

  assert.equal(rewritten.status, 'launch-ready')
  assert.match(rewritten.shortDescription, /Logan, West Virginia/)
  assert.match(rewritten.shortDescription, /artwork upload attached to the order/i)
  assert.match(rewritten.bodyHtml, /Hatfield McCoy DTF/)
  assert.doesNotMatch(rewritten.bodyHtml, /Original DTF Virginia phrase/)
  assert.doesNotMatch(rewritten.bodyHtml, /kixxl_rolling_canvas_product_hidden/)
  assert.deepEqual(rewritten.approvalTags, [])
})

test('rewrites Virginia location pages as WV and national service pages', () => {
  const page = {
    handle: 'dtfva-dtf-transfer-richmond-va',
    title: 'Dtf Transfer Richmond Va',
    sourceUrl: 'https://dtfvirginia.com/pages/dtf-transfer-richmond-va',
  }
  const rewritten = rewriteServicePageCopy(page)

  assert.equal(rewritten.handle, 'dtf-transfers-shipped-nationwide')
  assert.match(rewritten.title, /Nationwide/)
  assert.match(rewritten.bodyHtml, /Logan, WV/)
  assert.doesNotMatch(rewritten.bodyHtml, /Richmond/)
  assert.doesNotMatch(rewritten.bodyHtml, /Virginia-local/)
})

test('builds SEO records with canonical URL, metadata, and schema', () => {
  const seo = buildSeoRecord({
    kind: 'product',
    handle: product.handle,
    title: product.title,
    description: 'Custom DTF transfers printed in Logan, WV and shipped nationwide.',
    urlPath: `/products/${product.handle}`,
    price: '4.00',
    availability: 'PreOrder',
  })

  assert.equal(seo.canonicalUrl, 'https://www.hatfieldmccoydtf.com/products/dtfva-custom-dtf-transfers')
  assert.match(seo.title, /Custom DTF Transfers/)
  assert.match(seo.description, /Logan, WV/)
  assert.equal(seo.schema['@type'], 'Product')
  assert.equal(seo.schema.offers.price, '4.00')
})

test('builds approval state from tags and risk flags', () => {
  const state = buildApprovalState({
    tags: ['fulfillment-needs-review'],
    variants: [{ flags: ['low_price_floor_0_98'] }],
  })

  assert.equal(state.indexable, false)
  assert.equal(state.publishable, false)
  assert.deepEqual(state.blockers, ['fulfillment'])
})

test('keeps draft products out of public checkout and storefront listing', () => {
  const catalog = buildFrontendCatalog({
    products: [{ ...product, status: 'DRAFT' }],
    collections: [],
    pages: [],
  })

  assert.equal(catalog.products[0].publishable, false)
  assert.deepEqual(catalog.products[0].blockers, ['unpublished'])
  assert.deepEqual(publicStorefrontProducts(catalog.products), [])
  assert.equal(catalog.products[0].variants[0].checkoutEnabled, false)
})

test('builds frontend catalog with SEO copy and checkout-safe variants', () => {
  const catalog = buildFrontendCatalog({
    products: [product],
    collections: [{ handle: 'dtfva-dtf-transfers', title: 'DTF Transfers', description: 'Transfers collection.' }],
    pages: [],
  }, {
    shopifyState: {
      products: {
        'dtfva-custom-dtf-transfers': {
          handle: 'dtfva-custom-dtf-transfers',
          productId: 'gid://shopify/Product/999',
          status: 'ACTIVE',
          variants: [{ sku: 'DTFVA-2X2', variantId: 'gid://shopify/ProductVariant/999' }],
        },
      },
    },
  })

  assert.equal(catalog.products[0].url, '/products/dtfva-custom-dtf-transfers')
  assert.equal(catalog.products[0].indexable, false)
  assert.equal(catalog.products[0].shopifyProductId, 'gid://shopify/Product/999')
  assert.equal(catalog.products[0].variants[0].merchandiseId, 'gid://shopify/ProductVariant/999')
  assert.equal(catalog.products[0].variants[0].checkoutEnabled, true)
  assert.equal(catalog.products[0].images.length, 0)
  assert.equal(catalog.collections[0].url, '/collections/dtfva-dtf-transfers')
})

test('renders crawlable product and collection pages with noindex for drafts', () => {
  const catalog = buildFrontendCatalog({
    products: [product],
    collections: [{ handle: 'dtfva-dtf-transfers', title: 'DTF Transfers', description: 'Transfers collection.' }],
    pages: [],
  })
  const productHtml = renderProductPage(catalog.products[0], { siteUrl: 'https://www.hatfieldmccoydtf.com' })
  const collectionHtml = renderCollectionPage(catalog.collections[0], catalog.products, { siteUrl: 'https://www.hatfieldmccoydtf.com' })

  assert.match(productHtml, /<link rel="canonical" href="https:\/\/www\.hatfieldmccoydtf\.com\/products\/dtfva-custom-dtf-transfers"/)
  assert.match(productHtml, /<meta name="robots" content="noindex, nofollow"/)
  assert.match(productHtml, /application\/ld\+json/)
  assert.match(productHtml, /data-merchandise-id="gid:\/\/shopify\/ProductVariant\/111"/)
  assert.match(productHtml, /data-requires-artwork="true"/)
  assert.match(collectionHtml, /\/products\/dtfva-custom-dtf-transfers/)
  assert.match(productHtml, /data-handle="dtfva-custom-dtf-transfers"/)
  assert.match(productHtml, /id="cart-summary"/)
  assert.match(productHtml, /id="cart-recommendations"/)
})

test('renders mobile navigation with live collection routes and builder-first PDP routing', () => {
  const builderProduct = {
    ...product,
    handle: 'dtfva-custom-dtf-gang-sheets-builder',
    title: 'Custom DTF Gang Sheets Builder',
    variants: [
      {
        sku: 'DTFVA-GANG-22',
        sourceVariantId: '222',
        title: '22 inch roll',
        options: { Width: '22 inch roll' },
        price: '11.00',
        sourcePrice: '12.00',
        flags: [],
        storefront_variant_id: 'gid://shopify/ProductVariant/222',
      },
    ],
  }

  const catalog = buildFrontendCatalog({
    products: [product, builderProduct],
    collections: [
      { handle: 'dtfva-dtf-transfers', title: 'DTF Transfers', description: 'Transfers collection.' },
      { handle: 'dtfva-uv-dtf-transfers', title: 'UV DTF Transfers – Decals & Stickers', description: 'Sticker collection.' },
      { handle: 'dtfva-custom-t-shirts', title: 'Custom T-Shirts', description: 'Apparel collection.' },
    ],
    pages: [],
  })

  const shopHtml = renderShopPage(catalog, { siteUrl: 'https://www.hatfieldmccoydtf.com' })
  const builderHtml = renderProductPage(catalog.products.find((item) => item.handle === 'dtfva-custom-dtf-gang-sheets-builder'), {
    siteUrl: 'https://www.hatfieldmccoydtf.com',
  })

  assert.match(shopHtml, /href="\/collections\/dtfva-uv-dtf-transfers"/)
  assert.match(shopHtml, /href="\/collections\/dtfva-custom-t-shirts"/)
  assert.doesNotMatch(shopHtml, /dtfva-stickers-decals/)
  assert.doesNotMatch(shopHtml, /dtfva-apparel-blanks/)
  assert.match(shopHtml, /class="mobile-menu-toggle"[^>]*><span class="hamburger-lines" aria-hidden="true"><\/span><span class="mobile-menu-label">Menu<\/span><\/button>/)
  assert.match(shopHtml, /class="btn secondary cart-btn"[^>]*><span class="cart-btn-label">Cart<\/span><span class="cart-count-badge" id="cart-count">0<\/span><\/button>/)
  assert.match(builderHtml, /class="btn primary feature-cta" href="\/gang-sheet-builder"/)
  assert.match(builderHtml, /Open builder<\/a>/)
  assert.match(builderHtml, /class="quote-button table-link" href="\/gang-sheet-builder">Open builder<\/a>/)
})

test('routes hidden Kixxl proxy products to the builder instead of cart or quote buttons', () => {
  const proxyProduct = {
    ...product,
    handle: 'dtfva-custom-dtf-transfers-by-size',
    title: 'Custom DTF Transfers by Size',
    productType: 'kixxl_rolling_canvas_product_hidden',
    tags: ['competitor-parity', 'source-tag-kixxl-proxy-product'],
    options: [{ name: 'kixxl-size', values: ['2" x 2"'] }],
    variants: [
      {
        sku: 'DTFVA-PROXY',
        sourceVariantId: '333',
        title: '11.6 x 5.33-POU7',
        options: { Size: '11.6 x 5.33-POU7', 'kixxl-size': '2" x 2"' },
        price: '0.98',
        sourcePrice: '1.98',
        flags: [],
      },
    ],
  }

  const catalog = buildFrontendCatalog({
    products: [proxyProduct],
    collections: [],
    pages: [],
  })

  assert.equal(catalog.products[0].internalProxy, true)
  assert.equal(catalog.products[0].publicVisible, false)
  assert.equal(catalog.meta.internal_proxy_product_count, 1)
  assert.deepEqual(publicStorefrontProducts(catalog.products), [])

  const proxyHtml = renderProductPage(catalog.products[0], { siteUrl: 'https://www.hatfieldmccoydtf.com' })

  assert.match(proxyHtml, /class="btn primary feature-cta" href="\/gang-sheet-builder">Open builder<\/a>/)
  assert.doesNotMatch(proxyHtml, /Add selected option<\/button>/)
  assert.doesNotMatch(proxyHtml, /Request product help<\/button>/)
  assert.doesNotMatch(proxyHtml, /11\.6 x 5\.33-POU7/)
  assert.doesNotMatch(proxyHtml, /kixxl-size/)
})

test('treats builder products as a distinct family and keeps builder collections scoped to builder routes', () => {
  const standardTransfer = {
    ...product,
    handle: 'dtfva-standard-dtf-transfer',
    title: 'Standard DTF Transfer',
    tags: ['competitor-parity'],
  }
  const builderProduct = {
    ...product,
    handle: 'dtfva-custom-dtf-gang-sheets-builder',
    title: 'Custom DTF Gang Sheets Builder',
    tags: ['competitor-parity', 'source-tag-gang-sheet'],
    variants: [
      {
        sku: 'DTFVA-GANG-46',
        sourceVariantId: '444',
        title: '46 inch roll',
        options: { Width: '46 inch roll' },
        price: '12.00',
        sourcePrice: '13.00',
        flags: [],
      },
    ],
  }

  const catalog = buildFrontendCatalog({
    products: [standardTransfer, builderProduct],
    collections: [
      { handle: 'dtfva-gang-builder', title: 'Gang Builder', description: 'Builder-only route.' },
      { handle: 'dtfva-dtf-transfers', title: 'DTF Transfers', description: 'Transfer collection.' },
    ],
    pages: [],
  })

  const shopHtml = renderShopPage(catalog, { siteUrl: 'https://www.hatfieldmccoydtf.com' })
  const builderCollectionHtml = renderCollectionPage(catalog.collections[0], catalog.products, { siteUrl: 'https://www.hatfieldmccoydtf.com' })

  assert.match(shopHtml, /data-filter="builders">Builders <span>1<\/span><\/button>/)
  assert.match(shopHtml, /data-category="builders"/)
  assert.match(builderCollectionHtml, /Custom DTF Gang Sheets Builder/)
  assert.doesNotMatch(builderCollectionHtml, /Standard DTF Transfer/)
})

test('does not publish proxy products in shop, collection, product index, or sitemap output', () => {
  const proxyProduct = {
    ...product,
    handle: 'dtfva-custom-sublimation-transfers-by-size-1',
    title: 'Custom Sublimation Transfers by Size',
    productType: 'kixxl_rolling_canvas_product_hidden',
    tags: ['source-tag-kixxl-proxy-product'],
    options: [{ name: 'Size', values: ['11.6 x 5.33-POU7'] }, { name: 'kixxl-size', values: ['2" x 2"'] }],
    variants: [
      {
        sku: 'DTFVA-SUB-PROXY',
        title: '11.6 x 5.33-POU7',
        options: { Size: '11.6 x 5.33-POU7', 'kixxl-size': '2" x 2"' },
        price: '0.98',
        sourcePrice: '1.98',
        flags: [],
      },
    ],
  }
  const catalog = buildFrontendCatalog({
    products: [product, proxyProduct],
    collections: [{ handle: 'dtfva-all', title: 'All Products', description: 'All products.' }],
    pages: [],
  })

  const shopHtml = renderShopPage({ ...catalog, products: publicStorefrontProducts(catalog.products) }, { siteUrl: 'https://www.hatfieldmccoydtf.com' })
  const collectionHtml = renderCollectionPage(catalog.collections[0], publicStorefrontProducts(catalog.products), { siteUrl: 'https://www.hatfieldmccoydtf.com' })
  const sitemap = renderSitemapXml([
    ...publicStorefrontProducts(catalog.products),
    ...catalog.collections,
  ], { siteUrl: 'https://www.hatfieldmccoydtf.com' })

  assert.match(shopHtml, /dtfva-custom-dtf-transfers/)
  assert.doesNotMatch(shopHtml, /dtfva-custom-sublimation-transfers-by-size-1/)
  assert.doesNotMatch(collectionHtml, /11\.6 x 5\.33-POU7/)
  assert.doesNotMatch(sitemap, /dtfva-custom-sublimation-transfers-by-size-1/)
})

test('routes non-transfer proxy products to contact instead of the gang sheet builder', () => {
  const proxyProduct = {
    ...product,
    handle: 'dtfva-photo-magnets-4',
    title: 'Photo Magnets',
    productType: 'kixxl_rolling_canvas_product_hidden',
    tags: ['source-tag-kixxl-proxy-product'],
    variants: [
      {
        sku: 'MAGNET-PROXY',
        title: '8 x 10-ABCD',
        options: { Size: '8 x 10-ABCD' },
        price: '6.00',
        sourcePrice: '7.00',
        flags: [],
      },
    ],
  }
  const catalog = buildFrontendCatalog({ products: [proxyProduct], collections: [], pages: [] })
  const html = renderProductPage(catalog.products[0], { siteUrl: 'https://www.hatfieldmccoydtf.com' })

  assert.equal(catalog.products[0].internalActionUrl, '/contact')
  assert.match(html, /class="btn primary feature-cta" href="\/contact">Request product help<\/a>/)
  assert.doesNotMatch(html, /8 x 10-ABCD/)
})

test('large non-proxy variant lists render as a capped customer-facing starting set', () => {
  const largeProduct = {
    ...product,
    handle: 'dtfva-large-shirt',
    title: 'Custom Shirt',
    productType: 'Apparel',
    tags: ['apparel'],
    variants: Array.from({ length: 90 }, (_, index) => ({
      sku: `SHIRT-${index}`,
      title: `Size ${index}`,
      options: { Size: `Size ${index}` },
      price: '12.00',
      sourcePrice: '13.00',
      flags: [],
    })),
  }
  const catalog = buildFrontendCatalog({ products: [largeProduct], collections: [], pages: [] })
  const html = renderProductPage(catalog.products[0], { siteUrl: 'https://www.hatfieldmccoydtf.com' })

  assert.match(html, /This product has 90 available configurations/)
  assert.match(html, /Size 35/)
  assert.doesNotMatch(html, /Size 36/)
})

test('does not route non-transfer products into the builder just because the imported product type says gang sheet', () => {
  const signageProduct = {
    ...product,
    handle: 'dtfva-indoor-floor-graphics',
    title: 'Indoor Floor Graphics',
    productType: 'Gang Sheet',
    tags: ['competitor-parity', 'source-dtf-virginia', 'source-tag-gang-sheet'],
    variants: [
      {
        sku: 'FLOOR-24X24',
        sourceVariantId: '444',
        title: '24" x 24"',
        options: { Size: '24" x 24"' },
        price: '31.93',
        sourcePrice: '32.93',
        flags: [],
        storefront_variant_id: 'gid://shopify/ProductVariant/444',
      },
    ],
  }

  const catalog = buildFrontendCatalog({ products: [signageProduct], collections: [], pages: [] })
  const html = renderProductPage(catalog.products[0], { siteUrl: 'https://www.hatfieldmccoydtf.com' })

  assert.match(html, /Choose a size or product option, add it to the cart, upload artwork, and move straight into Shopify checkout/i)
  assert.match(html, /Add selected option<\/button>/)
  assert.doesNotMatch(html, /class="btn primary feature-cta" href="\/gang-sheet-builder">Open builder<\/a>/)
})

test('renders sitemap with only indexable URLs and robots for launch state', () => {
  const sitemap = renderSitemapXml([
    { url: '/products/live-product', indexable: true },
    { url: '/products/draft-product', indexable: false },
  ], { siteUrl: 'https://www.hatfieldmccoydtf.com' })
  const robots = renderRobotsTxt({ launched: true, sitemapUrl: 'https://www.hatfieldmccoydtf.com/sitemap.xml' })

  assert.match(sitemap, /\/products\/live-product/)
  assert.doesNotMatch(sitemap, /draft-product/)
  assert.match(robots, /Allow: \//)
  assert.match(robots, /Sitemap: https:\/\/www\.hatfieldmccoydtf\.com\/sitemap\.xml/)
})
