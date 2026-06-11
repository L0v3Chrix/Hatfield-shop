#!/usr/bin/env node
// Deterministic public-copy scanner (G5). Fails the build when customer-visible
// text carries hesitation/internal/tooling language, brand violations, or
// competitor names. Scans VISIBLE TEXT only: script/style blocks and tag
// attributes are stripped first, so URLs (apps/gangify/…), input placeholders,
// and class names never false-positive.
//
// Whitelist: scripts/copy-compliance-whitelist.json — [{file, term, reason}].
// Every entry must carry a reason; use it only for technically unavoidable text.

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PS = join(ROOT, 'deliverables', 'production-site')
const OUT_DIR = join(ROOT, 'output', 'readiness')
const WHITELIST_PATH = join(__dirname, 'copy-compliance-whitelist.json')

const FORBIDDEN = [
  // hesitation / project-state language
  ['blocker', /\bblockers?\b/i],
  ['blocked', /\bblocked\b/i],
  ['pending', /\bpending\b/i],
  ['open question', /open question/i],
  ['TBD', /\bTBD\b/],
  ['TODO', /\bTODO\b/],
  ['prototype', /\bprototypes?\b/i],
  ['staging', /\bstaging\b/i],
  ['draft', /\bdrafts?\b/i],
  ['placeholder', /\bplaceholders?\b/i],
  ['awaiting', /\bawaiting\b/i],
  ['not ready', /\bnot ready\b/i],
  ['client confirmation', /client confirmation/i],
  ['needs approval', /needs approval/i],
  // people / internal org names
  ['Jesse', /\bJesse\b/],
  ['Harold', /\bHarold\b/],
  ['RM Marketing', /RM Marketing/i],
  // tooling / AI language
  ['agent', /\bagents?\b/i],
  ['AI-generated', /\bAI[- ]generated\b/i],
  ['internal-only', /\binternal[- ]only\b|\binternal\b/i],
  ['Kixxl', /kixxl/i],
  ['Gangify', /gangify/i],
  // brand rules
  ['Hatfield & McCoy form', /Hatfield\s*(&|&amp;|and)\s*McCoy/i],
  ['bare Virginia', /(?<!West )\bVirginia\b/],
  // competitor names
  ['competitor name', /dtf\s*virginia|dtfvirginia|ninja\s*transfers|ninjatransfers/i],
]

const whitelist = existsSync(WHITELIST_PATH) ? JSON.parse(readFileSync(WHITELIST_PATH, 'utf8')) : []
const isWhitelisted = (file, term) =>
  whitelist.some((w) => w.term === term && (w.file === '*' || file.endsWith(w.file)))

function walkHtml(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walkHtml(full, out)
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
}

const findings = []
for (const file of walkHtml(PS)) {
  const rel = '/' + relative(PS, file)
  const text = visibleText(readFileSync(file, 'utf8'))
  for (const [term, pattern] of FORBIDDEN) {
    const match = text.match(pattern)
    if (!match) continue
    if (isWhitelisted(rel, term)) continue
    const at = match.index ?? 0
    findings.push({
      file: rel,
      term,
      context: text.slice(Math.max(0, at - 50), at + 60).replace(/\s+/g, ' ').trim(),
    })
  }
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'copy-compliance.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  filesScanned: walkHtml(PS).length,
  whitelistEntries: whitelist.length,
  findings,
}, null, 2) + '\n')

if (findings.length) {
  console.error(`COPY COMPLIANCE FAIL — ${findings.length} finding(s):`)
  for (const f of findings.slice(0, 40)) console.error(`  ${f.file} [${f.term}] …${f.context}…`)
  process.exit(1)
}
console.log(`COPY COMPLIANCE PASS (${walkHtml(PS).length} HTML files, ${whitelist.length} whitelist entries)`)
