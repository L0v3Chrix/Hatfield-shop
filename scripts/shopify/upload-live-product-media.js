#!/usr/bin/env node

import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, ShopifyError } from './lib/shopify-client.js'

const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'hatfield-mccoy-dtf.myshopify.com'
const SITE_ORIGIN = (process.env.HM_MEDIA_ORIGIN || 'https://production-site-flax.vercel.app').replace(/\/$/, '')
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEFAULT_STATE_PATH = join(ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-state.json')
const DEFAULT_POSTFLIGHT_PATH = join(ROOT, 'project-ops', '2026-05-25-production-readiness-postflight.json')

const MEDIA_BY_HANDLE = {
  'dtf-22-gang-sheet-builder': {
    image: '/assets/shopify-images/car-gang-sheet-card.webp',
    alt: 'DTF 22 inch gang sheet builder layout preview',
  },
  'dtf-46-gang-sheet-builder': {
    image: '/assets/shopify-images/big-gangsheet-card.webp',
    alt: 'Wide gang sheet packed with customer artwork',
  },
  'glitter-dtf-22-gang-sheet-builder': {
    image: '/assets/shopify-images/glitter-sticker-card.webp',
    alt: 'Glitter UV DTF print close up with sparkle finish',
  },
  'glow-dtf-22-gang-sheet-builder': {
    image: '/assets/shopify-images/neon-items-card.webp',
    alt: 'Neon custom merchandise samples',
  },
  'sublimation-24-gang-sheet-builder': {
    image: '/assets/shopify-images/dtf-builder-card.webp',
    alt: 'Gang sheet builder canvas with artwork arranged on a sheet',
  },
  'dtf-22-sheet': {
    image: '/assets/shopify-images/vibrant-transfer-stack-card.webp',
    alt: 'DTF 22 inch transfer sheet preview',
  },
  'dtf-46-sheet': {
    image: '/assets/shopify-images/custom-dtf-transfers-card.webp',
    alt: 'DTF 46 inch transfer sheet preview',
  },
  'glitter-dtf-22-sheet': {
    image: '/assets/shopify-images/glitter-sticker-card.webp',
    alt: 'Glitter UV DTF print close up with sparkle finish',
  },
  'glow-dtf-22-sheet': {
    image: '/assets/shopify-images/neon-items-card.webp',
    alt: 'Neon custom merchandise samples',
  },
  'sublimation-24': {
    image: '/assets/shopify-images/h-m-tumblers-card.webp',
    alt: 'Lineup of personalized tumblers with custom prints',
  },
}

// Generated media map (D1) covers catalog products beyond the hardcoded live
// set; hardcoded entries win on conflict.
const MEDIA_MAP_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'output', 'competitor', 'dtfvirginia', 'media-map.json')
function mediaForHandle(handle) {
  if (MEDIA_BY_HANDLE[handle]) return MEDIA_BY_HANDLE[handle]
  if (!mediaForHandle.map) {
    mediaForHandle.map = existsSync(MEDIA_MAP_PATH)
      ? new Map(JSON.parse(readFileSync(MEDIA_MAP_PATH, 'utf8')).map((row) => [row.handle, { image: row.image, alt: row.alt }]))
      : new Map()
  }
  return mediaForHandle.map.get(handle) ?? null
}

const ADD_PRODUCT_IMAGE = `
mutation AddProductImage($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media {
      alt
      mediaContentType
      status
    }
    mediaUserErrors {
      field
      message
    }
    product {
      id
      title
    }
  }
}`

function productGid(productId) {
  return `gid://shopify/Product/${productId}`
}

async function fetchPublicProducts({ fetcher = fetch, shopDomain = SHOP_DOMAIN } = {}) {
  const response = await fetcher(`https://${shopDomain}/products.json?limit=250`)
  if (!response.ok) throw new Error(`Public products JSON failed: ${response.status}`)
  const data = await response.json()
  return data.products || []
}

export function readFallbackProducts({
  postflightPath = DEFAULT_POSTFLIGHT_PATH,
  statePath = DEFAULT_STATE_PATH,
} = {}) {
  if (existsSync(postflightPath)) {
    const postflight = JSON.parse(readFileSync(postflightPath, 'utf8'))
    const products = Object.entries(postflight.products || {}).map(([handle, summary]) => ({
      handle,
      title: handle,
      status: summary.status || 'ACTIVE',
      images: [],
      variants: [],
    }))
    if (products.length) return { products, source: 'production-postflight' }
  }

  if (!existsSync(statePath)) return { products: [], source: null }
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  const products = Array.isArray(state.products) ? state.products : []
  return { products, source: 'shopify-state-export' }
}

export async function loadProductsForMediaSync({
  fetcher = fetch,
  shopDomain = SHOP_DOMAIN,
  fallbackPostflightPath = DEFAULT_POSTFLIGHT_PATH,
  fallbackStatePath = DEFAULT_STATE_PATH,
} = {}) {
  try {
    const products = await fetchPublicProducts({ fetcher, shopDomain })
    return { products, source: 'public-storefront' }
  } catch (error) {
    const fallback = readFallbackProducts({
      postflightPath: fallbackPostflightPath,
      statePath: fallbackStatePath,
    })
    if (!fallback.products.length) throw error
    return {
      products: fallback.products,
      source: fallback.source,
      fallbackReason: error instanceof Error ? error.message : String(error),
    }
  }
}

export function buildMediaTargets(products, { source = 'public-storefront' } = {}) {
  return products
    .filter((product) => mediaForHandle(product.handle))
    .map((product) => ({
      id: product.id || product.productId || '',
      title: product.title || product.handle,
      handle: product.handle,
      currentImageCount: source === 'public-storefront'
        ? (product.images?.length || 0)
        : null,
      ...mediaForHandle(product.handle),
    }))
}

const PRODUCT_MEDIA_QUERY = `
query ProductMedia($handle: String!) {
  productByHandle(handle: $handle) {
    id
    media(first: 20) { nodes { id ... on MediaImage { image { url } } } }
  }
}`

const DELETE_PRODUCT_MEDIA = `
mutation DeleteProductMedia($productId: ID!, $mediaIds: [ID!]!) {
  productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
    deletedMediaIds
    mediaUserErrors { field message }
  }
}`

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const replaceMode = process.argv.includes('--replace')
  const productSource = await loadProductsForMediaSync()
  const targets = buildMediaTargets(productSource.products, { source: productSource.source })

  const sourceLabel = productSource.source === 'public-storefront'
    ? 'live storefront'
    : productSource.source === 'production-postflight'
      ? 'production postflight snapshot'
      : 'exported Shopify state'
  console.log(`Found ${productSource.products.length} ${sourceLabel} products; ${targets.length} have mapped Hatfield McCoy media.`)
  if (productSource.fallbackReason) {
    console.warn(`offline-fallback: using ${sourceLabel} because live storefront fetch failed (${productSource.fallbackReason})`)
  }
  const PRODUCTION_DIR = join(ROOT, 'deliverables', 'production-site')
  for (const target of targets) {
    const source = `${SITE_ORIGIN}${target.image}`
    const onDisk = existsSync(join(PRODUCTION_DIR, target.image))
    const status = target.currentImageCount == null
      ? 'mapped-offline'
      : target.currentImageCount > 0
        ? (replaceMode ? (dryRun ? 'would-replace' : 'replace') : 'skip-has-media')
        : dryRun
          ? 'would-upload'
          : 'upload'
    console.log(`${status}: ${target.handle} -> ${source}${onDisk ? '' : '  [WARN: not in local build]'}`)
  }

  if (dryRun) return

  const client = await createClient({
    shopDomain: SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || undefined,
    clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET,
  })

  // Replace mode: delete existing media first, logging the inverse so the
  // previous state is recoverable (original URLs + deleted media ids).
  const replaceLog = []
  if (replaceMode) {
    for (const target of targets.filter((item) => (item.currentImageCount ?? 0) > 0)) {
      const data = await client.gql(PRODUCT_MEDIA_QUERY, { handle: target.handle })
      const product = data.productByHandle
      if (!product?.media?.nodes?.length) continue
      const mediaIds = product.media.nodes.map((node) => node.id)
      const previousUrls = product.media.nodes.map((node) => node.image?.url).filter(Boolean)
      const payload = await client.gql(DELETE_PRODUCT_MEDIA, { productId: product.id, mediaIds })
      const errors = payload.productDeleteMedia.mediaUserErrors
      if (errors?.length) {
        console.error(`replace-delete errors for ${target.handle}: ${JSON.stringify(errors)}`)
        continue
      }
      replaceLog.push({ handle: target.handle, productId: product.id, deletedMediaIds: mediaIds, previousUrls })
      target.currentImageCount = 0
      console.log(`cleared: ${target.handle} (${mediaIds.length} media)`)
    }
    const { mkdirSync, writeFileSync } = await import('node:fs')
    const logDir = join(ROOT, 'output', 'shopify-audit')
    mkdirSync(logDir, { recursive: true })
    writeFileSync(join(logDir, 'media-replace-log.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      replaced: replaceLog,
    }, null, 2) + '\n')
  }

  for (const target of targets.filter((item) => item.currentImageCount === 0)) {
    const source = `${SITE_ORIGIN}${target.image}`
    try {
      const result = await client.gql(ADD_PRODUCT_IMAGE, {
        productId: productGid(target.id),
        media: [
          {
            mediaContentType: 'IMAGE',
            originalSource: source,
            alt: target.alt,
          },
        ],
      })
      const payload = result.productCreateMedia
      if (payload.mediaUserErrors?.length) {
        console.error(`media errors for ${target.handle}: ${JSON.stringify(payload.mediaUserErrors)}`)
      } else {
        console.log(`uploaded: ${target.handle}`)
      }
    } catch (error) {
      if (error instanceof ShopifyError && /write_products|read_products|Access denied|Auth rejected/i.test(error.message)) {
        console.error(`scope-blocked: ${target.handle} - token needs read_products and write_products.`)
        process.exitCode = 2
        continue
      }
      throw error
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
