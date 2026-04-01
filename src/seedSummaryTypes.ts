/** 自 `seeds-summary.json` 載入（不含名稱；名稱來自 `seeds-i18n.json` 之 seedItem / crop） */
export type SeedSummaryJson = {
  seedId: number
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

/** 列表／搜尋用：合併 i18n 後的列 */
export type SeedSummary = SeedSummaryJson & {
  /** 種子包道具顯示名（繁中；種子列表主欄位與排序用；無種子字串時退回作物名） */
  name: string
  /** 種子包道具顯示名（繁中；與 `name` 同源邏輯） */
  seedItemName: string
  /**
   * 供名稱篩選：seedItem 與 crop 四語系合併（去重）。
   */
  nameSearchText: string
  /** Teamcraft 種子道具 item id */
  seedItemId: number | null
  /** Teamcraft 作物／收成道具 item id；盆栽專用為 null */
  cropItemId: number | null
  /** 由 Universalis 取得的種子道具最低售價（NQ/HQ 合併） */
  seedMinPrice: number | null
  /** 由 Universalis 取得的作物最低售價（NQ/HQ 合併）；盆栽專用維持 null */
  cropMinPrice: number | null
}

export type SeedsSummaryPayloadJson = {
  meta: Record<string, unknown>
  seeds: SeedSummaryJson[]
}

export type SeedsSummaryPayload = {
  meta: Record<string, unknown>
  seeds: SeedSummary[]
}
