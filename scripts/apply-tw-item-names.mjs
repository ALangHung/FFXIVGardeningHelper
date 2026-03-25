/**
 * Replaces English crop/seed names in data/seeds.json with Traditional Chinese
 * from ffxiv-teamcraft tw-items.json (via items.json en → id).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_SEEDS = join(ROOT, 'data', 'seeds.json')
const OUT_BY_ID = join(ROOT, 'data', 'seeds-by-id.json')

const TEAMCRAFT_JSON = join(
  'c:',
  'ReferenceProject',
  'ffxiv-teamcraft',
  'libs',
  'data',
  'src',
  'lib',
  'json',
)
const ITEMS_JSON = join(TEAMCRAFT_JSON, 'items.json')
const TW_ITEMS_JSON = join(TEAMCRAFT_JSON, 'tw', 'tw-items.json')

/**
 * ffxivgardening.com uses short names; Teamcraft `items.json` uses the in-game item name.
 */
const EN_ALIASES = {
  'Shroud Cherry': 'Shroud Cherry Sapling',
  Tulip: 'Tulip Bulbs',
  Dahlia: 'Dahlia Bulbs',
  Arum: 'Arum Bulbs',
  'Lily of the Valley': 'Lily of the Valley Pips',
  Hyacinth: 'Hyacinth Bulbs',
  Cattleya: 'Cattleya Seeds',
  Paperflower: 'Paperflower Seeds',
  Champa: 'Champa Seeds',
  'Tea Flower': 'Tea Flower Seeds',
}

/**
 * When `tw-items.json` has no row for the item id (newer patches), use fixed TW.
 * Based on items-database `zh` where present, converted to Traditional Chinese.
 */
const MANUAL_TW = {
  Cattleya: '卡特蘭種子',
  Champa: '大季花種子',
  Paperflower: '葉子花種子',
  'Tea Flower': '茶花種子',
}

/** Prefer smaller item id when multiple entries share the same `en` (reissues). */
function buildEnToIdMap(items) {
  const map = new Map()
  for (const [id, o] of Object.entries(items)) {
    const en = o?.en
    if (typeof en !== 'string' || !en.trim()) continue
    const prev = map.get(en)
    if (!prev || Number(id) < Number(prev)) map.set(en, id)
  }
  return map
}

function twForId(twItems, id) {
  const row = twItems[String(id)]
  return row?.tw && typeof row.tw === 'string' ? row.tw.trim() : null
}

function translateName(enMap, twItems, enName) {
  if (!enName || typeof enName !== 'string') return enName
  const key = enName.trim()
  if (!key) return enName
  if (key === '--') return '--'

  const lookupKey = EN_ALIASES[key] ?? key

  let id = enMap.get(lookupKey)
  if (id != null) {
    const tw = twForId(twItems, id)
    if (tw) return tw
  }

  id = enMap.get(`${lookupKey} Seeds`)
  if (id != null) {
    const tw = twForId(twItems, id)
    if (tw) return tw
  }

  const manual = MANUAL_TW[key]
  if (manual) return manual

  return enName
}

function transformSeed(enMap, twItems, seed) {
  const out = { ...seed }
  out.name = translateName(enMap, twItems, seed.name)

  if (Array.isArray(seed.usedInOtherCrosses)) {
    out.usedInOtherCrosses = seed.usedInOtherCrosses.map((u) => ({
      ...u,
      name: translateName(enMap, twItems, u.name),
    }))
  }

  if (Array.isArray(seed.confirmedCrosses)) {
    out.confirmedCrosses = seed.confirmedCrosses.map((c) => ({
      ...c,
      parentA: c.parentA
        ? {
            ...c.parentA,
            name: translateName(enMap, twItems, c.parentA.name),
          }
        : c.parentA,
      parentB: c.parentB
        ? {
            ...c.parentB,
            name: translateName(enMap, twItems, c.parentB.name),
          }
        : c.parentB,
      alternate: c.alternate
        ? {
            ...c.alternate,
            name:
              c.alternate.name != null
                ? translateName(enMap, twItems, c.alternate.name)
                : c.alternate.name,
          }
        : c.alternate,
    }))
  }

  return out
}

async function main() {
  const [itemsRaw, twRaw, seedsRaw] = await Promise.all([
    readFile(ITEMS_JSON, 'utf8'),
    readFile(TW_ITEMS_JSON, 'utf8'),
    readFile(OUT_SEEDS, 'utf8'),
  ])

  const items = JSON.parse(itemsRaw)
  const twItems = JSON.parse(twRaw)
  const data = JSON.parse(seedsRaw)

  const enMap = buildEnToIdMap(items)

  const seeds = data.seeds.map((s) => transformSeed(enMap, twItems, s))
  const meta = {
    ...data.meta,
    nameLocale: 'zh-Hant',
    nameSource:
      'ffxiv-teamcraft libs/data/src/lib/json/tw/tw-items.json (via items.json en→id)',
    namesTranslatedAt: new Date().toISOString(),
  }

  const seedsById = Object.fromEntries(
    seeds.map((s) => [String(s.seedId), s]),
  )

  await writeFile(
    OUT_SEEDS,
    JSON.stringify({ meta, seeds }, null, 2),
    'utf8',
  )
  await writeFile(
    OUT_BY_ID,
    JSON.stringify({ meta, seedsById }, null, 2),
    'utf8',
  )

  /** Still looks English after translate (no TW match). Ignores `--` and CJK-only strings. */
  function stillEnglish(s) {
    if (!s || typeof s !== 'string') return false
    const t = s.trim()
    if (!t || t === '--') return false
    return /[A-Za-z]/.test(t)
  }

  const orig = JSON.parse(seedsRaw)
  const untranslated = new Set()
  const note = (name) => {
    const out = translateName(enMap, twItems, name)
    if (stillEnglish(out)) untranslated.add(out)
  }

  for (const s of orig.seeds) {
    note(s.name)
    for (const u of s.usedInOtherCrosses ?? []) note(u.name)
    for (const c of s.confirmedCrosses ?? []) {
      note(c.parentA?.name)
      note(c.parentB?.name)
      note(c.alternate?.name)
    }
  }

  const uniq = [...untranslated].sort()
  console.log(`Wrote ${OUT_SEEDS} and ${OUT_BY_ID}`)
  if (uniq.length) {
    console.warn(`Untranslated (${uniq.length} unique names still in English):`)
    for (const x of uniq.slice(0, 30)) console.warn(`  - ${x}`)
    if (uniq.length > 30) console.warn(`  ... and ${uniq.length - 30} more`)
  } else {
    console.log('All crop/seed names resolved to Traditional Chinese (or non-English).')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
