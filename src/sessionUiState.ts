/**
 * 以 sessionStorage 保存列表／雜交計算器 UI，從種子詳情返回時可還原篩選與計算狀態。
 * （僅限同源、同一瀏覽器分頁工作階段。）
 */

const SEED_LIST_KEY = 'ffxivgh.seedList.v1'
const CROSS_CALC_KEY = 'ffxivgh.crossCalc.v1'

export type SeedListSortKey = 'name' | 'growTime' | 'harvestLocation'

export type SeedListUiState = {
  nameQuery: string
  growTime: string
  locationQuery: string
  sortKey: SeedListSortKey
  sortDir: 1 | -1
}

export type CrossCalcMode = 'computeOutcomes' | 'searchParents'
export type OutcomeSortKey = 'outcome' | 'loop' | 'efficiency'
export type OtherParentSortKey = 'other' | 'loop' | 'efficiency'

export type CrossCalcUiState = {
  mode: CrossCalcMode
  parentAId: number | null
  parentBId: number | null
  queryA: string
  queryB: string
  spKnownId: number | null
  spResultId: number | null
  spQueryKnown: string
  spQueryResult: string
  outcomeSortKey: OutcomeSortKey
  outcomeSortDir: 1 | -1
  otherParentSortKey: OtherParentSortKey
  otherParentSortDir: 1 | -1
}

function safeJsonParse(raw: string | null): unknown {
  if (raw == null || raw === '') return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function isSortKey(x: unknown): x is SeedListSortKey {
  return x === 'name' || x === 'growTime' || x === 'harvestLocation'
}

function isDir(x: unknown): x is 1 | -1 {
  return x === 1 || x === -1
}

function isCrossMode(x: unknown): x is CrossCalcMode {
  return x === 'computeOutcomes' || x === 'searchParents'
}

function isOutcomeSortKey(x: unknown): x is OutcomeSortKey {
  return x === 'outcome' || x === 'loop' || x === 'efficiency'
}

function isOtherParentSortKey(x: unknown): x is OtherParentSortKey {
  return x === 'other' || x === 'loop' || x === 'efficiency'
}

function readNullableSeedId(x: unknown): number | null {
  if (x === null || x === undefined) return null
  if (typeof x === 'number' && Number.isFinite(x) && x >= 1) return Math.floor(x)
  if (typeof x === 'string' && /^\d+$/.test(x)) {
    const n = Number.parseInt(x, 10)
    return Number.isFinite(n) && n >= 1 ? n : null
  }
  return null
}

export function loadSeedListUiState(): Partial<SeedListUiState> | null {
  if (typeof sessionStorage === 'undefined') return null
  const v = safeJsonParse(sessionStorage.getItem(SEED_LIST_KEY))
  if (v == null || typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const out: Partial<SeedListUiState> = {}
  if (typeof o.nameQuery === 'string') out.nameQuery = o.nameQuery
  if (typeof o.growTime === 'string') out.growTime = o.growTime
  if (typeof o.locationQuery === 'string') out.locationQuery = o.locationQuery
  if (isSortKey(o.sortKey)) out.sortKey = o.sortKey
  if (isDir(o.sortDir)) out.sortDir = o.sortDir
  return Object.keys(out).length ? out : null
}

export function saveSeedListUiState(s: SeedListUiState): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(SEED_LIST_KEY, JSON.stringify(s))
  } catch {
    /* 配額等 */
  }
}

export function loadCrossCalcUiState(): Partial<CrossCalcUiState> | null {
  if (typeof sessionStorage === 'undefined') return null
  const v = safeJsonParse(sessionStorage.getItem(CROSS_CALC_KEY))
  if (v == null || typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const out: Partial<CrossCalcUiState> = {}
  if (isCrossMode(o.mode)) out.mode = o.mode
  const pa = readNullableSeedId(o.parentAId)
  const pb = readNullableSeedId(o.parentBId)
  if ('parentAId' in o) out.parentAId = pa
  if ('parentBId' in o) out.parentBId = pb
  if (typeof o.queryA === 'string') out.queryA = o.queryA
  if (typeof o.queryB === 'string') out.queryB = o.queryB
  if ('spKnownId' in o) out.spKnownId = readNullableSeedId(o.spKnownId)
  if ('spResultId' in o) out.spResultId = readNullableSeedId(o.spResultId)
  if (typeof o.spQueryKnown === 'string') out.spQueryKnown = o.spQueryKnown
  if (typeof o.spQueryResult === 'string') out.spQueryResult = o.spQueryResult
  if (isOutcomeSortKey(o.outcomeSortKey)) out.outcomeSortKey = o.outcomeSortKey
  if (isDir(o.outcomeSortDir)) out.outcomeSortDir = o.outcomeSortDir
  if (isOtherParentSortKey(o.otherParentSortKey))
    out.otherParentSortKey = o.otherParentSortKey
  if (isDir(o.otherParentSortDir)) out.otherParentSortDir = o.otherParentSortDir
  return Object.keys(out).length ? out : null
}

export function saveCrossCalcUiState(s: CrossCalcUiState): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(CROSS_CALC_KEY, JSON.stringify(s))
  } catch {
    /* 配額等 */
  }
}
