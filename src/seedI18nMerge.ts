import type { SeedLocaleBundle, SeedI18nEntry } from './seedI18nTypes'
import { DEFAULT_SEED_LOCALE } from './seedI18nTypes'
import type { SeedSummary, SeedSummaryJson } from './seedSummaryTypes'

/** 作物／收成道具顯示名（預設繁中）；無作物時為空字串。繁中為空時改取日文。 */
export function cropDisplayName(
  entry: SeedI18nEntry | undefined,
  locale: keyof SeedLocaleBundle = DEFAULT_SEED_LOCALE,
): string {
  if (!entry?.crop) return ''
  const v = entry.crop[locale]
  let out = typeof v === 'string' ? v.trim() : ''
  if (locale === 'zh-Hant' && out === '') {
    const ja = entry.crop.ja
    out = typeof ja === 'string' ? ja.trim() : ''
  }
  return out
}

/** 種子包（可種植）道具顯示名（預設繁中）；繁中為空時改取日文（與 Teamcraft 缺 tw 時一致）。 */
export function seedItemDisplayName(
  entry: SeedI18nEntry | undefined,
  locale: keyof SeedLocaleBundle = DEFAULT_SEED_LOCALE,
): string {
  if (!entry) return ''
  const bundle = entry.seedItem ?? entry.crop
  if (!bundle) return ''
  const v = bundle[locale]
  let out = typeof v === 'string' ? v.trim() : ''
  if (locale === 'zh-Hant' && out === '') {
    const ja = bundle.ja
    out = typeof ja === 'string' ? ja.trim() : ''
  }
  return out
}

function fallbackSeedName(seedId: number): string {
  return `種子 #${seedId}`
}

/** 列表／詳情主標題：優先作物名，無作物時為種子道具名 */
export function cropOrSeedDisplayName(
  entry: SeedI18nEntry | undefined,
  locale: keyof SeedLocaleBundle = DEFAULT_SEED_LOCALE,
): string {
  return cropDisplayName(entry, locale) || seedItemDisplayName(entry, locale)
}

/**
 * 將摘要列與 i18n 合併為列表頁使用的列。
 * 列表主標題 `name`：優先種子包（seedItem），無種子包字串時再退回作物（crop）。
 */
export function mergeSeedSummaryRow(
  row: SeedSummaryJson,
  i18n: Record<string, SeedI18nEntry>,
): SeedSummary {
  const e = i18n[String(row.seedId)]
  const cropName = cropDisplayName(e)
  const seedName = seedItemDisplayName(e)
  const name =
    seedName || cropName || fallbackSeedName(row.seedId)
  const seedItemName = seedName || cropName || name
  const nameSearchText =
    e?.nameSearchText?.trim() || `${name} ${seedItemName}`.trim()
  return {
    ...row,
    name,
    seedItemName,
    nameSearchText,
    seedItemId: e?.seedItemId ?? null,
    cropItemId: e?.cropItemId ?? null,
    seedMinPrice: null,
    cropMinPrice: null,
  }
}
