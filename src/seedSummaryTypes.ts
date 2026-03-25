export type SeedSummary = {
  seedId: number
  name: string
  seedType: string | null
  growTime: string | null
  wiltTime: string | null
  harvestLocation: string | null
  /** 採集點等級（網站 Node Level） */
  nodeLevel: string | null
  /** 本機路徑，如 `/images/seed-icon/1.png` */
  iconUrl: string
  detailUrl: string
}

export type SeedsSummaryPayload = {
  meta: Record<string, unknown>
  seeds: SeedSummary[]
}
