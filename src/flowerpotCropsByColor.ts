import { publicUrl } from './publicUrl'

export type FlowerpotColorKey =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'green'
  | 'orange'
  | 'purple'
  | 'white'
  | 'black'
  | 'mixed'

export type FlowerpotCropNames = {
  'zh-Hant': string
  en: string
  ja: string
  'zh-Hans': string
}

export type FlowerpotCropByColor = {
  teamcraftItemId: string
  names: FlowerpotCropNames
}

export type FlowerpotSeedColorEntry = {
  seedId: number
  seedItem: FlowerpotCropNames
  cropsByColor: Partial<Record<FlowerpotColorKey, FlowerpotCropByColor>>
}

export type FlowerpotCropsByColorPayload = {
  meta: Record<string, unknown>
  bySeedId: Record<string, FlowerpotSeedColorEntry>
}

let cache: FlowerpotCropsByColorPayload | null = null
let loading: Promise<FlowerpotCropsByColorPayload> | null = null

export async function loadFlowerpotCropsByColor(): Promise<FlowerpotCropsByColorPayload> {
  if (cache) return cache
  if (!loading) {
    loading = (async () => {
      const res = await fetch(publicUrl('data/flowerpot-crops-by-color.json'))
      if (!res.ok)
        throw new Error(`無法載入盆栽染色資料 (${res.status})`)
      const data = (await res.json()) as FlowerpotCropsByColorPayload
      cache = data
      return data
    })()
  }
  return loading
}

export function clearFlowerpotCropsByColorCache() {
  cache = null
  loading = null
}

const COLOR_PREFIX_FALLBACK: Record<FlowerpotColorKey, string> = {
  red: '紅色',
  blue: '藍色',
  yellow: '黃色',
  green: '綠色',
  orange: '橙色',
  purple: '紫色',
  white: '白色',
  black: '黑色',
  mixed: '混色',
}

/** JSON 缺漏時沿用「顏色前綴 + 作物顯示名」 */
export function fallbackFlowerpotCropLine(
  color: FlowerpotColorKey,
  cropDisplayName: string,
): string {
  return `${COLOR_PREFIX_FALLBACK[color]}${cropDisplayName}`
}

export function cropNameZhFromEntry(
  entry: FlowerpotSeedColorEntry | undefined,
  color: FlowerpotColorKey,
): string | null {
  const raw = entry?.cropsByColor?.[color]?.names?.['zh-Hant']
  if (raw == null) return null
  const t = String(raw).trim()
  return t.length > 0 ? t : null
}
