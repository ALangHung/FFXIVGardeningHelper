import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { SeedSummary, SeedsSummaryPayload } from './seedSummaryTypes'
import { publicUrl } from './publicUrl'
import { SearchClearButton } from './SearchClearButton'
import {
  loadSeedListUiState,
  saveSeedListUiState,
  type SeedListSortKey,
} from './sessionUiState'
import { durationToSortHours, formatDurationEn } from './seedFormat'
import './SeedListPage.css'

type SortKey = SeedListSortKey

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function growTimeToHours(label: string): number {
  return durationToSortHours(label)
}

function sortedGrowOptions(seeds: SeedSummary[]): string[] {
  const set = new Set<string>()
  for (const s of seeds) {
    if (s.growTime) set.add(s.growTime)
  }
  return [...set].sort((a, b) => growTimeToHours(a) - growTimeToHours(b))
}

function compareRows(
  a: SeedSummary,
  b: SeedSummary,
  key: SortKey,
  dir: 1 | -1,
): number {
  const m = dir
  switch (key) {
    case 'name':
      return m * a.name.localeCompare(b.name, 'zh-Hant')
    case 'growTime':
      return (
        m *
        (durationToSortHours(a.growTime) - durationToSortHours(b.growTime))
      )
    case 'harvestLocation': {
      const sa = a.harvestLocation ?? ''
      const sb = b.harvestLocation ?? ''
      return m * sa.localeCompare(sb)
    }
    default:
      return 0
  }
}

export function SeedListPage() {
  const [persistedList] = useState(() => loadSeedListUiState())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeds, setSeeds] = useState<SeedSummary[]>([])

  const [nameQuery, setNameQuery] = useState(
    () => persistedList?.nameQuery ?? '',
  )
  const [growTime, setGrowTime] = useState(
    () => persistedList?.growTime ?? '',
  )
  const [locationQuery, setLocationQuery] = useState(
    () => persistedList?.locationQuery ?? '',
  )

  const [sortKey, setSortKey] = useState<SortKey>(
    () => persistedList?.sortKey ?? 'name',
  )
  const [sortDir, setSortDir] = useState<1 | -1>(
    () => persistedList?.sortDir ?? 1,
  )

  useEffect(() => {
    saveSeedListUiState({
      nameQuery,
      growTime,
      locationQuery,
      sortKey,
      sortDir,
    })
  }, [nameQuery, growTime, locationQuery, sortKey, sortDir])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(publicUrl('data/seeds-summary.json'))
        if (!res.ok) throw new Error(`載入失敗 ${res.status}`)
        const data = (await res.json()) as SeedsSummaryPayload
        if (!cancelled) setSeeds(data.seeds ?? [])
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const growOptions = useMemo(() => sortedGrowOptions(seeds), [seeds])

  const filtered = useMemo(() => {
    const nq = normalize(nameQuery)
    const lq = normalize(locationQuery)
    return seeds.filter((s) => {
      if (nq) {
        const hay = normalize(s.nameSearchText ?? s.name)
        if (!hay.includes(nq)) return false
      }
      if (growTime && s.growTime !== growTime) return false
      if (lq && !normalize(s.harvestLocation ?? '').includes(lq)) return false
      return true
    })
  }, [seeds, nameQuery, growTime, locationQuery])

  const sortedRows = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => compareRows(a, b, sortKey, sortDir))
    return rows
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  return (
    <div className="seed-list-page">
      <header className="seed-list-header">
        <h1 className="seed-page-title">種子列表</h1>
        <p className="seed-list-sub">
          共 {seeds.length} 筆 · 篩選後 {filtered.length} 筆
        </p>
      </header>

      {loading && <p className="seed-list-status">載入中…</p>}
      {error && (
        <p className="seed-list-status seed-list-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="seed-table-shell">
          <div className="seed-table-scroll">
            <table className="seed-table">
              <colgroup>
                <col className="seed-col-name" />
                <col className="seed-col-grow" />
                <col className="seed-col-loc" />
              </colgroup>
              <thead>
                <tr className="seed-table-head-row">
                  <th scope="col" className="seed-th seed-th-name">
                    <button
                      type="button"
                      className="seed-th-btn"
                      onClick={() => toggleSort('name')}
                    >
                      種子名稱
                      <SortGlyph active={sortKey === 'name'} dir={sortDir} />
                    </button>
                  </th>
                  <th scope="col" className="seed-th seed-th-grow">
                    <button
                      type="button"
                      className="seed-th-btn"
                      onClick={() => toggleSort('growTime')}
                    >
                      生長時間
                      <SortGlyph active={sortKey === 'growTime'} dir={sortDir} />
                    </button>
                  </th>
                  <th scope="col" className="seed-th seed-th-loc">
                    <button
                      type="button"
                      className="seed-th-btn"
                      onClick={() => toggleSort('harvestLocation')}
                    >
                      獲取地點
                      <SortGlyph
                        active={sortKey === 'harvestLocation'}
                        dir={sortDir}
                      />
                    </button>
                  </th>
                </tr>
                <tr className="seed-table-filter-row">
                  <td>
                    <label className="seed-input-box">
                      <span className="seed-input-box-icon" aria-hidden>
                        <SearchIcon />
                      </span>
                      <input
                        type="search"
                        className={`seed-td-input seed-td-input--inbox${nameQuery ? ' seed-td-input--with-clear' : ''}`}
                        placeholder="搜尋名稱…"
                        value={nameQuery}
                        onChange={(e) => setNameQuery(e.target.value)}
                        autoComplete="off"
                        aria-label="依名稱篩選"
                      />
                      {nameQuery ? (
                        <SearchClearButton onClear={() => setNameQuery('')} />
                      ) : null}
                    </label>
                  </td>
                  <td>
                    <select
                      className="seed-td-select"
                      value={growTime}
                      onChange={(e) => setGrowTime(e.target.value)}
                      aria-label="依生長時間篩選"
                    >
                      <option value="">全部</option>
                      {growOptions.map((g) => (
                        <option key={g} value={g}>
                          {formatDurationEn(g)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <label className="seed-input-box">
                      <span className="seed-input-box-icon" aria-hidden>
                        <SearchIcon />
                      </span>
                      <input
                        type="search"
                        className={`seed-td-input seed-td-input--inbox${locationQuery ? ' seed-td-input--with-clear' : ''}`}
                        placeholder="搜尋地點…"
                        value={locationQuery}
                        onChange={(e) => setLocationQuery(e.target.value)}
                        autoComplete="off"
                        aria-label="依獲取地點篩選"
                      />
                      {locationQuery ? (
                        <SearchClearButton onClear={() => setLocationQuery('')} />
                      ) : null}
                    </label>
                  </td>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((s) => (
                  <tr key={s.seedId} className="seed-tr">
                    <td className="seed-td seed-td-name">
                      <span className="seed-name-cell">
                        <img
                          src={publicUrl(s.iconUrl)}
                          alt=""
                          width={28}
                          height={28}
                          className="seed-row-icon"
                          loading="lazy"
                        />
                        <Link
                          to={`/seed/${s.seedId}`}
                          className="seed-name-link"
                        >
                          {s.name}
                        </Link>
                      </span>
                    </td>
                    <td className="seed-td seed-td-grow">
                      {formatDurationEn(s.growTime)}
                    </td>
                    <td
                      className="seed-td seed-td-loc"
                      title={s.harvestLocation ?? undefined}
                    >
                      {s.harvestLocation ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && sortedRows.length === 0 && (
        <p className="seed-list-empty">沒有符合條件的種子。</p>
      )}
    </div>
  )
}

function SortGlyph({
  active,
  dir,
}: {
  active: boolean
  dir: 1 | -1
}) {
  if (!active) {
    return (
      <span className="seed-sort-icon seed-sort-muted" aria-hidden>
        ↕
      </span>
    )
  }
  return (
    <span className="seed-sort-icon" aria-hidden>
      {dir === 1 ? '↑' : '↓'}
    </span>
  )
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
