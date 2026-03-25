import type { SeedRecord, SeedsByIdPayload } from './seedDetailTypes'
import { publicUrl } from './publicUrl'

let cache: Record<string, SeedRecord> | null = null
let loading: Promise<Record<string, SeedRecord>> | null = null

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

export async function getSeedById(seedId: number): Promise<SeedRecord | null> {
  const map = await loadSeedsById()
  return map[String(seedId)] ?? null
}

export function clearSeedsByIdCache() {
  cache = null
  loading = null
}
