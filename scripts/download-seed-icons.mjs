/**
 * 下載 ffxivgardening.com 種子圖示至 public/images/seed-icon/
 * Run: node scripts/download-seed-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'images', 'seed-icon')
const BASE = 'https://www.ffxivgardening.com/images/seed-icon/'
const RANGE = [1, 107]
const DELAY_MS = 350

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const errors = []

  for (let id = RANGE[0]; id <= RANGE[1]; id++) {
    const url = `${BASE}${id}.png`
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'FFXIVGardeningHelper/1.0 (local asset mirror; +https://www.ffxivgardening.com)',
        },
      })
      if (!res.ok) {
        errors.push({ id, error: `HTTP ${res.status}` })
        console.warn(`SKIP ${id}: ${res.status}`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const outPath = join(OUT_DIR, `${id}.png`)
      await writeFile(outPath, buf)
      process.stdout.write(`OK ${id}/${RANGE[1]}\n`)
    } catch (e) {
      errors.push({ id, error: String(e?.message ?? e) })
      console.warn(`ERR ${id}:`, e)
    }
    if (id < RANGE[1]) await sleep(DELAY_MS)
  }

  console.log(`\nSaved PNGs under ${OUT_DIR}`)
  if (errors.length) console.warn('Errors:', errors.length, errors.slice(0, 5))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
