import type {
  ConfirmedCross,
  CrossAlternate,
  CrossParent,
  SeedRecord,
  SeedRecordCore,
  SeedsByIdPayloadCore,
  UsedInCross,
} from './seedDetailTypes'
import type { SeedsI18nPayload } from './seedI18nTypes'
import {
  cropDisplayName,
  cropOrSeedDisplayName,
  mergeSeedSummaryRow,
  seedItemDisplayName,
} from './seedI18nMerge'
import type { SeedSummary, SeedsSummaryPayloadJson } from './seedSummaryTypes'
import { publicUrl } from './publicUrl'

export const UNIVERSALIS_TW_DC = '陸行鳥'
const UNIVERSALIS_BATCH_SIZE = 50

let cache: Record<string, SeedRecord> | null = null
let loading: Promise<Record<string, SeedRecord>> | null = null

let i18nCache: SeedsI18nPayload | null = null
let loadingI18n: Promise<SeedsI18nPayload> | null = null

let nameSearchById: Record<string, string> | null = null
let loadingNameSearch: Promise<Record<string, string>> | null = null

function fallbackSeedName(seedId: number): string {
  return `種子 #${seedId}`
}

function nameForSeedId(
  byI18n: Record<string, import('./seedI18nTypes').SeedI18nEntry>,
  seedId: number | null,
): string | null {
  if (seedId == null || !Number.isFinite(seedId)) return null
  const label = cropOrSeedDisplayName(byI18n[String(seedId)])
  return label || fallbackSeedName(seedId)
}

/** 與 `mergeSeedSummaryRow`／詳情頁種子副標相同：種子包名 > 作物名 > 顯示名 */
function seedItemNameForSeedId(
  byI18n: Record<string, import('./seedI18nTypes').SeedI18nEntry>,
  seedId: number | null,
): string | null {
  if (seedId == null || !Number.isFinite(seedId)) return null
  const e = byI18n[String(seedId)]
  const cropName = cropDisplayName(e)
  const seedName = seedItemDisplayName(e)
  const displayName = cropOrSeedDisplayName(e) || fallbackSeedName(seedId)
  return seedName || cropName || displayName
}

function enrichCrossParent(
  p: CrossParent,
  byI18n: Record<string, import('./seedI18nTypes').SeedI18nEntry>,
): CrossParent {
  return {
    ...p,
    name: nameForSeedId(byI18n, p.seedId),
    seedItemName: seedItemNameForSeedId(byI18n, p.seedId),
  }
}

function enrichAlternate(
  a: CrossAlternate,
  byI18n: Record<string, import('./seedI18nTypes').SeedI18nEntry>,
): CrossAlternate {
  return {
    ...a,
    name: nameForSeedId(byI18n, a.seedId),
    seedItemName: seedItemNameForSeedId(byI18n, a.seedId),
  }
}

function enrichConfirmedCross(
  c: ConfirmedCross,
  byI18n: Record<string, import('./seedI18nTypes').SeedI18nEntry>,
): ConfirmedCross {
  return {
    ...c,
    parentA: enrichCrossParent(c.parentA, byI18n),
    parentB: enrichCrossParent(c.parentB, byI18n),
    alternate: enrichAlternate(c.alternate, byI18n),
  }
}

function enrichUsed(u: UsedInCross, byI18n: Record<string, import('./seedI18nTypes').SeedI18nEntry>): UsedInCross {
  const nm = nameForSeedId(byI18n, u.seedId)
  return {
    ...u,
    name: nm ?? fallbackSeedName(u.seedId),
  }
}

export function enrichSeedRecordCore(
  core: SeedRecordCore,
  byI18n: Record<string, import('./seedI18nTypes').SeedI18nEntry>,
): SeedRecord {
  const e = byI18n[String(core.seedId)]
  const name = cropOrSeedDisplayName(e) || fallbackSeedName(core.seedId)
  const seedItemName = seedItemDisplayName(e) || name
  return {
    ...core,
    name,
    seedItemName,
    usedInOtherCrosses: core.usedInOtherCrosses.map((u) => enrichUsed(u, byI18n)),
    confirmedCrosses: core.confirmedCrosses.map((c) => enrichConfirmedCross(c, byI18n)),
  }
}

function enrichSeedsByIdMap(
  raw: Record<string, SeedRecordCore>,
  byI18n: Record<string, import('./seedI18nTypes').SeedI18nEntry>,
): Record<string, SeedRecord> {
  const out: Record<string, SeedRecord> = {}
  for (const [k, s] of Object.entries(raw)) {
    out[k] = enrichSeedRecordCore(s, byI18n)
  }
  return out
}

/** 摘要 JSON + i18n 合併後供列表／雜交／田地選種使用 */
export async function loadSeedsSummaryMerged(): Promise<SeedSummary[]> {
  const [sumRes, i18nPayload] = await Promise.all([
    fetch(publicUrl('data/seeds-summary.json')),
    loadSeedsI18n(),
  ])
  if (!sumRes.ok) throw new Error(`無法載入種子摘要 (${sumRes.status})`)
  const data = (await sumRes.json()) as SeedsSummaryPayloadJson
  const byI18n = i18nPayload.bySeedId ?? {}
  return (data.seeds ?? []).map((row) => mergeSeedSummaryRow(row, byI18n))
}

function chunkNumbers(input: number[], size: number): number[][] {
  const out: number[][] = []
  for (let i = 0; i < input.length; i += size) {
    out.push(input.slice(i, i + size))
  }
  return out
}

type UniversalisItemPayload = {
  minPrice?: number
}

type UniversalisBatchPayload = {
  items?: Record<string, UniversalisItemPayload>
}

/**
 * 取得指定大區（預設 Elemental）各道具當前最低售價（minPrice）。
 */
export async function loadUniversalisMinPricesByItemId(
  itemIds: number[],
  dcName: string = UNIVERSALIS_TW_DC,
): Promise<Record<number, number | null>> {
  const uniq = [...new Set(itemIds.filter((x) => Number.isFinite(x) && x > 0))]
  if (uniq.length === 0) return {}

  const chunks = chunkNumbers(uniq, UNIVERSALIS_BATCH_SIZE)
  const out: Record<number, number | null> = {}

  await Promise.all(
    chunks.map(async (ids) => {
      const joined = ids.join(',')
      const url = `https://universalis.app/api/v2/${encodeURIComponent(dcName)}/${joined}?listings=0&entries=0`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`無法載入市場價格 (${res.status})`)
      }
      const payload = (await res.json()) as UniversalisBatchPayload
      const items = payload?.items ?? {}
      for (const id of ids) {
        const minPrice = items[String(id)]?.minPrice
        out[id] = typeof minPrice === 'number' && Number.isFinite(minPrice) ? minPrice : null
      }
    }),
  )

  for (const id of uniq) {
    if (!(id in out)) out[id] = null
  }
  return out
}

export async function loadSeedsI18n(): Promise<SeedsI18nPayload> {
  if (i18nCache) return i18nCache
  if (!loadingI18n) {
    loadingI18n = (async () => {
      const res = await fetch(publicUrl('data/i18n/seeds-i18n.json'))
      if (!res.ok) throw new Error(`無法載入種子多語資料 (${res.status})`)
      const data = (await res.json()) as SeedsI18nPayload
      i18nCache = data
      return data
    })()
  }
  return loadingI18n
}

export async function loadSeedsById(): Promise<Record<string, SeedRecord>> {
  if (cache) return cache
  if (!loading) {
    loading = (async () => {
      const [res, i18nPayload] = await Promise.all([
        fetch(publicUrl('data/seeds-by-id.json')),
        loadSeedsI18n(),
      ])
      if (!res.ok) throw new Error(`無法載入種子資料 (${res.status})`)
      const data = (await res.json()) as SeedsByIdPayloadCore
      const raw = data.seedsById ?? {}
      const byI18n = i18nPayload.bySeedId ?? {}
      const map = enrichSeedsByIdMap(raw, byI18n)
      cache = map
      return map
    })()
  }
  return loading
}

/**
 * seedId → nameSearchText（種子道具 + 作物，四語系合併去重）。
 */
export async function loadSeedNameSearchById(): Promise<Record<string, string>> {
  if (nameSearchById) return nameSearchById
  if (!loadingNameSearch) {
    loadingNameSearch = (async () => {
      const i18n = await loadSeedsI18n()
      const map: Record<string, string> = {}
      for (const [id, entry] of Object.entries(i18n.bySeedId ?? {})) {
        const t = entry?.nameSearchText?.trim()
        map[id] =
          t ||
          `${cropDisplayName(entry)} ${seedItemDisplayName(entry)}`.trim() ||
          `種子 #${id}`
      }
      nameSearchById = map
      return map
    })()
  }
  return loadingNameSearch
}

export async function getSeedById(seedId: number): Promise<SeedRecord | null> {
  const map = await loadSeedsById()
  return map[String(seedId)] ?? null
}

export function clearSeedsByIdCache() {
  cache = null
  loading = null
  i18nCache = null
  loadingI18n = null
  nameSearchById = null
  loadingNameSearch = null
}
