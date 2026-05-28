#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildFrontendCatalog, writeFrontendArtifacts } from './frontend-generator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..')
const DEFAULT_NORMALIZED_PATH = join(PROJECT_ROOT, 'output', 'competitor', 'dtfvirginia', 'normalized-catalog.json')
const DEFAULT_SHOPIFY_STATE_PATH = join(PROJECT_ROOT, 'output', 'competitor', 'dtfvirginia', 'shopify-state.json')
const DEFAULT_OUTPUT_DIR = join(PROJECT_ROOT, 'deliverables', 'prototype')
const DEFAULT_SITE_URL = 'https://www.hatfieldmccoydtf.com'

function main() {
  const flags = parseFlags(process.argv)
  const normalizedPath = flags.normalizedPath || DEFAULT_NORMALIZED_PATH
  const outputDir = flags.outputDir || DEFAULT_OUTPUT_DIR
  if (!existsSync(normalizedPath)) throw new Error(`Normalized catalog not found: ${normalizedPath}`)
  const normalized = JSON.parse(readFileSync(normalizedPath, 'utf8'))
  const shopifyStatePath = flags.shopifyStatePath || DEFAULT_SHOPIFY_STATE_PATH
  const shopifyState = existsSync(shopifyStatePath) ? JSON.parse(readFileSync(shopifyStatePath, 'utf8')) : null
  const catalog = buildFrontendCatalog(normalized, { shopifyState })
  const result = writeFrontendArtifacts(catalog, {
    outputDir,
    siteUrl: flags.siteUrl || DEFAULT_SITE_URL,
    launched: flags.launched,
  })

  console.log('✓ Generated Hatfield McCoy SEO storefront layer')
  console.log(`Products: ${catalog.products.length}`)
  console.log(`Variants: ${catalog.meta.variant_count}`)
  console.log(`Collections: ${catalog.collections.length}`)
  console.log(`Pages: ${catalog.pages.length}`)
  console.log(`Indexable URLs: ${[...catalog.products, ...catalog.collections, ...catalog.pages].filter((item) => item.indexable).length}`)
  console.log(`Shopify state: ${shopifyState ? shopifyStatePath : '(not found; generated without imported IDs)'}`)
  console.log(`Catalog: ${result.catalogPath}`)
  console.log(`Products dir: ${result.productsDir}`)
  console.log(`Collections dir: ${result.collectionsDir}`)
  console.log(`Pages dir: ${result.pagesDir}`)
}

function parseFlags(argv) {
  const flags = {
    normalizedPath: '',
    outputDir: '',
    siteUrl: '',
    shopifyStatePath: '',
    launched: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--normalized':
        flags.normalizedPath = readValue(argv, ++i, arg)
        break
      case '--output-dir':
        flags.outputDir = readValue(argv, ++i, arg)
        break
      case '--site-url':
        flags.siteUrl = readValue(argv, ++i, arg).replace(/\/$/, '')
        break
      case '--shopify-state':
        flags.shopifyStatePath = readValue(argv, ++i, arg)
        break
      case '--launched':
        flags.launched = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
        break
      default:
        throw new Error(`Unknown flag: ${arg}`)
    }
  }
  return flags
}

function readValue(argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
  return value
}

function printHelp() {
  console.log(`Generate Hatfield McCoy SEO frontend layer

Usage:
  node scripts/competitor/dtfvirginia/generate-frontend.js [flags]

Flags:
  --normalized <path>   Normalized catalog JSON
  --output-dir <path>   Static storefront directory
  --site-url <url>      Canonical site URL
  --shopify-state <path> Imported Shopify product/variant ID state
  --launched            Render robots.txt as Allow: / instead of Disallow: /

Default output is deliverables/prototype. Draft pages remain noindex until approval tags are cleared.`)
}

try {
  main()
} catch (error) {
  console.error(`✗ ${error.message}`)
  if (process.env.DEBUG) console.error(error.stack)
  process.exit(1)
}
