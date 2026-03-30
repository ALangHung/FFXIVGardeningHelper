/**
 * 盆栽專用種子 → Teamcraft 各色收成道具（八色／混色）四語系名稱。
 * 種子名自 public/data/i18n/seeds-i18n.json；混色英文基準見下方 TEAMCRAFT_MIXED_EN。
 * 自 Teamcraft items + tw + zh 建置，寫入 public/data/flowerpot-crops-by-color.json。
 *
 * 說明：未染色時收成等同紅色，請使用 `red` 欄位，不另設 undyed。
 * 櫻花樹幼苗：混色對應粉色櫻花（Pink Cherry Blossoms），非 Rainbow。
 * 菊花種子：八色為 Red Chrysanthemums … Black Chrysanthemums，混色為 Rainbow Chrysanthemum Bouquet。
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildEnToIdMap,
  buildLocaleBundle,
  idForEn,
} from './lib/teamcraft-seed-resolve.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC_DATA = join(ROOT, 'public', 'data')
const I18N_JSON = join(PUBLIC_DATA, 'i18n', 'seeds-i18n.json')
const OUT_JSON = join(PUBLIC_DATA, 'flowerpot-crops-by-color.json')

/** 與 Teamcraft items.en 一致（81=粉櫻、101=混色花束） */
const TEAMCRAFT_MIXED_EN = {
  72: 'Rainbow Oldroses',
  79: 'Rainbow Violas',
  81: 'Pink Cherry Blossoms',
  82: 'Rainbow Daisies',
  83: 'Rainbow Brightlilies',
  86: 'Rainbow Tulips',
  87: 'Rainbow Dahlias',
  88: 'Rainbow Arums',
  89: 'Rainbow Lilies of the Valley',
  90: 'Rainbow Hydrangeas',
  91: 'Rainbow Campanulas',
  92: 'Rainbow Hyacinths',
  94: 'Rainbow Cosmos',
  95: 'Rainbow Carnations',
  96: 'Rainbow Moth Orchids',
  97: 'Rainbow Triteleia',
  98: 'Rainbow Byregotia',
  99: 'Rainbow Sweet Peas',
  100: 'Rainbow Morning Glories',
  101: 'Rainbow Chrysanthemum Bouquet',
  102: 'Rainbow Lupins',
  103: 'Rainbow Sunflowers',
  104: 'Rainbow Cattleyas',
  105: 'Rainbow Paperflowers',
  106: 'Rainbow Champa',
  107: 'Rainbow Tea Flowers',
}

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

/** @returns {Record<string, string>} colorKey -> English item name */
function englishNamesForSeed(seedId, mixedCropEn) {
  const id = Number(seedId)

  /** 八色前綴對應 stem（Red X, Blue X, …） */
  const eight = (stem) => ({
    red: `Red ${stem}`,
    blue: `Blue ${stem}`,
    yellow: `Yellow ${stem}`,
    green: `Green ${stem}`,
    orange: `Orange ${stem}`,
    purple: `Purple ${stem}`,
    white: `White ${stem}`,
    black: `Black ${stem}`,
  })

  if (id === 81) {
    const stem = 'Cherry Blossoms'
    return {
      ...eight(stem),
      mixed: 'Pink Cherry Blossoms',
    }
  }

  if (id === 101) {
    return {
      ...eight('Chrysanthemums'),
      mixed: 'Rainbow Chrysanthemum Bouquet',
    }
  }

  if (!mixedCropEn || !String(mixedCropEn).startsWith('Rainbow ')) {
    throw new Error(
      `seedId ${seedId}: expected teamcraftMixedCropEn to start with "Rainbow " (except 81/101), got ${mixedCropEn}`,
    )
  }
  const stem = String(mixedCropEn).slice('Rainbow '.length)
  return {
    ...eight(stem),
    mixed: mixedCropEn.trim(),
  }
}

function cropEntry(enMap, items, twItems, zhItems, en) {
  if (en == null) return null
  const tid = idForEn(enMap, en)
  if (tid == null) {
    throw new Error(`Teamcraft items.json 找不到 en="${en}"`)
  }
  return {
    teamcraftItemId: String(tid),
    names: buildLocaleBundle(items, twItems, zhItems, tid),
  }
}

async function main() {
  const i18nData = JSON.parse(await readFile(I18N_JSON, 'utf8'))
  const { items, twItems, zhItems, source } = await loadTeamcraftBundle()
  const enMap = buildEnToIdMap(items)

  const bySeedId = {}
  const keys = Object.keys(TEAMCRAFT_MIXED_EN)
    .map(Number)
    .sort((a, b) => a - b)
    .map(String)

  for (const sid of keys) {
    const mixedEn = TEAMCRAFT_MIXED_EN[Number(sid)]
    const row = i18nData.bySeedId?.[sid]
    if (!row?.seedItem) {
      throw new Error(`seeds-i18n.json 缺少 seedId ${sid} 的 seedItem`)
    }
    const enByColor = englishNamesForSeed(sid, mixedEn)

    const cropsByColor = {}
    for (const [colorKey, en] of Object.entries(enByColor)) {
      cropsByColor[colorKey] = cropEntry(enMap, items, twItems, zhItems, en)
    }

    bySeedId[sid] = {
      seedId: Number(sid),
      seedItem: row.seedItem,
      cropsByColor,
    }
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    teamcraftSource: source,
    seedItemSource: 'public/data/i18n/seeds-i18n.json',
    defaultLocale: 'zh-Hant',
    locales: ['zh-Hant', 'en', 'ja', 'zh-Hans'],
    colorKeys: [
      'red',
      'blue',
      'yellow',
      'green',
      'orange',
      'purple',
      'white',
      'black',
      'mixed',
    ],
    note:
      '未染色時收成與紅色相同，請使用 red。',
    fields: {
      red: '紅色染料收成（未染色時亦為此）',
      blue: '藍色染料收成',
      yellow: '黃色染料收成',
      green: '綠色染料收成',
      orange: '橙色染料收成',
      purple: '紫色染料收成',
      white: '白色染料收成',
      black: '黑色染料收成',
      mixed:
        '混色（三色油粕齊：多數為 Rainbow…；櫻花為 Pink Cherry Blossoms；菊花為 Rainbow Chrysanthemum Bouquet）',
      names: '各語系顯示名（tw / items.en / items.ja / zh）',
      teamcraftItemId: 'Teamcraft 道具 id',
    },
  }

  await mkdir(dirname(OUT_JSON), { recursive: true })
  await writeFile(
    OUT_JSON,
    JSON.stringify({ meta, bySeedId }, null, 2),
    'utf8',
  )
  console.log(`Wrote ${OUT_JSON} (${keys.length} planter-only seeds)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
