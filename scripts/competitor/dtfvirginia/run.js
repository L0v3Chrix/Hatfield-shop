#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { scrapeDtfVirginia } from './scrape.js'
import { normalizeCatalog } from './normalize.js'
import { writeExportArtifacts } from './export.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..', '..')
const DEFAULT_OUTPUT_DIR = join(PROJECT_ROOT, 'output', 'competitor', 'dtfvirginia')
const DEFAULT_RAW_PATH = join(DEFAULT_OUTPUT_DIR, 'raw-scrape.json')

async function main() {
  const flags = parseFlags(process.argv)
  const outputDir = flags.outputDir || DEFAULT_OUTPUT_DIR
  mkdirSync(outputDir, { recursive: true })

  let scrape
  if (flags.fromRaw) {
    scrape = JSON.parse(readFileSync(flags.fromRaw, 'utf8'))
    console.log(`✓ Loaded raw scrape from ${flags.fromRaw}`)
  } else {
    console.log('Fetching DTF Virginia public Shopify endpoints and sitemaps...')
    scrape = await scrapeDtfVirginia({ includeCollectionProducts: flags.includeCollectionProducts })
    writeFileSync(DEFAULT_RAW_PATH, JSON.stringify(scrape, null, 2))
    console.log(`✓ Wrote raw scrape to ${DEFAULT_RAW_PATH}`)
  }

  const normalized = normalizeCatalog(scrape)
  const { paths, report } = writeExportArtifacts(normalized, { outputDir })

  console.log('\n━━━ DTF Virginia parity export ━━━')
  console.log(`Products: ${report.summary.products}`)
  console.log(`Variants: ${report.summary.variants}`)
  console.log(`Collections: ${report.summary.collections}`)
  console.log(`Commerce/support pages queued: ${report.summary.pages}`)
  console.log(`Low-price $0.98 exceptions: ${report.summary.low_price_exceptions}`)
  console.log(`Fulfillment-risk products: ${report.summary.fulfillment_risk_products}`)
  console.log(`Validation errors: ${report.summary.validation_errors}`)
  console.log('\nArtifacts:')
  for (const [label, path] of Object.entries(paths)) console.log(`- ${label}: ${path}`)

  if (normalized.validationErrors.length) {
    console.error('\nValidation errors detected. Review artifacts before importing to Shopify.')
    for (const error of normalized.validationErrors.slice(0, 20)) console.error(`- ${error}`)
    if (normalized.validationErrors.length > 20) console.error(`- ...and ${normalized.validationErrors.length - 20} more`)
    process.exitCode = 1
  }
}

function parseFlags(argv) {
  const flags = {
    includeCollectionProducts: false,
    fromRaw: '',
    outputDir: '',
  }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--include-collection-products':
        flags.includeCollectionProducts = true
        break
      case '--from-raw':
        flags.fromRaw = readValue(argv, ++i, arg)
        if (!existsSync(flags.fromRaw)) throw new Error(`Raw scrape file not found: ${flags.fromRaw}`)
        break
      case '--output-dir':
        flags.outputDir = readValue(argv, ++i, arg)
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
  console.log(`DTF Virginia competitive-parity workflow

Usage:
  node scripts/competitor/dtfvirginia/run.js [flags]

Flags:
  --from-raw <path>                   Normalize/export an existing raw scrape JSON
  --output-dir <path>                 Artifact directory (default: output/competitor/dtfvirginia)
  --include-collection-products       Also fetch /collections/<handle>/products.json for membership research
  --help                              Show this help

This command does not mutate Shopify. It writes review artifacts for approval.`)
}

main().catch((error) => {
  console.error(`✗ ${error.message}`)
  if (process.env.DEBUG) console.error(error.stack)
  process.exit(1)
})
