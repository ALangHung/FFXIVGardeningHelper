/**
 * 移除園藝站 harvest 字串中的「Slot N @ 」前綴（僅保留時段等後段說明）。
 * @param {string | null | undefined} s
 * @returns {string | null | undefined}
 */
export function stripSlotPrefixFromHarvestLocation(s) {
  if (s == null || typeof s !== 'string') return s
  return s.replace(/\bSlot\s+\d+\s+@\s+/g, '')
}

/**
 * @param {Record<string, { seedId?: number }>} seedsById
 * @returns {object[]}
 */
export function seedsSortedById(seedsById) {
  return Object.values(seedsById ?? {}).sort(
    (a, b) => Number(a.seedId) - Number(b.seedId),
  )
}
