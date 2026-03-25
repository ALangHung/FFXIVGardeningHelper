import type { SeedRecord } from './seedDetailTypes'

export type IntercrossOutcome = {
  outcomeSeedId: number
  outcomeName: string
  kind: 'primary' | 'alternate'
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
      raw.push({
        outcomeSeedId: seed.seedId,
        outcomeName: seed.name,
        kind: 'primary',
        efficiency: c.efficiency,
        efficiencyRating: c.efficiencyRating,
        isLoop: c.isLoop,
      })
      const altId = c.alternate.seedId
      if (altId != null) {
        const altRec = seedsById[String(altId)]
        const altName =
          altRec?.name ?? c.alternate.name ?? `種子 #${altId}`
        raw.push({
          outcomeSeedId: altId,
          outcomeName: altName,
          kind: 'alternate',
          efficiency: c.efficiency,
          efficiencyRating: c.efficiencyRating,
          isLoop: c.isLoop,
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
      c.parentA.name ??
      (a != null ? seedsById[String(a)]?.name : null) ??
      ''
    const nameB =
      c.parentB.name ??
      (b != null ? seedsById[String(b)]?.name : null) ??
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
