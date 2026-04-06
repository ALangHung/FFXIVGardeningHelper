import type { ConfirmedCross, SeedRecord } from './seedDetailTypes'

export type IntercrossOutcome = {
  outcomeSeedId: number
  outcomeName: string
  kind: 'primary' | 'alternate'
  outcomeGrowTime: string | null
  efficiency: number | null
  efficiencyRating: string | null
  isLoop: boolean
}

function pairMatch(
  idA: number | null,
  idB: number | null,
  p1: number,
  p2: number,
): boolean {
  if (idA == null || idB == null) return false
  return (idA === p1 && idB === p2) || (idA === p2 && idB === p1)
}

function effSortValue(e: number | null): number {
  return e != null && Number.isFinite(e) ? e : Number.NEGATIVE_INFINITY
}

/**
 * 在該種子的 confirmedCrosses 中找與兩親本 id 相符的列（順序不論）。
 */
function findCrossRowForParents(
  seed: SeedRecord | undefined,
  parentId1: number,
  parentId2: number,
) {
  if (!seed?.confirmedCrosses?.length) return null
  for (const row of seed.confirmedCrosses) {
    if (
      pairMatch(row.parentA.seedId, row.parentB.seedId, parentId1, parentId2)
    ) {
      return row
    }
  }
  return null
}

/**
 * 效率／顏色／loop 以「結果種子」頁面上 (親本A,親本B) 的列為準；若該頁無此組合（多為從他種「其他可能」欄帶出）則退回發現列。
 */
function efficiencyFromOutcomeRow(
  seedsById: Record<string, SeedRecord>,
  outcomeSeedId: number,
  parentId1: number,
  parentId2: number,
  fallbackRow: ConfirmedCross,
) {
  const rec = seedsById[String(outcomeSeedId)]
  const match = findCrossRowForParents(rec, parentId1, parentId2)
  const src = match ?? fallbackRow
  return {
    efficiency: src.efficiency,
    efficiencyRating: src.efficiencyRating,
    isLoop: src.isLoop,
  }
}

/**
 * 依 seeds-by-id 中各種子的「雜交獲取表」反查：兩親本可得到哪些結果（含主要結果與「其他可能」欄）。
 */
export function findIntercrossOutcomes(
  seedsById: Record<string, SeedRecord>,
  parentId1: number,
  parentId2: number,
): IntercrossOutcome[] {
  const raw: IntercrossOutcome[] = []
  for (const seed of Object.values(seedsById)) {
    for (const c of seed.confirmedCrosses ?? []) {
      if (!pairMatch(c.parentA.seedId, c.parentB.seedId, parentId1, parentId2))
        continue
      const primaryEff = efficiencyFromOutcomeRow(
        seedsById,
        seed.seedId,
        parentId1,
        parentId2,
        c,
      )
      raw.push({
        outcomeSeedId: seed.seedId,
        outcomeName: seed.seedItemName.trim() || seed.name,
        kind: 'primary',
        outcomeGrowTime: seed.growTime ?? null,
        efficiency: primaryEff.efficiency,
        efficiencyRating: primaryEff.efficiencyRating,
        isLoop: primaryEff.isLoop,
      })
      const altId = c.alternate.seedId
      if (altId != null) {
        const altRec = seedsById[String(altId)]
        const altName =
          altRec?.seedItemName?.trim() ||
          altRec?.name ||
          c.alternate.name ||
          `種子 #${altId}`
        const altEff = efficiencyFromOutcomeRow(
          seedsById,
          altId,
          parentId1,
          parentId2,
          c,
        )
        raw.push({
          outcomeSeedId: altId,
          outcomeName: altName,
          kind: 'alternate',
          outcomeGrowTime: altRec?.growTime ?? null,
          efficiency: altEff.efficiency,
          efficiencyRating: altEff.efficiencyRating,
          isLoop: altEff.isLoop,
        })
      }
    }
  }

  const best = new Map<number, IntercrossOutcome>()
  for (const row of raw) {
    const prev = best.get(row.outcomeSeedId)
    if (!prev) {
      best.set(row.outcomeSeedId, row)
      continue
    }
    const pv = effSortValue(prev.efficiency)
    const nv = effSortValue(row.efficiency)
    if (nv > pv) best.set(row.outcomeSeedId, row)
    else if (nv === pv && row.kind === 'primary' && prev.kind === 'alternate')
      best.set(row.outcomeSeedId, row)
  }

  return [...best.values()].sort((a, b) =>
    a.outcomeName.localeCompare(b.outcomeName, 'zh-Hant'),
  )
}

export type OtherParentCandidate = {
  otherParentSeedId: number
  otherParentName: string
  /** 來自確認配方親本欄位括號內的天數，無則為 null */
  otherParentGrowDays: number | null
  efficiency: number | null
  efficiencyRating: string | null
  isLoop: boolean
}

/**
 * 在「雜交結果」種子與「已有的親本」其一已確定時，從該結果的確認配方表列出另一種可能的親本。
 */
export function findOtherParentsFromResult(
  seedsById: Record<string, SeedRecord>,
  resultSeedId: number,
  knownParentId: number,
): OtherParentCandidate[] {
  const result = seedsById[String(resultSeedId)]
  if (!result) return []

  const raw: OtherParentCandidate[] = []
  for (const c of result.confirmedCrosses ?? []) {
    const a = c.parentA.seedId
    const b = c.parentB.seedId
    const nameA =
      (a != null
        ? seedsById[String(a)]?.seedItemName?.trim() ||
          seedsById[String(a)]?.name
        : null) ??
      c.parentA.name ??
      ''
    const nameB =
      (b != null
        ? seedsById[String(b)]?.seedItemName?.trim() ||
          seedsById[String(b)]?.name
        : null) ??
      c.parentB.name ??
      ''

    if (
      a === knownParentId &&
      b != null &&
      Number.isFinite(b) &&
      b !== knownParentId
    ) {
      raw.push({
        otherParentSeedId: b,
        otherParentName: nameB.trim() || `種子 #${b}`,
        otherParentGrowDays:
          c.parentB.growDays != null && Number.isFinite(c.parentB.growDays)
            ? c.parentB.growDays
            : null,
        efficiency: c.efficiency,
        efficiencyRating: c.efficiencyRating,
        isLoop: c.isLoop,
      })
    }
    if (
      b === knownParentId &&
      a != null &&
      Number.isFinite(a) &&
      a !== knownParentId
    ) {
      raw.push({
        otherParentSeedId: a,
        otherParentName: nameA.trim() || `種子 #${a}`,
        otherParentGrowDays:
          c.parentA.growDays != null && Number.isFinite(c.parentA.growDays)
            ? c.parentA.growDays
            : null,
        efficiency: c.efficiency,
        efficiencyRating: c.efficiencyRating,
        isLoop: c.isLoop,
      })
    }
  }

  const best = new Map<number, OtherParentCandidate>()
  for (const row of raw) {
    const prev = best.get(row.otherParentSeedId)
    if (!prev) {
      best.set(row.otherParentSeedId, row)
      continue
    }
    const pv = effSortValue(prev.efficiency)
    const nv = effSortValue(row.efficiency)
    if (nv > pv) best.set(row.otherParentSeedId, row)
  }

  return [...best.values()].sort((a, b) =>
    a.otherParentName.localeCompare(b.otherParentName, 'zh-Hant'),
  )
}
