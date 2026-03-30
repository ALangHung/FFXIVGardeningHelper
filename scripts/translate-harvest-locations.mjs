/**
 * 將 public/data/seeds-by-id.json 的 harvestLocation 譯為繁體，
 * 地名依 ffxiv-teamcraft places.json + tw/tw-places.json；其餘用 MANUAL。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripSlotPrefixFromHarvestLocation } from './lib/seeds-by-id-utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TC = join(
  'c:',
  'ReferenceProject',
  'ffxiv-teamcraft',
  'libs',
  'data',
  'src',
  'lib',
  'json',
)
const PLACES_JSON = join(TC, 'places.json')
const TW_PLACES_JSON = join(TC, 'tw', 'tw-places.json')
const BY_ID_JSON = join(ROOT, 'public', 'data', 'seeds-by-id.json')

/** 完整字串無法從地名替換得到時使用（繁體） */
const FULL_MANUAL = {
  'Crossbreed Only': '僅限雜交獲得',
  'Crossbreed Only / Airship Ventures (Rank 50)':
    '僅限雜交／飛空艇探索（50級）',
  'GC Seals / Resident Caretaker': '軍票／住宅區管理人',
  'Hunt Billmaster': '怪物狩獵公告員',
  'Material Supplier (Flowerpot Only)': '素材商人（僅限盆栽）',
  'Material Supplier (Housing District)': '素材商人（住宅區）',
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 園藝站英文與 Teamcraft `places.en` 不一致時的手動對應（須長於會誤傷的子字串，如 Dravania）。
 * tw 與 Teamcraft tw-places 一致。
 */
const EXTRA_PLACE_PAIRS = [
  { en: 'Dravanian Forelands', tw: '德拉瓦尼亞山麓地' },
  { en: 'Dravanian Hinterlands', tw: '德拉瓦尼亞河谷地' },
]

function buildPlacePairs(places, twPlaces) {
  const pairs = [...EXTRA_PLACE_PAIRS]
  for (const [id, o] of Object.entries(places)) {
    const en = typeof o?.en === 'string' ? o.en.trim() : ''
    if (!en) continue
    const tw = twPlaces[id]?.tw
    if (typeof tw !== 'string' || !tw.trim()) continue
    pairs.push({ en, tw: tw.trim() })
  }
  pairs.sort((a, b) => b.en.length - a.en.length)
  return pairs
}

function translateLocation(raw, pairs) {
  if (raw == null || typeof raw !== 'string') return raw
  raw = stripSlotPrefixFromHarvestLocation(raw)
  const t = raw.trim()
  if (!t) return raw

  if (Object.prototype.hasOwnProperty.call(FULL_MANUAL, t)) {
    return FULL_MANUAL[t]
  }

  let out = raw
  for (const { en, tw } of pairs) {
    if (en.length < 2) continue
    out = out.replace(new RegExp(escapeRegExp(en), 'g'), tw)
  }

  // 階級維持繁體（「Slot N @ 」已在 stripSlotPrefixFromHarvestLocation 移除）
  out = out.replace(/\bRank (\d+)\b/g, '階級 $1')

  return out
}

function applyToSeed(seed, pairs) {
  return {
    ...seed,
    harvestLocation:
      seed.harvestLocation != null
        ? translateLocation(seed.harvestLocation, pairs)
        : seed.harvestLocation,
  }
}

async function main() {
  const [placesRaw, twRaw, byIdRaw] = await Promise.all([
    readFile(PLACES_JSON, 'utf8'),
    readFile(TW_PLACES_JSON, 'utf8'),
    readFile(BY_ID_JSON, 'utf8'),
  ])

  const places = JSON.parse(placesRaw)
  const twPlaces = JSON.parse(twRaw)
  const pairs = buildPlacePairs(places, twPlaces)

  const data = JSON.parse(byIdRaw)
  const nextById = {}
  for (const [id, seed] of Object.entries(data.seedsById ?? {})) {
    nextById[id] = applyToSeed(seed, pairs)
  }
  data.seedsById = nextById
  data.meta = {
    ...data.meta,
    harvestLocationLocale: 'zh-Hant',
    harvestLocationSource:
      'ffxiv-teamcraft places.json + tw/tw-places.json (+ manual phrases)',
    harvestLocationTranslatedAt: new Date().toISOString(),
  }

  await writeFile(BY_ID_JSON, JSON.stringify(data, null, 2), 'utf8')

  console.log(`Updated ${BY_ID_JSON}`)
  console.log(`Place name pairs used: ${pairs.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
