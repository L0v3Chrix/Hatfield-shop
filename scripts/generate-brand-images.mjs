#!/usr/bin/env node
// Brand image generation driver (D4/D5). Calls the Gemini image API directly
// and writes candidates to tmp/image-curation/ (gitignored). Resume-safe:
// existing candidate files are skipped, so interrupted runs just re-invoke.
// Approved images are promoted into Shopify-images-good/ by hand afterwards —
// this script never touches the protected pool.
//
// Usage: node scripts/generate-brand-images.mjs [--only slug1,slug2]
// Env:   GEMINI_API_KEY (required), GEMINI_IMAGE_MODEL (default gemini-3-pro-image)

import 'dotenv/config'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'tmp', 'image-curation')
const LOG_DIR = join(ROOT, 'output', 'readiness')
const KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image'
if (!KEY) {
  console.error('GEMINI_API_KEY missing — set it in .env (gitignored).')
  process.exit(1)
}

// Locked brand template: photoreal, dark shop, neutral key on prints, brand
// accents as environment rim light only, never tinting the printed surface.
const TEMPLATE = (subject) =>
  `Photorealistic commercial product photography for a custom DTF print shop. ${subject} ` +
  'Dark industrial workshop setting with near-black charcoal surfaces, soft neutral key light ' +
  'keeping printed colors true, faint magenta and cyan rim-light accents from the environment ' +
  'only and never tinting the printed surface, subject fills about seventy percent of the frame, ' +
  'centered composition, no people, no faces, no readable brand names, no logos, no text, ' +
  'no watermarks, crisp studio-quality detail.'

const SUBJECTS = {
  // D5 — replacements for the 16 illustration families
  'gen-dtf-transfer-peel': 'A single hand peeling clear DTF transfer film away from a freshly heat-pressed black t-shirt, revealing a vivid multicolor printed design beneath (the hand is the only human element).',
  'gen-gang-sheet-roll': 'A wide roll of printed DTF transfer film partially unrolled on a workbench, packed edge to edge with assorted colorful artwork designs.',
  'gen-builder-canvas-layout': 'A printed 22 inch DTF gang sheet lying flat on a dark workbench, filled with neatly arranged abstract geometric and nature-silhouette designs of different sizes in an efficient grid layout, strictly no letters, no words, no typography anywhere in the artwork.',
  'gen-glitter-film-sheet': 'Close-up of a glitter DTF transfer sheet with sparkling metallic flake texture catching the light, a colorful printed design visible in the glitter.',
  'gen-glow-film-sheet': 'A glow-in-the-dark DTF transfer sheet with its design glowing soft green in dim light, lying next to the same sheet shown under normal light.',
  'gen-uv-dtf-sticker-pack': 'A sheet of glossy UV DTF stickers on a clear release liner with vibrant durable decal shapes, two stickers already applied to a dark insulated tumbler standing beside the sheet.',
  'gen-apparel-samples-stack': 'A neat stack of folded blank t-shirts in heather gray, black, and earth tones on a workbench, ready for custom printing.',
  'gen-blank-shirt-transfer': 'A blank dark t-shirt laid flat with an unpressed DTF transfer positioned on the chest, aligned and ready before heat pressing.',
  'gen-heat-press-shirt': 'A commercial clamshell heat press pressing a t-shirt with the pressure handle down and a wisp of steam rising.',
  'gen-pressed-shirt-front': 'Front view of a finished black t-shirt on a table with a vivid freshly pressed full-color design, fabric texture visible.',
  'gen-printer-output-film': 'A wide-format DTF printer outputting printed transfer film, the film emerging with colorful designs, a powder shaker unit nearby.',
  'gen-shipping-pouch-transfers': 'Rolled printed transfer film inside a kraft shipping mailer on a packing bench with tape and blank labels, an order ready to ship; the visible prints are abstract colorful shapes only, strictly no letters, no words, no typography.',
  'gen-sublimation-tumbler': 'A white stainless tumbler with a vibrant full-wrap sublimation print standing on a dark bench beside printed sublimation paper sheets.',
  'gen-wide-format-roll': 'A large wide-format print roll of signage material partially unrolled showing a bold colorful printed graphic.',
  'gen-appalachian-ridge-film': 'A DTF transfer film sheet printed with a layered Appalachian mountain ridge silhouette design in neon magenta and cyan on dark film.',
  'gen-service-sample-bundle': 'A bundle of assorted printed sample swatches and small test prints fanned out on a dark workbench, every print an abstract colorful graphic or nature silhouette, strictly no letters, no words, no typography.',
  // D4 — gap subjects
  'gen-magnet-truck-door': 'A rectangular printed magnetic sign mounted on a work truck door in a parking area, carrying a simple bold geometric graphic.',
  'gen-perf-window-vinyl': 'Perforated window vinyl graphic applied to a storefront glass window seen from outside, bold colorful print with the tiny perforation dot pattern visible up close.',
  'gen-rip-software-station': 'A print production computer workstation beside a wide-format printer, the monitor showing an abstract colorful print layout grid.',
  'gen-hockey-puck': 'A black hockey puck with a custom full-color printed circular graphic on its top face, resting on a dark surface.',
  'gen-tumbler-press': 'A tumbler heat press machine with a stainless tumbler clamped inside and a printed wrap being applied.',
  'gen-coin-display': 'Custom printed commemorative coins displayed in a dark velvet tray, metallic rims with colorful printed centers.',
  'gen-vector-cleanup': 'A side-by-side comparison on a designer desk: a rough hand-sketched artwork print next to its clean crisp vector version print.',
}

const onlyArg = process.argv.find((a) => a.startsWith('--only'))
const only = onlyArg ? process.argv[process.argv.indexOf(onlyArg) + 1]?.split(',') ?? [] : null
const queue = Object.entries(SUBJECTS).filter(([slug]) => !only || only.includes(slug))

async function generate(slug, subject, attempt = 1) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 150_000)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: TEMPLATE(subject) }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: '1:1', imageSize: '2K' },
          },
        }),
      }
    )
    const json = await res.json()
    if (!res.ok) {
      const message = json.error?.message ?? `HTTP ${res.status}`
      // Older image models reject imageSize — retry once without it.
      if (attempt === 1 && /imageSize|image_size|Unknown name/i.test(message)) {
        return generate(slug, subject, 2)
      }
      if (attempt === 1 && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 20_000))
        return generate(slug, subject, 2)
      }
      throw new Error(message)
    }
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
    if (!part) throw new Error('no image in response (possibly safety-filtered)')
    const buffer = Buffer.from(part.inlineData.data, 'base64')
    const file = join(OUT_DIR, `${slug}.png`)
    writeFileSync(file, buffer)
    return { slug, status: 'ok', bytes: buffer.length }
  } finally {
    clearTimeout(timer)
  }
}

mkdirSync(OUT_DIR, { recursive: true })
const results = []
for (const [slug, subject] of queue) {
  if (existsSync(join(OUT_DIR, `${slug}.png`))) {
    console.log(`skip (exists): ${slug}`)
    results.push({ slug, status: 'exists' })
    continue
  }
  try {
    const result = await generate(slug, subject)
    console.log(`generated: ${slug} (${Math.round(result.bytes / 1024)} KB)`)
    results.push(result)
  } catch (err) {
    console.error(`FAILED: ${slug} — ${err.message.slice(0, 140)}`)
    results.push({ slug, status: 'failed', error: err.message.slice(0, 200) })
  }
}

mkdirSync(LOG_DIR, { recursive: true })
writeFileSync(join(LOG_DIR, 'image-generation-log.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  model: MODEL,
  results,
}, null, 2) + '\n')
const ok = results.filter((r) => r.status !== 'failed').length
console.log(`\n${ok}/${queue.length} candidates ready in tmp/image-curation/`)
process.exit(ok === queue.length ? 0 : 1)
