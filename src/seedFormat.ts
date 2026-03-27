/** 網站英文種類 → 繁體顯示（對照參考介面） */
export const SEED_TYPE_ZH: Record<string, string> = {
  Fruit: '水果',
  Vegetable: '蔬菜',
  'Herb & Nut': '藥草／堅果',
  'Chocobo Food': '陸行鳥飼料',
  'Deluxe Fruit': '高級水果',
  'Deluxe Herb & Nut': '高級藥草／堅果',
  'Deluxe Vegetable': '高級蔬菜',
  Minion: '寵物',
  Flowerpot: '盆栽花',
  Elemental: '元素',
}

export function seedTypeLabelZh(en: string | null): string {
  if (!en) return '—'
  return SEED_TYPE_ZH[en] ?? en
}

/** 生長／枯萎時間：英文 → 繁體簡短顯示 */
export function formatDurationEn(en: string | null): string {
  if (!en) return '—'
  const t = en.trim()
  const day = t.match(/^(\d+)\s*Days?$/i)
  if (day) return `${day[1]} 天`
  const hour = t.match(/^(\d+)\s*Hours?$/i)
  if (hour) return `${hour[1]} 小時`
  const sec = t.match(/^(\d+)\s*Seconds?$/i)
  if (sec) return `${sec[1]} 秒`
  return t
}

export function durationToSortHours(en: string | null): number {
  if (!en) return Number.POSITIVE_INFINITY
  const t = en.trim()
  const sec = t.match(/^(\d+)\s*Seconds?$/i)
  if (sec) return Number.parseInt(sec[1], 10) / 3600
  const hour = t.match(/^(\d+)\s*Hours?$/i)
  if (hour) return Number.parseInt(hour[1], 10)
  const day = t.match(/^(\d+)\s*Days?$/i)
  if (day) return Number.parseInt(day[1], 10) * 24
  return Number.POSITIVE_INFINITY
}

export function nodeLevelToNumber(nodeLevel: string | null): number {
  if (!nodeLevel) return Number.NaN
  const n = Number.parseInt(nodeLevel, 10)
  return Number.isFinite(n) ? n : Number.NaN
}

export type DhmsParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** 將毫秒轉成天／時／分／秒（非負整數；毫秒無條件捨去）。 */
export function msToDhms(ms: number): DhmsParts {
  let sec = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(sec / 86400)
  sec %= 86400
  const hours = Math.floor(sec / 3600)
  sec %= 3600
  const minutes = Math.floor(sec / 60)
  const seconds = sec % 60
  return { days, hours, minutes, seconds }
}

/** 天／時／分／秒（非負整數）合計為毫秒。 */
export function dhmsToMs(
  days: number,
  hours: number,
  minutes: number,
  seconds: number,
): number {
  const d = Math.max(0, Math.floor(Number(days) || 0))
  const h = Math.max(0, Math.floor(Number(hours) || 0))
  const m = Math.max(0, Math.floor(Number(minutes) || 0))
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  return (d * 86400 + h * 3600 + m * 60 + s) * 1000
}
