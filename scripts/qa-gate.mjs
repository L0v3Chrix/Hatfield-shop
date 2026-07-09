#!/usr/bin/env node
// QA gate runner (F2). Runs the full local verification chain in order and
// prints the highest gate the tree currently satisfies. Network-dependent
// steps run only when credentials are present and never block LOCAL_READY.
//
//   BLOCKED            — any local step failed
//   LOCAL_READY        — all local steps green
//   STAGING_READY      — requires a deployed preview + the checks in
//                        docs/qa-gate-ladder.md (this script reports the
//                        network-step results as advisory evidence)
//
// Usage: npm run qa:gate   (add --skip-build to reuse the last build)

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const skipBuild = process.argv.includes('--skip-build')

const LOCAL_STEPS = [
  ['unit + generator tests', 'npm run --silent competitor:dtfva:test'],
  ...(skipBuild ? [] : [['production build', 'npm run --silent production:prepare']]),
  ['readiness audit + copy scanner', 'npm run --silent production:verify'],
  ['round-trip integrity', 'node scripts/verify-roundtrip.mjs'],
  ['offer-sheet conformance', 'node scripts/verify-offer-sheet.mjs'],
]
const NETWORK_STEPS = [
  ['shopify state audit', 'npm run --silent shopify:audit'],
  ['storefront visibility + cartCreate', 'npm run --silent shopify:storefront:verify'],
  ['builder live verification', 'npm run --silent kixxl:verify -- --handle dtf-22-gang-sheet-builder'],
]

function run(name, command) {
  try {
    execSync(command, { cwd: ROOT, stdio: 'pipe' })
    console.log(`✓ ${name}`)
    return { name, ok: true }
  } catch (err) {
    const tail = String(err.stdout ?? '').split('\n').filter(Boolean).slice(-4).join(' | ')
    console.log(`✗ ${name} — ${tail || err.message.split('\n')[0]}`)
    return { name, ok: false }
  }
}

const localResults = LOCAL_STEPS.map(([name, command]) => run(name, command))
const hasCreds = Boolean(process.env.SHOPIFY_SHOP_DOMAIN) ||
  (() => { try { execSync('test -f .env', { cwd: ROOT }); return true } catch { return false } })()
const networkResults = hasCreds
  ? NETWORK_STEPS.map(([name, command]) => run(name, command))
  : (console.log('ℹ network steps skipped (no credentials present)'), [])

const localGreen = localResults.every((r) => r.ok)
const gate = localGreen ? 'LOCAL_READY' : 'BLOCKED'

mkdirSync(join(ROOT, 'output', 'readiness'), { recursive: true })
writeFileSync(join(ROOT, 'output', 'readiness', 'qa-gate.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  gate,
  local: localResults,
  network: networkResults,
}, null, 2) + '\n')

console.log(`\nGATE: ${gate}${gate === 'LOCAL_READY'
  ? ' — staging requires a deployed preview (see docs/qa-gate-ladder.md)'
  : ' — fix the smallest failing step and rerun'}`)
console.log(`Network evidence: ${networkResults.filter((r) => r.ok).length}/${networkResults.length} green`)
process.exit(localGreen ? 0 : 1)
