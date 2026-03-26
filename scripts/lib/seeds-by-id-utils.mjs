/**
 * @param {Record<string, { seedId?: number }>} seedsById
 * @returns {object[]}
 */
export function seedsSortedById(seedsById) {
  return Object.values(seedsById ?? {}).sort(
    (a, b) => Number(a.seedId) - Number(b.seedId),
  )
}
