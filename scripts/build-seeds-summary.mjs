/**
 * Writes public/data/seeds-summary.json for the web UI (slim payload).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SEEDS_JSON = join(ROOT, 'data', 'seeds.json')
const OUT = join(ROOT, 'public', 'data', 'seeds-summary.json')
const SITE_BASE = 'https://www.ffxivgardening.com/'

async function main() {
  const { seeds, meta } = JSON.parse(await readFile(SEEDS_JSON, 'utf8'))
  const summary = seeds.map((s) => ({
    seedId: s.seedId,
    name: s.name,
    seedType: s.seedType ?? null,
    growTime: s.growTime ?? null,
    wiltTime: s.wiltTime ?? null,
    harvestLocation: s.harvestLocation ?? null,
    nodeLevel: s.nodeLevel != null ? String(s.nodeLevel) : null,
    /** 本機靜態圖（見 scripts/download-seed-icons.mjs） */
    iconUrl: `/images/seed-icon/${s.seedId}.png`,
    detailUrl: `${SITE_BASE}seed-details.php?SeedID=${s.seedId}`,
  }))

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    JSON.stringify(
      {
        meta: {
          ...meta,
          summaryGeneratedAt: new Date().toISOString(),
        },
        seeds: summary,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`Wrote ${OUT} (${summary.length} seeds)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
