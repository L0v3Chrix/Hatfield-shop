#!/usr/bin/env node
// Image coverage matrix (D1). Grades every public product and collection by how
// its resolved imagery serves merchandising, and emits the media map that the
// Shopify media upload merge consumes. Pure local computation — no network.
//
// Grades: curated (hand-picked override) > good > generic (family is spread too
// thin or is a known-generic illustration) > stale (webp derivative whose slug
// left the manifest) > missing (file absent on disk).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFrontendCatalog, publicStorefrontProducts } from './frontend-generator.js'
import {
  resolveProductImages,
  resolveCollectionImages,
  classifyProductVisualFamily,
  HANDLE_IMAGE_OVERRIDES,
} from './asset-map.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')
const NORMALIZED = join(ROOT, 'output', 'competitor', 'dtfvirginia', 'normalized-catalog.json')
const SHOPIFY_STATE = join(ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-state.json')
const SHOPIFY_IMG_DIR = join(ROOT, 'deliverables', 'brand-design-pack', 'assets', 'shopify-images')
const GRAPHICS_DIR = join(ROOT, 'deliverables', 'prototype', 'assets', 'images')
const OUT_DIR = join(ROOT, 'output', 'competitor', 'dtfvirginia')
const MD_OUT = join(ROOT, 'deliverables', 'brand-design-pack', 'asset-coverage-matrix.md')

// Families that are placeholder illustrations rather than product photography.
// D5 replaces each with a photoreal gen-<slug> source through the main pipeline.
const GENERIC_FAMILIES = new Set([
  'apparel-samples-stack', 'appalachian-ridge-film', 'blank-shirt-transfer',
  'builder-canvas-layout', 'dtf-transfer-peel', 'gang-sheet-roll',
  'glitter-film-sheet', 'glow-film-sheet', 'heat-press-shirt',
  'pressed-shirt-front', 'printer-output-film', 'service-sample-bundle',
  'shipping-pouch-transfers', 'sublimation-tumbler', 'uv-dtf-sticker-pack',
  'wide-format-roll',
])
const plannedFor = (family) => (GENERIC_FAMILIES.has(family) ? `gen-${family}` : null)

const MAX_PRODUCTS_PER_FAMILY = 6
const MAX_COLLECTIONS_PER_FAMILY = 4

// Derivative sets intentionally kept without a manifest source until D5
// regenerates them (mirrors LEGACY_PINNED_SLUGS in prepare-shopify-images.py).
const LEGACY_PINNED_SLUGS = new Set(['featured-merch-scene'])

const normalized = JSON.parse(readFileSync(NORMALIZED, 'utf8'))
const shopifyState = existsSync(SHOPIFY_STATE) ? JSON.parse(readFileSync(SHOPIFY_STATE, 'utf8')) : null
const catalog = buildFrontendCatalog(normalized, { shopifyState })
const products = publicStorefrontProducts(catalog.products)
const collections = catalog.collections

const manifest = JSON.parse(readFileSync(join(SHOPIFY_IMG_DIR, 'manifest.json'), 'utf8'))
const manifestDerivatives = new Set(
  (manifest.images ?? manifest.items ?? manifest ?? []).flatMap?.((item) =>
    Object.values(item.derivatives ?? {}).map((d) => basename(d.file))
  ) ?? []
)

function srcExists(src) {
  if (!src) return false
  if (src.startsWith('/assets/shopify-images/')) {
    return existsSync(join(SHOPIFY_IMG_DIR, src.replace('/assets/shopify-images/', '')))
  }
  if (src.startsWith('/assets/images/')) {
    return existsSync(join(GRAPHICS_DIR, src.replace('/assets/images/', '')))
  }
  return false
}

function gradeEntry({ family, card, hero, overridden, familyCount, maxPerFamily }) {
  if (!srcExists(card?.src) || !srcExists(hero?.src)) return 'missing'
  if (overridden) return 'curated'
  const isDerivative = /-(card|hero|thumb)\.webp$/.test(card?.src ?? '')
  if (isDerivative && manifestDerivatives.size && !manifestDerivatives.has(basename(card.src))
    && !LEGACY_PINNED_SLUGS.has(family)) return 'stale'
  if (GENERIC_FAMILIES.has(family) || familyCount > maxPerFamily) return 'generic'
  return 'good'
}

// First pass: resolve families to compute spread counts
const productResolved = products.map((p) => ({ p, images: resolveProductImages(p) }))
const collectionResolved = collections.map((c) => ({ c, images: resolveCollectionImages(c) }))
const productFamilyCounts = {}
for (const { images } of productResolved) {
  productFamilyCounts[images.family] = (productFamilyCounts[images.family] ?? 0) + 1
}
const collectionFamilyCounts = {}
for (const { images } of collectionResolved) {
  collectionFamilyCounts[images.family] = (collectionFamilyCounts[images.family] ?? 0) + 1
}

const productRows = productResolved.map(({ p, images }) => {
  const overridden = Boolean(HANDLE_IMAGE_OVERRIDES[p.handle])
  return {
    handle: p.handle,
    title: p.title,
    ruleLabel: classifyProductVisualFamily(p),
    family: images.family,
    card: images.card.src,
    hero: images.hero.src,
    overridden,
    grade: gradeEntry({
      family: images.family, card: images.card, hero: images.hero, overridden,
      familyCount: productFamilyCounts[images.family], maxPerFamily: MAX_PRODUCTS_PER_FAMILY,
    }),
    planned: plannedFor(images.family),
  }
})

const collectionRows = collectionResolved.map(({ c, images }) => ({
  handle: c.handle,
  title: c.title,
  family: images.family,
  card: images.card.src,
  hero: images.hero.src,
  grade: gradeEntry({
    family: images.family, card: images.card, hero: images.hero, overridden: false,
    familyCount: collectionFamilyCounts[images.family], maxPerFamily: MAX_COLLECTIONS_PER_FAMILY,
  }),
  planned: plannedFor(images.family),
}))

const tally = (rows) => rows.reduce((acc, r) => ((acc[r.grade] = (acc[r.grade] ?? 0) + 1), acc), {})
const rollup = {
  products: { count: productRows.length, byGrade: tally(productRows), byFamily: productFamilyCounts },
  collections: { count: collectionRows.length, byGrade: tally(collectionRows), byFamily: collectionFamilyCounts },
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'asset-coverage-matrix.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  rollup,
  products: productRows,
  collections: collectionRows,
}, null, 2) + '\n')

// Media map for the Shopify upload merge: best current card image per public product
writeFileSync(join(OUT_DIR, 'media-map.json'), JSON.stringify(
  productRows.map((r) => {
    const override = HANDLE_IMAGE_OVERRIDES[r.handle]
    return {
      handle: r.handle,
      image: r.card,
      alt: (override?.alt ?? `${r.title} — Hatfield McCoy DTF`).slice(0, 125),
      family: r.family,
      grade: r.grade,
    }
  }), null, 2) + '\n')

const familyTable = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])
  .map(([family, count]) => `| ${family} | ${count} | ${GENERIC_FAMILIES.has(family) ? 'generic illustration — D5 replaces' : ''} |`)
  .join('\n')
writeFileSync(MD_OUT, `# Asset Coverage Matrix (generated — do not hand-edit)

Generated by \`npm run images:coverage\`. Data: \`output/competitor/dtfvirginia/asset-coverage-matrix.json\`.

## Products (${productRows.length})

Grades: ${JSON.stringify(rollup.products.byGrade)}

| Family | Products | Note |
|---|---|---|
${familyTable(productFamilyCounts)}

## Collections (${collectionRows.length})

Grades: ${JSON.stringify(rollup.collections.byGrade)}

| Family | Collections | Note |
|---|---|---|
${familyTable(collectionFamilyCounts)}

## Worst offenders

${[...productRows, ...collectionRows].filter((r) => r.grade === 'missing' || r.grade === 'stale')
  .map((r) => `- ${r.grade.toUpperCase()}: ${r.handle} → ${r.card}`).join('\n') || '- none'}
`)

console.log(`Products: ${productRows.length} ${JSON.stringify(rollup.products.byGrade)}`)
console.log(`Collections: ${collectionRows.length} ${JSON.stringify(rollup.collections.byGrade)}`)
console.log('Top product families:', familyTable(productFamilyCounts).split('\n').slice(0, 6).join(' · ').replaceAll('|', '').replace(/\s+/g, ' '))
console.log('Top collection families:', familyTable(collectionFamilyCounts).split('\n').slice(0, 4).join(' · ').replaceAll('|', '').replace(/\s+/g, ' '))
console.log(`Matrix: ${join(OUT_DIR, 'asset-coverage-matrix.json')}`)
console.log(`Media map: ${join(OUT_DIR, 'media-map.json')}`)
