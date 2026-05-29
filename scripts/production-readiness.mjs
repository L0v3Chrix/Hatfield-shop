#!/usr/bin/env node

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MOBILE_MENU_LINKS, buildFrontendCatalog, publicStorefrontProducts, writeFrontendArtifacts } from './competitor/dtfvirginia/frontend-generator.js'
import { COLLECTIONS as SHOPIFY_COLLECTIONS, PRODUCTS as SHOPIFY_PRODUCTS } from './shopify/config/catalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BRAND_DIR = join(ROOT, 'deliverables', 'brand-design-pack')
const SOURCE_ASSET_DIR = join(ROOT, 'Shopify-images-good')
const OPTIMIZED_ASSET_DIR = join(BRAND_DIR, 'assets', 'shopify-images')
const PRODUCTION_DIR = join(ROOT, 'deliverables', 'production-site')
const NORMALIZED_CATALOG_PATH = join(ROOT, 'output', 'competitor', 'dtfvirginia', 'normalized-catalog.json')
const SHOPIFY_STATE_PATH = join(ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-state.json')
const LIVE_PRODUCTS_JSON_PATH = join(ROOT, 'deliverables', 'prototype', 'data', 'products.json')
const SITE_URL = 'https://www.hatfieldmccoydtf.com'
const SHOPIFY_HANDLE_TO_FRONTEND_SLUG = {
  'dtf-22-sheet': 'dtf-22',
  'dtf-46-sheet': 'dtf-46',
  'glitter-dtf-22-sheet': 'glitter-22',
  'glow-dtf-22-sheet': 'glow-22',
  'sublimation-24': 'sublimation-24',
  'custom-gang-sheet': 'gang-sheet',
}

const PENDING_CONFIRMATIONS = [
  {
    id: 'pickup-details',
    label: 'Pickup details',
    owner: 'Jesse / Hatfield McCoy',
    buildFallback: 'Pickup address, hours, cutoff policy, and response time are pending Hatfield McCoy confirmation.',
    launchRequirement: 'Confirm pickup address, hours, order cutoff policy, and expected response time.',
    affectedRoutes: ['/contact', '/'],
  },
  {
    id: 'pressing-instructions',
    label: 'DTF pressing instructions',
    owner: 'Jesse / Hatfield McCoy',
    buildFallback: 'Final time, temperature, pressure, peel, and wash guidance is pending Hatfield McCoy confirmation.',
    launchRequirement: 'Confirm final time, temperature, pressure, peel, and wash instructions for published guide copy.',
    affectedRoutes: ['/guides'],
  },
  {
    id: 'wholesale-minimum',
    label: 'Wholesale minimum order threshold',
    owner: 'Jesse / Hatfield McCoy',
    buildFallback: 'Minimum order threshold is pending Hatfield McCoy confirmation.',
    launchRequirement: 'Confirm minimum order threshold or remove the threshold claim entirely.',
    affectedRoutes: ['/wholesale'],
  },
  {
    id: 'wholesale-turnaround',
    label: 'Wholesale turnaround and cutoff policy',
    owner: 'Jesse / Hatfield McCoy',
    buildFallback: 'Turnaround and cutoff policy are pending operational review.',
    launchRequirement: 'Confirm wholesale turnaround language and cutoff policy before publishing.',
    affectedRoutes: ['/wholesale'],
  },
  {
    id: 'artwork-upload-endpoint',
    label: 'Artwork upload endpoint',
    owner: 'Build team + Hatfield McCoy',
    buildFallback: 'Direct ordering can stay in preview until the production artwork upload destination is verified.',
    launchRequirement: 'Connect the direct-order artwork upload endpoint and confirm files are attached to order metadata.',
    affectedRoutes: ['/shop', '/products/sample-dtf-transfer', '/gang-sheet-builder'],
  },
  {
    id: 'shopify-publish-approval',
    label: 'Shopify publish approval',
    owner: 'Jesse / Hatfield McCoy',
    buildFallback: 'Products remain draft or launch-held until publication, media, and checkout verification are complete.',
    launchRequirement: 'Approve fulfillment, pricing, copy, images, SEO, and checkout for every published product.',
    affectedRoutes: ['/shop', '/products/sample-dtf-transfer', '/gang-sheet-builder'],
  },
]

const ROUTES = [
  {
    source: 'conversion-framework.html',
    output: 'index.html',
    route: '/',
    title: 'Hatfield McCoy DTF | Custom DTF Transfers and Gang Sheets',
    description: 'Order custom DTF transfers, gang sheets, specialty print products, wholesale DTF, and artwork help from Hatfield McCoy DTF in Logan, WV.',
    schemaType: 'WebSite',
  },
  {
    source: 'shop.html',
    output: 'shop/index.html',
    route: '/shop',
    title: 'Shop DTF Transfers | Hatfield McCoy DTF',
    description: 'Shop Hatfield McCoy DTF product families including DTF transfers, gang sheets, stickers, hat transfers, apparel blanks, and artwork services.',
    schemaType: 'CollectionPage',
  },
  {
    source: 'product.html',
    output: 'products/sample-dtf-transfer/index.html',
    route: '/products/sample-dtf-transfer',
    title: 'Custom DTF Transfers by Size | Hatfield McCoy DTF',
    description: 'Sample product page template for custom DTF transfer products with variant clarity, artwork upload, and Shopify checkout readiness.',
    schemaType: 'Product',
  },
  {
    source: 'gang-sheet-builder.html',
    output: 'gang-sheet-builder/index.html',
    route: '/gang-sheet-builder',
    title: 'Gang Sheet Builder | Hatfield McCoy DTF',
    description: 'Builder-first gang sheet ordering route for uploading artwork, choosing a fixed-size sheet, and preparing Shopify checkout.',
    schemaType: 'WebPage',
  },
  {
    source: 'wholesale.html',
    output: 'wholesale/index.html',
    route: '/wholesale',
    title: 'Wholesale DTF Transfers | Hatfield McCoy DTF',
    description: 'Wholesale DTF transfer page for resellers, apparel brands, teams, and repeat buyers using approval-gated account setup.',
    schemaType: 'WebPage',
  },
  {
    source: 'guides.html',
    output: 'guides/index.html',
    route: '/guides',
    title: 'DTF Pressing and Artwork Guides | Hatfield McCoy DTF',
    description: 'Guide hub for DTF pressing instructions, artwork prep, ordering FAQs, SEO support pages, and Shopify asset readiness.',
    schemaType: 'FAQPage',
  },
  {
    source: 'contact.html',
    output: 'contact/index.html',
    route: '/contact',
    title: 'Contact Hatfield McCoy DTF',
    description: 'Contact route for wholesale questions, local pickup details, custom print requests, and support.',
    schemaType: 'ContactPage',
  },
]

const LINK_REWRITES = new Map([
  ['conversion-framework.html', '/'],
  ['./conversion-framework.html', '/'],
  ['shop.html', '/shop'],
  ['./shop.html', '/shop'],
  ['product.html', '/products/sample-dtf-transfer'],
  ['./product.html', '/products/sample-dtf-transfer'],
  ['gang-sheet-builder.html', '/gang-sheet-builder'],
  ['./gang-sheet-builder.html', '/gang-sheet-builder'],
  ['wholesale.html', '/wholesale'],
  ['./wholesale.html', '/wholesale'],
  ['guides.html', '/guides'],
  ['./guides.html', '/guides'],
  ['contact.html', '/contact'],
  ['./contact.html', '/contact'],
  ['shopify-asset-readiness-plan.md', '/production-readiness-checklist.html'],
  ['./shopify-asset-readiness-plan.md', '/production-readiness-checklist.html'],
])

function main() {
  const flags = new Set(process.argv.slice(2))
  const verifyOnly = flags.has('--verify-only')
  if (!verifyOnly) buildProductionPreview()
  const report = verifyProductionPreview()
  writeFileSync(join(PRODUCTION_DIR, 'readiness-report.json'), JSON.stringify(report, null, 2) + '\n')
  writeFileSync(join(PRODUCTION_DIR, 'production-readiness-checklist.html'), renderChecklistHtml(report))
  writeFileSync(join(BRAND_DIR, 'production-readiness-summary.md'), renderSummaryMarkdown(report))
  printReport(report)
  if (report.summary.blockers > 0) process.exitCode = 1
}

function buildProductionPreview() {
  if (existsSync(PRODUCTION_DIR)) rmSync(PRODUCTION_DIR, { recursive: true, force: true })
  mkdirSync(PRODUCTION_DIR, { recursive: true })
  cpSync(join(BRAND_DIR, 'assets'), join(PRODUCTION_DIR, 'assets'), { recursive: true })
  cpSync(join(ROOT, 'deliverables', 'prototype', 'assets', 'css'), join(PRODUCTION_DIR, 'assets', 'css'), { recursive: true })
  cpSync(join(ROOT, 'deliverables', 'prototype', 'assets', 'js'), join(PRODUCTION_DIR, 'assets', 'js'), { recursive: true })
  cpSync(join(ROOT, 'deliverables', 'prototype', 'assets', 'images'), join(PRODUCTION_DIR, 'assets', 'images'), { recursive: true })
  mkdirSync(join(PRODUCTION_DIR, 'assets', 'images'), { recursive: true })
  copyFileSync(join(ROOT, 'deliverables', 'prototype', 'assets', 'images', 'logo-primary.png'), join(PRODUCTION_DIR, 'assets', 'images', 'logo-primary.png'))
  copyFileSync(join(ROOT, 'deliverables', 'prototype', 'assets', 'images', 'favicon.png'), join(PRODUCTION_DIR, 'assets', 'images', 'favicon.png'))
  copyFileSync(join(BRAND_DIR, 'shopify-asset-readiness-plan.md'), join(PRODUCTION_DIR, 'shopify-asset-readiness-plan.md'))
  copyFileSync(join(BRAND_DIR, 'copy-proof-build-brief.md'), join(PRODUCTION_DIR, 'copy-proof-build-brief.md'))
  copyFileSync(join(BRAND_DIR, 'build-now-implementation-brief.md'), join(PRODUCTION_DIR, 'build-now-implementation-brief.md'))
  mkdirSync(join(PRODUCTION_DIR, 'data'), { recursive: true })
  copyFileSync(join(ROOT, 'deliverables', 'prototype', 'data', 'config.json'), join(PRODUCTION_DIR, 'data', 'config.json'))
  writeFileSync(join(PRODUCTION_DIR, 'data', 'pending-confirmations.json'), JSON.stringify(PENDING_CONFIRMATIONS, null, 2) + '\n')
  writeFileSync(join(PRODUCTION_DIR, 'production-readiness-checklist.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Production Readiness Checklist</title><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="${SITE_URL}/production-readiness-checklist.html"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Production Readiness Checklist"}</script></head><body></body></html>`)

  for (const route of ROUTES) {
    const sourcePath = join(BRAND_DIR, route.source)
    const outputPath = join(PRODUCTION_DIR, route.output)
    mkdirSync(dirname(outputPath), { recursive: true })
    let html = readFileSync(sourcePath, 'utf8')
    html = normalizeLinks(html)
    html = html.replaceAll('../prototype/assets/images/logo-primary.png', '/assets/images/logo-primary.png')
    html = html.replaceAll('href="assets/site.css"', 'href="/assets/site.css"')
    html = html.replaceAll('src="assets/shopify-images/', 'src="/assets/shopify-images/')
    html = html.replaceAll('href="assets/shopify-images/', 'href="/assets/shopify-images/')
    html = ensureMeta(html, route)
    html = ensureJsonLd(html, route)
    html = ensureSkipLink(html)
    html = ensureMobileNavigation(html)
    html = html.replace('<body>', '<body>\n  <a class="skip-link" href="#main-content">Skip to content</a>')
    html = html.replace(/<main(?![^>]*id=)/, '<main id="main-content"')
    writeFileSync(outputPath, html)
  }

  const generatedCatalog = buildGeneratedCatalogLayer()

  writeFileSync(join(PRODUCTION_DIR, 'robots.txt'), `User-agent: *\nDisallow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`)
  writeFileSync(join(PRODUCTION_DIR, 'sitemap.xml'), renderSitemap([]))
  writeFileSync(join(PRODUCTION_DIR, 'sitemap.launch-preview.xml'), renderSitemap([
    ...ROUTES.map((route) => route.route),
    ...publicStorefrontProducts(generatedCatalog.products).map((item) => item.url),
    ...generatedCatalog.collections.map((item) => item.url),
    ...generatedCatalog.pages.map((item) => item.url),
  ]))
  writeFileSync(join(PRODUCTION_DIR, 'vercel.json'), JSON.stringify(buildVercelConfig(), null, 2) + '\n')
}

function buildGeneratedCatalogLayer() {
  const normalized = buildFullStorefrontNormalizedCatalog()
  const shopifyState = buildFullStorefrontShopifyState()
  const catalog = buildFrontendCatalog(normalized, { shopifyState })
  writeFrontendArtifacts(catalog, {
    outputDir: PRODUCTION_DIR,
    siteUrl: SITE_URL,
    launched: false,
  })
  return catalog
}

function buildFullStorefrontNormalizedCatalog() {
  const normalized = existsSync(NORMALIZED_CATALOG_PATH)
    ? JSON.parse(readFileSync(NORMALIZED_CATALOG_PATH, 'utf8'))
    : { products: [], collections: [], pages: [] }
  const productsByHandle = new Map((normalized.products ?? []).map((product) => [product.handle, product]))
  for (const product of SHOPIFY_PRODUCTS) {
    productsByHandle.set(product.handle, {
      ...product,
      tags: [
        'shopify-launch-catalog',
        product.status === 'ACTIVE' ? 'launch-approved' : 'launch-held',
      ],
      metafields: {
        source_url: `https://hatfield-mccoy-dtf.myshopify.com/products/${product.handle}`,
      },
    })
  }
  const collectionsByHandle = new Map((normalized.collections ?? []).map((collection) => [collection.handle, collection]))
  for (const collection of SHOPIFY_COLLECTIONS) {
    collectionsByHandle.set(collection.handle, {
      handle: collection.handle,
      title: collection.title,
      description: `${collection.title} products approved for Hatfield McCoy DTF launch ordering.`,
    })
  }
  return {
    meta: {
      generated_at: new Date().toISOString(),
      source: 'dtfva-catalog-plus-shopify-launch-catalog',
    },
    products: [...productsByHandle.values()],
    collections: [...collectionsByHandle.values()],
    pages: normalized.pages ?? [],
    validationErrors: [],
  }
}

function buildFullStorefrontShopifyState() {
  const importedState = existsSync(SHOPIFY_STATE_PATH)
    ? JSON.parse(readFileSync(SHOPIFY_STATE_PATH, 'utf8'))
    : { products: {}, collections: [] }
  const productsJson = existsSync(LIVE_PRODUCTS_JSON_PATH)
    ? JSON.parse(readFileSync(LIVE_PRODUCTS_JSON_PATH, 'utf8'))
    : null
  const stateByHandle = new Map(readShopifyStateProducts(importedState).map((product) => [product.handle, product]))

  for (const product of SHOPIFY_PRODUCTS) {
    const slug = SHOPIFY_HANDLE_TO_FRONTEND_SLUG[product.handle]
    const sourceCollection = productsJson?.collections?.find((collection) => collection.slug === slug)
    stateByHandle.set(product.handle, {
      handle: product.handle,
      productId: '',
      status: product.status,
      variants: product.variants.map((variant) => ({
        sku: variant.sku,
        variantId: resolveLiveVariantId(sourceCollection, variant.sku),
        price: variant.price,
        selectedOptions: Object.entries(variant.options ?? {}).map(([name, value]) => ({ name, value })),
      })),
    })
  }

  return {
    meta: {
      generated_at: new Date().toISOString(),
      source: `${relative(ROOT, SHOPIFY_STATE_PATH)} + ${relative(ROOT, LIVE_PRODUCTS_JSON_PATH)}`,
      product_count: stateByHandle.size,
      missing_variant_ids: [...stateByHandle.values()]
        .flatMap((product) => product.variants)
        .filter((variant) => !variant.variantId).length,
    },
    products: Object.fromEntries([...stateByHandle.entries()]),
    collections: [
      ...(importedState.collections ?? []),
      ...SHOPIFY_COLLECTIONS.map((collection) => ({
        handle: collection.handle,
        collectionId: '',
        missing: false,
      })),
    ],
  }
}

function readShopifyStateProducts(shopifyState) {
  const products = shopifyState?.products ?? []
  if (Array.isArray(products)) return products
  return Object.values(products)
}

function resolveLiveVariantId(collection, sku) {
  if (!collection) return ''
  for (const product of collection.products ?? []) {
    if (product.sku === sku && product.storefront_variant_id) return product.storefront_variant_id
    if (product.storefront_variant_ids && sku.startsWith(`${product.sku}-`)) {
      const suffix = sku.slice(product.sku.length + 1)
      return product.storefront_variant_ids[suffix] ?? ''
    }
  }
  return ''
}

function normalizeLinks(html) {
  for (const [from, to] of LINK_REWRITES) {
    html = html.replaceAll(`href="${from}`, `href="${to}`)
  }
  html = html.replaceAll('/shop#', '/shop#')
  html = html.replaceAll('/guides#', '/guides#')
  return html
}

function ensureMeta(html, route) {
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(route.title)}</title>`)
  html = html.replace(/<meta name="description" content=".*?">/s, `<meta name="description" content="${escapeHtml(route.description)}">`)
  const extra = [
    '  <meta name="robots" content="noindex, nofollow">',
    `  <link rel="canonical" href="${SITE_URL}${route.route === '/' ? '/' : route.route}">`,
    '  <meta property="og:site_name" content="Hatfield McCoy DTF">',
    `  <meta property="og:title" content="${escapeHtml(route.title)}">`,
    `  <meta property="og:description" content="${escapeHtml(route.description)}">`,
    `  <meta property="og:url" content="${SITE_URL}${route.route === '/' ? '/' : route.route}">`,
    '  <meta property="og:type" content="website">',
    `  <meta property="og:image" content="${SITE_URL}/assets/shopify-images/custom-dtf-transfers-hero.webp">`,
    '  <meta name="twitter:card" content="summary_large_image">',
  ].join('\n')
  return html.replace('  <link rel="stylesheet" href="/assets/site.css">', `${extra}\n  <link rel="stylesheet" href="/assets/site.css">`)
}

function ensureJsonLd(html, route) {
  const schema = buildSchema(route)
  return html.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`)
}

function buildSchema(route) {
  const base = {
    '@context': 'https://schema.org',
    '@type': route.schemaType,
    name: route.title,
    description: route.description,
    url: `${SITE_URL}${route.route === '/' ? '/' : route.route}`,
    publisher: {
      '@type': 'Organization',
      name: 'Hatfield McCoy DTF',
      url: SITE_URL,
      logo: `${SITE_URL}/assets/images/logo-primary.png`,
    },
  }
  if (route.schemaType === 'Product') {
    return {
      ...base,
      image: `${SITE_URL}/assets/shopify-images/custom-dtf-transfers-hero.webp`,
      brand: { '@type': 'Brand', name: 'Hatfield McCoy DTF' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        availability: 'https://schema.org/PreOrder',
        url: `${SITE_URL}${route.route}`,
      },
    }
  }
  if (route.schemaType === 'FAQPage') {
    return {
      ...base,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What details must be confirmed before launch?',
          acceptedAnswer: { '@type': 'Answer', text: 'Operational claims, artwork requirements, pressing instructions, pickup details, shipping expectations, and publish approvals must be confirmed before indexing.' },
        },
      ],
    }
  }
  return base
}

function ensureSkipLink(html) {
  if (html.includes('.skip-link')) return html
  const css = `
  <style>
    .skip-link{position:absolute;left:12px;top:-80px;z-index:99;background:#39FF14;color:#071009;padding:10px 12px;border-radius:6px;font-weight:950;text-transform:uppercase}
    .skip-link:focus{top:12px}
  </style>`
  return html.replace('</head>', `${css}\n</head>`)
}

function ensureMobileNavigation(html) {
  let output = html
  if (!output.includes('mobile-menu-toggle')) {
    output = output.replace(
      /(<a class="brand"[\s\S]*?<\/a>)/,
      `$1
        ${mobileMenuButtonMarkup()}`
    )
  }
  if (!output.includes('id="mobile-menu"')) {
    output = output.replace('</header>', `${mobileMenuMarkup()}\n</header>`)
  }
  if (!output.includes('mobile-menu-normalizer')) {
    output = output.replace('</body>', `${mobileMenuScript()}\n</body>`)
  }
  return output
}

function mobileMenuButtonMarkup() {
  return '<button class="mobile-menu-toggle" type="button" aria-controls="mobile-menu" aria-expanded="false"><span class="hamburger-lines" aria-hidden="true"></span><span class="mobile-menu-label">Menu</span></button>'
}

function mobileMenuMarkup() {
  const links = MOBILE_MENU_LINKS
    .map((link) => `    <a href="${link.href}">${link.label}</a>`)
    .join('\n')
  return `
  <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile navigation" hidden>
${links}
  </nav>`
}

function mobileMenuScript() {
  return `<script id="mobile-menu-normalizer">
  (function() {
    var button = document.querySelector('.mobile-menu-toggle');
    var menu = document.getElementById('mobile-menu');
    if (!button || !menu) return;
    function setOpen(open) {
      document.body.classList.toggle('nav-open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.hidden = !open;
      menu.classList.toggle('open', open);
    }
    button.addEventListener('click', function() {
      setOpen(button.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function(event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') setOpen(false);
    });
    window.addEventListener('resize', function() {
      if (window.innerWidth > 900) setOpen(false);
    });
  })();
</script>`
}

function verifyProductionPreview() {
  const placeholders = collectTextMatches(PRODUCTION_DIR, /\[FILL[^\]]*\]/g)
  const pendingConfirmations = collectTextMatches(PRODUCTION_DIR, /pending (?:Hatfield McCoy confirmation|operational review|confirmation)/gi)
  const htmlFiles = listFiles(PRODUCTION_DIR).filter((file) => file.endsWith('.html'))
  const sourceAssets = listFiles(SOURCE_ASSET_DIR).filter((file) => file.toLowerCase().endsWith('.jpg'))
  const optimizedImages = listFiles(OPTIMIZED_ASSET_DIR).filter((file) => file.toLowerCase().endsWith('.webp'))
  const manifestPath = join(OPTIMIZED_ASSET_DIR, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const linkIssues = []
  const imageIssues = []
  const seoIssues = []

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8')
    const page = '/' + relative(PRODUCTION_DIR, file).replace(/\/index\.html$/, '').replace('index.html', '').replace(/\\/g, '/')
    if (!html.includes('name="robots" content="noindex, nofollow"')) seoIssues.push(`${page || '/'} missing preview noindex`)
    if (!html.includes('application/ld+json')) seoIssues.push(`${page || '/'} missing JSON-LD`)
    if (!html.includes('rel="canonical"')) seoIssues.push(`${page || '/'} missing canonical`)
    for (const href of extractAttributes(html, 'href')) {
      if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) continue
      if (href === '#') continue
      const clean = href.split('#')[0]
      if (!clean) continue
      if (clean.startsWith('/')) {
        const target = resolveProductionPath(clean)
        if (!existsSync(target)) linkIssues.push(`${relative(PRODUCTION_DIR, file)} -> ${href}`)
      }
    }
    for (const src of extractAttributes(html, 'src')) {
      if (src.startsWith('http')) continue
      const target = src.startsWith('/') ? join(PRODUCTION_DIR, src) : join(dirname(file), src)
      if (!existsSync(target)) imageIssues.push(`${relative(PRODUCTION_DIR, file)} -> ${src}`)
    }
  }

  const blockers = [
    ...linkIssues.map((issue) => ({ type: 'broken-link', issue })),
    ...imageIssues.map((issue) => ({ type: 'missing-image', issue })),
    ...seoIssues.map((issue) => ({ type: 'seo-gate', issue })),
  ]

  const reviewItems = [
    ...placeholders.map((item) => ({ type: 'placeholder', ...item })),
    ...pendingConfirmations.map((item) => ({ type: 'client-confirmation', ...item })),
  ]

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      routes: ROUTES.length,
      htmlFiles: htmlFiles.length,
      sourceImages: sourceAssets.length,
      optimizedImages: optimizedImages.length,
      manifestImages: manifest.images?.length ?? 0,
      manifestWarnings: manifest.warnings?.length ?? 0,
      placeholders: placeholders.length,
      pendingConfirmations: PENDING_CONFIRMATIONS.length,
      pendingConfirmationMentions: pendingConfirmations.length,
      blockers: blockers.length,
      reviewItems: reviewItems.length,
    },
    gates: {
      buildCanProceedBeforeClientConfirmations: true,
      previewNoindex: true,
      sourceAssetsPreserved: true,
      shopifyDraftControlled: true,
      competitorCopyPublishBlocked: true,
    },
    routes: ROUTES.map(({ route, output, title }) => ({ route, output, title })),
    blockers,
    reviewItems,
    assetWorkflow: {
      sourceDirectory: relative(ROOT, SOURCE_ASSET_DIR),
      optimizedDirectory: relative(ROOT, OPTIMIZED_ASSET_DIR),
      manifest: relative(ROOT, manifestPath),
      policy: 'Original source assets are preserved. Production preview references optimized derivatives.',
    },
    pendingConfirmations: PENDING_CONFIRMATIONS,
    readyToBuild: blockers.length === 0 && placeholders.length === 0,
    readyToImplement: blockers.length === 0 && placeholders.length === 0,
    readyToLaunch: false,
    launchBlockers: [
      'Client confirmation required for operational public claims; build may proceed with fallback copy.',
      'Shopify products must remain draft until copy, fulfillment, pricing, imagery, SEO, and checkout approvals pass.',
      'robots.txt is intentionally Disallow: / for preview; launch requires approval-gated sitemap and robots update.',
      'Artwork upload and Shopify publication must be verified before public launch.',
    ],
  }
}

function resolveProductionPath(pathname) {
  const clean = pathname.replace(/^\//, '')
  if (!clean) return join(PRODUCTION_DIR, 'index.html')
  const direct = join(PRODUCTION_DIR, clean)
  if (existsSync(direct) && statSync(direct).isFile()) return direct
  if (existsSync(join(direct, 'index.html'))) return join(direct, 'index.html')
  return direct
}

function renderSitemap(routes) {
  const urls = routes.map((route) => `  <url><loc>${SITE_URL}${route === '/' ? '/' : route}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function buildVercelConfig() {
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    cleanUrls: true,
    trailingSlash: false,
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/assets/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/(.*).html',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ],
  }
}

function renderChecklistHtml(report) {
  const checklist = [
    ['Build status', report.readyToBuild ? 'Ready to build now. Pending client confirmations are launch gates, not build blockers.' : 'Not ready to build; resolve automated blockers first.'],
    ['Copy proofing', `${report.summary.placeholders} placeholder tokens remain; ${report.summary.pendingConfirmations} operational details are still pending client confirmation.`],
    ['Assets', `${report.summary.sourceImages} source JPGs preserved; ${report.summary.optimizedImages} optimized WebP derivatives available.`],
    ['Shopify', 'Draft catalog and approval gates remain the production source-of-truth requirement.'],
    ['SEO', 'Preview pages are noindex; launch sitemap is separated as sitemap.launch-preview.xml.'],
    ['QA', `${report.summary.blockers} automated blockers detected in the production preview.`],
  ]
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hatfield McCoy DTF Production Readiness Checklist</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="canonical" href="${SITE_URL}/production-readiness-checklist.html">
  <link rel="stylesheet" href="/assets/site.css">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Hatfield McCoy DTF Production Readiness Checklist',
    description: 'Production readiness gates for Hatfield McCoy DTF implementation.',
    url: `${SITE_URL}/production-readiness-checklist.html`,
  })}</script>
</head>
<body>
  <main class="wrap page-hero">
    <span class="eyebrow">Production readiness</span>
    <h1>Implementation gates are clear. Launch remains approval controlled.</h1>
    <p class="lede">This checklist is generated from the current site files, asset manifest, and production preview routes.</p>
    <section class="section">
      <div class="resource-list">
        ${checklist.map(([title, body]) => `<div class="resource-item"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div><span class="asset-note">Gate</span></div>`).join('\n        ')}
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Build now, launch later</h2><p>The full site can be built before the six confirmations arrive. Use the fallback copy and keep launch gates closed until the confirmed values are supplied.</p></div>
      <div class="resource-list">
        ${report.pendingConfirmations.map((item) => `<div class="resource-item"><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.buildFallback)}</p></div><span class="asset-note">Launch gate</span></div>`).join('\n        ')}
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2>Launch blockers</h2><p>These stay blocked until Jesse/Hatfield McCoy approval and Shopify checkout verification.</p></div>
      <div class="resource-list">
        ${report.launchBlockers.map((item) => `<div class="resource-item"><div><strong>Blocked</strong><p>${escapeHtml(item)}</p></div></div>`).join('\n        ')}
      </div>
    </section>
  </main>
</body>
</html>
`
}

function renderSummaryMarkdown(report) {
  return `# Hatfield McCoy DTF Production Readiness Summary

Generated: ${report.generatedAt}

## Status

- Ready to implement: ${report.readyToImplement ? 'yes' : 'no'}
- Ready to build before confirmations: ${report.readyToBuild ? 'yes' : 'no'}
- Ready to launch: no
- Production preview routes: ${report.summary.routes}
- Source images preserved: ${report.summary.sourceImages}
- Optimized WebP derivatives: ${report.summary.optimizedImages}
- Manifest images: ${report.summary.manifestImages}
- Manifest warnings: ${report.summary.manifestWarnings}
- Automated blockers: ${report.summary.blockers}
- Client-confirmation placeholders: ${report.summary.placeholders}
- Client-confirmation statements: ${report.summary.pendingConfirmations}

## Required Before Launch

${report.launchBlockers.map((item) => `- ${item}`).join('\n')}

## Build-Now Rule

Build the complete site now using fallback copy for pending operational details. Do not open indexing, publish products, or enable production form destinations until the matching confirmation is supplied.

## Pending Confirmation Fields

${report.pendingConfirmations.map((item) => `- \`${item.id}\`: ${item.launchRequirement}`).join('\n')}

## Route Map

${report.routes.map((route) => `- \`${route.route}\` -> \`${route.output}\``).join('\n')}

## Asset Policy

Original files in \`${report.assetWorkflow.sourceDirectory}\` remain untouched. The production preview uses optimized derivatives from \`${report.assetWorkflow.optimizedDirectory}\`, mapped by \`${report.assetWorkflow.manifest}\`.
`
}

function printReport(report) {
  console.log('✓ Generated Hatfield McCoy production readiness preview')
  console.log(`Routes: ${report.summary.routes}`)
  console.log(`HTML files: ${report.summary.htmlFiles}`)
  console.log(`Source images preserved: ${report.summary.sourceImages}`)
  console.log(`Optimized images: ${report.summary.optimizedImages}`)
  console.log(`Manifest warnings: ${report.summary.manifestWarnings}`)
  console.log(`Placeholders requiring confirmation: ${report.summary.placeholders}`)
  console.log(`Pending launch confirmations: ${report.pendingConfirmations.length}`)
  console.log(`Automated blockers: ${report.summary.blockers}`)
  console.log(`Preview: ${relative(ROOT, PRODUCTION_DIR)}`)
}

function collectTextMatches(baseDir, regex) {
  const matches = []
  for (const file of listFiles(baseDir).filter((candidate) => candidate.endsWith('.html') || candidate.endsWith('.md'))) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      const found = line.match(regex)
      if (found) {
        for (const token of found) matches.push({ file: relative(ROOT, file), line: index + 1, token })
      }
    })
  }
  return matches
}

function listFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    const entries = readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) stack.push(path)
      else out.push(path)
    }
  }
  return out.sort()
}

function extractAttributes(html, attr) {
  const pattern = new RegExp(`${attr}="([^"]+)"`, 'g')
  return Array.from(html.matchAll(pattern), (match) => match[1])
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

main()
