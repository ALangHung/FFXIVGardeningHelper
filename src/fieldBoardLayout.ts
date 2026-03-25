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

export function computeBoardCellCount(fields: GardenField[]): number {
  if (fields.length === 0) return FIELD_BOARD_TAIL_EMPTY
  const maxIdx = Math.max(...fields.map((f) => f.gridIndex))
  return maxIdx + 1 + FIELD_BOARD_TAIL_EMPTY
}

export function buildBoardCells(fields: GardenField[]): BoardCell[] {
  const fixed = dedupeGridIndices(fields)
  const byIndex = new Map<number, GardenField>()
  for (const f of fixed) byIndex.set(f.gridIndex, f)
  const len = computeBoardCellCount(fixed)
  const out: BoardCell[] = []
  for (let i = 0; i < len; i++) {
    out.push({ index: i, field: byIndex.get(i) ?? null })
  }
  return out
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
