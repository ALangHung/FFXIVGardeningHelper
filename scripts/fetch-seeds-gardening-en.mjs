/**
 * Writes public/data/seeds-gardening-en.json: seedId → English title from ffxivgardening.com.
 * Run when gardening names change (delay between requests).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'data', 'seeds-gardening-en.json')
const DELAY_MS = 350

async function fetchTitle(seedId) {
  const url = `https://www.ffxivgardening.com/seed-details.php?SeedID=${seedId}`
  const res = await fetch(url)
  const html = await res.text()
  const m = html.match(
    /<h3><img[^>]*>\s*<strong>([^<]+)<\/strong><\/h3>/i,
  )
  return m ? m[1].trim() : null
}

async function main() {
  const byId = {}
  for (let id = 1; id <= 107; id++) {
    byId[String(id)] = await fetchTitle(id)
    await delay(DELAY_MS)
    process.stderr.write(`.\r`)
  }
  process.stderr.write('\n')
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    JSON.stringify(
      {
        meta: {
          source: 'https://www.ffxivgardening.com/seed-details.php',
          fetchedAt: new Date().toISOString(),
        },
        bySeedId: byId,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`Wrote ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
