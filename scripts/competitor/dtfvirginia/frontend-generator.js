import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildApprovalState,
  buildSeoRecord,
  createProductSeoDescription,
  rewriteCollectionCopy,
  rewriteProductCopy,
  rewriteServicePageCopy,
} from './copy-seo.js'
import { IMAGE_FAMILIES, resolveCollectionImages, resolveProductImages } from './asset-map.js'

const DEFAULT_SITE_URL = 'https://www.hatfieldmccoydtf.com'
const DEFAULT_IMAGE = '/assets/images/logo-primary.png'
export const MOBILE_MENU_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/gang-sheet-builder', label: 'Build a sheet' },
  { href: '/collections/dtf-transfers', label: 'DTF transfers' },
  { href: '/collections/glitter-dtf', label: 'Glitter DTF' },
  { href: '/collections/sublimation', label: 'Sublimation' },
  { href: '/wholesale', label: 'Wholesale' },
  { href: '/guides', label: 'Guides' },
  { href: '/contact', label: 'Contact' },
]

export function buildFrontendCatalog(normalized, { shopifyState = null } = {}) {
  const launched = process.env.HM_LAUNCHED === '1'
  const shopifyByHandle = new Map(readShopifyProducts(shopifyState).map((product) => [product.handle, product]))
  const products = (normalized.products ?? []).map((product) => {
    const displayProduct = { ...product, title: publicTitle(product.title), productType: publicProductType(product.productType) }
    const internalProxy = isInternalBuilderProxyProduct(product)
    const shopifyProduct = shopifyByHandle.get(product.handle)
    const variantIdBySku = new Map((shopifyProduct?.variants ?? []).map((variant) => [variant.sku, variant.variantId]))
    const copy = { ...rewriteProductCopy(displayProduct), ...(product.copyOverrides ?? {}) }
    const tags = unique([...(product.tags ?? []), ...copy.approvalTags])
    // Live Shopify status must win over the normalized snapshot's status —
    // otherwise products activated after import keep an 'unpublished' blocker.
    const approval = buildApprovalState({ ...product, tags, shopifyStatus: shopifyProduct?.status })
    const variants = (product.variants ?? []).map((variant) => {
      const merchandiseId = variantIdBySku.get(variant.sku) ?? variant.storefront_variant_id ?? variant.merchandiseId ?? ''
      return {
        sku: variant.sku,
        title: variant.title,
        options: variant.options,
        price: variant.price,
        sourcePrice: variant.sourcePrice,
        flags: variant.flags ?? [],
        merchandiseId,
        checkoutEnabled: approval.publishable && !!merchandiseId,
      }
    })
    const firstPrice = firstDisplayPrice({ variants })
    const seoDescription = createProductSeoDescription(displayProduct, copy)
    const seo = buildSeoRecord({
      kind: 'product',
      handle: product.handle,
      title: displayProduct.title,
      description: seoDescription,
      urlPath: `/products/${product.handle}`,
      price: firstPrice,
      availability: approval.publishable ? 'InStock' : 'PreOrder',
      indexable: approval.indexable,
    })

    return {
      handle: product.handle,
      shopifyProductId: shopifyProduct?.productId ?? '',
      shopifyStatus: shopifyProduct?.status ?? product.status,
      title: displayProduct.title,
      productType: displayProduct.productType,
      rawProductType: product.productType ?? '',
      vendor: product.vendor,
      url: `/products/${product.handle}`,
      internalProxy,
      publicVisible: !internalProxy && product.publicVisible !== false,
      internalActionUrl: internalProxyProductActionUrl(product),
      status: product.status,
      tags,
      indexable: approval.indexable,
      publishable: approval.publishable,
      blockers: approval.blockers,
      copy,
      offerCopy: product.offerCopy ?? '',
      forceDirectBuy: product.forceDirectBuy === true,
      notes: product.notes ?? [],
      cardNote: product.cardNote ?? '',
      seo,
      variants,
      images: [],
      sourceUrl: product.metafields?.source_url ?? '',
    }
  })

  const collections = (normalized.collections ?? []).map((collection) => {
    const copy = rewriteCollectionCopy(collection)
    const seo = buildSeoRecord({
      kind: 'collection',
      handle: collection.handle,
      title: collection.title,
      description: copy.shortDescription,
      urlPath: `/collections/${collection.handle}`,
      indexable: launched,
    })
    return {
      handle: collection.handle,
      title: collection.title,
      url: `/collections/${collection.handle}`,
      description: collection.description,
      indexable: launched,
      copy,
      seo,
    }
  })

  const pages = dedupePages((normalized.pages ?? []).map((page) => {
    const copy = rewriteServicePageCopy(page)
    const seo = buildSeoRecord({
      kind: 'page',
      handle: copy.handle,
      title: copy.title,
      description: `${copy.title} from Hatfield McCoy DTF in Logan, WV with nationwide shipping and human-reviewed service details.`,
      urlPath: `/pages/${copy.handle}`,
      indexable: launched,
    })
    return {
      handle: copy.handle,
      title: copy.title,
      url: `/pages/${copy.handle}`,
      indexable: launched,
      copy,
      seo,
      sourceUrl: page.sourceUrl,
    }
  }))

  const groups = buildShopGroups(normalized.shopGroups ?? [], products)

  return {
    meta: {
      generated_at: new Date().toISOString(),
      source: normalized.meta?.source ?? 'dtfvirginia.com',
      shop_group_count: groups.length,
      product_count: products.length,
      public_product_count: publicStorefrontProducts(products).length,
      internal_proxy_product_count: products.filter((product) => product.internalProxy).length,
      variant_count: products.reduce((sum, product) => sum + product.variants.length, 0),
      public_variant_count: publicStorefrontProducts(products).reduce((sum, product) => sum + product.variants.length, 0),
      collection_count: collections.length,
      page_count: pages.length,
    },
    products,
    collections,
    pages,
    groups,
  }
}

// Owner-configured shop consolidation (catalog-edits.json shopGroups): one card
// per group on /shop with item + variant selectors. Members keep their PDPs.
// A member is dropped (warn) when it isn't a live public product in THIS build —
// core (non-dtfva) members only exist in the production build. A group with
// fewer than 2 surviving members dissolves back to individual cards.
function buildShopGroups(shopGroups, products) {
  const byHandle = new Map(products.map((product) => [product.handle, product]))
  const groups = []
  for (const group of shopGroups) {
    const members = []
    for (const handle of group.members ?? []) {
      const product = byHandle.get(handle)
      if (!product || product.publicVisible === false || product.internalProxy) {
        console.warn(`[shop-groups] ${group.id}: dropping member ${handle} (not a live public product in this build)`)
        continue
      }
      const buyableVariants = product.variants
        .filter((variant) => variant.checkoutEnabled && variant.merchandiseId && variantDisplayPrice(variant) !== null)
        .map((variant) => ({
          sku: variant.sku,
          title: variant.title || variant.sku,
          label: `${variant.title || variant.sku} — $${variantDisplayPrice(variant)}`,
          price: variantDisplayPrice(variant),
          merchandiseId: variant.merchandiseId,
        }))
      const route = buyerRoute(product)
      if (route === 'order-online' && buyableVariants.length === 0) {
        console.warn(`[shop-groups] ${group.id}: dropping member ${handle} (order-online but zero buyable variants)`)
        continue
      }
      members.push({
        handle: product.handle,
        title: product.title,
        url: product.url,
        route,
        variantCount: product.variants.length,
        variants: route === 'order-online' ? buyableVariants : [],
      })
    }
    if (members.length < 2) {
      if ((group.members ?? []).length) console.warn(`[shop-groups] ${group.id}: dissolved (${members.length} surviving member)`)
      continue
    }
    const imageProduct = byHandle.get(group.imageHandle) ?? byHandle.get(members[0].handle)
    groups.push({
      id: group.id,
      title: group.title,
      blurb: group.blurb ?? '',
      category: group.category,
      image: imageProduct ? resolveProductImages(imageProduct).card : { src: DEFAULT_IMAGE, alt: group.title },
      members,
    })
  }
  return groups
}

function readShopifyProducts(shopifyState) {
  const products = shopifyState?.products ?? []
  if (Array.isArray(products)) return products
  return Object.values(products)
}

export function writeFrontendArtifacts(frontendCatalog, { outputDir, siteUrl = DEFAULT_SITE_URL, launched = false } = {}) {
  const productsDir = join(outputDir, 'products')
  const collectionsDir = join(outputDir, 'collections')
  const pagesDir = join(outputDir, 'pages')
  const shopDir = join(outputDir, 'shop')
  mkdirSync(shopDir, { recursive: true })
  mkdirSync(productsDir, { recursive: true })
  mkdirSync(collectionsDir, { recursive: true })
  mkdirSync(pagesDir, { recursive: true })

  const publicProducts = publicStorefrontProducts(frontendCatalog.products)
  const publicCatalog = { ...frontendCatalog, products: publicProducts }
  writeFileSync(join(outputDir, 'catalog.json'), JSON.stringify(frontendCatalog, null, 2))
  writeFileSync(join(outputDir, 'sitemap.xml'), renderSitemapXml([
    ...publicProducts,
    ...frontendCatalog.collections,
    ...frontendCatalog.pages,
  ], { siteUrl }))
  writeFileSync(join(outputDir, 'robots.txt'), renderRobotsTxt({ launched, sitemapUrl: `${siteUrl}/sitemap.xml` }))
  writeFileSync(join(shopDir, 'index.html'), renderShopPage(publicCatalog, { siteUrl }))
  writeFileSync(join(productsDir, 'index.html'), renderProductIndexPage(publicProducts, { siteUrl }))
  writeFileSync(join(collectionsDir, 'index.html'), renderCollectionIndexPage(frontendCatalog.collections, publicProducts, { siteUrl }))
  writeFileSync(join(pagesDir, 'index.html'), renderPageIndexPage(frontendCatalog.pages, { siteUrl }))

  for (const product of publicProducts) {
    const html = renderProductPage(product, { siteUrl })
    writeFileSync(join(productsDir, `${product.handle}.html`), html)
    const cleanDir = join(productsDir, product.handle)
    mkdirSync(cleanDir, { recursive: true })
    writeFileSync(join(cleanDir, 'index.html'), html)
  }
  // Proxy stubs only for live products — owner removals (status DRAFT/ARCHIVED
  // via catalog-edits) must not leave orphaned pages behind.
  for (const product of frontendCatalog.products.filter((item) => item.internalProxy && String(item.shopifyStatus ?? item.status ?? '').toUpperCase() === 'ACTIVE')) {
    const html = renderProductPage(product, { siteUrl })
    writeFileSync(join(productsDir, `${product.handle}.html`), html)
    const cleanDir = join(productsDir, product.handle)
    mkdirSync(cleanDir, { recursive: true })
    writeFileSync(join(cleanDir, 'index.html'), html)
  }
  for (const collection of frontendCatalog.collections) {
    const html = renderCollectionPage(collection, publicProducts, { siteUrl })
    writeFileSync(join(collectionsDir, `${collection.handle}.html`), html)
    const cleanDir = join(collectionsDir, collection.handle)
    mkdirSync(cleanDir, { recursive: true })
    writeFileSync(join(cleanDir, 'index.html'), html)
  }
  for (const page of frontendCatalog.pages) {
    const html = renderInfoPage(page, { siteUrl })
    writeFileSync(join(pagesDir, `${page.handle}.html`), html)
    const cleanDir = join(pagesDir, page.handle)
    mkdirSync(cleanDir, { recursive: true })
    writeFileSync(join(cleanDir, 'index.html'), html)
  }

  return {
    catalogPath: join(outputDir, 'catalog.json'),
    productsDir,
    collectionsDir,
    pagesDir,
  }
}

export function renderProductPage(product, { siteUrl = DEFAULT_SITE_URL } = {}) {
  if (String(product.handle ?? '') === 'custom-gang-sheet') {
    const builders = loadKixxlBuilders()
    if (builders) return renderCustomGangSheetPage(product, builders, { siteUrl })
  }
  if (product.internalProxy) return renderInternalProxyProductPage(product, { siteUrl })
  const category = categorizeProduct(product)
  const image = resolveProductImages(product).hero
  const firstPrice = firstDisplayPrice(product)
  const variantCount = product.variants.length
  const orderLabel = orderPathLabel(product)
  const builderProduct = isBuilderProduct(product)
  const primaryVariant = product.variants.find((variant) => variantDisplayPrice(variant)) ?? product.variants[0]
  const shownVariants = variantsForDisplay(product)
  const variantLimitNotice = product.variants.length > shownVariants.length
    ? `<p class="variant-limit-note">This product has ${product.variants.length} available configurations. We show a focused starting set here — ask the shop if you need a size or option you don't see.</p>`
    : ''
  const relatedLinks = [
    ['Shop all products', '/shop'],
    ['DTF transfer collections', '/collections/dtf-transfers'],
    ['Gang sheet options', '/gang-sheet-builder'],
    ['Pressing guide', '/guides'],
  ].map(([label, url]) => `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`).join('')
  const quoteHref = `/contact?product=${encodeURIComponent(product.handle)}`
  const selectorOptions = shownVariants.map((variant) => {
    const price = variantDisplayPrice(variant)
    const label = [variant.title || variant.sku, formatOptions(variant.options)].filter(Boolean).join(' - ')
    return `<option value="${escapeHtml(variant.sku)}">${escapeHtml(label)}${price ? ` - $${escapeHtml(price)}` : ''}</option>`
  }).join('')
  const rows = shownVariants.map((variant) => {
    const price = variantDisplayPrice(variant)
    return `
            <tr>
              <td>${escapeHtml(variant.title || variant.sku)}</td>
              <td>${escapeHtml(formatOptions(variant.options))}</td>
              <td>${price ? `$${escapeHtml(price)}` : 'Quoted'}</td>
              <td>${builderProduct ? `<a class="quote-button table-link" href="/gang-sheet-builder">Open builder</a>` : variant.checkoutEnabled && price ? `<button class="buy-button" data-handle="${escapeHtml(product.handle)}" data-sku="${escapeHtml(variant.sku)}" data-name="${escapeHtml(product.title)}" data-variant="${escapeHtml(variant.title || variant.sku)}" data-price="${escapeHtml(variant.price)}" data-merchandise-id="${escapeHtml(variant.merchandiseId || '')}" data-checkout-ready="true" data-requires-artwork="true">Add to cart</button>` : `<a class="quote-button table-link" href="${escapeHtml(quoteHref)}">Request a quote</a>`}</td>
            </tr>`
  }).join('')
  const primaryCta = builderProduct
    ? `<a class="btn primary feature-cta" href="/gang-sheet-builder">Open builder</a>`
    : primaryVariant?.checkoutEnabled && Number(primaryVariant?.price) > 0
      ? `<button class="buy-button feature-cta" data-handle="${escapeHtml(product.handle)}" data-sku="${escapeHtml(primaryVariant?.sku ?? '')}" data-name="${escapeHtml(product.title)}" data-variant="${escapeHtml(primaryVariant?.title || primaryVariant?.sku || '')}" data-price="${escapeHtml(primaryVariant?.price ?? '')}" data-merchandise-id="${escapeHtml(primaryVariant?.merchandiseId || '')}" data-checkout-ready="true" data-requires-artwork="true">Add selected option</button>`
      : `<a class="quote-button feature-cta" href="${escapeHtml(quoteHref)}">Request a quote</a>`
  return renderShell({
    seo: product.seo,
    siteUrl,
    body: `
      <main class="seo-page product-page">
        ${breadcrumb([{ label: 'Shop', url: '/shop' }, { label: product.title }])}
        <section class="product-hero">
          <div>
            <p class="eyebrow">${escapeHtml(category.label)} · Logan, WV production</p>
            <h1>${escapeHtml(product.title)}</h1>
            <p class="lede">${escapeHtml(product.copy.shortDescription)}</p>
            ${buildOfferSummary(product) ? `<p class="offer-summary">${escapeHtml(buildOfferSummary(product))}</p>` : ''}
            <div class="status-strip" aria-label="Ordering path">
              <span class="route-chip route-${escapeHtml(buyerRoute(product))}">${escapeHtml(orderLabel)}</span>
              ${firstPrice ? `<span>From $${escapeHtml(firstPrice)}</span>` : ''}
              <span>${variantCount} ${variantCount === 1 ? 'option' : 'options'}</span>
              <span>${escapeHtml(product.productType || 'Custom print product')}</span>
            </div>
            <div class="hero-actions">
              <a class="btn primary" href="${builderProduct ? '/gang-sheet-builder' : '#variants'}">${builderProduct ? 'Open builder' : 'Choose options'}</a>
              <a class="btn secondary" href="/guides#artwork">Artwork guide</a>
            </div>
          </div>
          <div class="purchase-panel">
            <img src="${escapeHtml(image.src)}" width="900" height="900" alt="${escapeHtml(image.alt)}" loading="eager" decoding="async">
            <span class="price">${firstPrice ? `From $${escapeHtml(firstPrice)}` : 'Quoted to your spec'}</span>
            <p>${builderProduct ? 'Open the builder to arrange artwork on a fixed-size sheet and move straight into checkout.' : buyerRoute(product) === 'order-online' ? 'Upload your artwork right here, pick a size, and add it to the cart — checkout is direct through Shopify.' : 'Send the artwork and details — the shop will quote the right setup and turnaround.'}</p>
            <label class="variant-select"><span>Start with a variant</span><select id="variant-select">${selectorOptions}</select></label>
            ${!builderProduct && buyerRoute(product) === 'order-online' ? `
            <div class="pdp-qty" aria-label="Quantity">
              <span>Quantity</span>
              <div class="pdp-qty-stepper">
                <button type="button" class="pdp-qty-btn" id="pdp-qty-dec" aria-label="Decrease quantity">&minus;</button>
                <input type="number" id="pdp-qty" min="1" step="1" value="1" inputmode="numeric" aria-label="Quantity">
                <button type="button" class="pdp-qty-btn" id="pdp-qty-inc" aria-label="Increase quantity">+</button>
              </div>
            </div>` : ''}
            ${!builderProduct && buyerRoute(product) === 'order-online' ? `
            <div class="pdp-upload" id="pdp-upload">
              <input type="file" id="pdp-artwork-input" class="pdp-upload-input" accept=".png,.jpg,.jpeg,.pdf,.ai,.eps,image/png,image/jpeg,application/pdf,application/postscript">
              <button type="button" class="pdp-upload-btn" id="pdp-upload-btn"><span aria-hidden="true">&#128206;</span> Upload your artwork</button>
              <p class="pdp-upload-status" id="pdp-upload-status">PNG, JPG, PDF, AI, or EPS &middot; up to 50MB &middot; attaches to your order</p>
            </div>` : ''}
            ${primaryCta}
            <div class="approval-list">
              ${['Artwork attaches to your order', 'Direct Shopify checkout', 'Nationwide shipping'].map((label) => `<span>${escapeHtml(label)}</span>`).join('')}
            </div>
          </div>
        </section>
        <section class="merchandising-band">
          <article>
            <p class="eyebrow">Product details</p>
            <h2>Built for clear ordering.</h2>
            ${buildOfferSummary(product) ? `<p class="offer-summary">${escapeHtml(buildOfferSummary(product))}</p>` : ''}
            ${product.copy.bodyHtml}
          </article>
          <aside class="notes-panel">
            <p class="eyebrow">Artwork and production notes</p>
            <ul>
              ${(product.notes ?? []).map((note) => `<li class="offer-note"><strong>${escapeHtml(note)}</strong></li>`).join('\n              ')}
              <li>Upload clean artwork in the cart before checkout.</li>
              <li>Exact colors, placement, sizing, and material details travel with the order metadata.</li>
              <li>Local pickup and shipped order paths can be coordinated from Logan, WV.</li>
            </ul>
          </aside>
        </section>
        <section class="link-band" aria-label="Related resources">${relatedLinks}</section>
        <section class="variant-band" id="variants">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Options and pricing</p>
              <h2>${product.variants.length > shownVariants.length ? 'Choose a starting option.' : 'Choose a size or variant.'}</h2>
            </div>
            <strong>${variantCount} ${variantCount === 1 ? 'option' : 'options'}</strong>
          </div>
          ${variantLimitNotice}
          <div class="table-wrap"><table><thead><tr><th>Variant</th><th>Options</th><th>Price</th><th>Checkout</th></tr></thead><tbody>${rows}</tbody></table></div>
        </section>
      </main>
      <script>
        (function(){
          var select = document.getElementById('variant-select');
          var cta = document.querySelector('.feature-cta');
          var buttons = Array.prototype.slice.call(document.querySelectorAll('#variants button[data-sku]'));
          if (!select || !cta || cta.tagName === 'A') return;
          var quoteHref = '/contact?product=' + encodeURIComponent(cta.dataset.handle || '');
          cta.addEventListener('click', function(){
            if (cta.classList.contains('quote-button')) window.location.href = quoteHref;
          });
          select.addEventListener('change', function(){
            var match = buttons.find(function(button){ return button.dataset.sku === select.value; });
            if (!match) return;
            cta.dataset.handle = match.dataset.handle || '';
            cta.dataset.sku = match.dataset.sku || '';
            cta.dataset.variant = match.dataset.variant || '';
            cta.dataset.price = match.dataset.price || '0';
            cta.dataset.merchandiseId = match.dataset.merchandiseId || '';
            cta.dataset.checkoutReady = match.dataset.checkoutReady || 'false';
            if (match.dataset.checkoutReady === 'true') {
              cta.className = 'buy-button feature-cta';
              cta.textContent = 'Add selected option';
              cta.removeAttribute('disabled');
              cta.removeAttribute('aria-disabled');
            } else {
              cta.className = 'quote-button feature-cta';
              cta.textContent = 'Request a quote';
              cta.setAttribute('type', 'button');
              cta.removeAttribute('disabled');
              cta.removeAttribute('aria-disabled');
            }
          });
        })();
      </script>`,
  })
}

const KIXXL_BUILDERS_PATH = join(
  dirname(fileURLToPath(import.meta.url)), '..', '..',
  'shopify', 'config', 'kixxl-builders.json',
)
const GANGIFY_BASE = 'https://hatfield-mccoy-dtf.myshopify.com/apps/gangify/builder'
const KIXXL_FAMILY_ORDER = ['dtf-22', 'dtf-46', 'glitter-22', 'glow-22', 'sublimation-24']

// Regenerate the data file with scripts/shopify/derive-kixxl-builders.mjs after
// any Kixxl builder product/price change on Shopify.
let kixxlBuildersCache
function loadKixxlBuilders() {
  if (kixxlBuildersCache !== undefined) return kixxlBuildersCache
  kixxlBuildersCache = existsSync(KIXXL_BUILDERS_PATH)
    ? JSON.parse(readFileSync(KIXXL_BUILDERS_PATH, 'utf8'))
    : null
  return kixxlBuildersCache
}

function gangifyDeepLink(family, size) {
  return `${GANGIFY_BASE}?variant=${size.variant}&price=${size.price}&store=zm1evm-rd.myshopify.com&product=${family.product}&quantity=1&locale=en`
}

// The custom-gang-sheet PDP is the routing page for gang sheets: pick a fixed
// sheet size up front and open the Kixxl builder locked to that exact variant,
// or hand the layout to the shop via the direct-buy sheet PDPs.
function renderCustomGangSheetPage(product, builders, { siteUrl = DEFAULT_SITE_URL } = {}) {
  const image = resolveProductImages(product).hero
  const families = KIXXL_FAMILY_ORDER.filter((key) => builders[key]?.sizes?.length)
  const cheapest = families
    .flatMap((key) => builders[key].sizes.map((size) => Number(size.price)))
    .reduce((min, price) => Math.min(min, price), Infinity)
  const totalSizes = families
    .reduce((sum, key) => sum + new Set(builders[key].sizes.map((size) => size.length)).size, 0)
  const defaultFamily = builders[families[0]]
  const defaultSize = defaultFamily.sizes[0]
  const familyOptions = families.map((key, index) => `<option value="${escapeHtml(key)}"${index === 0 ? ' selected' : ''}>${escapeHtml(builders[key].label)}</option>`).join('')
  const defaultLengthOptions = [...new Set(defaultFamily.sizes.map((size) => size.length))]
    .map((length, index) => `<option value="${length}"${index === 0 ? ' selected' : ''}>${defaultFamily.widthInches}&quot; x ${length}&quot;</option>`).join('')
  const ladderRows = ['dtf-22', 'dtf-46'].filter((key) => builders[key]).map((key) => {
    const family = builders[key]
    return family.sizes.map((size) => `
            <tr>
              <td>${escapeHtml(family.label)}</td>
              <td>${escapeHtml(size.label)}</td>
              <td>$${escapeHtml(size.price)}</td>
              <td><a class="quote-button table-link" href="${escapeHtml(gangifyDeepLink(family, size))}">Open builder</a></td>
            </tr>`).join('')
  }).join('')
  const specialtyRows = ['glitter-22', 'glow-22', 'sublimation-24'].filter((key) => builders[key]).map((key) => {
    const family = builders[key]
    const lengths = [...new Set(family.sizes.map((size) => size.length))]
    const fromPrice = family.sizes.reduce((min, size) => Math.min(min, Number(size.price)), Infinity)
    return `
            <tr>
              <td>${escapeHtml(family.label)}</td>
              <td>${family.widthInches}&quot; wide, ${lengths[0]}&quot; to ${lengths[lengths.length - 1]}&quot; long</td>
              <td>From $${fromPrice.toFixed(2)}</td>
              <td><a class="quote-button table-link" href="#gs-picker">Pick a size above</a></td>
            </tr>`
  }).join('')
  const weBuildCards = families.map((key) => {
    const family = builders[key]
    return `<a class="family-card" href="${escapeHtml(family.sheetProduct)}"><img src="${escapeHtml(image.src)}" width="300" height="300" alt="" loading="lazy" decoding="async"><strong>${escapeHtml(family.label)}</strong><small>Pick a length, upload one image, add to cart — we lay out the sheet.</small></a>`
  }).join('\n              ')
  const buildersJson = JSON.stringify(builders).replaceAll('<', '\\u003c')
  return renderShell({
    seo: product.seo,
    siteUrl,
    body: `
      <main class="seo-page product-page">
        ${breadcrumb([{ label: 'Shop', url: '/shop' }, { label: product.title }])}
        <section class="product-hero">
          <div>
            <p class="eyebrow">Gang sheet builders · Logan, WV production</p>
            <h1>${escapeHtml(product.title)}</h1>
            <p class="lede">${escapeHtml(product.copy.shortDescription)}</p>
            ${buildOfferSummary(product) ? `<p class="offer-summary">${escapeHtml(buildOfferSummary(product))}</p>` : ''}
            <div class="status-strip" aria-label="Ordering path">
              <span class="route-chip route-builder">Customize in builder</span>
              <span>From $${cheapest.toFixed(2)}</span>
              <span>${totalSizes} sheet sizes</span>
              <span>Fixed sizes — no rolling sheets</span>
            </div>
            <div class="hero-actions">
              <a class="btn primary" href="#gs-picker">Pick your sheet size</a>
              <a class="btn secondary" href="#we-build-it">We can lay it out</a>
            </div>
          </div>
          <div class="purchase-panel" id="gs-picker">
            <img src="${escapeHtml(image.src)}" width="900" height="900" alt="${escapeHtml(image.alt)}" loading="eager" decoding="async">
            <span class="price" id="gs-price">$${escapeHtml(defaultSize.price)}</span>
            <p>Pick the sheet type and length first. The builder opens locked to that exact size and price — place your images, then add it to the cart.</p>
            <label class="variant-select"><span>Sheet type</span><select id="gs-type">${familyOptions}</select></label>
            <label class="variant-select" id="gs-color-wrap" hidden><span>Glitter color</span><select id="gs-color"></select></label>
            <label class="variant-select"><span>Sheet size</span><select id="gs-length">${defaultLengthOptions}</select></label>
            <a class="btn primary feature-cta" id="gs-open" href="/gang-sheet-builder">Open builder — ${defaultFamily.widthInches}&quot; x ${defaultSize.length}&quot;</a>
            <div class="approval-list">
              ${['Sheet is the exact size you pick', 'Price fixed before the builder opens', 'Checkout direct through Shopify'].map((label) => `<span>${escapeHtml(label)}</span>`).join('')}
            </div>
          </div>
        </section>
        <section class="merchandising-band">
          <article>
            <p class="eyebrow">Product details</p>
            <h2>Two ways to get a gang sheet.</h2>
            ${buildOfferSummary(product) ? `<p class="offer-summary">${escapeHtml(buildOfferSummary(product))}</p>` : ''}
            ${product.copy.bodyHtml}
          </article>
          <aside class="notes-panel">
            <p class="eyebrow">How the builder route works</p>
            <ul>
              <li><strong>Pick the length.</strong> Choose a sheet type and size on this page — the price is set right here.</li>
              <li><strong>Place your images.</strong> The builder opens at that exact sheet size; upload artwork and arrange it.</li>
              <li><strong>Add it to the cart.</strong> The cart line carries the size and price you picked — nothing recalculates.</li>
            </ul>
          </aside>
        </section>
        <section class="merch-family-band" id="we-build-it">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Skip the builder</p>
              <h2>We build the gang sheet for you.</h2>
            </div>
          </div>
          <p class="variant-limit-note">Not into arranging a sheet yourself? Pick a width below, choose the length on that page, upload one image, and add it to the cart — the shop lays out the gang sheet for you at the flat sheet price.</p>
          <div class="family-grid">
              ${weBuildCards}
          </div>
        </section>
        <section class="link-band" aria-label="Related resources"><a href="/shop">Shop all products</a><a href="/gang-sheet-builder">Gang sheet builder</a><a href="/guides">Pressing guide</a><a href="/contact">Talk to the shop</a></section>
        <section class="variant-band" id="variants">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Options and pricing</p>
              <h2>Every sheet size, priced up front.</h2>
            </div>
            <strong>${totalSizes} sizes</strong>
          </div>
          <p class="variant-limit-note">Builder sheets run $0.60 over the flat sheet price. Every link opens the builder locked to that exact size.</p>
          <div class="table-wrap"><table><thead><tr><th>Sheet type</th><th>Size</th><th>Price</th><th>Builder</th></tr></thead><tbody>${ladderRows}${specialtyRows}</tbody></table></div>
        </section>
      </main>
      <script type="application/json" id="kixxl-builders-data">${buildersJson}</script>
      <script>
        (function(){
          // Base kept separate from '?variant=' so roundtrip's gangify-URL
          // scanner never sees a parameterless literal URL in this script.
          var GB = '${GANGIFY_BASE}';
          var data = JSON.parse(document.getElementById('kixxl-builders-data').textContent);
          var typeSelect = document.getElementById('gs-type');
          var colorWrap = document.getElementById('gs-color-wrap');
          var colorSelect = document.getElementById('gs-color');
          var lengthSelect = document.getElementById('gs-length');
          var price = document.getElementById('gs-price');
          var open = document.getElementById('gs-open');
          if (!typeSelect || !lengthSelect || !open) return;
          function family(){ return data[typeSelect.value]; }
          function fillLengths(){
            var seen = {};
            lengthSelect.innerHTML = family().sizes.filter(function(s){
              if (seen[s.length]) return false; seen[s.length] = true; return true;
            }).map(function(s){
              return '<option value="' + s.length + '">' + family().widthInches + '&quot; x ' + s.length + '&quot;</option>';
            }).join('');
          }
          function fillColors(){
            if (!family().hasColors) { colorWrap.hidden = true; return; }
            var seen = {};
            colorSelect.innerHTML = family().sizes.filter(function(s){
              if (!s.color || seen[s.color]) return false; seen[s.color] = true; return true;
            }).map(function(s){ return '<option value="' + s.color + '">' + s.color + '</option>'; }).join('');
            colorWrap.hidden = false;
          }
          function sync(){
            var length = Number(lengthSelect.value);
            var color = family().hasColors ? colorSelect.value : null;
            var size = family().sizes.find(function(s){ return s.length === length && (!color || s.color === color); });
            if (!size) return;
            price.textContent = '$' + size.price;
            open.href = GB + '?variant=' + size.variant + '&price=' + size.price + '&store=zm1evm-rd.myshopify.com&product=' + family().product + '&quantity=1&locale=en';
            open.textContent = 'Open builder — ' + family().widthInches + '" x ' + length + '"';
          }
          typeSelect.addEventListener('change', function(){ fillColors(); fillLengths(); sync(); });
          if (colorSelect) colorSelect.addEventListener('change', sync);
          lengthSelect.addEventListener('change', sync);
          fillColors(); sync();
        })();
      </script>`,
  })
}

function renderInternalProxyProductPage(product, { siteUrl = DEFAULT_SITE_URL } = {}) {
  const category = categorizeProduct(product)
  const image = resolveProductImages(product).hero
  const actionUrl = product.internalActionUrl || internalProxyProductActionUrl(product)
  const actionLabel = actionUrl === '/contact' ? 'Request product help' : 'Open builder'
  const firstPrice = firstDisplayPrice(product)
  return renderShell({
    seo: product.seo,
    siteUrl,
    body: `
      <main class="seo-page product-page internal-proxy-page">
        ${breadcrumb([{ label: 'Shop', url: '/shop' }, { label: product.title }])}
        <section class="product-hero">
          <div>
            <p class="eyebrow">${escapeHtml(category.label)} · ordering path</p>
            <h1>${escapeHtml(product.title)}</h1>
            <p class="lede">This product is ordered through a guided path so sizing and materials are set right the first time. Start with the builder or send the details to Hatfield McCoy DTF.</p>
            <div class="status-strip" aria-label="Ordering status">
              <span>Guided order</span>
              ${firstPrice ? `<span>From $${escapeHtml(firstPrice)}</span>` : ''}
              <span>${escapeHtml(orderPathLabel(product))}</span>
            </div>
            <div class="hero-actions">
              <a class="btn primary feature-cta" href="${escapeHtml(actionUrl)}">${escapeHtml(actionLabel)}</a>
              <a class="btn secondary" href="/guides#artwork">Artwork guide</a>
            </div>
          </div>
          <div class="purchase-panel">
            <img src="${escapeHtml(image.src)}" width="900" height="900" alt="${escapeHtml(image.alt)}" loading="eager" decoding="async">
            <span class="price">${firstPrice ? `From $${escapeHtml(firstPrice)}` : 'Quoted to your spec'}</span>
            <p>A guided route that lands you on the correct fixed-size builder or support path.</p>
            <a class="btn primary feature-cta" href="${escapeHtml(actionUrl)}">${escapeHtml(actionLabel)}</a>
          </div>
        </section>
        <section class="content-band">
          <article>
            <p class="eyebrow">Cleaner ordering</p>
            <h2>Built for guided setup.</h2>
            <p>Orders for this product run through a guided setup so sizing and materials are confirmed before production starts.</p>
          </article>
        </section>
      </main>`,
  })
}

export function renderCollectionPage(collection, products, { siteUrl = DEFAULT_SITE_URL } = {}) {
  const scopedProducts = productsForCollection(collection, products)
  const image = resolveCollectionImages(collection).hero
  const categories = buildShopCategories(scopedProducts)
  const nav = [
    ['all', 'All', scopedProducts.length],
    ...categories.map((category) => [category.id, category.label, category.products.length]),
  ].map(([id, label, count], index) => `<button class="filter-tab${index === 0 ? ' active' : ''}" type="button" data-filter="${escapeHtml(id)}">${escapeHtml(label)} <span>${count}</span></button>`).join('')
  const cards = scopedProducts.slice(0, 80).map((product) => productCardMarkup(product, { className: 'product-card commerce-card' })).join('')
  const links = [
    ['All collections', '/collections'],
    ['Shop catalog', '/shop'],
    ['Artwork guide', '/guides#artwork'],
  ].map(([label, url]) => `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`).join('')
  return renderShell({
    seo: collection.seo,
    siteUrl,
    body: `
      <main class="seo-page collection-page">
        ${breadcrumb([{ label: 'Shop', url: '/shop' }, { label: 'Collections', url: '/collections' }, { label: collection.title }])}
        <section class="collection-hero">
          <div>
            <p class="eyebrow">Shop by family</p>
            <h1>${escapeHtml(collection.title)}</h1>
            <p class="lede">${escapeHtml(collection.copy.shortDescription)}</p>
            <div class="status-strip" aria-label="Collection stats">
              <span>${scopedProducts.length} matching products</span>
              <span>${categories.length} product ${categories.length === 1 ? 'family' : 'families'}</span>
              <span>Artwork upload in cart</span>
            </div>
          </div>
          <img src="${escapeHtml(image.src)}" width="900" height="900" alt="${escapeHtml(image.alt)}" loading="eager" decoding="async">
        </section>
        <section class="collection-subnav" aria-label="Collection filters">${nav}</section>
        <section class="link-band" aria-label="Collection links">${links}</section>
        <section class="product-grid filtered-grid" id="collection-grid">${cards}</section>
      </main>
      <script>
        (function(){
          var tabs = Array.prototype.slice.call(document.querySelectorAll('.collection-subnav .filter-tab'));
          var cards = Array.prototype.slice.call(document.querySelectorAll('#collection-grid .commerce-card'));
          tabs.forEach(function(tab){
            tab.addEventListener('click', function(){
              tabs.forEach(function(other){ other.classList.remove('active'); });
              tab.classList.add('active');
              var active = tab.dataset.filter || 'all';
              cards.forEach(function(card){ card.hidden = active !== 'all' && card.dataset.category !== active; });
            });
          });
        })();
      </script>`,
  })
}

export function renderInfoPage(page, { siteUrl = DEFAULT_SITE_URL } = {}) {
  return renderShell({
    seo: page.seo,
    siteUrl,
    body: `
      <main class="seo-page info-page">
        ${breadcrumb([{ label: 'Home', url: '/' }, { label: 'Pages', url: '/pages' }, { label: page.title }])}
        <article class="content-band">
          <p class="eyebrow">Customer guide</p>
          <h1>${escapeHtml(page.title)}</h1>
          ${page.copy.bodyHtml}
        </article>
      </main>`,
  })
}

export function renderSitemapXml(items, { siteUrl = DEFAULT_SITE_URL } = {}) {
  const urls = items
    .filter((item) => item.indexable)
    .map((item) => `  <url><loc>${siteUrl}${item.url}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function renderRobotsTxt({ launched = false, sitemapUrl = `${DEFAULT_SITE_URL}/sitemap.xml` } = {}) {
  if (!launched) return `User-agent: *\nDisallow: /\nSitemap: ${sitemapUrl}\n`
  return `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`
}

export function renderShopPage(frontendCatalog, { siteUrl = DEFAULT_SITE_URL } = {}) {
  const seo = buildSeoRecord({
    kind: 'collection',
    handle: 'shop',
    title: 'Shop DTF Transfers, Gang Sheets, Stickers, and Print Products',
    description: `Browse ${frontendCatalog.products.length} Hatfield McCoy DTF products across transfers, builders, UV DTF, stickers, apparel, signage, and production services.`,
    urlPath: '/shop',
    indexable: false,
  })
  // Owner consolidation (Jessie, 2026-07-15): grouped members render as ONE
  // card with item/variant selectors; a pseudo display-unit per group keeps the
  // family tabs counting what the customer actually sees.
  const groups = frontendCatalog.groups ?? []
  const groupedHandles = new Set(groups.flatMap((group) => group.members.map((member) => member.handle)))
  const groupAtHandle = new Map(groups.map((group) => [group.members[0].handle, group]))
  const displayUnits = [
    ...frontendCatalog.products.filter((product) => !groupedHandles.has(product.handle)),
    ...groups.map((group) => ({ shopCategory: group.category, title: group.title, handle: group.id, productType: '', variants: [] })),
  ]
  const categories = buildShopCategories(displayUnits)
  const categoryTabs = [
    ['all', 'All products', displayUnits.length],
    ...categories.map((category) => [category.id, category.label, category.products.length]),
  ].map(([id, label, count], index) => `<button class="filter-tab${index === 0 ? ' active' : ''}" type="button" data-filter="${escapeHtml(id)}">${escapeHtml(label)} <span>${count}</span></button>`).join('')
  const collectionLinks = frontendCatalog.collections.slice(0, 10).map((collection) => `
            <a href="${escapeHtml(collection.url)}">${escapeHtml(collection.title)}</a>`).join('')
  // Descriptive taglines, never computed floor prices — by-size catalogs bottom
  // out at cents-level minimums that read as broken pricing on a family card.
  const FAMILY_TAGLINES = {
    transfers: 'Priced by size — pick and order',
    builders: 'Priced by sheet size in the builder',
    stickers: 'Stickers, decals, and UV DTF',
    apparel: 'Blanks ready for your prints',
    signage: 'Signs, magnets, and graphics',
    promo: 'Tumblers, coins, and gifts',
    services: 'Artwork help, vector design, and rush service',
  }
  const featuredFamilies = categories.map((category) => {
    const image = productCardImage(category)
    return `
          <a class="family-card" href="#catalog-grid" data-family-filter="${escapeHtml(category.id)}">
            <img src="${escapeHtml(image.src)}" width="900" height="900" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">
            <span class="kicker">${escapeHtml(category.label)}</span>
            <strong>${category.products.length} ${category.products.length === 1 ? 'product' : 'products'}</strong>
            <small>${escapeHtml(FAMILY_TAGLINES[category.id] ?? 'Custom print work from Logan, WV')}</small>
          </a>`
  }).join('')
  const cards = frontendCatalog.products.map((product) => {
    if (groupedHandles.has(product.handle)) {
      const group = groupAtHandle.get(product.handle)
      return group ? groupCardMarkup(group) : ''
    }
    return productCardMarkup(product, { className: 'catalog-card' })
  }).join('')
  return renderShell({
    seo,
    siteUrl,
    body: `
      <main class="seo-page shop-page">
        ${breadcrumb([{ label: 'Home', url: '/' }, { label: 'Shop' }])}
        <section class="shop-hero">
          <div>
            <p class="eyebrow">Shop Hatfield McCoy DTF</p>
            <h1>Custom DTF, stickers, apparel, signs, and print-ready goods.</h1>
            <p class="lede">Shop transfers, gang sheets, UV DTF, apparel, signage, and specialty print products. Direct-order items go straight to cart, and fixed-size builder routes stay cleanly separated.</p>
            <div class="hero-actions"><a class="btn primary" href="/gang-sheet-builder">Build a gang sheet</a><a class="btn secondary" href="/guides#artwork">Artwork guide</a></div>
          </div>
          <div class="shop-stats" aria-label="Catalog status">
            <strong>${displayUnits.length}</strong><span>Product lines</span>
            <strong>${frontendCatalog.collections.length}</strong><span>Collections</span>
            <strong>${frontendCatalog.meta.variant_count}</strong><span>Variants</span>
          </div>
        </section>
        <section class="merch-family-band" aria-label="Featured product families">
          <div class="section-heading">
            <div><p class="eyebrow">Product families</p><h2>Start with the kind of order you need.</h2></div>
            <a class="view-all-link" href="/collections">View collections</a>
          </div>
          <div class="family-grid">${featuredFamilies}</div>
        </section>
        <section class="shop-tools" aria-label="Catalog tools">
          <label class="catalog-search"><span>Search catalog</span><input id="catalog-search" type="search" placeholder="Search transfers, stickers, gang sheets, apparel..." autocomplete="off"></label>
          <div class="filter-tabs" role="list" aria-label="Catalog filters">${categoryTabs}</div>
        </section>
        <section class="catalog-grid" id="catalog-grid" aria-label="All products">${cards}</section>
        <section class="order-path-band" aria-label="Ordering paths">
          <article><span class="kicker">Fast reorder</span><strong>Know the size and file?</strong><p>Choose the closest product, select a variant, and add it to the cart.</p></article>
          <article><span class="kicker">Artwork upload</span><strong>Ready with your file?</strong><p>Add the right option to the cart, upload artwork there, and move directly into checkout.</p></article>
          <article><span class="kicker">Bigger runs</span><strong>Building for a team or shop?</strong><p>Use collections to compare families, materials, and pricing before you commit.</p></article>
        </section>
        <section class="collection-strip" aria-label="Collections">
          <div><p class="eyebrow">Popular routes</p><h2>Shop by need</h2></div>
          <div class="collection-links">${collectionLinks}<a class="view-all-link" href="/collections">View all collections</a></div>
        </section>
      </main>
      <script>
        (function(){
          var search = document.getElementById('catalog-search');
          var cards = Array.prototype.slice.call(document.querySelectorAll('.catalog-card'));
          var tabs = Array.prototype.slice.call(document.querySelectorAll('.filter-tab'));
          var active = 'all';
          function apply(){
            var q = (search && search.value || '').trim().toLowerCase();
            cards.forEach(function(card){
              var categoryMatch = active === 'all' || card.dataset.category === active;
              var textMatch = !q || (card.dataset.title || '').indexOf(q) !== -1;
              card.hidden = !(categoryMatch && textMatch);
            });
          }
          tabs.forEach(function(tab){
            tab.addEventListener('click', function(){
              tabs.forEach(function(other){ other.classList.remove('active'); });
              tab.classList.add('active');
              active = tab.dataset.filter || 'all';
              apply();
            });
          });
          document.querySelectorAll('[data-family-filter]').forEach(function(link){
            link.addEventListener('click', function(){
              var target = tabs.find(function(tab){ return tab.dataset.filter === link.dataset.familyFilter; });
              if (target) target.click();
            });
          });
          if (search) search.addEventListener('input', apply);
          function applyHashFamily(){
            var match = (location.hash || '').match(/family=([a-z-]+)/);
            if (!match) return;
            var target = tabs.find(function(tab){ return tab.dataset.filter === match[1]; });
            if (target) target.click();
          }
          window.addEventListener('hashchange', applyHashFamily);
          applyHashFamily();
        })();
        (function(){
          // Group cards: item select -> option select -> qty -> add. All lookups
          // are card-scoped (no ids) so multiple group cards coexist.
          document.querySelectorAll('.catalog-card--group').forEach(function(card){
            try {
              var data = JSON.parse(card.querySelector('.group-data').textContent);
              var itemSel = card.querySelector('.group-item-select');
              var varWrap = card.querySelector('.group-variant-wrap');
              var varSel = card.querySelector('.group-variant-select');
              var buyRow = card.querySelector('.group-buy-row');
              var qtyIn = card.querySelector('.group-qty-input');
              var price = card.querySelector('.group-price');
              var add = card.querySelector('.group-add');
              var link = card.querySelector('.group-cta-link');
              var details = card.querySelector('.group-details-link');
              function member(){ return data.members[itemSel.selectedIndex] || data.members[0]; }
              function modeOf(m){
                if (m.route !== 'order-online') return 'quote';
                if (m.variantCount > 60) return 'oversized';
                return 'direct';
              }
              function fillVariants(m){
                varSel.innerHTML = m.variants.map(function(v, i){
                  return '<option value="' + v.sku + '"' + (i === 0 ? ' selected' : '') + '>' + v.label + '</option>';
                }).join('');
              }
              function sync(){
                var m = member();
                var mode = modeOf(m);
                details.href = m.url;
                var direct = mode === 'direct';
                varWrap.hidden = !direct;
                buyRow.hidden = !direct;
                add.hidden = !direct;
                link.hidden = direct;
                if (!direct) {
                  link.href = mode === 'quote' ? '/contact?product=' + encodeURIComponent(m.handle) : m.url;
                  link.textContent = mode === 'quote' ? 'Request a quote' : 'Pick your size on the product page';
                  return;
                }
                var v = m.variants[varSel.selectedIndex] || m.variants[0];
                if (!v) { add.disabled = true; return; }
                add.disabled = false;
                add.dataset.handle = m.handle;
                add.dataset.sku = v.sku;
                add.dataset.name = m.title;
                add.dataset.variant = v.title;
                add.dataset.price = v.price;
                add.dataset.merchandiseId = v.merchandiseId;
                add.dataset.checkoutReady = 'true';
                add.dataset.requiresArtwork = 'true';
                var qty = Math.max(1, Math.floor(Number(qtyIn.value) || 1));
                qtyIn.value = String(qty);
                price.textContent = '$' + (Number(v.price) * qty).toFixed(2);
              }
              itemSel.addEventListener('change', function(){ fillVariants(member()); sync(); });
              varSel.addEventListener('change', sync);
              qtyIn.addEventListener('change', sync);
              card.querySelectorAll('.group-qty-btn').forEach(function(button){
                button.addEventListener('click', function(){
                  qtyIn.value = String(Math.max(1, Math.floor(Number(qtyIn.value) || 1) + Number(button.dataset.step)));
                  sync();
                });
              });
              fillVariants(member());
              sync();
            } catch (error) {
              var addButton = card.querySelector('.group-add');
              if (addButton) addButton.disabled = true;
              console.error('[shop-group] card init failed', error);
            }
          });
        })();
      </script>`,
  })
}

// A grouped member renders in one of three modes; the inline script applies the
// same rules on selection. >60 buyable variants = the 177-size DTF ladder —
// a select that long is worse UX than the PDP it links to.
function groupMemberMode(member) {
  if (member.route !== 'order-online') return 'quote'
  if (member.variantCount > 60) return 'oversized'
  return 'direct'
}

function groupCardMarkup(group) {
  const searchText = [group.title, ...group.members.flatMap((member) => [member.title, member.handle])].join(' ').toLowerCase()
  const first = group.members[0]
  const firstMode = groupMemberMode(first)
  const firstVariant = first.variants[0]
  const memberOptions = group.members
    .map((member, index) => `<option value="${escapeHtml(member.handle)}"${index === 0 ? ' selected' : ''}>${escapeHtml(member.title)}</option>`)
    .join('')
  const variantOptions = first.variants
    .map((variant, index) => `<option value="${escapeHtml(variant.sku)}"${index === 0 ? ' selected' : ''}>${escapeHtml(variant.label)}</option>`)
    .join('')
  const blobJson = JSON.stringify({ members: group.members }).replace(/</g, '\\u003c')
  const direct = firstMode === 'direct'
  const linkHref = firstMode === 'quote' ? `/contact?product=${encodeURIComponent(first.handle)}` : first.url
  const linkText = firstMode === 'quote' ? 'Request a quote' : 'Pick your size on the product page'
  return `
          <article class="catalog-card catalog-card--group" data-category="${escapeHtml(group.category)}" data-title="${escapeHtml(searchText)}">
            <script type="application/json" class="group-data">${blobJson}</script>
            <img src="${escapeHtml(group.image.src)}" width="900" height="900" alt="${escapeHtml(group.image.alt)}" loading="lazy" decoding="async">
            <div class="catalog-card-body">
              <em>${escapeHtml(FAMILY_LABELS[group.category] ?? 'Shop')}</em>
              <h3>${escapeHtml(group.title)}</h3>
              <p class="group-blurb">${escapeHtml(group.blurb)}</p>
              <label class="variant-select group-field"><span>Item</span><select class="group-item-select" aria-label="Choose an item">${memberOptions}</select></label>
              <label class="variant-select group-field group-variant-wrap"${direct ? '' : ' hidden'}><span>Option</span><select class="group-variant-select" aria-label="Choose an option">${variantOptions}</select></label>
              <div class="group-buy-row"${direct ? '' : ' hidden'}>
                <div class="group-qty" role="group" aria-label="Quantity">
                  <button type="button" class="group-qty-btn" data-step="-1" aria-label="Decrease quantity">&minus;</button>
                  <input class="group-qty-input" type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="Quantity">
                  <button type="button" class="group-qty-btn" data-step="1" aria-label="Increase quantity">+</button>
                </div>
                <strong class="group-price" aria-live="polite">${direct && firstVariant ? `$${escapeHtml(firstVariant.price)}` : ''}</strong>
              </div>
              <button class="buy-button group-add" type="button"${direct ? '' : ' hidden'} data-handle="${escapeHtml(first.handle)}" data-sku="${escapeHtml(firstVariant?.sku ?? '')}" data-name="${escapeHtml(first.title)}" data-variant="${escapeHtml(firstVariant?.title ?? '')}" data-price="${escapeHtml(firstVariant?.price ?? '')}" data-merchandise-id="${escapeHtml(firstVariant?.merchandiseId ?? '')}" data-checkout-ready="true" data-requires-artwork="true">Add to cart</button>
              <a class="quote-button group-cta-link"${direct ? ' hidden' : ''} href="${escapeHtml(linkHref)}">${escapeHtml(linkText)}</a>
              <a class="group-details-link" href="${escapeHtml(first.url)}">View full details &rarr;</a>
            </div>
          </article>`
}

export function renderProductIndexPage(products, { siteUrl = DEFAULT_SITE_URL } = {}) {
  // Owner decision 2026-07-13: /shop is the one canonical listing. This route
  // only exists as a safety net — vercel.json 308s /products → /shop at the edge;
  // this stub covers local preview and any non-Vercel host.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Shop | Hatfield McCoy DTF</title>
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="0; url=/shop">
<link rel="canonical" href="${escapeHtml(siteUrl)}/shop">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Shop | Hatfield McCoy DTF","url":"${escapeHtml(siteUrl)}/shop"}</script>
</head>
<body><p>The full catalog lives on <a href="/shop">the shop page</a>.</p></body>
</html>
`
}

export function renderCollectionIndexPage(collections, products = [], { siteUrl = DEFAULT_SITE_URL } = {}) {
  const seo = buildSeoRecord({
    kind: 'collection',
    handle: 'collections',
    title: 'Collections',
    description: 'Shop Hatfield McCoy DTF collections by product family, material, order path, and specialty print need.',
    urlPath: '/collections',
    indexable: false,
  })
  // Group the collection tiles under their dominant buyer family so the index
  // reads as a handful of sections instead of a flat wall of tiles.
  const FAMILY_ORDER = ['transfers', 'builders', 'stickers', 'apparel', 'signage', 'promo', 'services']
  const grouped = new Map(FAMILY_ORDER.map((id) => [id, []]))
  for (const collection of collections) {
    const image = resolveCollectionImages(collection).card
    const scopedProducts = productsForCollection(collection, products)
    const dominant = categorizeCollectionForNav(collection)
    grouped.get(dominant).push(`
          <a class="product-card collection-card" href="${escapeHtml(collection.url)}">
            <img src="${escapeHtml(image.src)}" width="900" height="900" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">
            <span>Collection</span>
            <strong>${escapeHtml(collection.title)}</strong>
            <small>${scopedProducts.length} ${scopedProducts.length === 1 ? 'product' : 'products'}</small>
          </a>`)
  }
  const familySections = FAMILY_ORDER
    .filter((id) => grouped.get(id).length)
    .map((id) => `
        <section class="collection-family-group" aria-label="${escapeHtml(FAMILY_LABELS[id])} collections">
          <div class="section-heading">
            <div><p class="eyebrow">Product family</p><h2>${escapeHtml(FAMILY_LABELS[id])}</h2></div>
            <strong>${grouped.get(id).length} ${grouped.get(id).length === 1 ? 'collection' : 'collections'}</strong>
          </div>
          <div class="product-grid">${grouped.get(id).join('')}</div>
        </section>`)
    .join('')
  return renderShell({
    seo,
    siteUrl,
    body: `
      <main class="seo-page collection-page">
        ${breadcrumb([{ label: 'Home', url: '/' }, { label: 'Collections' }])}
        <section class="collection-hero">
          <p class="eyebrow">Collections</p>
          <h1>Find the right print path faster.</h1>
          <p class="lede">${collections.length} collection routes, grouped by product family so you can land on the right lane fast.</p>
        </section>
        ${familySections}
      </main>`,
  })
}

export function renderPageIndexPage(pages, { siteUrl = DEFAULT_SITE_URL } = {}) {
  const seo = buildSeoRecord({
    kind: 'page',
    handle: 'pages',
    title: 'Support Pages | Hatfield McCoy DTF',
    description: 'Hatfield McCoy DTF support pages for ordering, artwork, production, policies, and service details.',
    urlPath: '/pages',
    indexable: false,
  })
  const cards = pages.map((page) => `
          <a class="product-card" href="${escapeHtml(page.url)}">
            <span>Customer guide</span>
            <strong>${escapeHtml(page.title)}</strong>
            <small>Ordering, artwork, and service details</small>
          </a>`).join('')
  return renderShell({
    seo,
    siteUrl,
    body: `
      <main class="seo-page collection-page">
        ${breadcrumb([{ label: 'Home', url: '/' }, { label: 'Pages' }])}
        <section class="collection-hero">
          <p class="eyebrow">Support library</p>
          <h1>Guides, policies, and service pages.</h1>
          <p class="lede">${pages.length} support and commerce pages help customers understand artwork, ordering, fulfillment, and service options.</p>
        </section>
        <section class="product-grid">${cards}</section>
      </main>`,
  })
}

function renderShell({ seo, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(seo.title)}</title>
  <meta name="description" content="${escapeHtml(seo.description)}">
  <meta name="robots" content="${escapeHtml(seo.robots)}">
  <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}">
  <meta property="og:type" content="${escapeHtml(seo.openGraph.type)}">
  <meta property="og:site_name" content="${escapeHtml(seo.openGraph.siteName)}">
  <meta property="og:title" content="${escapeHtml(seo.openGraph.title)}">
  <meta property="og:description" content="${escapeHtml(seo.openGraph.description)}">
  <meta property="og:url" content="${escapeHtml(seo.openGraph.url)}">
  <meta property="og:image" content="${DEFAULT_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" href="/assets/images/favicon.png">
  <link rel="preload" href="/assets/fonts/anton-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/site.css">
  <style>${pageCss()}</style>
  <script type="application/ld+json">${JSON.stringify(seo.schema)}</script>
</head>
<body>
<div class="announce"><div class="wrap"><span>Custom DTF transfers</span><span>Gang sheet builder</span><span>Logan, WV production · nationwide shipping</span></div></div>
<header class="site-header">
  <div class="wrap top-nav">
    <a class="brand" href="/"><img src="/assets/images/logo-primary.png" alt="">Hatfield McCoy DTF</a>
    <nav class="primary-nav" aria-label="Primary navigation"><a class="nav-link" href="/">Home</a><a class="nav-link active" href="/shop">Shop</a><a class="nav-link" href="/gang-sheet-builder">Builder</a><a class="nav-link" href="/wholesale">Wholesale</a><a class="nav-link" href="/guides">Guides</a><a class="nav-link" href="/contact">Contact</a></nav>
    ${mobileMenuButtonMarkup()}
    <div class="nav-actions"><button class="btn secondary cart-btn" type="button" aria-label="Cart, 0 items"><span class="cart-btn-label">Cart</span><span class="cart-count-badge" id="cart-count">0</span></button><a class="btn primary" href="/gang-sheet-builder">Start order</a></div>
  </div>
  <nav class="support-nav" aria-label="Catalog navigation"><div class="wrap"><a class="mini-link" href="/collections">Collections</a><a class="mini-link" href="/shop">All products</a><a class="mini-link" href="/pages">Support pages</a><a class="mini-link" href="/guides#artwork">Artwork guide</a></div></nav>
  ${mobileMenuMarkup()}
</header>
${body}
${cartDrawerMarkup()}
<script src="/assets/js/cart-helpers.js"></script>
<script src="/assets/js/cart.js"></script>
${mobileMenuScript()}
<script>
  var pdpArtwork = null;
  (function () {
    var input = document.getElementById('pdp-artwork-input');
    var trigger = document.getElementById('pdp-upload-btn');
    var status = document.getElementById('pdp-upload-status');
    if (!input || !trigger || !status) return;
    trigger.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file || !window.Cart || !window.Cart.uploadArtwork) return;
      trigger.disabled = true;
      status.textContent = 'Uploading ' + file.name + '\u2026';
      window.Cart.uploadArtwork(file).then(function (uploaded) {
        pdpArtwork = { fileName: uploaded.fileName || file.name, url: uploaded.url };
        status.textContent = '\u2713 ' + pdpArtwork.fileName + ' attached \u2014 now pick a size and add to cart.';
        document.getElementById('pdp-upload').classList.add('has-file');
        trigger.textContent = 'Replace artwork';
        trigger.disabled = false;
      }).catch(function (err) {
        status.textContent = (err && err.message) || 'Upload failed \u2014 you can also upload in the cart before checkout.';
        trigger.disabled = false;
      });
    });
  })();
  document.addEventListener('click', function(event) {
    var button = event.target.closest('.buy-button:not(:disabled)');
    if (!button || !window.Cart) return;
    // Only real add-to-cart buttons carry a data-sku. The drawer's Checkout
    // button also has .buy-button — without these guards every Checkout click
    // silently added a phantom "custom-item" line and re-rendered the drawer
    // (owner-found dead end, 2026-07-13).
    if (!button.dataset.sku) return;
    if (button.closest('.cart-drawer')) return;
    event.preventDefault();
    var attributes = [{ key: 'Source', value: 'Hatfield McCoy DTF catalog page' }];
    if (pdpArtwork) {
      attributes.push({ key: 'Artwork file', value: pdpArtwork.fileName });
      attributes.push({ key: 'Artwork file URL', value: pdpArtwork.url });
      attributes.push({ key: 'Artwork upload URL', value: pdpArtwork.url });
    }
    var groupCard = button.closest('.catalog-card--group');
    var qtyInput = groupCard ? groupCard.querySelector('.group-qty-input') : document.getElementById('pdp-qty');
    var qty = qtyInput ? Math.max(1, Math.floor(Number(qtyInput.value) || 1)) : 1;
    window.Cart.add({
      sku: button.dataset.sku,
      handle: button.dataset.handle || '',
      name: button.dataset.name || 'Hatfield McCoy DTF product',
      variant: button.dataset.variant || '',
      price: Number(button.dataset.price || 0),
      qty: qty,
      merchandiseId: button.dataset.merchandiseId || '',
      checkoutReady: button.dataset.checkoutReady === 'true',
      requiresArtwork: button.dataset.requiresArtwork !== 'false',
      file: pdpArtwork ? pdpArtwork.fileName : null,
      artworkUrl: pdpArtwork ? pdpArtwork.url : '',
      attributes: attributes
    });
    if (window.openCart) window.openCart();
  });
  (function(){
    var qty = document.getElementById('pdp-qty');
    if (!qty) return;
    var clamp = function(){ qty.value = String(Math.max(1, Math.floor(Number(qty.value) || 1))); };
    qty.addEventListener('change', clamp);
    var dec = document.getElementById('pdp-qty-dec');
    var inc = document.getElementById('pdp-qty-inc');
    if (dec) dec.addEventListener('click', function(){ qty.value = String(Math.max(1, Math.floor(Number(qty.value) || 1) - 1)); });
    if (inc) inc.addEventListener('click', function(){ qty.value = String(Math.max(1, Math.floor(Number(qty.value) || 1) + 1)); });
  })();
</script>
</body>
</html>
`
}

function mobileMenuButtonMarkup() {
  return '<button class="mobile-menu-toggle" type="button" aria-controls="mobile-menu" aria-expanded="false"><span class="hamburger-lines" aria-hidden="true"></span><span class="mobile-menu-label">Menu</span></button>'
}

function mobileMenuMarkup() {
  const links = MOBILE_MENU_LINKS
    .map((link) => `    <a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`)
    .join('\n')
  return `
  <nav class="mobile-menu" id="mobile-menu" aria-label="Mobile navigation" hidden>
${links}
  </nav>`
}

function mobileMenuScript() {
  return `<script>
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

function breadcrumb(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">${items.map((item, index) => {
    if (index === items.length - 1) return `<span>${escapeHtml(item.label)}</span>`
    return `<a href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`
  }).join('<span>/</span>')}</nav>`
}

function cartDrawerMarkup() {
  return `
<div class="cart-scrim" id="cart-scrim"></div>
<aside class="cart-drawer" id="cart-drawer" aria-hidden="true" inert>
  <div class="cart-head">
    <div><span class="eyebrow">Order cart</span><h2>Cart</h2></div>
    <button class="cart-close" type="button" aria-label="Close cart">Close</button>
  </div>
  <p class="cart-empty" id="cart-empty">Add products to start your order. Artwork uploads happen right on the product page — or here in the cart.</p>
  <div class="cart-summary-slot" id="cart-summary" hidden></div>
  <div class="cart-scroll" id="cart-scroll">
    <div class="cart-items" id="cart-items"></div>
    <div class="cart-recommendations-slot" id="cart-recommendations" hidden></div>
  </div>
  <div class="cart-footer">
    <div class="cart-total-row"><span>Total</span><strong id="cart-total">$0.00</strong></div>
    <p class="cart-note" id="cart-note" hidden></p>
    <button class="buy-button" id="cart-checkout" type="button" disabled>Checkout</button>
    <a class="quote-link" href="/guides#artwork">Artwork prep guide</a>
  </div>
</aside>`
}

function pageCss() {
  return `
    .seo-page{width:min(1240px,calc(100% - 40px));margin:0 auto;padding:clamp(22px,3.4vw,38px) 0 82px;position:relative;z-index:1}
    .breadcrumbs{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:.84rem;margin-bottom:18px}
    .breadcrumbs a{color:var(--cyan);text-decoration:none;font-weight:800}
    .seo-page h1{font-size:clamp(2.25rem,4.15vw,4rem);line-height:1.08;letter-spacing:.015em;margin:12px 0 14px;max-width:920px}
    .seo-page h2{font-size:clamp(1.45rem,2.7vw,2.6rem);line-height:1.14;letter-spacing:.015em}
    .product-hero,.collection-hero,.shop-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,360px);gap:28px;align-items:start;padding:18px 0 24px;border-bottom:1px solid var(--line)}
    .collection-hero{padding-bottom:24px}
    .collection-hero>img{width:100%;height:clamp(190px,24vw,300px);aspect-ratio:1/1;object-fit:contain;object-position:center;padding:12px;border-radius:6px;border:1px solid rgba(255,255,255,.11);background:radial-gradient(circle at 50% 32%,rgba(255,255,255,.08),transparent 48%),var(--bg-3)}
    .hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
    .status-strip,.approval-list,.catalog-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
    .status-strip span,.approval-list span,.catalog-meta span{min-height:28px;display:inline-flex;align-items:center;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.045);border-radius:999px;padding:0 9px;font-weight:950;text-transform:uppercase;font-size:.68rem;color:var(--soft)}
    .route-chip.route-order-online{border-color:rgba(57,255,20,.5);color:#b8ffba}
    .route-chip.route-builder{border-color:rgba(0,229,255,.5);color:#aef0ff}
    .route-chip.route-quote{border-color:rgba(233,30,140,.45);color:#ffc2e2}
    .purchase-panel,.content-band,.variant-band,.shop-stats,.collection-strip,.merchandising-band,.notes-panel,.merch-family-band,.order-path-band article{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.026));border-radius:8px;padding:20px;box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 18px 50px rgba(0,0,0,.24)}
    .purchase-panel{position:sticky;top:142px;display:grid;gap:12px;align-self:start}
    .purchase-panel img{width:100%;height:clamp(180px,23vw,260px);aspect-ratio:1/1;object-fit:contain;object-position:center;padding:12px;border-radius:6px;border:1px solid rgba(255,255,255,.11);background:radial-gradient(circle at 50% 32%,rgba(255,255,255,.08),transparent 48%),var(--bg-3)}
    .purchase-panel .price{display:block;color:var(--lime);font-family:Anton,Impact,sans-serif;font-size:2rem;font-weight:950}
    .variant-select{display:grid;gap:7px;color:var(--muted);font-weight:900;text-transform:uppercase;font-size:.74rem}
    .variant-select select{width:100%;min-height:42px;border:1px solid rgba(255,255,255,.14);background:#11111b;color:var(--ink);border-radius:6px;padding:0 10px;font:inherit}
    .feature-cta{width:100%;min-height:44px}
    .content-band,.variant-band,.link-band{margin-top:24px}
    .content-band{font-size:1.03rem;line-height:1.62}
    .merchandising-band{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,340px);gap:18px;margin-top:24px}
    .merchandising-band article{line-height:1.62}
    .notes-panel ul{margin:10px 0 0;padding-left:20px;color:var(--soft);line-height:1.55}
    .link-band{display:flex;gap:10px;flex-wrap:wrap}
    .link-band a{min-height:38px;display:inline-flex;align-items:center;color:var(--cyan);border:1px solid rgba(0,229,255,.42);background:rgba(0,229,255,.045);border-radius:999px;padding:0 13px;font-weight:950;text-transform:uppercase;font-size:.72rem}
    .section-heading{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:14px}
    .section-heading strong{color:var(--lime);font-size:.9rem;text-transform:uppercase}
    .table-wrap{overflow:auto}
    table{width:100%;border-collapse:separate;border-spacing:0;min-width:720px}
    th,td{text-align:left;border-bottom:1px solid var(--line);padding:13px 12px;background:rgba(255,255,255,.035)}
    th{position:sticky;top:0;color:var(--cyan);background:var(--bg-3);text-transform:uppercase;font-size:.76rem;font-weight:950}
    tr:hover td{background:rgba(0,229,255,.04)}
    .buy-button,.quote-button{border:0;border-radius:6px;padding:10px 12px;font-weight:950;text-transform:uppercase;cursor:pointer}
    .buy-button{background:var(--magenta);color:#fff;box-shadow:0 10px 30px rgba(233,30,140,.18)}
    .quote-button{background:rgba(0,229,255,.10);color:var(--cyan);border:1px solid rgba(0,229,255,.36)}
    .buy-button:disabled,.quote-button:disabled{background:rgba(255,255,255,.08);color:var(--muted);cursor:not-allowed}
    .shop-stats{display:grid;grid-template-columns:auto 1fr;gap:5px 13px}
    .shop-stats strong{font-family:Anton,Impact,sans-serif;font-size:2.05rem;color:var(--lime);line-height:.9}
    .shop-stats span{align-self:end;color:var(--muted);font-weight:900;text-transform:uppercase}
    .shop-tools{display:grid;grid-template-columns:minmax(260px,380px) 1fr;gap:16px;align-items:end;margin-top:20px}
    .catalog-search{display:grid;gap:8px;color:var(--muted);font-weight:900;text-transform:uppercase;font-size:.76rem}
    .catalog-search input{width:100%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);color:var(--ink);border-radius:6px;padding:13px 14px;font:inherit}
    .filter-tabs{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .filter-tab{min-height:38px;border:1px solid rgba(0,229,255,.25);background:rgba(0,229,255,.04);color:var(--ink);border-radius:999px;padding:0 12px;font-weight:950;text-transform:uppercase;cursor:pointer}
    .filter-tab.active{border-color:var(--lime);box-shadow:0 0 0 1px rgba(57,255,20,.25),0 0 28px rgba(57,255,20,.11)}
    .filter-tab span{color:var(--cyan)}
    .merch-family-band{margin-top:22px}
    .family-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
    .family-card{display:grid;gap:8px;align-content:start;color:var(--ink);text-decoration:none;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:10px;background:rgba(0,0,0,.16)}
    .family-card img{width:100%;height:104px;object-fit:contain;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:radial-gradient(circle at 50% 32%,rgba(255,255,255,.08),transparent 48%),var(--bg-3)}
    .family-card strong{font-size:1.05rem}
    .family-card small{color:var(--muted);line-height:1.35}
    .order-path-band{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
    .order-path-band article{display:grid;gap:7px;padding:16px}
    .order-path-band strong{font-size:1rem}
    .order-path-band p{margin:0;color:var(--muted);line-height:1.4}
    .collection-subnav{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}
    .collection-strip{display:grid;grid-template-columns:minmax(140px,190px) 1fr;gap:16px;margin-top:18px;padding:14px}
    .collection-links{display:flex;gap:8px;flex-wrap:wrap}
    .collection-links a{color:var(--ink);text-decoration:none;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 11px;font-weight:850;font-size:.82rem;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .collection-links .view-all-link{border-color:rgba(57,255,20,.42);color:var(--lime)}
    .catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:14px;margin-top:24px}
    .catalog-card{display:grid;grid-template-rows:156px 1fr;color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.026));transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
    .catalog-card:hover{transform:translateY(-4px);border-color:var(--cyan);box-shadow:0 24px 70px rgba(233,30,140,.18),0 0 36px rgba(0,229,255,.10)}
    .catalog-card[hidden]{display:none}
    .catalog-card--group{cursor:default;grid-column:span 2;grid-template-rows:190px 1fr}
    .catalog-card--group:hover{transform:none}
    .catalog-card--group img{height:190px}
    .catalog-card--group .catalog-card-body{grid-template-rows:auto;align-content:start;gap:9px}
    .catalog-card--group .group-blurb{margin:0;color:var(--soft);font-size:.86rem;line-height:1.4}
    .group-field select{width:100%;min-height:44px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:var(--ink);border-radius:8px;padding:8px 10px;font-weight:800}
    .group-buy-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .group-buy-row[hidden]{display:none}
    .group-qty{display:flex;align-items:center;gap:6px}
    .group-qty-btn{width:40px;min-height:40px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:var(--ink);border-radius:8px;font-weight:950;font-size:1.05rem;cursor:pointer}
    .group-qty-input{width:56px;min-height:40px;text-align:center;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:var(--ink);border-radius:8px;font-weight:900}
    .group-price{color:var(--lime);font-family:Anton,Impact,sans-serif;font-size:1.3rem}
    .group-add{min-height:46px}
    .group-cta-link{display:inline-flex;align-items:center;justify-content:center;min-height:46px;border:1px solid rgba(0,229,255,.5);border-radius:6px;color:#aef0ff;font-weight:950;text-transform:uppercase;font-size:.8rem;text-decoration:none;padding:0 12px}
    .group-cta-link[hidden]{display:none}
    .group-details-link{color:var(--cyan);font-weight:900;font-size:.84rem;text-decoration:none}
    .catalog-card img{width:100%;height:156px;aspect-ratio:1/1;object-fit:contain;object-position:center;padding:10px;background:radial-gradient(circle at 50% 32%,rgba(255,255,255,.08),transparent 48%),var(--bg-3);position:static;filter:none;opacity:1}
    .catalog-card-body{display:grid;grid-template-rows:auto auto 1fr auto;gap:8px;padding:14px}
    .catalog-card h3{margin:0;font-family:Anton,Impact,sans-serif;text-transform:uppercase;font-size:1.2rem;line-height:1.04;letter-spacing:0}
    .catalog-card p{margin:0;color:var(--soft);line-height:1.38;font-size:.88rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .catalog-meta{margin-top:8px}
    .catalog-meta span:first-child{color:var(--lime);border-color:rgba(57,255,20,.34)}
    .product-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:14px;margin-top:24px}
    .seo-page .product-card{min-height:250px;display:grid;grid-template-rows:128px 1fr;color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:8px;padding:10px;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.026));transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
    .seo-page .product-card img{position:static;width:100%;height:128px;aspect-ratio:1/1;object-fit:contain;object-position:center;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,.11);margin-bottom:4px;background:radial-gradient(circle at 50% 32%,rgba(255,255,255,.08),transparent 48%),var(--bg-3);filter:none;opacity:1}
    .seo-page .product-card[hidden]{display:none}
    .seo-page .product-card:hover{transform:translateY(-3px);border-color:var(--cyan);box-shadow:0 24px 70px rgba(233,30,140,.18),0 0 36px rgba(0,229,255,.10)}
    .card-copy{display:grid;grid-template-rows:auto auto 1fr auto auto;gap:8px;padding:6px 2px 0}
    .seo-page .kicker{letter-spacing:0}
    .product-card span,.product-card small{color:var(--muted);font-weight:800}
    .product-card strong{font-size:1.06rem;line-height:1.24}
    .product-card p{margin:0;color:var(--soft);line-height:1.38;font-size:.86rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .product-card em,.catalog-card em{font-style:normal;color:var(--cyan);font-weight:950;text-transform:uppercase;font-size:.75rem}
    .cart-scrim{position:fixed;inset:0;z-index:30;background:rgba(0,0,0,.58);opacity:0;pointer-events:none;transition:opacity .18s ease}
    .cart-scrim.open{opacity:1;pointer-events:auto}
    /* Flex column: head/summary/footer pinned, ONE scroll region (#cart-scroll)
       holding the order lines first and recommendations after them — the customer's
       own lines always own the drawer; upsells can never push them out of view. */
    .cart-drawer{position:fixed;top:0;right:0;z-index:31;width:min(420px,100vw);height:100dvh;background:#101018;border-left:1px solid var(--line);box-shadow:-24px 0 80px rgba(0,0,0,.48);padding:18px;transform:translateX(102%);transition:transform .22s ease;display:flex;flex-direction:column;gap:16px}
    .cart-head,.cart-empty,.cart-summary-slot,.cart-footer{flex:0 0 auto}
    .cart-scroll{flex:1 1 0;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:14px;scrollbar-width:thin}
    .cart-items,.cart-recommendations-slot{flex:0 0 auto}
    .cart-footer .buy-button{min-height:48px}
    .cart-drawer.open{transform:translateX(0)}
    .cart-head{display:flex;align-items:start;justify-content:space-between;gap:14px}
    .cart-close{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);color:var(--ink);border-radius:999px;padding:8px 12px;font-weight:950;text-transform:uppercase}
    .cart-empty,.cart-note{color:var(--muted);line-height:1.5}
    .cart-note{margin:0;border:1px solid rgba(0,229,255,.24);background:rgba(0,229,255,.06);border-radius:8px;padding:10px;font-size:.9rem}
    .cart-summary{display:grid;gap:8px;border:1px solid rgba(57,255,20,.24);background:rgba(57,255,20,.055);border-radius:8px;padding:10px}
    .cart-summary-row{display:flex;align-items:center;justify-content:space-between;gap:10px;color:var(--soft);font-size:.9rem}
    .cart-summary-row strong{color:var(--lime)}
    .cart-summary p{margin:0;color:var(--muted);font-size:.84rem;line-height:1.4}
    .cart-items{display:grid;gap:10px;align-content:start}
    .cart-item{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:start;border:1px solid var(--line);border-radius:8px;padding:10px;background:rgba(255,255,255,.04)}
    .cart-item-thumb{width:40px;height:40px;border-radius:6px;background:linear-gradient(135deg,var(--magenta),var(--cyan))}
    .cart-item-next{display:inline-flex;align-items:center;min-height:32px;margin-top:6px;padding:0 10px;border:1px solid rgba(0,229,255,.5);border-radius:6px;color:#aef0ff;font-weight:950;text-transform:uppercase;font-size:.66rem;text-decoration:none}
    @media(max-width:480px){.cart-drawer{padding:14px}.qty-btn,.cart-remove{min-height:44px}.cart-item-next{min-height:40px}}
    .seo-page p,.seo-page li{line-height:1.6}
    h1,h2,h3{letter-spacing:.015em}
    .btn,.buy-button,.quote-button,.filter-tab,.catalog-card,.family-card,.product-card,.collection-card{transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background-color .16s ease}
    .buy-button:not(:disabled):hover,.quote-button:not(:disabled):hover,.btn:hover{transform:translateY(-1px)}
    .catalog-card:hover,.family-card:hover,.product-card:hover,.collection-card:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(0,0,0,.42);border-color:rgba(0,229,255,.3)}
    :focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
    .cart-item-name{font-weight:950}
    .cart-item-state{width:max-content;margin-top:6px;border-radius:999px;padding:4px 8px;font-size:.68rem;font-weight:950;text-transform:uppercase}
    .cart-item-state-checkout-ready{border:1px solid rgba(57,255,20,.32);background:rgba(57,255,20,.08);color:var(--lime)}
    .cart-item-state-needs-artwork{border:1px solid rgba(255,184,77,.55);background:rgba(255,184,77,.1);color:#ffd399}
    .cart-item-flash{animation:hmCartFlash 1.4s ease 2;border-color:rgba(255,184,77,.9)!important}
    @keyframes hmCartFlash{0%,100%{box-shadow:none}50%{box-shadow:0 0 0 3px rgba(255,184,77,.55)}}
    .cart-item-state-builder-required{border:1px solid rgba(0,229,255,.3);background:rgba(0,229,255,.08);color:var(--cyan)}
    .cart-item-state-review-required{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:var(--soft)}
    .cart-item-variant,.cart-item-file{color:var(--muted);font-size:.82rem;margin-top:3px}
    .cart-item-controls{display:flex;gap:6px;align-items:center;margin-top:8px}
    .qty-btn,.cart-remove{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--ink);border-radius:6px;font-weight:900}
    .qty-input{width:54px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--ink);border-radius:6px;padding:6px}
    .cart-item-price{font-weight:950;color:var(--lime)}
    .cart-footer{border-top:1px solid var(--line);padding-top:16px;display:grid;gap:12px}
    .cart-total-row{display:flex;justify-content:space-between;font-size:1.1rem}
    .quote-link{color:var(--cyan);font-weight:900;text-align:center}
    .cart-item-upload{display:grid;gap:6px;margin-top:8px}
    .cart-upload-input{display:none}
    .cart-upload-btn{width:100%;justify-content:center;min-height:44px;display:inline-flex;align-items:center;border:1px solid rgba(0,229,255,.62);background:rgba(0,229,255,.14);color:#c9f6ff;border-radius:8px;padding:6px 14px;font-weight:950;text-transform:uppercase}
    .offer-summary{margin:10px 0 0;padding:10px 14px;border-left:3px solid var(--lime);background:rgba(57,255,20,.06);color:#d8ffd2;font-weight:800;line-height:1.5;border-radius:0 8px 8px 0}
    .pdp-qty{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .pdp-qty>span{font-weight:950;text-transform:uppercase;font-size:.72rem;color:var(--soft)}
    .pdp-qty-stepper{display:flex;align-items:center;gap:6px}
    .pdp-qty-btn{width:44px;min-height:44px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:var(--ink);border-radius:8px;font-weight:950;font-size:1.1rem;cursor:pointer}
    #pdp-qty{width:64px;min-height:44px;text-align:center;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:var(--ink);border-radius:8px;font-weight:900}
    .pdp-upload{display:grid;gap:6px;border:2px dashed rgba(0,229,255,.5);border-radius:10px;padding:14px;background:rgba(0,229,255,.06);margin:2px 0}
    .pdp-upload.has-file{border-color:rgba(57,255,20,.6);background:rgba(57,255,20,.07)}
    .pdp-upload-input{display:none}
    .pdp-upload-btn{min-height:46px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--cyan),#2bb8d8);color:#04252b;font-weight:950;text-transform:uppercase;letter-spacing:.05em;cursor:pointer}
    .pdp-upload-btn:disabled{opacity:.6;cursor:wait}
    .pdp-upload-status{margin:0;color:var(--soft);font-size:.82rem;line-height:1.4}
    .pdp-upload.has-file .pdp-upload-status{color:#b8ffb0}
    .cart-upload-btn:disabled{opacity:.6;cursor:wait}
    .cart-upload-status{color:var(--muted);font-size:.78rem;line-height:1.3}
    .cart-recommendations{display:grid;gap:8px;border-top:1px solid var(--line);padding-top:12px}
    .cart-recommendations-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .cart-recommendations-head span{font-weight:950;text-transform:uppercase;font-size:.74rem;color:var(--soft)}
    .cart-recommendations-head a{color:var(--cyan);font-weight:900;font-size:.84rem}
    .cart-recommendation-card{display:grid;grid-template-columns:54px 1fr;gap:10px;border:1px solid rgba(255,255,255,.11);border-radius:8px;padding:8px;background:rgba(255,255,255,.035)}
    .cart-recommendation-card img{width:54px;height:54px;object-fit:contain;border-radius:6px;background:var(--bg-3);padding:4px}
    .cart-recommendation-body{display:grid;gap:4px}
    .cart-recommendation-body strong{line-height:1.12}
    .cart-recommendation-body span,.cart-recommendation-body small{color:var(--muted);font-size:.78rem;line-height:1.25}
    .cart-recommendation-action{width:max-content;border:1px solid rgba(0,229,255,.42);background:rgba(0,229,255,.08);color:var(--cyan);border-radius:999px;padding:6px 10px;font-weight:950;text-transform:uppercase;text-decoration:none;font-size:.72rem}
    .variant-limit-note{margin:0 0 14px;color:var(--muted);line-height:1.45;border:1px solid rgba(0,229,255,.18);background:rgba(0,229,255,.045);border-radius:8px;padding:12px}
    body.nav-open{overflow:hidden}
    body.nav-open::after{content:'';position:fixed;inset:0;z-index:19;background:rgba(5,7,12,.72);backdrop-filter:blur(8px)}
    .site-header{z-index:20}
    .support-nav .wrap{display:grid;width:min(1240px,calc(100% - 40px));grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .mini-link{justify-content:center;text-align:center;white-space:normal}
    @media(max-width:1100px){.wrap{width:min(1240px,calc(100% - 28px))}.nav-link{min-width:0;justify-content:center;padding:0 8px;overflow-wrap:anywhere}.mini-link{justify-content:center;white-space:normal}}
    @media(max-width:900px){.primary-nav,.support-nav{display:none!important}.top-nav{min-height:58px;grid-template-columns:44px minmax(0,1fr) 44px;gap:8px;padding:7px 0}.brand{order:2;justify-self:center;max-width:100%;gap:6px;white-space:nowrap}.brand img{width:28px;height:28px}.mobile-menu-toggle{order:1;justify-self:start;display:inline-flex;width:44px;min-width:44px;min-height:44px;padding:0;gap:0;border-color:rgba(0,229,255,.58);background:rgba(0,229,255,.1)}.mobile-menu-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.hamburger-lines{width:21px;height:15px}.hamburger-lines::before{top:5px}.nav-actions{order:3;justify-self:end;gap:0}.nav-actions .btn:not(.cart-btn){display:none}.cart-btn{min-height:44px;min-width:44px;width:44px;padding-inline:0;gap:0;border-radius:999px}.cart-btn-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.mobile-menu{z-index:21;padding:12px 14px 16px;background:linear-gradient(180deg,rgba(10,12,18,.985),rgba(10,12,18,.965));box-shadow:0 28px 72px rgba(0,0,0,.58)}.seo-page{width:min(1240px,calc(100% - 28px));padding:12px 0 40px}.breadcrumbs{gap:6px;font-size:.76rem;margin-bottom:12px}.shop-tools,.collection-strip,.shop-hero,.merchandising-band,.order-path-band{grid-template-columns:1fr}.product-hero,.shop-hero,.collection-hero{grid-template-columns:1fr;gap:10px;padding:8px 0 12px}.shop-page .shop-stats{display:none}.filter-tabs,.collection-subnav,.collection-links,.link-band{justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.filter-tabs::-webkit-scrollbar,.collection-subnav::-webkit-scrollbar,.collection-links::-webkit-scrollbar,.link-band::-webkit-scrollbar{display:none}.filter-tab{flex:0 0 auto;min-height:44px;font-size:.68rem}.hero-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}.hero-actions .btn{flex:none;min-height:40px;padding-inline:12px}.status-strip,.approval-list,.catalog-meta{gap:6px;margin-top:10px}.status-strip span,.approval-list span,.catalog-meta span{min-height:24px;padding:0 8px;font-size:.58rem}.merch-family-band{padding:12px;margin-top:14px}.merch-family-band .section-heading{display:flex;align-items:start;justify-content:space-between;flex-direction:row;gap:10px;margin-bottom:10px}.merch-family-band .section-heading h2{font-size:1.24rem;line-height:1.08}.merch-family-band .eyebrow{display:none}.family-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.family-card{min-height:186px;align-content:start;gap:7px;padding:10px}.family-card img{height:88px;aspect-ratio:1/1;object-fit:contain}.family-card strong{font-size:.92rem;line-height:1.1}.family-card small{display:block;font-size:.74rem;line-height:1.3}.order-path-band{gap:10px}.order-path-band article{padding:14px}.catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.catalog-card{grid-template-rows:112px 1fr}.catalog-card img{height:112px;padding:10px}.catalog-card-body{padding:10px;gap:7px}.catalog-card h3{font-size:.92rem;line-height:1.08}.catalog-card p{display:none}.catalog-card--group{grid-column:1/-1;grid-template-rows:150px 1fr}.catalog-card--group img{height:150px}.catalog-card--group p.group-blurb{display:block}.catalog-meta .option-count{display:none}.purchase-panel{position:static;display:flex;flex-direction:column;padding:12px;gap:8px}.purchase-panel .price{order:1;font-size:1.48rem}.purchase-panel p{order:2;margin:0}.purchase-panel img{order:3;height:188px;padding:10px}.variant-select{order:4}.feature-cta{order:5}.approval-list{order:6}.collection-links a,.link-band a{flex:0 0 auto}.collection-strip{padding:12px}.section-heading{align-items:start;flex-direction:column;gap:10px}.seo-page h1{font-size:clamp(1.72rem,7.4vw,2.18rem);line-height:1.08;letter-spacing:.01em;overflow-wrap:break-word}.seo-page .lede{font-size:.94rem;line-height:1.45}.content-band,.variant-band,.link-band{margin-top:16px}.table-wrap{border:1px solid var(--line);border-radius:8px}.table-wrap table{min-width:540px}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.seo-page .product-card{grid-template-rows:112px 1fr;min-height:0}.seo-page .product-card img{height:112px;padding:10px}.product-card p{display:none}.collection-hero>img{height:196px;padding:10px}}
    @media(max-width:680px){.hero-actions{grid-template-columns:1fr}.family-grid,.catalog-grid,.product-grid{grid-template-columns:1fr}.catalog-card,.seo-page .product-card{min-height:0}.catalog-card h3{font-size:.98rem}.catalog-card p,.product-card p{display:block;-webkit-line-clamp:3}.purchase-panel img{height:172px}.table-wrap table{min-width:520px}}
    @media(max-width:420px){.seo-page{width:min(1240px,calc(100% - 24px))}.catalog-card h3{font-size:.86rem}.status-strip span,.approval-list span,.catalog-meta span{font-size:.55rem}.purchase-panel img{height:180px}.collection-hero>img{height:180px}}
  `
}

function buildShopCategories(products) {
  const labels = new Map()
  for (const product of products) {
    const category = categorizeProduct(product)
    labels.set(category.id, category.label)
  }
  return Array.from(labels.entries())
    .map(([id, label]) => ({ id, label, products: products.filter((product) => categorizeProduct(product).id === id) }))
    .sort((a, b) => b.products.length - a.products.length)
}

export function publicStorefrontProducts(products = []) {
  return products.filter((product) => product.publicVisible !== false && !product.internalProxy)
}

// Buyer-intent family names — these are customer-facing navigation labels.
const FAMILY_LABELS = {
  transfers: 'Transfers by size',
  builders: 'Gang sheet builders',
  stickers: 'UV DTF & stickers',
  apparel: 'Apparel & blanks',
  signage: 'Signs & graphics',
  promo: 'Promo & gifts',
  services: 'Shop services',
}

function categorizeProduct(product) {
  // Shop group cards carry an explicit owner-chosen category.
  if (product.shopCategory) return { id: product.shopCategory, label: FAMILY_LABELS[product.shopCategory] }
  const text = `${product.title} ${product.productType} ${product.handle}`.toLowerCase()
  if (isBuilderProduct(product)) return { id: 'builders', label: FAMILY_LABELS.builders }
  // Sports gear first: "UV-Printed Softballs" would otherwise trip the /uv/
  // stickers test (only the 4 ball/puck products match this in the catalog).
  if (/balls?\b|pucks?\b/.test(text)) return { id: 'promo', label: FAMILY_LABELS.promo }
  if (/uv|sticker|decal|label|patch/.test(text)) return { id: 'stickers', label: FAMILY_LABELS.stickers }
  if (/shirt|tee|hoodie|sweatshirt|apparel|hat/.test(text)) return { id: 'apparel', label: FAMILY_LABELS.apparel }
  if (/banner|sign|window|floor|magnet|vinyl|graphics/.test(text)) return { id: 'signage', label: FAMILY_LABELS.signage }
  if (/software|cadlink|rip|service|design|branding|logo/.test(text)) return { id: 'services', label: FAMILY_LABELS.services }
  if (/tumbler|cup|ball|puck|coin|personalized|promo/.test(text)) return { id: 'promo', label: FAMILY_LABELS.promo }
  // Everything else in this catalog is a transfer product — no 'other' bucket.
  return { id: 'transfers', label: FAMILY_LABELS.transfers }
}

function productCardMarkup(product, { className = 'product-card' } = {}) {
  const category = categorizeProduct(product)
  const image = resolveProductImages(product).card
  const variantCount = product.variants.length
  const firstPrice = firstDisplayPrice(product)
  const action = orderPathLabel(product)
  const isCatalog = className.includes('catalog-card')
  const body = `<div class="${isCatalog ? 'catalog-card-body' : 'card-copy'}">
              <span class="kicker">${escapeHtml(category.label)}</span>
              ${isCatalog ? `<h3>${escapeHtml(product.title)}</h3>` : `<strong>${escapeHtml(product.title)}</strong>`}
              <p>${escapeHtml(product.copy.shortDescription)}</p>
              <div class="catalog-meta">${firstPrice ? `<span>From $${escapeHtml(firstPrice)}</span>` : ''}<span class="option-count">${variantCount} ${variantCount === 1 ? 'option' : 'options'}</span><span class="route-chip route-${escapeHtml(buyerRoute(product))}">${escapeHtml(action)}</span>${product.cardNote ? `<span class="card-note">${escapeHtml(product.cardNote)}</span>` : ''}</div>
              <em>View options</em>
            </div>`
  return `
          <a class="${escapeHtml(className)}" href="${escapeHtml(product.url)}" data-category="${escapeHtml(category.id)}" data-title="${escapeHtml(`${product.title} ${product.productType} ${product.handle}`.toLowerCase())}">
            <img src="${escapeHtml(image.src)}" width="900" height="900" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">
            ${body}
          </a>`
}

function productCardImage(category) {
  const byCategory = {
    // builderCanvasLayout reads bright at thumbnail size; the wide-roll photo
    // goes near-black at 88px on the dark panel.
    builders: IMAGE_FAMILIES.builderCanvasLayout.card,
    transfers: resolveProductImages({ title: 'Custom DTF Transfers' }).card,
    stickers: resolveProductImages({ title: 'UV DTF Stickers' }).card,
    apparel: resolveProductImages({ title: 'Custom T-Shirts' }).card,
    signage: resolveProductImages({ title: 'Window Graphics' }).card,
    services: resolveProductImages({ title: 'CADLINK RIP Software' }).card,
    promo: resolveProductImages({ title: 'Personalized Tumblers' }).card,
    other: resolveProductImages({ title: 'Custom DTF Gang Sheets' }).card,
  }
  return byCategory[category.id] ?? byCategory.other
}

function lowestPrice(products) {
  const prices = products
    .flatMap((product) => product.variants ?? [])
    .map((variant) => Number(variantDisplayPrice(variant)))
    .filter((price) => Number.isFinite(price) && price > 0)
  return prices.length ? Math.min(...prices).toFixed(2) : null
}

function firstDisplayPrice(product) {
  for (const variant of product.variants ?? []) {
    const price = variantDisplayPrice(variant)
    if (price) return price
  }
  return null
}

function formatDisplayPrice(price) {
  const value = displayPriceNumber(price)
  return value === null ? null : value.toFixed(2)
}

// Returns null for missing/zero prices — templates render the buyer-route state
// instead of a fabricated floor price.
function displayPriceNumber(price) {
  const parsed = Number(price)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// The importer floored unpriced variants to $0.98 and flagged them; an honest
// display price treats those as unpriced (quote path), never as $0.98.
function variantDisplayPrice(variant) {
  if (!variant) return null
  if ((variant.flags ?? []).includes('low_price_floor_0_98')) return null
  return formatDisplayPrice(variant.price)
}

const BUYER_ROUTE_LABELS = {
  'order-online': 'Order online',
  builder: 'Customize in builder',
  quote: 'Request a quote',
  unavailable: 'Not currently available online',
}

// The single routing truth for cards, PDP hero, and variant tables. 'unavailable'
// is reserved for items the shop explicitly cannot produce; everything else that
// is not online-purchasable routes to quote (production default).
export function buyerRoute(product) {
  if (isBuilderProduct(product)) return 'builder'
  const purchasable = (product.variants ?? []).some(
    (variant) => variant.checkoutEnabled && variantDisplayPrice(variant) !== null
  )
  return purchasable ? 'order-online' : 'quote'
}

function orderPathLabel(product) {
  return BUYER_ROUTE_LABELS[buyerRoute(product)]
}


// Plain-English offer summary derived from the live variant set, so pricing
// lives in the product COPY, not only in the variant selector (owner QA,
// 2026-07-10). Hand-written product.offerCopy (catalog-edits) wins over this.
export function buildOfferSummary(product) {
  if (product.offerCopy) return product.offerCopy
  const priced = (product.variants ?? []).filter((v) => Number(v.price) > 0)
  if (!priced.length) return ''
  const money = (v) => `$${Number(v).toFixed(2).replace(/\.00$/, '')}`
  const label = (v) => {
    const opts = v.options && typeof v.options === 'object' ? Object.entries(v.options) : []
    if (opts.length) return opts.map(([name, value]) => (/title/i.test(name) ? String(value) : `${name} ${value}`)).join(', ')
    return String(v.title || v.sku || '').trim()
  }
  if (priced.length === 1) {
    const only = priced[0]
    const l = label(only)
    return `Pricing: ${money(only.price)}${l && !/default/i.test(l) ? ` (${l})` : ''}.`
  }
  if (priced.length <= 4) {
    return `Pricing: ${priced.map((v) => `${label(v)} — ${money(v.price)}`).join(' · ')}.`
  }
  const sorted = [...priced].sort((a, b) => Number(a.price) - Number(b.price))
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  if (Number(min.price) === Number(max.price)) {
    return `Pricing: every option is ${money(min.price)} (${priced.length} options).`
  }
  const optionNames = (product.options ?? []).map((o) => o.name).filter(Boolean)
  const axis = optionNames.length ? ` by ${optionNames.join(' and ').toLowerCase()}` : ''
  return `Pricing${axis}: from ${money(min.price)} (${label(min)}) to ${money(max.price)} (${label(max)}) — ${priced.length} options, every price shown in the table below.`
}

function isBuilderProduct(product) {
  // Owner offer sheet can force a product onto the direct add-to-cart path
  // even when its handle/tags look builder-ish (e.g. 100-pack stickers).
  if (product.forceDirectBuy === true) return false
  // The core catch-all gang sheet page IS the builder entry point — its copy
  // says "handled through the Kixxl builder", so route it there, not to quote.
  if (String(product.handle ?? '') === 'custom-gang-sheet') return true
  const handle = String(product.handle ?? '').toLowerCase()
  const handleWithoutPrefix = handle.replace(/^dtfva-/, '')
  const title = String(product.title ?? '').toLowerCase()
  const productType = String(product.productType ?? '').toLowerCase()
  const rawProductType = String(product.rawProductType ?? '').toLowerCase()
  const tags = (product.tags ?? []).map((tag) => String(tag).toLowerCase())
  const keyText = `${handle} ${title} ${tags.join(' ')}`
  const text = `${handleWithoutPrefix} ${title} ${productType} ${rawProductType} ${tags.join(' ')}`
  const familyText = `${handleWithoutPrefix} ${title} ${productType} ${rawProductType}`
  if (/builder|gang-sheet-builder|gang builder|sheet builder/.test(keyText)) return true
  if (rawProductType.includes('kixxl_rolling_canvas_product_hidden') || productType.includes('kixxl_rolling_canvas_product_hidden')) return true
  if (tags.includes('source-tag-kixxl-proxy-product')) return true
  if (/3d puff transfers/.test(text)) return true
  if (!/gang sheets?|gang sheet/.test(text) && !tags.includes('source-tag-gang-sheet')) return false
  return /dtf|transfer|sublimation|glitter|fluorescent|foil|uv/.test(familyText)
}

function isInternalBuilderProxyProduct(product) {
  const rawType = String(product.productType ?? '').toLowerCase()
  const tags = (product.tags ?? []).map((tag) => String(tag).toLowerCase())
  const optionNames = (product.options ?? []).map((option) => String(option?.name ?? option).toLowerCase())
  const variantText = (product.variants ?? [])
    .slice(0, 20)
    .map((variant) => `${variant.title ?? ''} ${variant.sku ?? ''} ${formatOptions(variant.options ?? {})}`)
    .join(' ')
  return rawType.includes('kixxl_rolling_canvas_product_hidden')
    || tags.includes('source-tag-kixxl-proxy-product')
    || optionNames.some((name) => name.includes('kixxl'))
    || /\b\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?-[A-Z0-9]{4}\b/i.test(variantText)
}

function internalProxyProductActionUrl(product) {
  const handle = String(product.handle ?? '').replace(/^dtfva-/, '')
  const text = `${handle} ${product.title ?? ''}`.toLowerCase()
  if (/dtf|sublimation|glitter|fluorescent|color|transfer|sheet/.test(text)) return '/gang-sheet-builder'
  return '/contact'
}

function variantsForDisplay(product) {
  if ((product.variants ?? []).length <= 60) return product.variants ?? []
  return (product.variants ?? []).slice(0, 36)
}

function dedupePages(pages) {
  const seen = new Set()
  const result = []
  for (const page of pages) {
    if (seen.has(page.handle)) continue
    seen.add(page.handle)
    result.push(page)
  }
  return result
}

function formatOptions(options = {}) {
  return Object.entries(options).map(([key, value]) => `${key}: ${value}`).join(' · ')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

// Nav grouping keys off the collection's own name — scoped-product counts skew
// toward builders because the transfer superset includes them.
function categorizeCollectionForNav(collection) {
  const handle = String(collection.handle ?? '').replace(/^dtfva-/, '')
  const text = `${handle} ${collection.title}`.toLowerCase()
  if (/builder/.test(text)) return 'builders'
  if (/uv|sticker|decal|label|patch/.test(text)) return 'stickers'
  if (/shirt|tee|hoodie|sweatshirt|apparel|hat\b/.test(text)) return 'apparel'
  if (/banner|sign|window|floor|magnet|vinyl|graphic/.test(text)) return 'signage'
  if (/software|cadlink|rip|service|vector|branding|logo|artwork/.test(text)) return 'services'
  if (/tumbler|cup|ball|puck|coin|personalized|promo|gift/.test(text)) return 'promo'
  return 'transfers'
}

function productsForCollection(collection, products) {
  // Strip the import prefix — "dtfva-" otherwise matches the /dtf/ scoping rule
  // for every collection (same trap as asset-map's searchableText).
  const handle = String(collection.handle ?? '').replace(/^dtfva-/, '')
  const text = `${handle} ${collection.title}`.toLowerCase()
  if (/\ball\b|featured|best-seller/.test(text)) return products
  if (/builder|gang-builder/.test(text)) {
    const builderProducts = products.filter((product) => isBuilderProduct(product))
    if (/uv|sticker|decal/.test(text)) return builderProducts.filter((product) => /uv|sticker|decal/.test(`${product.title} ${product.productType} ${product.handle}`.toLowerCase()))
    if (/sublimation|dye/.test(text)) return builderProducts.filter((product) => /sublimation|dye/.test(`${product.title} ${product.productType} ${product.handle}`.toLowerCase()))
    if (/glitter/.test(text)) return builderProducts.filter((product) => /glitter/.test(`${product.title} ${product.productType} ${product.handle}`.toLowerCase()))
    return builderProducts
  }
  const rules = [
    [/dtf|gang-sheet|gang-builder|heat-transfer/, /dtf|gang|transfer|puff|fluorescent|glitter|foil/i],
    [/sublimation|dye/, /sublimation/i],
    [/uv|sticker|decal/, /uv|sticker|decal|patch/i],
    [/patch/, /patch/i],
    [/magnet/, /magnet/i],
    [/banner/, /banner/i],
    [/shirt|t-shirt|apparel/, /shirt|tee|hoodie|sweatshirt|apparel/i],
    [/cadlink|software|rip/, /cadlink|software|rip|driver/i],
    [/sports|balls|pucks/, /softball|baseball|puck|pickleball|sports/i],
    [/window|floor|graphics/, /window|floor|vinyl|clings|graphics/i],
  ]
  const rule = rules.find(([collectionPattern]) => collectionPattern.test(text))
  if (!rule) return products.slice(0, 24)
  const [, productPattern] = rule
  const filtered = products.filter((product) => productPattern.test(`${product.title} ${product.productType} ${product.handle.replace(/^dtfva-/, '')}`))
  return filtered.length ? filtered : products.slice(0, 24)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function publicProductType(productType) {
  const raw = String(productType ?? '').trim()
  if (!raw || /kixxl|hidden|competitor parity|mws_fee_generated/i.test(raw)) return 'Custom Print Product'
  return raw
}

function publicTitle(title) {
  return String(title ?? '')
    .replace(/DTF Virginia/gi, 'Hatfield McCoy DTF')
    .replace(/Best in Virginia/gi, 'West Virginia Specialty')
}
