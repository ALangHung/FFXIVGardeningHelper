/**
 * Builds data/i18n/seeds-i18n.json（種子道具 seedItem + 作物 crop + nameSearchText），
 * 並重寫 public/data/seeds-by-id.json（無內嵌名稱）。
 *
 * 流程：① ffxivgardening（英文標題：擷取頁 seed.name 或 seeds-gardening-en.json）
 *      ② Teamcraft items + tw + zh → 對應道具各語系名稱
 *
 * Requires Teamcraft JSON (local or GitHub staging).
 * Env: TEAMCRAFT_JSON — optional override for libs/data/src/lib/json directory.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildEnToIdMap,
  buildLocaleBundle,
  buildNameSearchText,
  expectsSeparateHarvestItem,
  idForEn,
  resolveCropEn,
  resolveSeedPacketEn,
} from './lib/teamcraft-seed-resolve.mjs'
import { seedsSortedById } from './lib/seeds-by-id-utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC_DATA = join(ROOT, 'public', 'data')
const BY_ID_JSON = join(PUBLIC_DATA, 'seeds-by-id.json')
const GARDENING_EN_JSON = join(PUBLIC_DATA, 'seeds-gardening-en.json')
const I18N_OUT = join(PUBLIC_DATA, 'i18n', 'seeds-i18n.json')

const DEFAULT_TEAMCRAFT_JSON = join(
  ROOT,
  '..',
  'ffxiv-teamcraft',
  'libs',
  'data',
  'src',
  'lib',
  'json',
)

const TEAMCRAFT_RAW_BASE =
  'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/staging/libs/data/src/lib/json'

function teamcraftJsonDir() {
  const fromEnv = process.env.TEAMCRAFT_JSON
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  if (existsSync(DEFAULT_TEAMCRAFT_JSON)) return DEFAULT_TEAMCRAFT_JSON
  return null
}

async function loadJsonFromDisk(dir, name) {
  const p = join(dir, name)
  return JSON.parse(await readFile(p, 'utf8'))
}

async function loadTeamcraftBundle() {
  const dir = teamcraftJsonDir()
  if (dir) {
    const items = await loadJsonFromDisk(dir, 'items.json')
    const twItems = await loadJsonFromDisk(dir, join('tw', 'tw-items.json'))
    const zhItems = await loadJsonFromDisk(dir, join('zh', 'zh-items.json'))
    return { items, twItems, zhItems, source: dir }
  }
  console.warn(
    `No local Teamcraft JSON; fetching staging from GitHub (${TEAMCRAFT_RAW_BASE})`,
  )
  const [items, twItems, zhItems] = await Promise.all([
    fetch(`${TEAMCRAFT_RAW_BASE}/items.json`).then((r) => r.json()),
    fetch(`${TEAMCRAFT_RAW_BASE}/tw/tw-items.json`).then((r) => r.json()),
    fetch(`${TEAMCRAFT_RAW_BASE}/zh/zh-items.json`).then((r) => r.json()),
  ])
  return { items, twItems, zhItems, source: TEAMCRAFT_RAW_BASE }
}

function isPlanterOnlyHarvestLocation(harvestLocation) {
  if (typeof harvestLocation !== 'string') return false
  return harvestLocation.includes('僅限盆栽')
}

function stripSeed(seed) {
  const o = { ...seed }
  delete o.name
  o.isPlanterOnly = isPlanterOnlyHarvestLocation(o.harvestLocation)
  if (Array.isArray(o.usedInOtherCrosses)) {
    o.usedInOtherCrosses = o.usedInOtherCrosses.map((u) => {
      const x = { seedId: u.seedId }
      if (u.iconPath != null) x.iconPath = u.iconPath
      return x
    })
  }
  if (Array.isArray(o.confirmedCrosses)) {
    o.confirmedCrosses = o.confirmedCrosses.map((c) => ({
      isLoop: c.isLoop,
      parentA: {
        seedId: c.parentA?.seedId ?? null,
        growDays: c.parentA?.growDays ?? null,
      },
      parentB: {
        seedId: c.parentB?.seedId ?? null,
        growDays: c.parentB?.growDays ?? null,
      },
      alternate: {
        seedId: c.alternate?.seedId ?? null,
      },
      efficiency: c.efficiency,
      efficiencyRating: c.efficiencyRating,
    }))
  }
  return o
}

/**
 * 種子包（可種植道具）與收成物各一組多語。
 * 若 Teamcraft 上種子與收成為同一道具 id，crop 與 seedItem 共用該 id（合法）。
 * 若無法解析收成英文（cropEn）導致只能把種子包當 crop，則拋錯請維護者補別名。
 * 若 seeds-by-id 為僅限盆栽（harvestLocation 含「僅限盆栽」），不解析收成，crop 為 null。
 */
function buildI18nEntry(
  enMap,
  items,
  twItems,
  zhItems,
  gardeningEn,
  seedId,
  isPlanterOnly,
) {
  if (isPlanterOnly) {
    const seedPacketEn = resolveSeedPacketEn(enMap, gardeningEn)
    const seedPacketId = idForEn(enMap, seedPacketEn)
    if (seedPacketId == null) {
      throw new Error(
        `Cannot resolve Teamcraft seed packet for gardening title: ${gardeningEn} (seedId ${seedId}, planter-only)`,
      )
    }
    const seedItem = buildLocaleBundle(items, twItems, zhItems, seedPacketId)
    const searchParts = []
    for (const loc of ['zh-Hant', 'en', 'ja', 'zh-Hans']) {
      searchParts.push(seedItem[loc])
    }
    return {
      seedItem,
      crop: null,
      nameSearchText: buildNameSearchText(searchParts),
    }
  }

  const seedPacketEn = resolveSeedPacketEn(enMap, gardeningEn)
  const cropEn = resolveCropEn(enMap, gardeningEn)
  const seedPacketId = idForEn(enMap, seedPacketEn)
  let cropId = idForEn(enMap, cropEn)

  const cropSameItemAsSeedPacket =
    seedPacketId != null &&
    cropId != null &&
    String(seedPacketId) === String(cropId)

  if (cropSameItemAsSeedPacket) {
    cropId = null
  }

  const seedItemId = seedPacketId ?? cropId
  if (seedItemId == null) {
    throw new Error(
      `Cannot resolve Teamcraft item id for gardening title: ${gardeningEn}`,
    )
  }

  const wouldReuseSeedPacketAsCrop =
    cropId == null && seedPacketId != null && !cropSameItemAsSeedPacket

  if (
    wouldReuseSeedPacketAsCrop &&
    expectsSeparateHarvestItem(enMap, seedPacketEn, seedPacketId)
  ) {
    throw new Error(
      [
        `[build:seeds-i18n] seedId=${seedId}：無法解析收成物（crop）對應的 Teamcraft 道具，若繼續會誤把種子包當作物。`,
        `  ffxivgardening 英文標題: "${gardeningEn}"`,
        `  resolveCropEn: ${cropEn == null ? 'null（items.json 無此 en，或缺少 CROP_EN_ALIASES / EN_ALIASES / 複數規則）' : `"${cropEn}"`}`,
        `  resolveSeedPacketEn: ${seedPacketEn == null ? 'null' : `"${seedPacketEn}"`} → id ${seedPacketId}`,
        `請修正其一：`,
        `  1) 在 scripts/lib/teamcraft-seed-resolve.mjs 的 CROP_EN_ALIASES（僅收成）或 EN_ALIASES 補「園藝英文標題 → Teamcraft 收成物 en」；`,
        `  2) 或更新 public/data/seeds-gardening-en.json 的英文標題使其能對到 items.json；`,
        `  3) 確認本機／staging Teamcraft JSON 版本是否過舊。`,
      ].join('\n'),
    )
  }

  const seedItem = buildLocaleBundle(items, twItems, zhItems, seedItemId)
  const crop = cropId
    ? buildLocaleBundle(items, twItems, zhItems, cropId)
    : buildLocaleBundle(items, twItems, zhItems, seedPacketId)

  const searchParts = []
  for (const loc of ['zh-Hant', 'en', 'ja', 'zh-Hans']) {
    searchParts.push(seedItem[loc], crop[loc])
  }

  return {
    seedItem,
    crop,
    nameSearchText: buildNameSearchText(searchParts),
  }
}

async function main() {
  const seedsRaw = await readFile(BY_ID_JSON, 'utf8')
  const data = JSON.parse(seedsRaw)
  let byGardeningId = {}
  try {
    await access(GARDENING_EN_JSON, constants.R_OK)
    const gardening = JSON.parse(await readFile(GARDENING_EN_JSON, 'utf8'))
    byGardeningId = gardening.bySeedId ?? gardening
  } catch {
    console.warn(
      `Optional ${GARDENING_EN_JSON} not read; using each seed's "name" as ffxivgardening English title (e.g. right after scrape).`,
    )
  }

  const { items, twItems, zhItems, source } = await loadTeamcraftBundle()
  const enMap = buildEnToIdMap(items)

  const bySeedId = {}
  for (const s of seedsSortedById(data.seedsById)) {
    const id = s.seedId
    const fromFile = byGardeningId[String(id)]
    const gardeningEn =
      typeof fromFile === 'string' && fromFile.trim()
        ? fromFile.trim()
        : typeof s.name === 'string' && s.name.trim()
          ? s.name.trim()
          : ''
    if (!gardeningEn) {
      throw new Error(
        `Missing English gardening title for seedId ${id}: add public/data/seeds-gardening-en.json or ensure seed.name is set (scrape).`,
      )
    }
    bySeedId[String(id)] = buildI18nEntry(
      enMap,
      items,
      twItems,
      zhItems,
      gardeningEn,
      id,
      isPlanterOnlyHarvestLocation(s.harvestLocation),
    )
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    teamcraftSource: source,
    gardeningEnSource: GARDENING_EN_JSON,
    defaultLocale: 'zh-Hant',
    locales: ['zh-Hant', 'en', 'ja', 'zh-Hans'],
    fields: {
      seedItem: '種子道具（可種植之物品）各語系顯示名',
      crop: '作物／收成道具各語系顯示名；與種子包為同一 Teamcraft id 時與 seedItem 相同。seeds-by-id.harvestLocation 含「僅限盆栽」時視為僅盆栽，crop 為 null（僅 seedItem）。若應有獨立收成卻無法 resolveCropEn，建置會拋錯（見 expectsSeparateHarvestItem）。',
      nameSearchText: '列表／詳情搜尋：seedItem 與（若有）crop 四語系合併（去重）',
    },
  }

  await mkdir(dirname(I18N_OUT), { recursive: true })
  await writeFile(
    I18N_OUT,
    JSON.stringify({ meta, bySeedId }, null, 2),
    'utf8',
  )

  const stripped = seedsSortedById(data.seedsById).map((s) => stripSeed(s))
  const {
    nameLocale: _nl,
    nameSource: _ns,
    namesTranslatedAt: _nt,
    ...metaRest
  } = data.meta ?? {}
  const metaSeeds = {
    ...metaRest,
    i18n: {
      path: 'public/data/i18n/seeds-i18n.json',
      publicPath: '/data/i18n/seeds-i18n.json',
      generatedAt: meta.generatedAt,
    },
  }

  const seedsById = Object.fromEntries(
    stripped.map((s) => [String(s.seedId), s]),
  )
  await writeFile(
    BY_ID_JSON,
    JSON.stringify({ meta: metaSeeds, seedsById }, null, 2),
    'utf8',
  )

  console.log(`Wrote ${I18N_OUT}`)
  console.log(`Updated ${BY_ID_JSON} (names stripped)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
