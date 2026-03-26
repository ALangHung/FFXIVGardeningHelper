/**
 * Writes public/data/seeds-summary.json（不含名稱；顯示名與搜尋字串見 public/data/i18n/seeds-i18n.json）。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedsSortedById } from './lib/seeds-by-id-utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC_DATA = join(ROOT, 'public', 'data')
const BY_ID_JSON = join(PUBLIC_DATA, 'seeds-by-id.json')
const OUT = join(PUBLIC_DATA, 'seeds-summary.json')
const SITE_BASE = 'https://www.ffxivgardening.com/'

async function main() {
  const { seedsById, meta } = JSON.parse(await readFile(BY_ID_JSON, 'utf8'))

  const summary = seedsSortedById(seedsById).map((s) => ({
    seedId: s.seedId,
    seedType: s.seedType ?? null,
    growTime: s.growTime ?? null,
    wiltTime: s.wiltTime ?? null,
    harvestLocation: s.harvestLocation ?? null,
    nodeLevel: s.nodeLevel != null ? String(s.nodeLevel) : null,
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
          nameFields:
            '種子道具名、作物名、nameSearchText 見 /data/i18n/seeds-i18n.json',
        },
        seeds: summary,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`Wrote ${OUT} (${summary.length} seeds, no embedded names)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
