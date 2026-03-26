/** Teamcraft / 遊戲內道具各語系顯示名（繁中、英、日、簡中） */
export type SeedLocaleBundle = {
  'zh-Hant': string
  en: string
  ja: string
  'zh-Hans': string
}

/**
 * 與 ffxivgardening SeedID 對應：種子包道具與收成物各一組多語（來自 Teamcraft）。
 */
export type SeedI18nEntry = {
  /** 舊版 `seeds-i18n.json` 可能缺此欄，執行期 fallback 為 `crop` */
  seedItem?: SeedLocaleBundle
  /** 無獨立收成（cropYield 為 0／空）時為 null；舊版 JSON 可能仍為物件 */
  crop: SeedLocaleBundle | null
  nameSearchText: string
}

export type SeedsI18nPayload = {
  meta: Record<string, unknown>
  bySeedId: Record<string, SeedI18nEntry>
}

export const DEFAULT_SEED_LOCALE = 'zh-Hant' as const
