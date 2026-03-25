export type CrossParent = {
  seedId: number | null
  name: string | null
  growDays: number | null
}

export type CrossAlternate = {
  seedId: number | null
  name: string | null
}

export type ConfirmedCross = {
  isLoop: boolean
  parentA: CrossParent
  parentB: CrossParent
  alternate: CrossAlternate
  efficiency: number | null
  efficiencyRating: string | null
}

export type UsedInCross = {
  seedId: number
  name: string
  iconPath?: string | null
}

export type SeedRecord = {
  seedId: number
  sourceUrl: string
  name: string
  iconPath?: string
  seedType: string | null
  growTime: string | null
  wiltTime: string | null
  cropYield: string | null
  seedYield: string | null
  harvestLocation: string | null
  nodeLevel: string | null
  didYouKnow: string | null
  confirmedCrossesCount: number
  confirmedCrossCountMatches?: boolean
  confirmedCrosses: ConfirmedCross[]
  notObtainableViaIntercrossing: boolean
  usedInOtherCrosses: UsedInCross[]
}

export type SeedsByIdPayload = {
  meta: Record<string, unknown>
  seedsById: Record<string, SeedRecord>
}
