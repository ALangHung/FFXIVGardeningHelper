import { findIntercrossOutcomes } from './crossOutcomes'
import { durationToSortHours } from './seedFormat'
import type { SeedRecord } from './seedDetailTypes'
import type {
  CrossHintAtPlant,
  FieldSlotId,
  GardenField,
  PlotSlot,
} from './fieldStateTypes'

/**
 * 九宮格編號（遊戲常見）：
 * 1 2 3
 * 8 ✕ 4
 * 7 6 5
 */
export const FIELD_SLOTS: readonly {
  id: FieldSlotId
  label: string
  row: number
  col: number
}[] = [
  { id: 0, label: '1', row: 0, col: 0 },
  { id: 1, label: '2', row: 0, col: 1 },
  { id: 2, label: '3', row: 0, col: 2 },
  { id: 3, label: '4', row: 1, col: 2 },
  { id: 4, label: '5', row: 2, col: 2 },
  { id: 5, label: '6', row: 2, col: 1 },
  { id: 6, label: '7', row: 2, col: 0 },
  { id: 7, label: '8', row: 1, col: 0 },
] as const

const DIR_LABELS = ['右', '下', '上', '左'] as const

function slotAt(row: number, col: number) {
  if (row === 1 && col === 1) return null
  return FIELD_SLOTS.find((s) => s.row === row && s.col === col) ?? null
}

/** 鄰格掃描順序：右 → 下 → 上 → 左 */
function neighborSteps(
  row: number,
  col: number,
): readonly [number, number, (typeof DIR_LABELS)[number]][] {
  return [
    [row, col + 1, '右'],
    [row + 1, col, '下'],
    [row - 1, col, '上'],
    [row, col - 1, '左'],
  ]
}

export function growMsFromSeedRecord(seed: SeedRecord | null): number | null {
  if (!seed) return null
  const h = durationToSortHours(seed.growTime)
  if (!Number.isFinite(h) || h === Number.POSITIVE_INFINITY) return null
  return Math.round(h * 3600 * 1000)
}

export function computeCrossHintsAtPlant(
  seedsById: Record<string, SeedRecord>,
  plantedSeedId: number,
  slots: PlotSlot[],
  plantedSlotId: FieldSlotId,
): CrossHintAtPlant | null {
  const meta = FIELD_SLOTS.find((s) => s.id === plantedSlotId)
  if (!meta) return null

  const byId = new Map<FieldSlotId, PlotSlot>()
  for (const s of slots) byId.set(s.id, s)

  for (const [dr, dc, dirLabel] of neighborSteps(meta.row, meta.col)) {
    const nb = slotAt(dr, dc)
    if (!nb) continue
    const neighbor = byId.get(nb.id)
    const nid = neighbor?.seedId
    if (nid == null) continue
    const outcomes = findIntercrossOutcomes(seedsById, plantedSeedId, nid)
    if (outcomes.length === 0) continue
    const neighborName =
      neighbor?.seedName ??
      seedsById[String(nid)]?.name ??
      `種子 #${nid}`
    return {
      dirLabel,
      neighborName,
      outcomes: outcomes.map((o) => ({
        seedId: o.outcomeSeedId,
        name: o.outcomeName,
      })),
    }
  }
  return null
}

export function visibleCrossHints(
  raw: CrossHintAtPlant | CrossHintAtPlant[] | null | undefined,
): CrossHintAtPlant[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
  return arr.filter((h) => h.outcomes.length > 0).slice(0, 1)
}

export function slotReadyToHarvest(
  slot: PlotSlot,
  now: number,
): boolean {
  if (slot.seedId == null) return false
  if (slot.harvestDeadline == null) return false
  return now >= slot.harvestDeadline
}

const FERTILIZE_COOLDOWN_MS = 60 * 60 * 1000

export function slotCanReceiveFertilize(slot: PlotSlot, now: number): boolean {
  if (slot.seedId == null) return false
  if (slot.harvestDeadline == null) return false
  if (now >= slot.harvestDeadline) return false
  const last = slot.lastFertilizeAt
  if (last != null && now - last < FERTILIZE_COOLDOWN_MS) return false
  return true
}

/** 該田是否至少一格目前可施肥 */
export function fieldHasFertilizableSlot(field: GardenField, now: number): boolean {
  return field.slots.some((s) => slotCanReceiveFertilize(s, now))
}

/**
 * 最早可再施肥的時間（毫秒時間戳）；若已有可施肥格則為 null。
 * 僅依「每格施肥冷卻」推算；若無作物／無倒數等則為 null。
 */
export function getNextFertilizeEligibleAt(
  field: GardenField,
  now: number,
): number | null {
  if (field.slots.some((s) => slotCanReceiveFertilize(s, now))) return null
  let best: number | null = null
  for (const slot of field.slots) {
    if (slot.seedId == null) continue
    if (slot.harvestDeadline == null) continue
    if (now >= slot.harvestDeadline) continue
    const last = slot.lastFertilizeAt
    if (last != null && now - last < FERTILIZE_COOLDOWN_MS) {
      const t = last + FERTILIZE_COOLDOWN_MS
      if (best == null || t < best) best = t
    }
  }
  return best
}
