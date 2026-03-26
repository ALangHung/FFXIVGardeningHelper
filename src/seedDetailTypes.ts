export type CrossParent = {
  seedId: number | null
  growDays: number | null
  /** 執行期由 `seeds-i18n.json` 依 seedId 填入（作物／收成道具顯示名） */
  name?: string | null
}

export type CrossAlternate = {
  seedId: number | null
  /** 執行期由 i18n 填入 */
  name?: string | null
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
  /** 執行期由 i18n 填入（作物／收成道具顯示名） */
  name?: string
  iconPath?: string | null
}

/**
 * 自 JSON 載入之種子本體（無內嵌名稱）；執行期合併 i18n 後補上作物道具顯示名 `name`。
 */
export type SeedRecordCore = {
  seedId: number
  sourceUrl: string
  iconPath?: string
  seedType: string | null
  growTime: string | null
  wiltTime: string | null
  cropYield: string | null
  seedYield: string | null
  harvestLocation: string | null
  isPlanterOnly?: boolean
  nodeLevel: string | null
  didYouKnow: string | null
  confirmedCrossesCount: number
  confirmedCrossCountMatches?: boolean
  confirmedCrosses: ConfirmedCross[]
  notObtainableViaIntercrossing: boolean
  usedInOtherCrosses: UsedInCross[]
}

/** 合併 i18n 後供 UI 使用 */
export type SeedRecord = SeedRecordCore & {
  /** 作物／收成道具名（繁中，列表／詳情／雜交主標題） */
  name: string
  /** 種子包道具名（繁中） */
  seedItemName: string
}

export type SeedsByIdPayloadCore = {
  meta: Record<string, unknown>
  seedsById: Record<string, SeedRecordCore>
}

export type SeedsByIdPayload = {
  meta: Record<string, unknown>
  seedsById: Record<string, SeedRecord>
}
