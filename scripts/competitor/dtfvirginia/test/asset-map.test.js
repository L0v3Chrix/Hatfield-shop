import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  IMAGE_FAMILIES,
  HANDLE_IMAGE_OVERRIDES,
  resolveProductImages,
  resolveCollectionImages,
} from '../asset-map.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..', '..')
const SHOPIFY_IMG_DIR = join(ROOT, 'deliverables', 'brand-design-pack', 'assets', 'shopify-images')
const GRAPHICS_DIR = join(ROOT, 'deliverables', 'prototype', 'assets', 'images')

function srcExists(src) {
  if (src.startsWith('/assets/shopify-images/')) {
    return existsSync(join(SHOPIFY_IMG_DIR, src.replace('/assets/shopify-images/', '')))
  }
  if (src.startsWith('/assets/images/')) {
    return existsSync(join(GRAPHICS_DIR, src.replace('/assets/images/', '')))
  }
  return false
}

test('every image family card + hero file exists on disk', () => {
  for (const [name, family] of Object.entries(IMAGE_FAMILIES)) {
    assert.ok(srcExists(family.card.src), `${name}: missing card ${family.card.src}`)
    assert.ok(srcExists(family.hero.src), `${name}: missing hero ${family.hero.src}`)
  }
})

test('every curated override file exists on disk', () => {
  for (const [handle, image] of Object.entries(HANDLE_IMAGE_OVERRIDES)) {
    assert.ok(srcExists(image.src), `${handle}: missing override ${image.src}`)
  }
})

test('garment-dye apparel routes to apparel, not sublimation', () => {
  const { family } = resolveProductImages({
    handle: 'dtfva-custom-los-angeles-apparel-1865gd-garment-dye-sleeveless-tee',
    title: 'Custom Los Angeles Apparel 1865GD Garment Dye Sleeveless Tee',
  })
  assert.equal(family, 'gen-apparel-samples-stack')
})

test('rush fee routes to the rush-order photo', () => {
  const { family } = resolveProductImages({
    handle: 'dtfva-rush-fee',
    title: 'RUSH FEE - for same-day or expedited Printing',
  })
  assert.equal(family, 'rush-order')
})

test('tumbler products route to the tumbler lineup photo, not sublimation', () => {
  const { family } = resolveProductImages({
    handle: 'dtfva-personalized-tumblers',
    title: 'Personalized Tumblers',
  })
  assert.equal(family, 'h-m-tumblers')
})

test('featured/best/all collections reach the featured-merch fallback family', () => {
  const { family } = resolveCollectionImages({
    handle: 'dtfva-featured-products',
    title: 'Featured products',
  })
  assert.equal(family, 'featured-merch-scene')
})

test('tumbler collections route to the tumbler lineup photo', () => {
  const { family } = resolveCollectionImages({
    handle: 'dtfva-personalized-tumblers',
    title: 'Personalized Tumblers',
  })
  assert.equal(family, 'h-m-tumblers')
})

test('an unmatchable prefixed handle falls through to the default fallback', () => {
  const { family } = resolveProductImages({
    handle: 'dtfva-mystery-item',
    title: 'Mystery Item',
  })
  assert.equal(family, 'custom-dtf-transfers')
})

test('curated overrides win the card slot and keep the rule-resolved hero', () => {
  const handle = 'dtfva-bella-canvas-3001'
  const { card, hero, family } = resolveProductImages({
    handle,
    title: 'BELLA + CANVAS 3001 Unisex Jersey Tee',
  })
  assert.equal(card.src, HANDLE_IMAGE_OVERRIDES[handle].src)
  assert.equal(family, 'gen-apparel-samples-stack')
  assert.notEqual(hero.src, card.src)
})
