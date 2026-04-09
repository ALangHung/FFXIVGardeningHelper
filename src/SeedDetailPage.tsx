import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CopyCropNameButton, CopyCropNameToast } from './CopyCropNameUi'
import {
  getSeedById,
  loadSeedNameSearchById,
  loadSeedsI18n,
  loadUniversalisMinPricesByItemId,
} from './seedDataApi'
import type {
  ConfirmedCross,
  CrossParent,
  SeedRecord,
} from './seedDetailTypes'
import type { SeedI18nEntry } from './seedI18nTypes'
import {
  type FlowerpotColorKey,
  cropNameZhFromEntry,
  fallbackFlowerpotCropLine,
  loadFlowerpotCropsByColor,
  type FlowerpotSeedColorEntry,
} from './flowerpotCropsByColor'
import { formatDurationEn, seedTypeLabelZh } from './seedFormat'
import './SeedDetailPage.css'
import { publicUrl } from './publicUrl'
import { SearchClearButton } from './SearchClearButton'
import { hasMarketAccess } from './marketAccess'
import { PriceSpinner } from './PriceSpinner'
import {
  getSeedDetailActiveSection,
  popSeedDetailPathForBack,
  recordSeedDetailForSection,
  seedDetailHref,
  type SeedDetailSection,
} from './sessionUiState'
import { SeedFavoriteHeartIcon } from './SeedFavoriteHeartIcon'
import {
  toggleSeedFavorite,
  useSeedFavoriteIds,
} from './seedFavorites'

const MARKET_ITEM_BASE = 'https://beherw.github.io/FFXIV_Market/item'

function iconSrc(seedId: number) {
  return publicUrl(`images/seed-icon/${seedId}.png`)
}

function marketItemUrl(itemId: number): string {
  return `${MARKET_ITEM_BASE}/${itemId}`
}

/** 資料裡無採集點時常為 null、空字串或 "--" */
function hasNodeLevelDisplay(value: string | null | undefined): boolean {
  if (value == null) return false
  const t = value.trim()
  if (!t) return false
  if (t === '--' || t === '—' || t === '-') return false
  return true
}

function formatHarvestLocation(value: string | null | undefined): string {
  if (value == null) return '—'
  const t = value.trim()
  if (!t) return '—'
  if (t === '素材商人（僅限盆栽）') return '素材商人'
  return t
}

/** 盆栽花種子（僅限盆栽）：顯示盆栽染色對照 */
function isFlowerpotExclusiveSeed(seed: SeedRecord): boolean {
  return seed.seedType === 'Flowerpot'
}

/** 肥料列 → flowerpot-crops-by-color.json 的 cropsByColor 鍵 */
const FLOWERPOT_DYE_ROW_DEFS: {
  fertilizer: string
  colors: FlowerpotColorKey[]
  randomColorNote?: boolean
}[] = [
  { fertilizer: '無肥料', colors: ['red'] },
  { fertilizer: '緋紅色油粕', colors: ['red'] },
  { fertilizer: '青藍色油粕', colors: ['blue'] },
  { fertilizer: '金黃色油粕', colors: ['yellow'] },
  { fertilizer: '青藍色油粕+金黃色油粕', colors: ['green'] },
  { fertilizer: '緋紅色油粕+金黃色油粕', colors: ['orange'] },
  { fertilizer: '緋紅色油粕+青藍色油粕', colors: ['purple'] },
  {
    fertilizer: '緋紅色油粕+青藍色油粕+金黃色油粕',
    colors: ['white', 'black', 'mixed'],
    randomColorNote: true,
  },
]

const FLOWERPOT_DYE_RANDOM_NOTE = '（隨機顏色）'

/** 單段或「青藍色油粕+金黃色油粕」等多段（每段右側複製） */
function FlowerpotFertilizerCell({
  fertilizer,
  onCopied,
}: {
  fertilizer: string
  onCopied: (copiedText: string) => void
}) {
  const parts = fertilizer
    .split('+')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (parts.length <= 1) {
    const text = parts[0] ?? fertilizer
    if (text === '無肥料') {
      return (
        <span className="seed-detail-dye-fertilizer-line">{text}</span>
      )
    }
    return (
      <div className="seed-detail-dye-copy-row">
        <span className="seed-detail-dye-fertilizer-line">{text}</span>
        <CopyCropNameButton
          name={text}
          className="seed-detail-dye-copy-btn"
          ariaLabel={`複製肥料：${text}`}
          title="複製"
          onCopied={(text) => onCopied(text)}
        />
      </div>
    )
  }
  return (
    <div className="seed-detail-dye-fertilizer-segments">
      {parts.map((part, i) => (
        <span
          key={`${part}-${i}`}
          className="seed-detail-dye-fertilizer-segment-item"
        >
          {i > 0 ? (
            <span className="seed-detail-dye-fertilizer-plus" aria-hidden>
              +
            </span>
          ) : null}
          <span className="seed-detail-dye-copy-row">
            <span className="seed-detail-dye-fertilizer-line">{part}</span>
            <CopyCropNameButton
              name={part}
              className="seed-detail-dye-copy-btn"
              ariaLabel={`複製肥料：${part}`}
              title="複製"
              onCopied={(text) => onCopied(text)}
            />
          </span>
        </span>
      ))}
    </div>
  )
}

function FlowerpotDyeSection({
  seedId,
  fallbackCropName,
  onCopied,
}: {
  seedId: number
  fallbackCropName: string
  onCopied: (copiedText: string) => void
}) {
  const [entry, setEntry] = useState<FlowerpotSeedColorEntry | null | undefined>(
    undefined,
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const payload = await loadFlowerpotCropsByColor()
        if (cancelled) return
        setEntry(payload.bySeedId[String(seedId)] ?? null)
      } catch {
        if (!cancelled) setEntry(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [seedId])

  function linesForColors(colors: FlowerpotColorKey[]): string[] {
    return colors.map((color) => {
      const fromJson = cropNameZhFromEntry(entry ?? undefined, color)
      return fromJson ?? fallbackFlowerpotCropLine(color, fallbackCropName)
    })
  }

  if (entry === undefined) {
    return (
      <section className="seed-detail-card">
        <h2 className="seed-detail-h2">染色詳情</h2>
        <p className="seed-detail-muted">載入染色資料中…</p>
      </section>
    )
  }

  return (
    <section className="seed-detail-card">
      <h2 className="seed-detail-h2">染色詳情</h2>
      <div className="seed-detail-table-wrap seed-detail-dye-table-wrap">
        <table className="seed-detail-table seed-detail-dye-table">
          <thead>
            <tr>
              <th scope="col">肥料</th>
              <th scope="col">染色結果</th>
            </tr>
          </thead>
          <tbody>
            {FLOWERPOT_DYE_ROW_DEFS.map((row) => {
              const lines = linesForColors(row.colors)
              const isTriple = row.colors.length === 3
              return (
                <tr key={row.fertilizer}>
                  <td>
                    {row.randomColorNote ? (
                      <div className="seed-detail-dye-fertilizer-stack">
                        <FlowerpotFertilizerCell
                          fertilizer={row.fertilizer}
                          onCopied={onCopied}
                        />
                        <span className="seed-detail-muted seed-detail-dye-fertilizer-sub">
                          {FLOWERPOT_DYE_RANDOM_NOTE}
                        </span>
                      </div>
                    ) : (
                      <FlowerpotFertilizerCell
                        fertilizer={row.fertilizer}
                        onCopied={onCopied}
                      />
                    )}
                  </td>
                  <td>
                    {isTriple ? (
                      <div className="seed-detail-dye-outcome-lines">
                        {lines.map((line, i) => (
                          <div
                            key={i}
                            className="seed-detail-dye-copy-row seed-detail-dye-outcome-copy-row"
                          >
                            <span>{line}</span>
                            <CopyCropNameButton
                              name={line}
                              className="seed-detail-dye-copy-btn"
                              ariaLabel={`複製染色結果：${line}`}
                              title="複製"
                              onCopied={onCopied}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="seed-detail-dye-copy-row seed-detail-dye-outcome-copy-row">
                        <span>{lines[0] ?? '—'}</span>
                        <CopyCropNameButton
                          name={lines[0] ?? '—'}
                          className="seed-detail-dye-copy-btn"
                          ariaLabel={`複製染色結果：${lines[0] ?? '—'}`}
                          title="複製"
                          onCopied={onCopied}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** 與畫面上作物／種子收成相同：多為「未使用 / 1–3 級黑森林土壤」以「 / 」分隔的數值。 */
function blackForestSoilYieldHintText(
  kind: 'crop' | 'seed',
  raw: string | null,
): string {
  const intro =
    kind === 'crop'
      ? '使用黑森林土壤會增加作物收成量'
      : '使用黑森林土壤會增加種子收成量'
  if (raw == null) return `${intro}\n—`
  const display = raw.trim()
  if (!display || display === '—' || display === '-' || display === '--')
    return `${intro}\n—`
  const parts = display
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (parts.length === 4) {
    return `${intro}\n未使用: ${parts[0]}\n1級: ${parts[1]}\n2級: ${parts[2]}\n3級: ${parts[3]}`
  }
  return `${intro}\n${display}`
}

function SeedDetailHelpHint({ text }: { text: string }) {
  return (
    <span
      className="seed-detail-help"
      tabIndex={0}
      aria-label={text}
    >
      <span aria-hidden className="seed-detail-help-mark">
        ?
      </span>
      <span className="seed-detail-help-tip" role="tooltip" aria-hidden="true">
        {text}
      </span>
    </span>
  )
}

function SeedDetailHeroPrice({
  label,
  kind,
  loading,
  data,
}: {
  label: string
  kind: 'crop' | 'seed'
  loading: boolean
  data: {
    seedItemId: number | null
    cropItemId: number | null
    seedMinPrice: number | null
    cropMinPrice: number | null
  } | null
}) {
  if (loading) {
    return (
      <span className="seed-detail-hero-price">
        <span className="seed-detail-hero-price-label">{label}</span>
        <PriceSpinner />
      </span>
    )
  }
  if (data == null) {
    return (
      <span className="seed-detail-hero-price">
        <span className="seed-detail-hero-price-label">{label}</span>
        <span className="seed-detail-hero-price-value">—</span>
      </span>
    )
  }
  if (kind === 'crop') {
    if (data.cropItemId == null) {
      return (
        <span className="seed-detail-hero-price">
          <span className="seed-detail-hero-price-label">{label}</span>
          <span className="seed-detail-hero-price-value seed-detail-hero-price-value--muted">
            不支援盆栽作物
          </span>
        </span>
      )
    }
    const text = formatMarketPrice(data.cropMinPrice)
    return (
      <span className="seed-detail-hero-price">
        <span className="seed-detail-hero-price-label">{label}</span>
        <a
          href={marketItemUrl(data.cropItemId)}
          target="_blank"
          rel="noreferrer"
          className="seed-detail-market-link seed-detail-hero-price-value"
        >
          {text}
        </a>
      </span>
    )
  }
  const text = formatMarketPrice(data.seedMinPrice)
  const inner =
    data.seedItemId != null ? (
      <a
        href={marketItemUrl(data.seedItemId)}
        target="_blank"
        rel="noreferrer"
        className="seed-detail-market-link seed-detail-hero-price-value"
      >
        {text}
      </a>
    ) : (
      <span className="seed-detail-hero-price-value">{text}</span>
    )
  return (
    <span className="seed-detail-hero-price">
      <span className="seed-detail-hero-price-label">{label}</span>
      {inner}
    </span>
  )
}

function SeedDetailFavoriteButton({ seedId }: { seedId: number }) {
  const favoriteIds = useSeedFavoriteIds()
  const on = favoriteIds.has(seedId)
  return (
    <button
      type="button"
      className={`seed-detail-favorite-btn${on ? ' seed-detail-favorite-btn--on' : ''}`}
      aria-pressed={on}
      aria-label={on ? '從最愛名單移除' : '加入最愛名單'}
      title={on ? '從最愛名單移除' : '加入最愛名單'}
      onClick={() => toggleSeedFavorite(seedId)}
    >
      <SeedFavoriteHeartIcon
        variant={on ? 'solid' : 'outline'}
        className="seed-detail-favorite-icon-svg"
      />
    </button>
  )
}

function SeedDetailBackNav({
  seedId,
  section,
}: {
  seedId?: number
  section: SeedDetailSection
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="seed-detail-back"
      onClick={() => {
        if (seedId != null && Number.isFinite(seedId) && seedId >= 1) {
          const r = popSeedDetailPathForBack(section, seedId)
          if (r.kind === 'main') {
            navigate(
              section === 'cross'
                ? '/cross'
                : section === 'fields'
                  ? '/fields'
                  : '/seeds',
            )
            return
          }
          navigate(`/seed/${r.seedId}`)
          return
        }
        if (typeof window !== 'undefined' && window.history.length > 1) {
          navigate(-1)
        } else {
          navigate(
            section === 'cross'
              ? '/cross'
              : section === 'fields'
                ? '/fields'
                : '/seeds',
          )
        }
      }}
    >
      ← 返回
    </button>
  )
}

function SeedLink({
  seedId,
  name,
  growDays,
  section,
}: {
  seedId: number | null
  name: string | null | undefined
  growDays?: number | null
  section: SeedDetailSection
}) {
  if (seedId == null || !name) return <span>—</span>
  const extra =
    growDays != null && Number.isFinite(growDays) ? ` (${growDays}天)` : ''
  return (
    <Link
      to={seedDetailHref(section, seedId)}
      className="seed-detail-link"
      onClick={() => recordSeedDetailForSection(section, seedId)}
    >
      {name}
      {extra}
    </Link>
  )
}

type CrossSortKey =
  | 'parentA'
  | 'aGrowDays'
  | 'aSeedPrice'
  | 'aCropPrice'
  | 'parentB'
  | 'bGrowDays'
  | 'bSeedPrice'
  | 'bCropPrice'
  | 'alternate'
  | 'altSeedPrice'
  | 'altCropPrice'
  | 'efficiency'

function normalizeQ(s: string) {
  return s.trim().toLowerCase()
}

function crossNameHaystack(
  seedId: number | null,
  displayName: string | null | undefined,
  searchById: Record<string, string>,
): string {
  const name = displayName != null ? String(displayName) : ''
  const extra =
    seedId != null && Number.isFinite(seedId)
      ? (searchById[String(seedId)] ?? '')
      : ''
  return normalizeQ(`${name} ${extra}`)
}

function rowMatchesQuery(
  row: ConfirmedCross,
  q: string,
  searchById: Record<string, string>,
) {
  if (!q.trim()) return true
  const n = normalizeQ(q)
  const hays = [
    crossNameHaystack(row.parentA.seedId, row.parentA.name, searchById),
    crossNameHaystack(row.parentB.seedId, row.parentB.name, searchById),
  ]
  return hays.some((hay) => hay.includes(n))
}

/** 有搜尋條件時：符合關鍵字的親本固定顯示在親本 A，另一親本在親本 B。 */
function orientParentsForSearchQuery(
  row: ConfirmedCross,
  q: string,
  searchById: Record<string, string>,
): { displayA: CrossParent; displayB: CrossParent } {
  const t = q.trim()
  if (!t) {
    return { displayA: row.parentA, displayB: row.parentB }
  }
  const n = normalizeQ(t)
  const hayA = crossNameHaystack(
    row.parentA.seedId,
    row.parentA.name,
    searchById,
  )
  const hayB = crossNameHaystack(
    row.parentB.seedId,
    row.parentB.name,
    searchById,
  )
  const aMatch = hayA.includes(n)
  const bMatch = hayB.includes(n)
  if (bMatch && !aMatch) {
    return { displayA: row.parentB, displayB: row.parentA }
  }
  return { displayA: row.parentA, displayB: row.parentB }
}

function parentSeedInFavorites(
  seedId: number | null,
  favoriteIds: ReadonlySet<number>,
): boolean {
  return seedId != null && favoriteIds.has(seedId)
}

/** 無搜尋時：若僅親本 B 為最愛，對調使最愛顯示於親本 A（僅 A 或兩者皆最愛則維持原序）。 */
function orientParentsForFavorites(
  row: ConfirmedCross,
  favoriteIds: ReadonlySet<number>,
): { displayA: CrossParent; displayB: CrossParent } {
  const fa = parentSeedInFavorites(row.parentA.seedId, favoriteIds)
  const fb = parentSeedInFavorites(row.parentB.seedId, favoriteIds)
  if (fb && !fa) {
    return { displayA: row.parentB, displayB: row.parentA }
  }
  return { displayA: row.parentA, displayB: row.parentB }
}

function orientParentsForDisplay(
  row: ConfirmedCross,
  q: string,
  searchById: Record<string, string>,
  favoriteIds: ReadonlySet<number>,
): { displayA: CrossParent; displayB: CrossParent } {
  if (q.trim()) {
    return orientParentsForSearchQuery(row, q, searchById)
  }
  return orientParentsForFavorites(row, favoriteIds)
}

type PreparedCrossRow = {
  row: ConfirmedCross
  displayA: CrossParent
  displayB: CrossParent
}

type CrossSeedPrice = {
  seedItemId: number | null
  seedMinPrice: number | null
  cropMinPrice: number | null
  cropItemId: number | null
}

function formatMarketPrice(price: number | null): string {
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return '交易版上沒資料'
  }
  return `${Math.round(price).toLocaleString('zh-Hant')} G`
}

function normalizeSortableMarketPrice(v: number | null): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null
  return v
}

function compareNullableNumber(
  av: number | null,
  bv: number | null,
  dir: 1 | -1,
): number {
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  return dir * (av - bv)
}

/** 列中親本 A／B 或「其他可能獲取的種子」任一為最愛則為 true（與畫面上顯示的親本方向一致） */
function preparedCrossRowInvolvesFavorite(
  item: PreparedCrossRow,
  favoriteIds: ReadonlySet<number>,
): boolean {
  const ids = [
    item.displayA.seedId,
    item.displayB.seedId,
    item.row.alternate.seedId,
  ]
  for (const id of ids) {
    if (id != null && favoriteIds.has(id)) return true
  }
  return false
}

function SeedCrossFavoriteHeart({
  seedId,
  favoriteIds,
}: {
  seedId: number | null
  favoriteIds: ReadonlySet<number>
}) {
  if (seedId == null || !favoriteIds.has(seedId)) return null
  return (
    <span
      className="seed-detail-cross-favorite-hint"
      title="已加入最愛名單"
      role="img"
      aria-label="已加入最愛名單"
    >
      <SeedFavoriteHeartIcon
        variant="solid"
        className="seed-detail-cross-favorite-hint-icon"
      />
    </span>
  )
}

function comparePreparedCross(
  a: PreparedCrossRow,
  b: PreparedCrossRow,
  key: CrossSortKey,
  dir: 1 | -1,
  priceBySeedId: Record<number, CrossSeedPrice>,
): number {
  const m = dir
  const seedValue = (seedId: number | null): number | null => {
    if (seedId == null) return null
    return normalizeSortableMarketPrice(priceBySeedId[seedId]?.seedMinPrice ?? null)
  }
  const cropValue = (seedId: number | null): number | null => {
    if (seedId == null) return null
    const p = priceBySeedId[seedId]
    if (!p || p.cropItemId == null) return null
    return normalizeSortableMarketPrice(p.cropMinPrice)
  }
  const growDaysValue = (growDays: number | null | undefined): number | null => {
    if (growDays == null || !Number.isFinite(growDays)) return null
    return growDays
  }
  switch (key) {
    case 'parentA':
      return (
        m *
        String(a.displayA.name ?? '').localeCompare(
          String(b.displayA.name ?? ''),
          'zh-Hant',
        )
      )
    case 'parentB':
      return (
        m *
        String(a.displayB.name ?? '').localeCompare(
          String(b.displayB.name ?? ''),
          'zh-Hant',
        )
      )
    case 'aGrowDays':
      return compareNullableNumber(
        growDaysValue(a.displayA.growDays),
        growDaysValue(b.displayA.growDays),
        m,
      )
    case 'bGrowDays':
      return compareNullableNumber(
        growDaysValue(a.displayB.growDays),
        growDaysValue(b.displayB.growDays),
        m,
      )
    case 'aSeedPrice':
      return compareNullableNumber(seedValue(a.displayA.seedId), seedValue(b.displayA.seedId), m)
    case 'aCropPrice':
      return compareNullableNumber(cropValue(a.displayA.seedId), cropValue(b.displayA.seedId), m)
    case 'bSeedPrice':
      return compareNullableNumber(seedValue(a.displayB.seedId), seedValue(b.displayB.seedId), m)
    case 'bCropPrice':
      return compareNullableNumber(cropValue(a.displayB.seedId), cropValue(b.displayB.seedId), m)
    case 'altSeedPrice':
      return compareNullableNumber(
        seedValue(a.row.alternate.seedId),
        seedValue(b.row.alternate.seedId),
        m,
      )
    case 'altCropPrice':
      return compareNullableNumber(
        cropValue(a.row.alternate.seedId),
        cropValue(b.row.alternate.seedId),
        m,
      )
    default:
      return compareCross(a.row, b.row, key, dir)
  }
}

function compareCross(
  a: ConfirmedCross,
  b: ConfirmedCross,
  key: CrossSortKey,
  dir: 1 | -1,
): number {
  const m = dir
  switch (key) {
    case 'parentA':
      return (
        m *
        String(a.parentA.name ?? '').localeCompare(
          String(b.parentA.name ?? ''),
          'zh-Hant',
        )
      )
    case 'parentB':
      return (
        m *
        String(a.parentB.name ?? '').localeCompare(
          String(b.parentB.name ?? ''),
          'zh-Hant',
        )
      )
    case 'alternate':
      return (
        m *
        String(a.alternate.name ?? '').localeCompare(
          String(b.alternate.name ?? ''),
          'zh-Hant',
        )
      )
    case 'efficiency': {
      const ae = a.efficiency
      const be = b.efficiency
      const av =
        ae != null && Number.isFinite(ae) ? ae : Number.NEGATIVE_INFINITY
      const bv =
        be != null && Number.isFinite(be) ? be : Number.NEGATIVE_INFINITY
      return m * (av - bv)
    }
    default:
      return 0
  }
}

function ConfirmedCrossesTable({
  seedId,
  crosses,
  marketEnabled,
  onSeedItemCopied,
  section,
}: {
  seedId: number
  crosses: ConfirmedCross[]
  marketEnabled: boolean
  onSeedItemCopied: (copiedText: string) => void
  section: SeedDetailSection
}) {
  const favoriteIds = useSeedFavoriteIds()
  const [query, setQuery] = useState('')
  const [nameSearchById, setNameSearchById] = useState<Record<string, string>>(
    {},
  )
  const [loopFilter, setLoopFilter] = useState<'all' | 'loop' | 'nonloop'>(
    'all',
  )
  const [sortKey, setSortKey] = useState<CrossSortKey>('efficiency')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [showCropPrice, setShowCropPrice] = useState(false)
  const [showSeedPrice, setShowSeedPrice] = useState(false)
  const [priceBySeedId, setPriceBySeedId] = useState<Record<number, CrossSeedPrice>>(
    {},
  )
  const [priceLoading, setPriceLoading] = useState(false)

  useEffect(() => {
    setQuery('')
    setLoopFilter('all')
    setSortKey('efficiency')
    setSortDir(-1)
    setShowCropPrice(false)
    setShowSeedPrice(false)
    setPriceBySeedId({})
  }, [seedId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const map = await loadSeedNameSearchById()
        if (!cancelled) setNameSearchById(map)
      } catch {
        if (!cancelled) setNameSearchById({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const crossSeedIds = useMemo(() => {
    const ids = new Set<number>()
    for (const row of crosses) {
      if (row.parentA.seedId != null) ids.add(row.parentA.seedId)
      if (row.parentB.seedId != null) ids.add(row.parentB.seedId)
      if (row.alternate.seedId != null) ids.add(row.alternate.seedId)
    }
    return [...ids]
  }, [crosses])

  useEffect(() => {
    if (!marketEnabled) {
      setPriceLoading(false)
      return
    }
    if (!showCropPrice && !showSeedPrice) {
      setPriceLoading(false)
      return
    }
    if (crossSeedIds.length === 0) {
      setPriceLoading(false)
      return
    }
    let cancelled = false
    setPriceLoading(true)
    ;(async () => {
      try {
        const i18n = await loadSeedsI18n()
        const bySeed = i18n.bySeedId ?? {}
        const itemIds: number[] = []
        for (const sid of crossSeedIds) {
          const e = bySeed[String(sid)] as SeedI18nEntry | undefined
          if (e?.seedItemId != null) itemIds.push(e.seedItemId)
          if (e?.cropItemId != null) itemIds.push(e.cropItemId)
        }
        const uniqItemIds = [...new Set(itemIds)]
        const minPrices = await loadUniversalisMinPricesByItemId(uniqItemIds)
        if (cancelled) return

        const next: Record<number, CrossSeedPrice> = {}
        for (const sid of crossSeedIds) {
          const e = bySeed[String(sid)] as SeedI18nEntry | undefined
          const seedItemId = e?.seedItemId ?? null
          const cropItemId = e?.cropItemId ?? null
          next[sid] = {
            seedItemId,
            seedMinPrice: seedItemId == null ? null : minPrices[seedItemId] ?? null,
            cropMinPrice: cropItemId == null ? null : minPrices[cropItemId] ?? null,
            cropItemId,
          }
        }
        setPriceBySeedId(next)
      } catch {
        if (!cancelled) setPriceBySeedId({})
      } finally {
        if (!cancelled) setPriceLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [crossSeedIds, showCropPrice, showSeedPrice, marketEnabled])

  useEffect(() => {
    if (!marketEnabled) {
      setShowCropPrice(false)
      setShowSeedPrice(false)
    }
  }, [marketEnabled])

  const filtered = useMemo(() => {
    return crosses.filter((row) => {
      if (!rowMatchesQuery(row, query, nameSearchById)) return false
      if (loopFilter === 'loop' && !row.isLoop) return false
      if (loopFilter === 'nonloop' && row.isLoop) return false
      return true
    })
  }, [crosses, query, loopFilter, nameSearchById])

  const prepared = useMemo(() => {
    return filtered.map((row) => {
      const { displayA, displayB } = orientParentsForDisplay(
        row,
        query,
        nameSearchById,
        favoriteIds,
      )
      return { row, displayA, displayB }
    })
  }, [filtered, query, nameSearchById, favoriteIds])

  const sorted = useMemo(() => {
    const rows = [...prepared]
    rows.sort((a, b) => {
      const fa = preparedCrossRowInvolvesFavorite(a, favoriteIds)
      const fb = preparedCrossRowInvolvesFavorite(b, favoriteIds)
      if (fa !== fb) return fa ? -1 : 1
      return comparePreparedCross(a, b, sortKey, sortDir, priceBySeedId)
    })
    return rows
  }, [prepared, sortKey, sortDir, priceBySeedId, favoriteIds])

  function toggleSort(key: CrossSortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(key)
      setSortDir(key === 'efficiency' ? -1 : 1)
    }
  }

  function sortLabel(key: CrossSortKey, label: string) {
    const active = sortKey === key
    return (
      <button
        type="button"
        className="seed-detail-th-btn"
        onClick={() => toggleSort(key)}
      >
        {label}
        {active ? (
          <span className="seed-detail-sort-glyph" aria-hidden>
            {sortDir === 1 ? '↑' : '↓'}
          </span>
        ) : null}
      </button>
    )
  }

  function seedPriceContent(seedId: number | null) {
    if (seedId == null) return '—'
    if (priceLoading) return <PriceSpinner />
    const price = priceBySeedId[seedId]
    if (!price) return '—'
    if (price.seedItemId == null) return formatMarketPrice(price.seedMinPrice)
    return (
      <a
        href={marketItemUrl(price.seedItemId)}
        target="_blank"
        rel="noreferrer"
        className="seed-detail-market-link"
      >
        {formatMarketPrice(price.seedMinPrice)}
      </a>
    )
  }

  function cropPriceContent(seedId: number | null) {
    if (seedId == null) return '—'
    if (priceLoading) return <PriceSpinner />
    const price = priceBySeedId[seedId]
    if (!price) return '—'
    if (price.cropItemId == null) return '不支援盆栽作物'
    return (
      <a
        href={marketItemUrl(price.cropItemId)}
        target="_blank"
        rel="noreferrer"
        className="seed-detail-market-link"
      >
        {formatMarketPrice(price.cropMinPrice)}
      </a>
    )
  }

  return (
    <>
      <div className="seed-detail-cross-toolbar">
        <label className="seed-detail-cross-field">
          <span className="seed-detail-cross-label">親本</span>
          <div className="seed-detail-cross-input-wrap">
            <input
              type="search"
              className={`seed-detail-cross-input${query ? ' seed-detail-cross-input--with-clear' : ''}`}
              placeholder="親本 A 或親本 B"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {query ? (
              <SearchClearButton onClear={() => setQuery('')} />
            ) : null}
          </div>
        </label>
        <label className="seed-detail-cross-field">
          <span className="seed-detail-cross-label">迴圈</span>
          <select
            className="seed-detail-cross-select"
            value={loopFilter}
            onChange={(e) =>
              setLoopFilter(e.target.value as 'all' | 'loop' | 'nonloop')
            }
          >
            <option value="all">全部</option>
            <option value="loop">迴圈</option>
            <option value="nonloop">非迴圈</option>
          </select>
        </label>
        {marketEnabled ? (
          <div className="seed-detail-cross-toggle-group">
            <button
              type="button"
              className={`seed-detail-cross-toggle-btn${showCropPrice ? ' is-on' : ''}`}
              onClick={() => setShowCropPrice((v) => !v)}
            >
              顯示作物價格
            </button>
            <button
              type="button"
              className={`seed-detail-cross-toggle-btn${showSeedPrice ? ' is-on' : ''}`}
              onClick={() => setShowSeedPrice((v) => !v)}
            >
              顯示種子價格
            </button>
          </div>
        ) : null}
        <p className="seed-detail-cross-meta">
          顯示 <strong>{sorted.length}</strong> / {crosses.length} 筆
        </p>
      </div>

      <div className="seed-detail-table-wrap">
        <table className="seed-detail-table">
          <thead>
            <tr>
              <th>{sortLabel('parentA', '親本 A')}</th>
              <th>{sortLabel('aGrowDays', '收成天數')}</th>
              {showSeedPrice ? <th>{sortLabel('aSeedPrice', '種子最低價')}</th> : null}
              {showCropPrice ? <th>{sortLabel('aCropPrice', '作物最低價')}</th> : null}
              <th>{sortLabel('parentB', '親本 B')}</th>
              <th>{sortLabel('bGrowDays', '收成天數')}</th>
              {showSeedPrice ? <th>{sortLabel('bSeedPrice', '種子最低價')}</th> : null}
              {showCropPrice ? <th>{sortLabel('bCropPrice', '作物最低價')}</th> : null}
              <th>{sortLabel('alternate', '其他可能獲取的種子')}</th>
              {showSeedPrice ? <th>{sortLabel('altSeedPrice', '種子最低價')}</th> : null}
              {showCropPrice ? <th>{sortLabel('altCropPrice', '作物最低價')}</th> : null}
              <th>{sortLabel('efficiency', '效率')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr key={i}>
                <td>
                  <div className="seed-detail-cross-name-row">
                    <SeedLink
                      seedId={item.displayA.seedId}
                      name={item.displayA.name}
                      section={section}
                    />
                    {item.displayA.seedId != null &&
                    item.displayA.seedItemName ? (
                      <CopyCropNameButton
                        name={item.displayA.seedItemName}
                        className="seed-detail-cross-copy-btn"
                        ariaLabel={`複製種子名稱：${item.displayA.seedItemName}`}
                        title="複製種子名稱"
                        onCopied={(text) => onSeedItemCopied(text)}
                      />
                    ) : null}
                    <SeedCrossFavoriteHeart
                      seedId={item.displayA.seedId}
                      favoriteIds={favoriteIds}
                    />
                  </div>
                </td>
                <td className="seed-detail-cross-price-cell">
                  {item.displayA.growDays != null ? `${item.displayA.growDays}天` : '—'}
                </td>
                {showSeedPrice ? (
                  <td className="seed-detail-cross-price-cell">
                    {seedPriceContent(item.displayA.seedId)}
                  </td>
                ) : null}
                {showCropPrice ? (
                  <td className="seed-detail-cross-price-cell">
                    {cropPriceContent(item.displayA.seedId)}
                  </td>
                ) : null}
                <td>
                  <div className="seed-detail-cross-name-row">
                    <SeedLink
                      seedId={item.displayB.seedId}
                      name={item.displayB.name}
                      section={section}
                    />
                    {item.displayB.seedId != null &&
                    item.displayB.seedItemName ? (
                      <CopyCropNameButton
                        name={item.displayB.seedItemName}
                        className="seed-detail-cross-copy-btn"
                        ariaLabel={`複製種子名稱：${item.displayB.seedItemName}`}
                        title="複製種子名稱"
                        onCopied={(text) => onSeedItemCopied(text)}
                      />
                    ) : null}
                    <SeedCrossFavoriteHeart
                      seedId={item.displayB.seedId}
                      favoriteIds={favoriteIds}
                    />
                  </div>
                </td>
                <td className="seed-detail-cross-price-cell">
                  {item.displayB.growDays != null ? `${item.displayB.growDays}天` : '—'}
                </td>
                {showSeedPrice ? (
                  <td className="seed-detail-cross-price-cell">
                    {seedPriceContent(item.displayB.seedId)}
                  </td>
                ) : null}
                {showCropPrice ? (
                  <td className="seed-detail-cross-price-cell">
                    {cropPriceContent(item.displayB.seedId)}
                  </td>
                ) : null}
                <td>
                  <div className="seed-detail-cross-name-row">
                    <SeedLink
                      seedId={item.row.alternate.seedId}
                      name={item.row.alternate.name}
                      section={section}
                    />
                    {item.row.alternate.seedId != null &&
                    item.row.alternate.seedItemName ? (
                      <CopyCropNameButton
                        name={item.row.alternate.seedItemName}
                        className="seed-detail-cross-copy-btn"
                        ariaLabel={`複製種子名稱：${item.row.alternate.seedItemName}`}
                        title="複製種子名稱"
                        onCopied={(text) => onSeedItemCopied(text)}
                      />
                    ) : null}
                    <SeedCrossFavoriteHeart
                      seedId={item.row.alternate.seedId}
                      favoriteIds={favoriteIds}
                    />
                  </div>
                </td>
                {showSeedPrice ? (
                  <td className="seed-detail-cross-price-cell">
                    {seedPriceContent(item.row.alternate.seedId)}
                  </td>
                ) : null}
                {showCropPrice ? (
                  <td className="seed-detail-cross-price-cell">
                    {cropPriceContent(item.row.alternate.seedId)}
                  </td>
                ) : null}
                <td>
                  <span
                    className={`seed-detail-eff seed-detail-eff--${item.row.efficiencyRating ?? 'none'}`}
                  >
                    {item.row.efficiency ?? '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <p className="seed-detail-muted">沒有符合篩選條件的配方。</p>
      )}
    </>
  )
}

export function SeedDetailPage() {
  const { seedId: rawId } = useParams()
  const section = getSeedDetailActiveSection()
  const [seed, setSeed] = useState<SeedRecord | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [marketEnabled, setMarketEnabled] = useState(false)
  const [heroMarket, setHeroMarket] = useState<{
    seedItemId: number | null
    cropItemId: number | null
    seedMinPrice: number | null
    cropMinPrice: number | null
  } | null>(null)
  const [heroMarketLoading, setHeroMarketLoading] = useState(false)
  const [copyToast, setCopyToast] = useState<{
    key: number
    message: string
  } | null>(null)

  const idNum = rawId ? Number.parseInt(rawId, 10) : Number.NaN

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const enabled = await hasMarketAccess()
      if (!cancelled) setMarketEnabled(enabled)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!marketEnabled) {
      setHeroMarket(null)
      setHeroMarketLoading(false)
      return
    }
    if (seed == null) {
      setHeroMarket(null)
      setHeroMarketLoading(false)
      return
    }
    let cancelled = false
    setHeroMarket(null)
    setHeroMarketLoading(true)
    ;(async () => {
      try {
        const i18n = await loadSeedsI18n()
        if (cancelled) return
        const e = i18n.bySeedId[String(seed.seedId)] as SeedI18nEntry | undefined
        const seedItemId = e?.seedItemId ?? null
        const cropItemId = e?.cropItemId ?? null
        const ids = [seedItemId, cropItemId].filter(
          (x): x is number => x != null,
        )
        if (ids.length === 0) {
          setHeroMarket({
            seedItemId,
            cropItemId,
            seedMinPrice: null,
            cropMinPrice: null,
          })
          return
        }
        const minPrices = await loadUniversalisMinPricesByItemId(ids)
        if (cancelled) return
        setHeroMarket({
          seedItemId,
          cropItemId,
          seedMinPrice:
            seedItemId == null ? null : minPrices[seedItemId] ?? null,
          cropMinPrice:
            cropItemId == null ? null : minPrices[cropItemId] ?? null,
        })
      } catch {
        if (!cancelled) setHeroMarket(null)
      } finally {
        if (!cancelled) setHeroMarketLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [marketEnabled, seed])

  useEffect(() => {
    let cancelled = false
    if (!Number.isFinite(idNum) || idNum < 1) {
      setSeed(null)
      return
    }
    setError(null)
    setSeed(undefined)
    ;(async () => {
      try {
        const s = await getSeedById(idNum)
        if (!cancelled) setSeed(s)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idNum])

  if (!Number.isFinite(idNum) || idNum < 1) {
    return (
      <div className="seed-detail-page">
        <p className="seed-detail-error">無效的種子編號。</p>
        <SeedDetailBackNav section={section} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="seed-detail-page">
        <p className="seed-detail-error">{error}</p>
        <SeedDetailBackNav seedId={idNum} section={section} />
      </div>
    )
  }

  if (seed === undefined) {
    return (
      <div className="seed-detail-page">
        <p className="seed-detail-muted">載入中…</p>
      </div>
    )
  }

  if (seed === null) {
    return (
      <div className="seed-detail-page">
        <p className="seed-detail-error">找不到此種子。</p>
        <SeedDetailBackNav seedId={idNum} section={section} />
      </div>
    )
  }

  const s = seed
  const showSeedSubline =
    s.seedItemName.trim() !== '' && s.seedItemName.trim() !== s.name.trim()

  return (
    <div className="seed-detail-page">
      <nav className="seed-detail-nav">
        <SeedDetailBackNav seedId={s.seedId} section={section} />
        <SeedDetailFavoriteButton seedId={s.seedId} />
      </nav>

      <header className="seed-detail-hero">
        <img
          src={iconSrc(s.seedId)}
          alt=""
          width={80}
          height={80}
          className="seed-detail-hero-icon"
        />
        <div>
          <div className="seed-detail-title-row">
            <h1 className="seed-detail-title">{s.name}</h1>
            <CopyCropNameButton
              name={s.name}
              onCopied={(text) =>
                setCopyToast({
                  key: Date.now(),
                  message: `已複製作物名稱：${text}`,
                })
              }
            />
            {marketEnabled ? (
              <div className="seed-detail-hero-price-row">
                <SeedDetailHeroPrice
                  label="作物最低價"
                  kind="crop"
                  loading={heroMarketLoading}
                  data={heroMarket}
                />
              </div>
            ) : null}
          </div>
          {showSeedSubline ? (
            <div className="seed-detail-seed-subrow">
              <span className="seed-detail-seed-sub">
                種子：{s.seedItemName}
              </span>
              <CopyCropNameButton
                name={s.seedItemName}
                ariaLabel={`複製種子名稱：${s.seedItemName}`}
                title="複製種子名稱"
                onCopied={(text) =>
                  setCopyToast({
                    key: Date.now(),
                    message: `已複製種子名稱：${text}`,
                  })
                }
              />
              {marketEnabled ? (
                <SeedDetailHeroPrice
                  label="種子最低價"
                  kind="seed"
                  loading={heroMarketLoading}
                  data={heroMarket}
                />
              ) : null}
            </div>
          ) : marketEnabled ? (
            <div className="seed-detail-seed-subrow seed-detail-seed-subrow--hero-seed-price-only">
              <SeedDetailHeroPrice
                label="種子最低價"
                kind="seed"
                loading={heroMarketLoading}
                data={heroMarket}
              />
            </div>
          ) : null}
        </div>
      </header>

      <CopyCropNameToast
        toastKey={copyToast?.key ?? null}
        message={copyToast?.message}
        onDismiss={() => setCopyToast(null)}
      />

      <section className="seed-detail-card">
        <h2 className="seed-detail-h2">基本資訊</h2>
        <dl className="seed-detail-dl">
          <div className="seed-detail-dl-row seed-detail-dl-row--4">
            <div className="seed-detail-dl-item seed-detail-dl-item--type">
              <dt>種子類型</dt>
              <dd>{seedTypeLabelZh(s.seedType)}</dd>
            </div>
            <div className="seed-detail-dl-item seed-detail-dl-item--location">
              <dt>獲取地點</dt>
              <dd>{formatHarvestLocation(s.harvestLocation)}</dd>
            </div>
            {hasNodeLevelDisplay(s.nodeLevel) ? (
              <div className="seed-detail-dl-item seed-detail-dl-item--node-level">
                <dt>採集等級</dt>
                <dd>{s.nodeLevel}</dd>
              </div>
            ) : null}
          </div>
          <div className="seed-detail-dl-row seed-detail-dl-row--4">
            <div className="seed-detail-dl-item">
              <dt className="seed-detail-dt-with-help">
                <span>生長時間</span>
                <SeedDetailHelpHint text="種子種下後，在沒有施肥的情況下多久可以收成。" />
              </dt>
              <dd>{formatDurationEn(s.growTime)}</dd>
            </div>
            <div className="seed-detail-dl-item">
              <dt className="seed-detail-dt-with-help">
                <span>枯萎時間</span>
                <SeedDetailHelpHint text='種子種下後，經過多久時間沒有"護理"作物會枯萎，每次"護理"後會重新計算枯萎時間。' />
              </dt>
              <dd>{formatDurationEn(s.wiltTime)}</dd>
            </div>
            <div className="seed-detail-dl-item">
              <dt className="seed-detail-dt-with-help">
                <span>作物收成</span>
                <SeedDetailHelpHint
                  text={blackForestSoilYieldHintText('crop', s.cropYield)}
                />
              </dt>
              <dd>{s.cropYield ?? '—'}</dd>
            </div>
            <div className="seed-detail-dl-item">
              <dt className="seed-detail-dt-with-help">
                <span>種子收成</span>
                <SeedDetailHelpHint
                  text={blackForestSoilYieldHintText('seed', s.seedYield)}
                />
              </dt>
              <dd>{s.seedYield ?? '—'}</dd>
            </div>
          </div>
        </dl>
      </section>

      {isFlowerpotExclusiveSeed(s) ? (
        <FlowerpotDyeSection
          seedId={s.seedId}
          fallbackCropName={s.name}
          onCopied={(text) =>
            setCopyToast({
              key: Date.now(),
              message: `已複製：${text}`,
            })
          }
        />
      ) : null}

      <section className="seed-detail-card">
        <h2 className="seed-detail-h2">雜交獲取表</h2>
        {s.notObtainableViaIntercrossing ? (
          <p className="seed-detail-muted">此種子無法透過雜交取得。</p>
        ) : null}
        {s.confirmedCrosses.length > 0 ? (
          <ConfirmedCrossesTable
            seedId={s.seedId}
            crosses={s.confirmedCrosses}
            marketEnabled={marketEnabled}
            section={section}
            onSeedItemCopied={(text) =>
              setCopyToast({
                key: Date.now(),
                message: `已複製種子名稱：${text}`,
              })
            }
          />
        ) : !s.notObtainableViaIntercrossing ? (
          <p className="seed-detail-muted">無確認雜交配方。</p>
        ) : null}
      </section>

      {s.usedInOtherCrosses.length > 0 ? (
        <section className="seed-detail-card">
          <h2 className="seed-detail-h2">可用於其他雜交配方</h2>
          <ul className="seed-detail-used">
            {s.usedInOtherCrosses.map((u) => (
              <li key={u.seedId}>
                <Link
                  to={seedDetailHref(section, u.seedId)}
                  className="seed-detail-used-item"
                  onClick={() => recordSeedDetailForSection(section, u.seedId)}
                >
                  <img
                    src={iconSrc(u.seedId)}
                    alt=""
                    width={24}
                    height={24}
                    className="seed-detail-used-icon"
                  />
                  <span>{u.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
