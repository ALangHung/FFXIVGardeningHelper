/**
 * Resolve ffxivgardening.com English titles to Teamcraft item ids:
 * seed packet (種子道具) vs harvest crop (收成物).
 */

/**
 * 僅用於收成物（crop）英文對照；不可併入 EN_ALIASES，否則 resolveSeedPacketEn 會先誤對到收成物 id。
 * 例：園藝站標題 Pearl Sprout，Teamcraft 收成為 Pearl Sprouts（複數）、種子為 Pearl Sprout Seeds。
 */
export const CROP_EN_ALIASES = {
  /** 與 Olive 相同：園藝站英文標題 → Teamcraft `items.json` 的收成物 `en`。 */
  Olive: 'Cinderfoot Olive',
  'Pearl Sprout': 'Pearl Sprouts',
  'Wild Onion Set': 'Wild Onion',
  'Royal Kukuru': 'Royal Kukuru Bean',
  'Shroud Tea': 'Shroud Tea Leaves',
  'Popoto Set': 'Popoto',
  'Dalamud Popoto Set': 'Dalamud Popoto',
  /** 大蒜球根（種球）收成為 Garlean Garlic */
  'Garlic Cloves': 'Garlean Garlic',
  'Pearl Ginger Root': 'Pearl Ginger',
  "O'Ghomoro Berry": "O'Ghomoro Berries",
  'Coerthan Tea': 'Coerthan Tea Leaves',
  Linseed: 'Flax',
  /** Teamcraft 僅有 Corsage／Seeds／Plot 條目 */
  'Morning Glory': 'Red Morning Glory Corsage',
  Chrysanthemum: 'Red Chrysanthemums',
  Lupin: 'Red Lupins',
  Sunflower: 'Red Sunflowers',
  Cattleya: 'Red Cattleyas',
  Paperflower: 'Red Paperflowers',
  Champa: 'Red Champa',
  'Tea Flower': 'Red Tea Flowers',
}

export const EN_ALIASES = {
  'Shroud Cherry': 'Shroud Cherry Sapling',
  Tulip: 'Tulip Bulbs',
  Dahlia: 'Dahlia Bulbs',
  Arum: 'Arum Bulbs',
  'Lily of the Valley': 'Lily of the Valley Pips',
  Hyacinth: 'Hyacinth Bulbs',
  Cattleya: 'Cattleya Seeds',
  Paperflower: 'Paperflower Seeds',
  Champa: 'Champa Seeds',
  'Tea Flower': 'Tea Flower Seeds',
}

/** Gardening page title → exact Teamcraft `en` for the plantable packet (not "… Seeds"). */
export const EXTRA_SEED_PACKET_EN = {
  Apricot: 'Apricot Kernels',
  'Doman Plum': 'Doman Plum Pits',
  'Cloud Acorn': 'Cloud Acorn Sapling',
  'Royal Fern': 'Royal Fern Sori',
}

/**
 * ffxivgardening 晶草頁用 *light 當標題；收成物實為元素碎晶。
 * 若直接用標題查 `items.json` 的 `en`，`Levinlight` 會誤對到 id 7920（同名魚／雜項「雷神光」），而非 Lightning Shard（雷之碎晶）。
 */
export const ELEMENTAL_LIGHT_GARDENING_TO_SHARD_EN = {
  Firelight: 'Fire Shard',
  Icelight: 'Ice Shard',
  Windlight: 'Wind Shard',
  Earthlight: 'Earth Shard',
  Levinlight: 'Lightning Shard',
  Waterlight: 'Water Shard',
}

export function buildEnToIdMap(items) {
  const map = new Map()
  for (const [id, o] of Object.entries(items)) {
    const en = o?.en
    if (typeof en !== 'string' || !en.trim()) continue
    const prev = map.get(en)
    if (!prev || Number(id) < Number(prev)) map.set(en, id)
  }
  return map
}

export function idForEn(enMap, en) {
  if (typeof en !== 'string' || !en.trim()) return null
  return enMap.get(en.trim()) ?? null
}

/**
 * Ordered English names to try for the **plantable** item.
 */
export function seedPacketEnCandidates(gardeningEn) {
  const key = String(gardeningEn ?? '').trim()
  if (!key || key === '--') return []
  const out = []
  const extra = EXTRA_SEED_PACKET_EN[key]
  const alias = EN_ALIASES[key]
  const lk = alias ?? key
  if (extra) out.push(extra)
  if (alias) out.push(alias)
  out.push(`${key} Seeds`)
  if (lk !== key) out.push(`${lk} Seeds`)
  out.push(lk)
  out.push(key)
  const seen = new Set()
  return out.filter((c) => {
    if (!c || seen.has(c)) return false
    seen.add(c)
    return true
  })
}

export function resolveSeedPacketEn(enMap, gardeningEn) {
  for (const en of seedPacketEnCandidates(gardeningEn)) {
    if (enMap.has(en)) return en
  }
  return null
}

/**
 * 園藝站標題常為單數（如 Lowland Grape），Teamcraft 收成物 en 常為最後一詞複數（Lowland Grapes）。
 */
function cropEnByPluralLastWord(enMap, key) {
  const parts = String(key ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return null
  const last = parts[parts.length - 1]
  if (/s$/i.test(last)) return null
  const candidate = [...parts.slice(0, -1), `${last}s`].join(' ')
  return enMap.has(candidate) ? candidate : null
}

export function resolveCropEn(enMap, gardeningEn) {
  const key = String(gardeningEn ?? '').trim()
  if (!key || key === '--') return null
  const shardEn = ELEMENTAL_LIGHT_GARDENING_TO_SHARD_EN[key]
  if (shardEn && enMap.has(shardEn)) return shardEn

  const cropOnly = CROP_EN_ALIASES[key]
  if (cropOnly && enMap.has(cropOnly)) return cropOnly

  const lk = EN_ALIASES[key] ?? key
  if (enMap.has(key)) return key
  if (enMap.has(lk)) return lk

  const pluralLast = cropEnByPluralLastWord(enMap, key)
  if (pluralLast) return pluralLast

  return null
}

/**
 * 推斷 Teamcraft 是否可能存在「與種子包不同 id」的收成道具。
 * 若為 false，表示資料庫裡多半只有種子包相關一筆，可讓 crop 與 seedItem 共用 id（不拋錯）。
 */
export function expectsSeparateHarvestItem(enMap, seedPacketEn, seedPacketId) {
  if (!seedPacketEn || seedPacketId == null) return false

  let stem = ''
  if (seedPacketEn.endsWith(' Seeds')) {
    stem = seedPacketEn.slice(0, -6).trim()
  } else {
    const stripped = seedPacketEn
      .replace(/\s+Set$/i, '')
      .replace(/\s+Seeds?$/i, '')
      .trim()
    if (stripped !== seedPacketEn) stem = stripped
  }

  if (!stem) return true

  const plural = cropEnByPluralLastWord(enMap, stem)
  if (plural) {
    const pid = enMap.get(plural)
    if (pid != null && String(pid) !== String(seedPacketId)) return true
  }
  if (enMap.has(stem)) {
    const sid = enMap.get(stem)
    if (sid != null && String(sid) !== String(seedPacketId)) return true
  }
  const colorPrefix =
    /^(Red|Blue|Yellow|Green|Orange|Purple|White|Black|Rainbow)\s+/i

  if (stem.length >= 3) {
    for (const [en, id] of enMap) {
      if (String(id) === String(seedPacketId)) continue
      if (en === seedPacketEn) continue
      if (/\bDried\b/i.test(en)) continue
      if (/\bSeeds?\b$/i.test(en)) continue
      if (colorPrefix.test(en)) continue
      if (en.endsWith(stem) && en.length > stem.length) return true
    }
  }
  return false
}

export function twForId(twItems, id) {
  if (id == null) return null
  const row = twItems[String(id)]
  return row?.tw && typeof row.tw === 'string' ? row.tw.trim() : null
}

export function zhHansForId(zhItems, id) {
  if (id == null) return null
  const row = zhItems[String(id)]
  const z = row?.zh
  return typeof z === 'string' ? z.trim() : null
}

export function localeRow(items, twItems, zhItems, id, locale) {
  if (id == null) return ''
  const it = items[String(id)]
  if (locale === 'en') return (it?.en && String(it.en).trim()) || ''
  if (locale === 'ja') return (it?.ja && String(it.ja).trim()) || ''
  if (locale === 'zh-Hant') return twForId(twItems, id) || ''
  if (locale === 'zh-Hans') return zhHansForId(zhItems, id) || ''
  return ''
}

export function buildLocaleBundle(items, twItems, zhItems, id) {
  const locales = ['zh-Hant', 'en', 'ja', 'zh-Hans']
  const o = {}
  for (const loc of locales) {
    o[loc] = localeRow(items, twItems, zhItems, id, loc)
  }
  return o
}

export function buildNameSearchText(parts) {
  const set = new Set()
  for (const p of parts) {
    if (typeof p === 'string' && p.trim()) set.add(p.trim())
  }
  return [...set].join(' ')
}
