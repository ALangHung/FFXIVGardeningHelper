import type { SeedSummary } from './seedSummaryTypes'
import { sortSeedsFavoritesFirstThenName } from './seedFavorites'

export function normalizeSeedQuery(s: string) {
  return s.trim().toLowerCase()
}

/** 空字串時列出全部種子（最愛優先、名稱排序）；有輸入時列出所有符合的種子。 */
export function filterSeeds(
  seeds: SeedSummary[],
  q: string,
  favoriteIds: ReadonlySet<number>,
): SeedSummary[] {
  const sorted = sortSeedsFavoritesFirstThenName(seeds, favoriteIds)
  const nq = normalizeSeedQuery(q)
  if (!nq) return sorted
  return sorted.filter((s) =>
    normalizeSeedQuery(s.nameSearchText ?? s.name).includes(nq),
  )
}

/** 依目前輸入解析單一種子：篩選結果僅一筆，或顯示名稱與輸入（不分大小寫、去首尾空白）完全一致。 */
export function resolveSeedFromQuery(
  seeds: SeedSummary[],
  query: string,
  favoriteIds: ReadonlySet<number>,
): SeedSummary | null {
  const nq = normalizeSeedQuery(query)
  if (!nq) return null
  const matches = filterSeeds(seeds, query, favoriteIds)
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]
  const exact = matches.find((s) => normalizeSeedQuery(s.name) === nq)
  return exact ?? null
}
