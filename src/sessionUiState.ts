/**
 * 以 sessionStorage 保存列表／雜交計算器 UI，從種子詳情返回時可還原篩選與計算狀態。
 * （僅限同源、同一瀏覽器分頁工作階段。）
 * 另記錄各分頁種子詳情瀏覽編號串（陣列）、目前詳情脈絡（seedDetailActiveSection）；網址統一 /seed/:id；返回鍵依編號串逆向；頂欄恢復詳情取串尾。
 * 田地管理資料則以 localStorage 持久化（關閉分頁／瀏覽器後仍保留，同源有效）。
 */

import { dedupeGridIndices } from './fieldBoardLayout'
import type {
  CrossHintAtPlant,
  FieldPlotNumber,
  FieldFertilizeEntry,
  FieldSlotId,
  GardenField,
  PotActionUndo,
  PotBaseColor,
  PlotSlot,
} from './fieldStateTypes'
import {
  FERTILIZE_UNDO_WINDOW_MS,
  normalizeFieldLocation,
} from './fieldStateTypes'

const SEED_LIST_KEY = 'ffxivgh.seedList.v1'
/** 種子列表脈絡下種子詳情瀏覽順序（編號串） */
const SEED_LIST_DETAIL_PATH_KEY = 'ffxivgh.seedListDetailPath.v1'
const CROSS_DETAIL_PATH_KEY = 'ffxivgh.crossDetailPath.v1'
const FIELDS_DETAIL_PATH_KEY = 'ffxivgh.fieldsDetailPath.v1'
/** 目前種子詳情頁所屬分頁（網址統一為 /seed/:id，由此判斷脈絡） */
const SEED_DETAIL_ACTIVE_SECTION_KEY = 'ffxivgh.seedDetailActiveSection.v1'
const CROSS_CALC_KEY = 'ffxivgh.crossCalc.v1'
const TUTORIAL_LAST_TOPIC_KEY = 'ffxivgh.tutorialLastTopic.v1'

export type SeedDetailSection = 'list' | 'cross' | 'fields'

export type SeedListSortKey =
  | 'name'
  | 'growTime'
  | 'harvestLocation'
  | 'seedMinPrice'
  | 'cropMinPrice'

export type SeedListUiState = {
  nameQuery: string
  growTime: string
  locationQuery: string
  sortKey: SeedListSortKey
  sortDir: 1 | -1
}

export type CrossCalcMode = 'computeOutcomes' | 'searchParents'
export type OutcomeSortKey =
  | 'outcome'
  | 'growTime'
  | 'seedMinPrice'
  | 'cropMinPrice'
  | 'loop'
  | 'efficiency'
export type OtherParentSortKey =
  | 'other'
  | 'growDays'
  | 'seedMinPrice'
  | 'cropMinPrice'
  | 'loop'
  | 'efficiency'

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
  return (
    x === 'name' ||
    x === 'growTime' ||
    x === 'harvestLocation' ||
    x === 'seedMinPrice' ||
    x === 'cropMinPrice'
  )
}

function isDir(x: unknown): x is 1 | -1 {
  return x === 1 || x === -1
}

function isCrossMode(x: unknown): x is CrossCalcMode {
  return x === 'computeOutcomes' || x === 'searchParents'
}

function isOutcomeSortKey(x: unknown): x is OutcomeSortKey {
  return (
    x === 'outcome' ||
    x === 'growTime' ||
    x === 'seedMinPrice' ||
    x === 'cropMinPrice' ||
    x === 'loop' ||
    x === 'efficiency'
  )
}

function isOtherParentSortKey(x: unknown): x is OtherParentSortKey {
  return (
    x === 'other' ||
    x === 'growDays' ||
    x === 'seedMinPrice' ||
    x === 'cropMinPrice' ||
    x === 'loop' ||
    x === 'efficiency'
  )
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

function seedDetailPathStorageKey(section: SeedDetailSection): string {
  switch (section) {
    case 'list':
      return SEED_LIST_DETAIL_PATH_KEY
    case 'cross':
      return CROSS_DETAIL_PATH_KEY
    case 'fields':
      return FIELDS_DETAIL_PATH_KEY
  }
}

function parseSeedIdArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const x of raw) {
    const id = readNullableSeedId(x)
    if (id != null) out.push(id)
  }
  return out
}

/** 讀取某分頁種子詳情瀏覽編號串 */
export function getSeedDetailPath(section: SeedDetailSection): number[] {
  if (typeof sessionStorage === 'undefined') return []
  return parseSeedIdArray(
    safeJsonParse(sessionStorage.getItem(seedDetailPathStorageKey(section))),
  )
}

function saveSeedDetailPath(
  section: SeedDetailSection,
  path: number[],
): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      seedDetailPathStorageKey(section),
      JSON.stringify(path),
    )
  } catch {
    /* 配額等 */
  }
}

/** 從列表／雜交主頁／田地主頁進入詳情時重設該分頁編號串為單一編號 */
export function resetSeedDetailPath(
  section: SeedDetailSection,
  seedId: number,
): void {
  if (!Number.isFinite(seedId) || seedId < 1) return
  saveSeedDetailPath(section, [Math.floor(seedId)])
}

/** 詳情內切換種子：接續編號串（與尾端相同則不變） */
export function pushSeedDetailPath(section: SeedDetailSection, seedId: number): void {
  if (!Number.isFinite(seedId) || seedId < 1) return
  const id = Math.floor(seedId)
  const path = [...getSeedDetailPath(section)]
  if (path[path.length - 1] === id) return
  path.push(id)
  saveSeedDetailPath(section, path)
}

export function clearSeedDetailPath(section: SeedDetailSection): void {
  saveSeedDetailPath(section, [])
}

/**
 * 返回鍵：自編號串 pop 當前種子；若還有上一顆則導向該 id，否則應回分頁主畫面。
 */
export function popSeedDetailPathForBack(
  section: SeedDetailSection,
  currentSeedId: number,
): { kind: 'seed'; seedId: number } | { kind: 'main' } {
  if (!Number.isFinite(currentSeedId) || currentSeedId < 1) {
    return { kind: 'main' }
  }
  const cur = Math.floor(currentSeedId)
  let path = [...getSeedDetailPath(section)]
  if (path.length === 0) return { kind: 'main' }

  const last = path[path.length - 1]
  if (last !== cur) {
    const idx = path.lastIndexOf(cur)
    if (idx === -1) {
      clearSeedDetailPath(section)
      return { kind: 'main' }
    }
    path = path.slice(0, idx + 1)
  }
  path.pop()
  saveSeedDetailPath(section, path)
  if (path.length === 0) return { kind: 'main' }
  return { kind: 'seed', seedId: path[path.length - 1]! }
}

/** 供頂欄恢復：列表脈絡最後停留種子 */
export function getSeedListLastDetailFromList(): number | null {
  const p = getSeedDetailPath('list')
  return p.length > 0 ? p[p.length - 1]! : null
}

export function clearSeedListLastDetailFromList(): void {
  clearSeedDetailPath('list')
}

export function getCrossLastSeedDetailFromCross(): number | null {
  const p = getSeedDetailPath('cross')
  return p.length > 0 ? p[p.length - 1]! : null
}

export function clearCrossLastSeedDetailFromCross(): void {
  clearSeedDetailPath('cross')
}

export function getFieldsLastSeedDetailFromFields(): number | null {
  const p = getSeedDetailPath('fields')
  return p.length > 0 ? p[p.length - 1]! : null
}

export function clearFieldsLastSeedDetailFromFields(): void {
  clearSeedDetailPath('fields')
}

function isSeedDetailSection(x: unknown): x is SeedDetailSection {
  return x === 'list' || x === 'cross' || x === 'fields'
}

/** 種子詳情頁目前脈絡（列表／雜交／田地）；網址皆為 `/seed/:id` */
export function getSeedDetailActiveSection(): SeedDetailSection {
  if (typeof sessionStorage === 'undefined') return 'list'
  const raw = sessionStorage.getItem(SEED_DETAIL_ACTIVE_SECTION_KEY)
  if (raw == null) return 'list'
  if (isSeedDetailSection(raw)) return raw
  const j = safeJsonParse(raw)
  if (isSeedDetailSection(j)) return j
  return 'list'
}

export function setSeedDetailActiveSection(section: SeedDetailSection): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(SEED_DETAIL_ACTIVE_SECTION_KEY, section)
  } catch {
    /* 配額等 */
  }
}

/** 入門教學最後停留的分頁 */
export function getTutorialLastTopic(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(TUTORIAL_LAST_TOPIC_KEY)
}

export function clearTutorialLastTopic(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(TUTORIAL_LAST_TOPIC_KEY)
  } catch {
    /* 配額等 */
  }
}

export function setTutorialLastTopic(topic: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(TUTORIAL_LAST_TOPIC_KEY, topic)
  } catch {
    /* 配額等 */
  }
}

/** 詳情內連往另一顆種子（網址統一） */
export function seedDetailHref(_section: SeedDetailSection, seedId: number): string {
  return `/seed/${seedId}`
}

/** 在詳情內切換至另一顆種子時，接續該分頁編號串 */
export function recordSeedDetailForSection(
  section: SeedDetailSection,
  seedId: number,
): void {
  setSeedDetailActiveSection(section)
  pushSeedDetailPath(section, seedId)
}

export function isCrossSectionPath(path: string): boolean {
  return path === '/cross' || path.startsWith('/cross/')
}

export function isFieldsSectionPath(path: string): boolean {
  return path === '/fields' || path.startsWith('/fields/')
}

/** 是否為種子詳情路徑 `/seed/:id`（脈絡另見 getSeedDetailActiveSection） */
export function isListSectionSeedDetailPath(path: string): boolean {
  return /^\/seed\/[^/]+$/.test(path)
}

/**
 * 頂部「種子列表」連結目標：有列表詳情紀錄時，從雜交／田地（主頁或種子詳情）、或從首頁回到列表脈絡的 /seed/:id。
 * 種子詳情網址統一為 /seed/:id，故需依路徑或 getSeedDetailActiveSection 判斷是否為「非列表脈絡的詳情」。
 */
export function seedListTabTarget(currentPath: string): string {
  const x = getSeedListLastDetailFromList()
  if (x == null) return '/seeds'
  // 已在列表區（/seeds 或列表脈絡的種子詳情）→ 回 /seeds
  if (currentPath === '/seeds') return '/seeds'
  if (
    isListSectionSeedDetailPath(currentPath) &&
    getSeedDetailActiveSection() === 'list'
  ) {
    return '/seeds'
  }
  // 不在列表區 → 回上次的種子詳情
  return `/seed/${x}`
}

/** 頂部「雜交計算器」：離開雜交區時若有雜交詳情紀錄則導向 /seed/:id（脈絡由 session 標記為 cross）。若在種子詳情（雜交脈絡）且編號串有值，點擊改為回 /cross 主畫面（由 App 頂欄 onClick 清除編號串）；首頁等非詳情路徑仍導向 /seed/:id。 */
export function crossTabTarget(currentPath: string): string {
  if (isCrossSectionPath(currentPath)) return '/cross'
  if (
    isListSectionSeedDetailPath(currentPath) &&
    getSeedDetailActiveSection() === 'cross' &&
    getCrossLastSeedDetailFromCross() != null
  ) {
    return '/cross'
  }
  const y = getCrossLastSeedDetailFromCross()
  if (y != null) return `/seed/${y}`
  return '/cross'
}

/** 頂部「田地管理」：離開田地区時若有田地詳情紀錄則導向 /seed/:id（脈絡由 session 標記為 fields）。若在種子詳情（田地脈絡）且編號串有值，點擊改為回 /fields 主畫面（由 App 頂欄 onClick 清除編號串）；首頁等非詳情路徑仍導向 /seed/:id。 */
export function fieldsTabTarget(currentPath: string): string {
  if (isFieldsSectionPath(currentPath)) return '/fields'
  if (
    isListSectionSeedDetailPath(currentPath) &&
    getSeedDetailActiveSection() === 'fields' &&
    getFieldsLastSeedDetailFromFields() != null
  ) {
    return '/fields'
  }
  const z = getFieldsLastSeedDetailFromFields()
  if (z != null) return `/seed/${z}`
  return '/fields'
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

/* ——— 田地管理（localStorage 持久化）——— */

const FIELDS_LOCAL_KEY = 'ffxivgh.fields.v2'

function isFieldSlotId(n: number): n is FieldSlotId {
  return n === 0 || n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6 || n === 7
}

function readNullableNumber(x: unknown): number | null {
  if (x === null || x === undefined) return null
  if (typeof x === 'number' && Number.isFinite(x)) return x
  return null
}

function parseCrossHint(raw: unknown): CrossHintAtPlant | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const dirLabel = typeof o.dirLabel === 'string' ? o.dirLabel : ''
  const neighborName = typeof o.neighborName === 'string' ? o.neighborName : ''
  const outcomesRaw = o.outcomes
  const outcomes: CrossHintAtPlant['outcomes'] = []
  if (Array.isArray(outcomesRaw)) {
    for (const r of outcomesRaw) {
      if (r == null || typeof r !== 'object') continue
      const p = r as Record<string, unknown>
      const seedId = readNullableSeedId(p.seedId)
      const name = typeof p.name === 'string' ? p.name : ''
      if (seedId != null && name) outcomes.push({ seedId, name })
    }
  }
  if (!dirLabel || outcomes.length === 0) return null
  return { dirLabel, neighborName, outcomes }
}

function parseCrossAtPlantSlot(
  raw: unknown,
): CrossHintAtPlant | CrossHintAtPlant[] | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const hints = raw.map(parseCrossHint).filter(Boolean) as CrossHintAtPlant[]
    return hints.length ? hints : null
  }
  return parseCrossHint(raw)
}

function parseClearUndo(raw: unknown): PlotSlot['clearUndo'] {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const seedId = readNullableSeedId(o.seedId)
  if (seedId == null) return null
  const seedName = typeof o.seedName === 'string' ? o.seedName : ''
  const hint = parseCrossAtPlantSlot(o.crossAtPlant)
  const crossAtPlant = Array.isArray(hint)
    ? hint[0] ?? null
    : hint
  const colorsRaw = Array.isArray(o.potColorSteps) ? o.potColorSteps : []
  const potColorSteps: PotBaseColor[] = []
  for (const c of colorsRaw) {
    if (c === 'red' || c === 'blue' || c === 'yellow') {
      potColorSteps.push(c)
    }
  }
  return {
    seedId,
    seedName,
    growMs: readNullableNumber(o.growMs),
    harvestDeadline: readNullableNumber(o.harvestDeadline),
    lastFertilizeAt: readNullableNumber(o.lastFertilizeAt),
    potColorLastActionAt: readNullableNumber(o.potColorLastActionAt),
    crossAtPlant,
    potColorSteps,
  }
}

function parsePlotSlot(raw: unknown): PlotSlot | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'number' && isFieldSlotId(o.id) ? o.id : null
  if (id == null) return null
  const hintRaw = parseCrossAtPlantSlot(o.crossAtPlant)
  const crossAtPlant = Array.isArray(hintRaw)
    ? hintRaw[0] ?? null
    : hintRaw
  const colorsRaw = Array.isArray(o.potColorSteps) ? o.potColorSteps : []
  const potColorSteps: PotBaseColor[] = []
  for (const c of colorsRaw) {
    if (c === 'red' || c === 'blue' || c === 'yellow') {
      potColorSteps.push(c)
    }
  }
  const potActionUndo = parsePotActionUndo(o.potActionUndo)
  return {
    id,
    seedId: readNullableSeedId(o.seedId),
    seedName: typeof o.seedName === 'string' ? o.seedName : null,
    growMs: readNullableNumber(o.growMs),
    harvestDeadline: readNullableNumber(o.harvestDeadline),
    lastFertilizeAt: readNullableNumber(o.lastFertilizeAt),
    potColorLastActionAt: readNullableNumber(o.potColorLastActionAt),
    crossAtPlant,
    clearUndo: parseClearUndo(o.clearUndo),
    potColorSteps,
    potActionUndo,
  }
}

function parsePotActionUndo(raw: unknown): PotActionUndo | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const time = readNullableNumber(o.time)
  const action = o.action
  const beforeRaw =
    o.before != null && typeof o.before === 'object'
      ? (o.before as Record<string, unknown>)
      : null
  if (time == null || beforeRaw == null) return null
  if (
    action !== 'red' &&
    action !== 'blue' &&
    action !== 'yellow'
  ) {
    return null
  }
  const colorsRaw = Array.isArray(beforeRaw.potColorSteps)
    ? beforeRaw.potColorSteps
    : []
  const potColorSteps: PotBaseColor[] = []
  for (const c of colorsRaw) {
    if (c === 'red' || c === 'blue' || c === 'yellow') {
      potColorSteps.push(c)
    }
  }
  return {
    time,
    action,
    before: {
      harvestDeadline: readNullableNumber(beforeRaw.harvestDeadline),
      lastFertilizeAt: readNullableNumber(beforeRaw.lastFertilizeAt),
      potColorLastActionAt: readNullableNumber(beforeRaw.potColorLastActionAt),
      potColorSteps,
    },
  }
}

function parseFertilizeEntry(raw: unknown): FieldFertilizeEntry | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const time = readNullableNumber(o.time)
  if (time == null) return null
  const db = o.deadlinesBefore
  const deadlinesBefore: Partial<Record<FieldSlotId, number | null>> = {}
  const lastFertilizeAtBefore: Partial<Record<FieldSlotId, number | null>> = {}
  if (db != null && typeof db === 'object') {
    for (let i = 0; i <= 7; i++) {
      const k = String(i)
      if (k in (db as object)) {
        const v = (db as Record<string, unknown>)[k]
        deadlinesBefore[i as FieldSlotId] = readNullableNumber(v)
      }
    }
  }
  const lb = o.lastFertilizeAtBefore
  if (lb != null && typeof lb === 'object') {
    for (let i = 0; i <= 7; i++) {
      const k = String(i)
      if (k in (lb as object)) {
        const v = (lb as Record<string, unknown>)[k]
        lastFertilizeAtBefore[i as FieldSlotId] = readNullableNumber(v)
      }
    }
  }
  const lastFertilizeTimeBefore = readNullableNumber(o.lastFertilizeTimeBefore)
  return { time, deadlinesBefore, lastFertilizeAtBefore, lastFertilizeTimeBefore: lastFertilizeTimeBefore ?? null }
}

/** 舊版 session：施肥堆疊（僅遷移用） */
function parseLegacyFertilizeHistory(raw: unknown): FieldFertilizeEntry[] {
  if (!Array.isArray(raw)) return []
  const out: FieldFertilizeEntry[] = []
  for (const e of raw) {
    const entry = parseFertilizeEntry(e)
    if (entry) out.push(entry)
  }
  return out
}

function parseGardenField(raw: unknown, index: number): GardenField | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : null
  if (!id) return null

  let locationLabel = ''
  if (typeof o.locationLabel === 'string') {
    locationLabel = normalizeFieldLocation(o.locationLabel)
  } else if (o.housing === 'guild') {
    locationLabel = normalizeFieldLocation('公會房')
  } else if (o.housing === 'personal') {
    locationLabel = normalizeFieldLocation('個人房')
  }

  let plotNumber: FieldPlotNumber = 1
  if (
    o.plotNumber === 1 ||
    o.plotNumber === 2 ||
    o.plotNumber === 3 ||
    o.plotNumber === 'pot'
  ) {
    plotNumber = o.plotNumber
  }

  let gridIndex =
    typeof o.gridIndex === 'number' && Number.isFinite(o.gridIndex) && o.gridIndex >= 0
      ? Math.floor(o.gridIndex)
      : index
  const slotsRaw = o.slots
  const slots: PlotSlot[] = []
  if (Array.isArray(slotsRaw)) {
    for (const s of slotsRaw) {
      const p = parsePlotSlot(s)
      if (p) slots.push(p)
    }
  }

  const byId = new Map<number, PlotSlot>()
  for (const p of slots) byId.set(p.id, p)
  const fullSlots: PlotSlot[] = []
  for (let i = 0; i <= 7; i++) {
    fullSlots.push(
      byId.get(i) ?? {
        id: i as FieldSlotId,
        seedId: null,
        seedName: null,
        growMs: null,
        harvestDeadline: null,
        lastFertilizeAt: null,
        potColorLastActionAt: null,
        crossAtPlant: null,
        clearUndo: null,
        potColorSteps: [],
        potActionUndo: null,
      },
    )
  }

  let lastFertilizeTime = readNullableNumber(o.lastFertilizeTime)
  let fertilizeUndo = parseFertilizeEntry(o.fertilizeUndo)

  const legacyHist = parseLegacyFertilizeHistory(o.fertilizeHistory)
  if (legacyHist.length > 0) {
    const last = legacyHist[legacyHist.length - 1]!
    if (lastFertilizeTime == null) lastFertilizeTime = last.time
    if (fertilizeUndo == null) {
      const age = Date.now() - last.time
      if (age >= 0 && age < FERTILIZE_UNDO_WINDOW_MS) fertilizeUndo = last
    }
  }

  if (fertilizeUndo != null) {
    const age = Date.now() - fertilizeUndo.time
    if (age < 0 || age >= FERTILIZE_UNDO_WINDOW_MS) fertilizeUndo = null
  }

  let potSlotLocations: Record<string, string> | undefined
  if (o.potSlotLocations != null && typeof o.potSlotLocations === 'object' && !Array.isArray(o.potSlotLocations)) {
    const parsed: Record<string, string> = {}
    for (const [k, v] of Object.entries(o.potSlotLocations as Record<string, unknown>)) {
      if (typeof v === 'string') parsed[k] = v
    }
    if (Object.keys(parsed).length > 0) potSlotLocations = parsed
  }

  return {
    id,
    locationLabel,
    plotNumber,
    gridIndex,
    slots: fullSlots,
    lastFertilizeTime,
    fertilizeUndo,
    potSlotLocations,
  }
}

export function loadFieldsLocal(): GardenField[] {
  if (typeof localStorage === 'undefined') return []
  const v = safeJsonParse(localStorage.getItem(FIELDS_LOCAL_KEY))
  if (!Array.isArray(v)) return []
  const parsed: GardenField[] = []
  for (let i = 0; i < v.length; i++) {
    const f = parseGardenField(v[i], i)
    if (f) parsed.push(f)
  }
  return dedupeGridIndices(parsed)
}

export function saveFieldsLocal(fields: GardenField[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(FIELDS_LOCAL_KEY, JSON.stringify(fields))
  } catch {
    /* 配額等 */
  }
}
