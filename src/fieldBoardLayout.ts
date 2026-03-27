import type { GardenField } from './fieldStateTypes'

export const FIELD_BOARD_COLS = 3
export const FIELD_BOARD_TAIL_EMPTY = 3

export function dedupeGridIndices(fields: GardenField[]): GardenField[] {
  const used = new Set<number>()
  let next = 0
  return fields.map((f) => {
    let g = f.gridIndex
    if (!Number.isFinite(g) || g < 0 || used.has(g)) {
      while (used.has(next)) next += 1
      g = next
    }
    used.add(g)
    next = Math.max(next, g + 1)
    return { ...f, gridIndex: g }
  })
}

export function nextFreeGridIndex(fields: GardenField[]): number {
  const used = new Set(fields.map((f) => f.gridIndex))
  let i = 0
  while (used.has(i)) i += 1
  return i
}

export type BoardCell = { index: number; field: GardenField | null }

export type BuildBoardCellsOptions = {
  /**
   * 將總格數向上取整為欄數的倍數，使每一列都排滿（編輯模式棋盤尾端才不會缺空白格）。
   * 例：僅 1 塊田在 index 0 時，基礎長度 4 只會排到第二列第 1 格；補滿後為 6，第二列有三個空白格。
   */
  padToFullRows?: boolean
}

export function computeBoardCellCount(fields: GardenField[]): number {
  if (fields.length === 0) return FIELD_BOARD_TAIL_EMPTY
  const maxIdx = Math.max(...fields.map((f) => f.gridIndex))
  return maxIdx + 1 + FIELD_BOARD_TAIL_EMPTY
}

export function buildBoardCells(
  fields: GardenField[],
  options?: BuildBoardCellsOptions,
): BoardCell[] {
  const fixed = dedupeGridIndices(fields)
  const byIndex = new Map<number, GardenField>()
  for (const f of fixed) byIndex.set(f.gridIndex, f)
  let len = computeBoardCellCount(fixed)
  if (options?.padToFullRows) {
    len = Math.ceil(len / FIELD_BOARD_COLS) * FIELD_BOARD_COLS
  }
  const out: BoardCell[] = []
  for (let i = 0; i < len; i++) {
    out.push({ index: i, field: byIndex.get(i) ?? null })
  }
  return out
}

/** 自尾端移除連續的空白格（供一般模式不顯示尾端放置區時使用）。 */
export function trimTrailingEmptyBoardCells(cells: BoardCell[]): BoardCell[] {
  let end = cells.length
  while (end > 0 && cells[end - 1]!.field == null) end -= 1
  return cells.slice(0, end)
}

/** 複製一塊田：新 id、新棋盤格位，其餘狀態（含各格作物與倒數）與來源相同。 */
export function duplicateGardenField(
  source: GardenField,
  allFields: GardenField[],
): GardenField {
  const newId = crypto.randomUUID()
  const gridIndex = nextFreeGridIndex(allFields)
  const cloned = structuredClone(source) as GardenField
  cloned.id = newId
  cloned.gridIndex = gridIndex
  return cloned
}

export function applyFieldGridDrop(
  fields: GardenField[],
  draggedId: string,
  targetIndex: number,
): GardenField[] {
  const dragged = fields.find((f) => f.id === draggedId)
  if (!dragged) return fields

  const other = fields.filter((f) => f.id !== draggedId)
  const atTarget = other.find((f) => f.gridIndex === targetIndex)

  if (!atTarget) {
    return fields.map((f) =>
      f.id === draggedId ? { ...f, gridIndex: targetIndex } : f,
    )
  }

  const a = dragged.gridIndex
  const b = atTarget.gridIndex
  return fields.map((f) => {
    if (f.id === draggedId) return { ...f, gridIndex: b }
    if (f.id === atTarget.id) return { ...f, gridIndex: a }
    return f
  })
}
