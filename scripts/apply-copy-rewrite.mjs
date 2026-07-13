#!/usr/bin/env node
// Apply a copy-rewrite bundle (from the 2026-07-13 rewrite workflow) to the two
// owner-truth layers: catalog-edits.json (dtfva products) and core-copy.json
// (core sheet products). Input: JSON file of entries [{handle, lede, offer, body[]}].
// Existing hand-written offerCopy entries in catalog-edits are never overwritten.
// Usage: node scripts/apply-copy-rewrite.mjs /tmp/hm-copy-rewrite.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))) === undefined ? '.' : join(dirname(fileURLToPath(import.meta.url)), '..')
const EDITS_PATH = join(ROOT, 'scripts', 'competitor', 'dtfvirginia', 'catalog-edits.json')
const CORE_COPY_PATH = join(ROOT, 'scripts', 'shopify', 'config', 'core-copy.json')

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('usage: node scripts/apply-copy-rewrite.mjs <entries.json>')
  process.exit(2)
}
const entries = JSON.parse(readFileSync(inputPath, 'utf8'))
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const toBodyHtml = (paragraphs) => paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n')

const edits = JSON.parse(readFileSync(EDITS_PATH, 'utf8'))
edits.copyOverrides = edits.copyOverrides ?? {}
edits.offerCopy = edits.offerCopy ?? {}
const coreCopy = existsSync(CORE_COPY_PATH) ? JSON.parse(readFileSync(CORE_COPY_PATH, 'utf8')) : {}

let dtfva = 0
let core = 0
for (const entry of entries) {
  const override = { shortDescription: entry.lede, bodyHtml: toBodyHtml(entry.body) }
  if (entry.handle.startsWith('dtfva-')) {
    edits.copyOverrides[entry.handle] = override
    if (!edits.offerCopy[entry.handle]) edits.offerCopy[entry.handle] = entry.offer
    dtfva += 1
  } else {
    coreCopy[entry.handle] = { copyOverrides: override, offerCopy: entry.offer }
    core += 1
  }
}

writeFileSync(EDITS_PATH, JSON.stringify(edits, null, 2) + '\n')
writeFileSync(CORE_COPY_PATH, JSON.stringify(coreCopy, null, 2) + '\n')
console.log(`applied: ${dtfva} dtfva copyOverrides (offerCopy only where absent), ${core} core products`)
