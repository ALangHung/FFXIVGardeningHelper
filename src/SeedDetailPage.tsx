import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CopyCropNameButton, CopyCropNameToast } from './CopyCropNameUi'
import { getSeedById, loadSeedNameSearchById } from './seedDataApi'
import type {
  ConfirmedCross,
  CrossParent,
  SeedRecord,
} from './seedDetailTypes'
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

function iconSrc(seedId: number) {
  return publicUrl(`images/seed-icon/${seedId}.png`)
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

function BlackForestSoilYieldHint({ text }: { text: string }) {
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

function SeedDetailBackNav() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="seed-detail-back"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          navigate(-1)
        } else {
          navigate('/seeds')
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
}: {
  seedId: number | null
  name: string | null | undefined
  growDays?: number | null
}) {
  if (seedId == null || !name) return <span>—</span>
  const extra =
    growDays != null && Number.isFinite(growDays) ? ` (${growDays}天)` : ''
  return (
    <Link to={`/seed/${seedId}`} className="seed-detail-link">
      {name}
      {extra}
    </Link>
  )
}

type CrossSortKey = 'parentA' | 'parentB' | 'alternate' | 'efficiency'

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

type PreparedCrossRow = {
  row: ConfirmedCross
  displayA: CrossParent
  displayB: CrossParent
}

function comparePreparedCross(
  a: PreparedCrossRow,
  b: PreparedCrossRow,
  key: CrossSortKey,
  dir: 1 | -1,
): number {
  const m = dir
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
}: {
  seedId: number
  crosses: ConfirmedCross[]
}) {
  const [query, setQuery] = useState('')
  const [nameSearchById, setNameSearchById] = useState<Record<string, string>>(
    {},
  )
  const [loopFilter, setLoopFilter] = useState<'all' | 'loop' | 'nonloop'>(
    'all',
  )
  const [sortKey, setSortKey] = useState<CrossSortKey>('efficiency')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)

  useEffect(() => {
    setQuery('')
    setLoopFilter('all')
    setSortKey('efficiency')
    setSortDir(-1)
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
      const { displayA, displayB } = orientParentsForSearchQuery(
        row,
        query,
        nameSearchById,
      )
      return { row, displayA, displayB }
    })
  }, [filtered, query, nameSearchById])

  const sorted = useMemo(() => {
    const rows = [...prepared]
    rows.sort((a, b) => comparePreparedCross(a, b, sortKey, sortDir))
    return rows
  }, [prepared, sortKey, sortDir])

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
        <p className="seed-detail-cross-meta">
          顯示 <strong>{sorted.length}</strong> / {crosses.length} 筆
        </p>
      </div>

      <div className="seed-detail-table-wrap">
        <table className="seed-detail-table">
          <thead>
            <tr>
              <th>{sortLabel('parentA', '親本 A')}</th>
              <th>{sortLabel('parentB', '親本 B')}</th>
              <th>{sortLabel('alternate', '其他可能獲取的種子')}</th>
              <th>{sortLabel('efficiency', '效率')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr key={i}>
                <td>
                  <SeedLink
                    seedId={item.displayA.seedId}
                    name={item.displayA.name}
                    growDays={item.displayA.growDays}
                  />
                </td>
                <td>
                  <SeedLink
                    seedId={item.displayB.seedId}
                    name={item.displayB.name}
                    growDays={item.displayB.growDays}
                  />
                </td>
                <td>
                  <SeedLink
                    seedId={item.row.alternate.seedId}
                    name={item.row.alternate.name}
                  />
                </td>
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
  const [seed, setSeed] = useState<SeedRecord | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [copyToast, setCopyToast] = useState<{
    key: number
    message: string
  } | null>(null)

  const idNum = rawId ? Number.parseInt(rawId, 10) : Number.NaN

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
        <SeedDetailBackNav />
      </div>
    )
  }

  if (error) {
    return (
      <div className="seed-detail-page">
        <p className="seed-detail-error">{error}</p>
        <SeedDetailBackNav />
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
        <SeedDetailBackNav />
      </div>
    )
  }

  const s = seed
  const showSeedSubline =
    s.seedItemName.trim() !== '' && s.seedItemName.trim() !== s.name.trim()

  return (
    <div className="seed-detail-page">
      <nav className="seed-detail-nav">
        <SeedDetailBackNav />
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
              <dt>生長時間</dt>
              <dd>{formatDurationEn(s.growTime)}</dd>
            </div>
            <div className="seed-detail-dl-item">
              <dt>枯萎時間</dt>
              <dd>{formatDurationEn(s.wiltTime)}</dd>
            </div>
            <div className="seed-detail-dl-item">
              <dt className="seed-detail-dt-with-help">
                <span>作物收成</span>
                <BlackForestSoilYieldHint
                  text={blackForestSoilYieldHintText('crop', s.cropYield)}
                />
              </dt>
              <dd>{s.cropYield ?? '—'}</dd>
            </div>
            <div className="seed-detail-dl-item">
              <dt className="seed-detail-dt-with-help">
                <span>種子收成</span>
                <BlackForestSoilYieldHint
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
          <ConfirmedCrossesTable seedId={s.seedId} crosses={s.confirmedCrosses} />
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
                  to={`/seed/${u.seedId}`}
                  className="seed-detail-used-item"
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
