import type { GardenField } from './fieldStateTypes'

/** 解析 CSS 長度為 px（支援 rem、px）。 */
export function parseCssLengthToPx(value: string, rootFontPx: number): number {
  const v = value.trim().toLowerCase()
  if (!v || v === 'auto') return 0
  if (v.endsWith('rem')) return parseFloat(v) * rootFontPx
  if (v.endsWith('px')) return parseFloat(v)
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 依棋盤容器寬度與 `.field-page` 上的 CSS 變數，計算每橫排可容納幾塊田。
 * 公式：floor((W + gapX) / (blockW + gapX))，至少為 1。
 */
export function computeBoardColsFromContainer(
  containerWidthPx: number,
  fieldPageStyle: CSSStyleDeclaration,
): number {
  const rootFont =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const blockW = parseCssLengthToPx(
    fieldPageStyle.getPropertyValue('--field-block-width').trim(),
    rootFont,
  )
  const gapX = parseCssLengthToPx(
    fieldPageStyle.getPropertyValue('--field-board-gap-x').trim(),
    rootFont,
  )
  if (blockW <= 0) return 1
  return Math.max(
    1,
    Math.floor((containerWidthPx + gapX) / (blockW + gapX)),
  )
}

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
   * 將總格數向上取整為「目前每橫排欄數」的倍數，使每一列都排滿（編輯模式棋盤尾端才不會缺空白格）。
   * 欄數須傳入 `boardCols`（與 `computeBoardColsFromContainer` 一致），非固定 3。
   */
  padToFullRows?: boolean
  /** 總覽棋盤每橫排欄數（須與畫面實際欄數一致，由容器寬度計算）。 */
  boardCols?: number
}

/**
 * 棋盤基礎格數：已佔用的 index 0..maxIdx，再加「尾端一整列」空白作拖放緩衝。
 * 尾端列寬須與目前每橫排欄數一致（單欄時為 1 格，三欄時為 3 格），不可固定為 3。
 */
export function computeBoardCellCount(
  fields: GardenField[],
  boardCols: number,
): number {
  const tail = Math.max(1, boardCols)
  if (fields.length === 0) return tail
  const maxIdx = Math.max(...fields.map((f) => f.gridIndex))
  return maxIdx + 1 + tail
}

export function buildBoardCells(
  fields: GardenField[],
  options?: BuildBoardCellsOptions,
): BoardCell[] {
  const cols = Math.max(1, options?.boardCols ?? 1)
  const fixed = dedupeGridIndices(fields)
  const byIndex = new Map<number, GardenField>()
  for (const f of fixed) byIndex.set(f.gridIndex, f)
  let len = computeBoardCellCount(fixed, cols)
  if (options?.padToFullRows) {
    len = Math.ceil(len / cols) * cols
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
