/**
 * Writes public/data/seeds-summary.json for the web UI (slim payload).
 * When ffxiv-teamcraft JSON is available, adds nameSearchText (zh display + en/ja/zh-Hans) for multilingual name search.
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SEEDS_JSON = join(ROOT, 'data', 'seeds.json')
const OUT = join(ROOT, 'public', 'data', 'seeds-summary.json')
const SITE_BASE = 'https://www.ffxivgardening.com/'

/** 與 scripts/apply-tw-item-names.mjs 同層的 teamcraft 資料根目錄 */
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

function teamcraftJsonDir() {
  const fromEnv = process.env.TEAMCRAFT_JSON
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  if (existsSync(DEFAULT_TEAMCRAFT_JSON)) return DEFAULT_TEAMCRAFT_JSON
  return null
}

function buildTwToIdMap(twItems) {
  const map = new Map()
  for (const [id, o] of Object.entries(twItems)) {
    const tw = o?.tw
    if (typeof tw !== 'string' || !tw.trim()) continue
    const t = tw.trim()
    const prev = map.get(t)
    if (!prev || Number(id) < Number(prev)) map.set(t, id)
  }
  return map
}

function candidateTwNames(seedName) {
  const n = typeof seedName === 'string' ? seedName.trim() : ''
  if (!n) return []
  const out = new Set([n])
  if (!/(種子|球根|球莖|幼苗|芽塊|種)$/.test(n)) out.add(`${n}種子`)
  if (n.endsWith('種子') && n.length >= 3) out.add(n.slice(0, -2))
  return [...out]
}

function resolveItemIds(twToId, seedName) {
  const ids = new Set()
  for (const tw of candidateTwNames(seedName)) {
    const id = twToId.get(tw)
    if (id) ids.add(id)
  }
  return [...ids]
}

function buildNameSearchText(seedName, items, zhItems, itemIds) {
  const parts = new Set()
  const add = (s) => {
    if (typeof s === 'string' && s.trim()) parts.add(s.trim())
  }
  add(seedName)
  for (const id of itemIds) {
    const it = items[id]
    if (it) {
      add(it.en)
      add(it.ja)
    }
    const zh = zhItems[id]?.zh
    if (typeof zh === 'string') add(zh)
  }
  return [...parts].join(' ')
}

async function loadTeamcraftMaps(dir) {
  const itemsPath = join(dir, 'items.json')
  const twPath = join(dir, 'tw', 'tw-items.json')
  const zhPath = join(dir, 'zh', 'zh-items.json')
  if (!existsSync(itemsPath) || !existsSync(twPath) || !existsSync(zhPath)) {
    return null
  }
  const [itemsRaw, twRaw, zhRaw] = await Promise.all([
    readFile(itemsPath, 'utf8'),
    readFile(twPath, 'utf8'),
    readFile(zhPath, 'utf8'),
  ])
  const items = JSON.parse(itemsRaw)
  const twItems = JSON.parse(twRaw)
  const zhItems = JSON.parse(zhRaw)
  const twToId = buildTwToIdMap(twItems)
  return { items, zhItems, twToId }
}

async function main() {
  const { seeds, meta } = JSON.parse(await readFile(SEEDS_JSON, 'utf8'))

  const tcDir = teamcraftJsonDir()
  let tc = null
  if (tcDir) {
    try {
      tc = await loadTeamcraftMaps(tcDir)
    } catch (e) {
      console.warn('Teamcraft JSON load failed, name search will be zh-only:', e)
    }
  } else {
    console.warn(
      `No Teamcraft JSON at ${DEFAULT_TEAMCRAFT_JSON} (set TEAMCRAFT_JSON). Name search = display name only.`,
    )
  }

  const summary = seeds.map((s) => {
    const name = s.name ?? ''
    let nameSearchText = name
    if (tc) {
      const itemIds = resolveItemIds(tc.twToId, name)
      nameSearchText = buildNameSearchText(name, tc.items, tc.zhItems, itemIds)
    }

    return {
      seedId: s.seedId,
      name: s.name,
      nameSearchText,
      seedType: s.seedType ?? null,
      growTime: s.growTime ?? null,
      wiltTime: s.wiltTime ?? null,
      harvestLocation: s.harvestLocation ?? null,
      nodeLevel: s.nodeLevel != null ? String(s.nodeLevel) : null,
      /** 本機靜態圖（見 scripts/download-seed-icons.mjs） */
      iconUrl: `/images/seed-icon/${s.seedId}.png`,
      detailUrl: `${SITE_BASE}seed-details.php?SeedID=${s.seedId}`,
    }
  })

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    JSON.stringify(
      {
        meta: {
          ...meta,
          summaryGeneratedAt: new Date().toISOString(),
          nameSearchText:
            tc != null
              ? 'display name + Teamcraft en/ja/zh (zh-Hans) for same item id(s) resolved from tw name'
              : 'display name only (Teamcraft JSON not found)',
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
