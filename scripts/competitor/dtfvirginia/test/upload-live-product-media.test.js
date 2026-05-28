import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { buildMediaTargets, loadProductsForMediaSync } from '../../../shopify/upload-live-product-media.js'

test('falls back to production postflight handles when storefront fetch is unavailable', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'hm-media-fallback-'))
  const postflightPath = join(tempDir, 'project-ops', '2026-05-25-production-readiness-postflight.json')
  const statePath = join(tempDir, 'output', 'competitor', 'dtfvirginia', 'shopify-state.json')
  mkdirSync(join(tempDir, 'project-ops'), { recursive: true })
  mkdirSync(join(tempDir, 'output', 'competitor', 'dtfvirginia'), { recursive: true })
  writeFileSync(postflightPath, JSON.stringify({
    products: {
      'dtf-22-sheet': { status: 'ACTIVE' },
      'glow-dtf-22-sheet': { status: 'ACTIVE' },
      'not-mapped-here': { status: 'ACTIVE' },
    },
  }))
  writeFileSync(statePath, JSON.stringify({
    products: [
      {
        handle: 'different-state-product',
        productId: 'gid://shopify/Product/1',
        status: 'DRAFT',
        variants: [],
      },
    ],
  }))

  try {
    const result = await loadProductsForMediaSync({
      fetcher: async () => {
        throw new Error('fetch failed')
      },
      fallbackPostflightPath: postflightPath,
      fallbackStatePath: statePath,
    })

    assert.equal(result.source, 'production-postflight')
    assert.match(result.fallbackReason, /fetch failed/)
    const targets = buildMediaTargets(result.products, { source: result.source })
    assert.equal(targets.length, 2)
    assert.deepEqual(targets.map((target) => target.handle), ['dtf-22-sheet', 'glow-dtf-22-sheet'])
    assert.equal(targets[0].currentImageCount, null)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('preserves live image counts when storefront fetch succeeds', async () => {
  const result = await loadProductsForMediaSync({
    fetcher: async () => ({
      ok: true,
      async json() {
        return {
          products: [
            {
              id: 10,
              handle: 'dtf-22-sheet',
              title: 'DTF 22 Sheet',
              images: [{ src: 'https://example.com/one.webp' }],
            },
          ],
        }
      },
    }),
  })

  assert.equal(result.source, 'public-storefront')
  const targets = buildMediaTargets(result.products, { source: result.source })
  assert.equal(targets.length, 1)
  assert.equal(targets[0].currentImageCount, 1)
})
