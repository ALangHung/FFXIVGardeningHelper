/** 九宮格可種植格位 id（0–7），對應畫面編號 1–8（中間格不種）。 */
export type FieldSlotId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export type CrossHintOutcome = {
  seedId: number
  name: string
}

/** 種下當下、依右→下→上→左第一個有配方的鄰格所算出的雜交提示（最多一筆有效）。 */
export type CrossHintAtPlant = {
  dirLabel: string
  neighborName: string
  outcomes: CrossHintOutcome[]
}

export type PlotSlotClearUndo = {
  seedId: number
  seedName: string
  growMs: number | null
  harvestDeadline: number | null
  lastFertilizeAt: number | null
  potColorLastActionAt: number | null
  crossAtPlant: CrossHintAtPlant | null
  potColorSteps: PotBaseColor[]
}

export type PotBaseColor = 'red' | 'blue' | 'yellow'
export type PotActionKey = PotBaseColor

export type PotActionUndo = {
  time: number
  action: PotActionKey
  before: {
    harvestDeadline: number | null
    lastFertilizeAt: number | null
    potColorLastActionAt: number | null
    potColorSteps: PotBaseColor[]
  }
}

export type PlotSlot = {
  id: FieldSlotId
  seedId: number | null
  seedName: string | null
  growMs: number | null
  harvestDeadline: number | null
  /** 該格被施肥影響的時間戳（毫秒）；用於 1 小時冷卻 */
  lastFertilizeAt: number | null
  /** 該格最近一次顏色油粕操作時間（毫秒）；供盆栽顏色按鈕 CD 使用。 */
  potColorLastActionAt: number | null
  crossAtPlant: CrossHintAtPlant | null
  clearUndo: PlotSlotClearUndo | null
  /** 盆栽染色操作：紀錄該輪曾使用的紅/藍/黃油粕順序。 */
  potColorSteps: PotBaseColor[]
  /** 盆栽按鈕列：最近一次操作可於 1 分鐘內撤銷。 */
  potActionUndo: PotActionUndo | null
}

export type FieldFertilizeEntry = {
  time: number
  /** 施肥前各格 harvestDeadline */
  deadlinesBefore: Partial<Record<FieldSlotId, number | null>>
  /** 施肥前各格 lastFertilizeAt（還原冷卻用） */
  lastFertilizeAtBefore: Partial<Record<FieldSlotId, number | null>>
  /** 施肥前的田地層級 lastFertilizeTime（還原顯示用） */
  lastFertilizeTimeBefore: number | null
}

/** 施肥後可取消的時間窗（毫秒） */
export const FERTILIZE_UNDO_WINDOW_MS = 60 * 1000

export type GardenField = {
  id: string
  /** 位置名稱，最多 5 字；空白時標題顯示「未命名」 */
  locationLabel: string
  /** 田編號（1–3）或盆栽 */
  plotNumber: FieldPlotNumber
  /** 總覽棋盤格位（橫排欄數依視窗寬度計算、由左而右由上而下） */
  gridIndex: number
  slots: PlotSlot[]
  /** 最近一次成功施肥的時間（毫秒），供「上次施肥」顯示；取消施肥後清空 */
  lastFertilizeTime: number | null
  /** 僅保留一筆：最近一次施肥的可撤銷快照；取消後為 null；超過 FERTILIZE_UNDO_WINDOW_MS 亦不可撤銷 */
  fertilizeUndo: FieldFertilizeEntry | null
}

export type FieldPlotNumber = 1 | 2 | 3 | 'pot'

export const FIELD_LOCATION_MAX_CHARS = 5

export function normalizeFieldLocation(raw: string): string {
  const t = raw.trim()
  return t.length <= FIELD_LOCATION_MAX_CHARS
    ? t
    : t.slice(0, FIELD_LOCATION_MAX_CHARS)
}

export function formatFieldHeading(field: GardenField): string {
  const loc = normalizeFieldLocation(field.locationLabel)
  const place = loc.length > 0 ? loc : '未命名'
  if (field.plotNumber === 'pot') return `${place}・盆栽`
  return `${place}・${field.plotNumber} 號田`
}

/** 是否可在「施肥後 1 分鐘內」執行唯一一次取消施肥 */
export function canUndoFertilize(field: GardenField, now: number): boolean {
  const u = field.fertilizeUndo
  if (u == null) return false
  return now - u.time <= FERTILIZE_UNDO_WINDOW_MS
}
