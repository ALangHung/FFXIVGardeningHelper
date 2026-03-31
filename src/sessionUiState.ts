/**
 * 以 sessionStorage 保存列表／雜交計算器 UI，從種子詳情返回時可還原篩選與計算狀態。
 * （僅限同源、同一瀏覽器分頁工作階段。）
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
  return { time, deadlinesBefore, lastFertilizeAtBefore }
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

  return {
    id,
    locationLabel,
    plotNumber,
    gridIndex,
    slots: fullSlots,
    lastFertilizeTime,
    fertilizeUndo,
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
