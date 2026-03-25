import type { SeedRecord, SeedsByIdPayload } from './seedDetailTypes'
import type { SeedsSummaryPayload } from './seedSummaryTypes'
import { publicUrl } from './publicUrl'

let cache: Record<string, SeedRecord> | null = null
let loading: Promise<Record<string, SeedRecord>> | null = null

let nameSearchById: Record<string, string> | null = null
let loadingNameSearch: Promise<Record<string, string>> | null = null

export async function loadSeedsById(): Promise<Record<string, SeedRecord>> {
  if (cache) return cache
  if (!loading) {
    loading = (async () => {
      const res = await fetch(publicUrl('data/seeds-by-id.json'))
      if (!res.ok) throw new Error(`無法載入種子資料 (${res.status})`)
      const data = (await res.json()) as SeedsByIdPayload
      const map = data.seedsById ?? {}
      cache = map
      return map
    })()
  }
  return loading
}

/**
 * seedId → nameSearchText（與種子列表相同：繁中顯示名 + Teamcraft 英／日／簡中等）。
 * 用於詳情頁雜交表等需多語名稱比對的篩選。
 */
export async function loadSeedNameSearchById(): Promise<Record<string, string>> {
  if (nameSearchById) return nameSearchById
  if (!loadingNameSearch) {
    loadingNameSearch = (async () => {
      const res = await fetch(publicUrl('data/seeds-summary.json'))
      if (!res.ok) throw new Error(`無法載入種子摘要 (${res.status})`)
      const data = (await res.json()) as SeedsSummaryPayload
      const map: Record<string, string> = {}
      for (const s of data.seeds ?? []) {
        map[String(s.seedId)] = s.nameSearchText ?? s.name
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
  nameSearchById = null
  loadingNameSearch = null
}
