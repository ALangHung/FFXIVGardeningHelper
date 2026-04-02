import { useEffect, useState } from 'react'
import type { SeedSummary } from './seedSummaryTypes'

const STORAGE_KEY = 'ffxivgh.seedFavorites.v1'

const SEED_FAVORITES_CHANGED_EVENT = 'ffxivgh-seed-favorites-changed'

function parseStoredIds(raw: string | null): number[] {
  if (raw == null || raw === '') return []
  try {
    const p = JSON.parse(raw) as unknown
    if (!Array.isArray(p)) return []
    return p.filter(
      (x): x is number =>
        typeof x === 'number' && Number.isFinite(x) && x >= 1,
    )
  } catch {
    return []
  }
}

export function loadFavoriteSeedIds(): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(parseStoredIds(localStorage.getItem(STORAGE_KEY)))
  } catch {
    return new Set()
  }
}

function persistFavoriteIds(ids: number[]): void {
  if (typeof window === 'undefined') return
  const uniq = [...new Set(ids)].sort((a, b) => a - b)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uniq))
}

/** 最愛優先，其餘依名稱（與既有列表／搜尋排序一致） */
export function sortSeedsFavoritesFirstThenName(
  seeds: SeedSummary[],
  favoriteIds: ReadonlySet<number>,
): SeedSummary[] {
  return [...seeds].sort((a, b) => {
    const fa = favoriteIds.has(a.seedId) ? 1 : 0
    const fb = favoriteIds.has(b.seedId) ? 1 : 0
    if (fa !== fb) return fb - fa
    return a.name.localeCompare(b.name, 'zh-Hant')
  })
}

export function toggleSeedFavorite(seedId: number): void {
  if (typeof window === 'undefined') return
  if (!Number.isFinite(seedId) || seedId < 1) return
  const id = Math.floor(seedId)
  const set = loadFavoriteSeedIds()
  if (set.has(id)) set.delete(id)
  else set.add(id)
  persistFavoriteIds([...set])
  window.dispatchEvent(new Event(SEED_FAVORITES_CHANGED_EVENT))
}

export function useSeedFavoriteIds(): Set<number> {
  const [ids, setIds] = useState(() => loadFavoriteSeedIds())

  useEffect(() => {
    function sync() {
      setIds(loadFavoriteSeedIds())
    }
    window.addEventListener(SEED_FAVORITES_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SEED_FAVORITES_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return ids
}
