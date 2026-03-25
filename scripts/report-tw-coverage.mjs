/**
 * Lists crop/seed display names in data/seeds.json that have no exact `tw` match in tw-items.json.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SEEDS_JSON = join(ROOT, 'data', 'seeds.json')
const TW_ITEMS_JSON = join(
  'c:',
  'ReferenceProject',
  'ffxiv-teamcraft',
  'libs',
  'data',
  'src',
  'lib',
  'json',
  'tw',
  'tw-items.json',
)

function collectNames(seed, out) {
  if (seed.name && seed.name !== '--') out.add(seed.name.trim())
  for (const u of seed.usedInOtherCrosses ?? []) {
    if (u.name && u.name !== '--') out.add(u.name.trim())
  }
  for (const c of seed.confirmedCrosses ?? []) {
    if (c.parentA?.name && c.parentA.name !== '--') out.add(c.parentA.name.trim())
    if (c.parentB?.name && c.parentB.name !== '--') out.add(c.parentB.name.trim())
    if (c.alternate?.name && c.alternate.name !== '--')
      out.add(c.alternate.name.trim())
  }
}

async function main() {
  const [seedsRaw, twRaw] = await Promise.all([
    readFile(SEEDS_JSON, 'utf8'),
    readFile(TW_ITEMS_JSON, 'utf8'),
  ])
  const { seeds } = JSON.parse(seedsRaw)
  const twItems = JSON.parse(twRaw)

  const twValues = new Set()
  for (const row of Object.values(twItems)) {
    if (row?.tw && typeof row.tw === 'string') twValues.add(row.tw.trim())
  }

  const allNames = new Set()
  for (const s of seeds) collectNames(s, allNames)

  const missing = [...allNames].filter((n) => !twValues.has(n)).sort()

  console.log(
    `tw-items.json 內不重複的 tw 字串數量: ${twValues.size}`,
  )
  console.log(`seeds.json 內不重複的作物／種子名稱數量: ${allNames.size}`)
  console.log(
    `\n以下 ${missing.length} 個名稱在 tw-items.json 中**沒有**任何一筆與之完全相同的「tw」欄位：\n`,
  )
  for (const m of missing) console.log(`  - ${m}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
