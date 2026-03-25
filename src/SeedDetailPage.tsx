import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSeedById, loadSeedNameSearchById } from './seedDataApi'
import type { ConfirmedCross, SeedRecord } from './seedDetailTypes'
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
          navigate('/')
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
  name: string | null
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
  displayName: string | null,
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

  const sorted = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => compareCross(a, b, sortKey, sortDir))
    return rows
  }, [filtered, sortKey, sortDir])

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
            {sorted.map((row, i) => (
              <tr key={i}>
                <td>
                  <SeedLink
                    seedId={row.parentA.seedId}
                    name={row.parentA.name}
                    growDays={row.parentA.growDays}
                  />
                </td>
                <td>
                  <SeedLink
                    seedId={row.parentB.seedId}
                    name={row.parentB.name}
                    growDays={row.parentB.growDays}
                  />
                </td>
                <td>
                  <SeedLink
                    seedId={row.alternate.seedId}
                    name={row.alternate.name}
                  />
                </td>
                <td>
                  <span
                    className={`seed-detail-eff seed-detail-eff--${row.efficiencyRating ?? 'none'}`}
                  >
                    {row.efficiency ?? '—'}
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
          <h1 className="seed-detail-title">{s.name}</h1>
        </div>
      </header>

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
              <dt>作物收成</dt>
              <dd>{s.cropYield ?? '—'}</dd>
            </div>
            <div className="seed-detail-dl-item">
              <dt>種子收成</dt>
              <dd>{s.seedYield ?? '—'}</dd>
            </div>
          </div>
        </dl>
      </section>

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
