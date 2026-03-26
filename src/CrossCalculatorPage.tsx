import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SeedSummary } from './seedSummaryTypes'
import type { SeedRecord } from './seedDetailTypes'
import { loadSeedsById, loadSeedsSummaryMerged } from './seedDataApi'
import type {
  IntercrossOutcome,
  OtherParentCandidate,
} from './crossOutcomes'
import {
  findIntercrossOutcomes,
  findOtherParentsFromResult,
} from './crossOutcomes'
import { CopyCropNameButton, CopyCropNameToast } from './CopyCropNameUi'
import { publicUrl } from './publicUrl'
import { SearchClearButton } from './SearchClearButton'
import {
  loadCrossCalcUiState,
  saveCrossCalcUiState,
  type CrossCalcMode,
  type OtherParentSortKey,
  type OutcomeSortKey,
} from './sessionUiState'
import './CrossCalculatorPage.css'

function normalize(s: string) {
  return s.trim().toLowerCase()
}

function seedsSortedByName(seeds: SeedSummary[]): SeedSummary[] {
  return [...seeds].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
}

/** 空字串時列出全部種子（已排序）；有輸入時列出所有符合的種子。 */
function filterSeeds(seeds: SeedSummary[], q: string): SeedSummary[] {
  const sorted = seedsSortedByName(seeds)
  const nq = normalize(q)
  if (!nq) return sorted
  return sorted.filter((s) =>
    normalize(s.nameSearchText ?? s.name).includes(nq),
  )
}

function SearchGlyph() {
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
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function ParentPicker({
  label,
  inputId,
  listId,
  seeds,
  selectedId,
  query,
  open,
  onOpenChange,
  onQueryChange,
  onSelect,
}: {
  label: string
  inputId: string
  listId: string
  seeds: SeedSummary[]
  selectedId: number | null
  query: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onQueryChange: (q: string) => void
  onSelect: (s: SeedSummary) => void
}) {
  const summaryById = useMemo(() => {
    const m = new Map<number, SeedSummary>()
    for (const s of seeds) m.set(s.seedId, s)
    return m
  }, [seeds])

  const displayValue =
    selectedId != null ? (summaryById.get(selectedId)?.name ?? '') : query

  const suggestions = useMemo(
    () => filterSeeds(seeds, selectedId != null ? '' : query),
    [seeds, query, selectedId],
  )

  return (
    <div className="cross-calc-picker">
      <label className="cross-calc-field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="cross-calc-input-wrap">
        <span className="cross-calc-input-icon" aria-hidden>
          <SearchGlyph />
        </span>
        <input
          id={inputId}
          type="search"
          className={`cross-calc-input${displayValue ? ' cross-calc-input--with-clear' : ''}`}
          placeholder="搜尋名稱…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={displayValue}
          onChange={(e) => {
            onQueryChange(e.target.value)
          }}
          onFocus={() => onOpenChange(true)}
          onBlur={() => {
            window.setTimeout(() => onOpenChange(false), 150)
          }}
        />
        {displayValue ? (
          <SearchClearButton
            preventMousedownBlur
            onClear={() => onQueryChange('')}
            aria-label="清除"
          />
        ) : null}
      </div>
      {open && suggestions.length > 0 ? (
        <ul id={listId} className="cross-calc-suggestions" role="listbox">
          {suggestions.map((s) => (
            <li key={s.seedId} role="none">
              <button
                type="button"
                role="option"
                className="cross-calc-suggest-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(s)
                  onOpenChange(false)
                }}
              >
                <img
                  src={publicUrl(s.iconUrl)}
                  alt=""
                  width={24}
                  height={24}
                  className="cross-calc-suggest-icon"
                  loading="lazy"
                />
                <span>{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function effClass(rating: string | null | undefined): string {
  const k = rating ?? 'none'
  if (k === 'green' || k === 'yellow' || k === 'red' || k === 'none')
    return `cross-calc-eff cross-calc-eff--${k}`
  return 'cross-calc-eff cross-calc-eff--none'
}

function compareOutcomes(
  a: IntercrossOutcome,
  b: IntercrossOutcome,
  key: OutcomeSortKey,
  dir: 1 | -1,
): number {
  const m = dir
  switch (key) {
    case 'outcome':
      return m * a.outcomeName.localeCompare(b.outcomeName, 'zh-Hant')
    case 'loop': {
      const av = a.isLoop ? 1 : 0
      const bv = b.isLoop ? 1 : 0
      return m * (av - bv)
    }
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

function compareOtherParents(
  a: OtherParentCandidate,
  b: OtherParentCandidate,
  key: OtherParentSortKey,
  dir: 1 | -1,
): number {
  const m = dir
  switch (key) {
    case 'other':
      return m * a.otherParentName.localeCompare(b.otherParentName, 'zh-Hant')
    case 'loop': {
      const av = a.isLoop ? 1 : 0
      const bv = b.isLoop ? 1 : 0
      return m * (av - bv)
    }
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

function OutcomeSortGlyph({
  active,
  dir,
}: {
  active: boolean
  dir: 1 | -1
}) {
  if (!active) {
    return (
      <span className="cross-calc-sort-glyph cross-calc-sort-glyph--muted" aria-hidden>
        ↕
      </span>
    )
  }
  return (
    <span className="cross-calc-sort-glyph" aria-hidden>
      {dir === 1 ? '↑' : '↓'}
    </span>
  )
}

export function CrossCalculatorPage() {
  const [persistedCross] = useState(() => loadCrossCalcUiState())

  const [seeds, setSeeds] = useState<SeedSummary[]>([])
  const [seedsById, setSeedsById] = useState<Record<string, SeedRecord> | null>(
    null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [parentAId, setParentAId] = useState<number | null>(
    () => persistedCross?.parentAId ?? null,
  )
  const [parentBId, setParentBId] = useState<number | null>(
    () => persistedCross?.parentBId ?? null,
  )
  const [queryA, setQueryA] = useState(() => persistedCross?.queryA ?? '')
  const [queryB, setQueryB] = useState(() => persistedCross?.queryB ?? '')
  const [openA, setOpenA] = useState(false)
  const [openB, setOpenB] = useState(false)

  const [mode, setMode] = useState<CrossCalcMode>(
    () => persistedCross?.mode ?? 'computeOutcomes',
  )

  const [spKnownId, setSpKnownId] = useState<number | null>(
    () => persistedCross?.spKnownId ?? null,
  )
  const [spResultId, setSpResultId] = useState<number | null>(
    () => persistedCross?.spResultId ?? null,
  )
  const [spQueryKnown, setSpQueryKnown] = useState(
    () => persistedCross?.spQueryKnown ?? '',
  )
  const [spQueryResult, setSpQueryResult] = useState(
    () => persistedCross?.spQueryResult ?? '',
  )
  const [spOpenKnown, setSpOpenKnown] = useState(false)
  const [spOpenResult, setSpOpenResult] = useState(false)

  const [outcomeSortKey, setOutcomeSortKey] = useState<OutcomeSortKey>(
    () => persistedCross?.outcomeSortKey ?? 'efficiency',
  )
  const [outcomeSortDir, setOutcomeSortDir] = useState<1 | -1>(
    () => persistedCross?.outcomeSortDir ?? -1,
  )

  const [otherParentSortKey, setOtherParentSortKey] =
    useState<OtherParentSortKey>(
      () => persistedCross?.otherParentSortKey ?? 'efficiency',
    )
  const [otherParentSortDir, setOtherParentSortDir] = useState<1 | -1>(
    () => persistedCross?.otherParentSortDir ?? -1,
  )
  const [copyToastKey, setCopyToastKey] = useState<number | null>(null)

  const prevParentPairKeyRef = useRef<string | null>(null)
  const prevSpPairKeyRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    ;(async () => {
      try {
        const [merged, byId] = await Promise.all([
          loadSeedsSummaryMerged(),
          loadSeedsById(),
        ])
        if (!cancelled) {
          setSeeds(merged)
          setSeedsById(byId)
        }
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const key = `${parentAId ?? ''}:${parentBId ?? ''}`
    const prev = prevParentPairKeyRef.current
    prevParentPairKeyRef.current = key
    if (prev === null) return
    if (prev !== key) {
      setOutcomeSortKey('efficiency')
      setOutcomeSortDir(-1)
    }
  }, [parentAId, parentBId])

  useEffect(() => {
    const key = `${spKnownId ?? ''}:${spResultId ?? ''}`
    const prev = prevSpPairKeyRef.current
    prevSpPairKeyRef.current = key
    if (prev === null) return
    if (prev !== key) {
      setOtherParentSortKey('efficiency')
      setOtherParentSortDir(-1)
    }
  }, [spKnownId, spResultId])

  useEffect(() => {
    saveCrossCalcUiState({
      mode,
      parentAId,
      parentBId,
      queryA,
      queryB,
      spKnownId,
      spResultId,
      spQueryKnown,
      spQueryResult,
      outcomeSortKey,
      outcomeSortDir,
      otherParentSortKey,
      otherParentSortDir,
    })
  }, [
    mode,
    parentAId,
    parentBId,
    queryA,
    queryB,
    spKnownId,
    spResultId,
    spQueryKnown,
    spQueryResult,
    outcomeSortKey,
    outcomeSortDir,
    otherParentSortKey,
    otherParentSortDir,
  ])

  const outcomes = useMemo(() => {
    if (
      parentAId == null ||
      parentBId == null ||
      parentAId === parentBId ||
      !seedsById
    )
      return []
    return findIntercrossOutcomes(seedsById, parentAId, parentBId)
  }, [seedsById, parentAId, parentBId])

  const sortedOutcomes = useMemo(() => {
    if (outcomes.length === 0) return outcomes
    const rows = [...outcomes]
    rows.sort((a, b) =>
      compareOutcomes(a, b, outcomeSortKey, outcomeSortDir),
    )
    return rows
  }, [outcomes, outcomeSortKey, outcomeSortDir])

  function toggleOutcomeSort(key: OutcomeSortKey) {
    if (outcomeSortKey === key) setOutcomeSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setOutcomeSortKey(key)
      setOutcomeSortDir(key === 'efficiency' ? -1 : 1)
    }
  }

  function outcomeSortTh(key: OutcomeSortKey, label: string) {
    const active = outcomeSortKey === key
    return (
      <button
        type="button"
        className="cross-calc-th-btn"
        onClick={() => toggleOutcomeSort(key)}
      >
        {label}
        <OutcomeSortGlyph active={active} dir={outcomeSortDir} />
      </button>
    )
  }

  function toggleOtherParentSort(key: OtherParentSortKey) {
    if (otherParentSortKey === key)
      setOtherParentSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setOtherParentSortKey(key)
      setOtherParentSortDir(key === 'efficiency' ? -1 : 1)
    }
  }

  function otherParentSortTh(key: OtherParentSortKey, label: string) {
    const active = otherParentSortKey === key
    return (
      <button
        type="button"
        className="cross-calc-th-btn"
        onClick={() => toggleOtherParentSort(key)}
      >
        {label}
        <OutcomeSortGlyph active={active} dir={otherParentSortDir} />
      </button>
    )
  }

  const statusLine = useMemo(() => {
    if (parentAId == null || parentBId == null)
      return '請選擇兩個親本以查詢可能結果。'
    if (parentAId === parentBId) return '請選擇兩個不同的親本。'
    return `共 ${outcomes.length} 種可能結果`
  }, [parentAId, parentBId, outcomes.length])

  const otherParents = useMemo(() => {
    if (
      !seedsById ||
      spKnownId == null ||
      spResultId == null ||
      spKnownId === spResultId
    )
      return []
    return findOtherParentsFromResult(seedsById, spResultId, spKnownId)
  }, [seedsById, spKnownId, spResultId])

  const sortedOtherParents = useMemo(() => {
    if (otherParents.length === 0) return otherParents
    const rows = [...otherParents]
    rows.sort((a, b) =>
      compareOtherParents(a, b, otherParentSortKey, otherParentSortDir),
    )
    return rows
  }, [otherParents, otherParentSortKey, otherParentSortDir])

  const searchParentsStatusLine = useMemo(() => {
    if (spKnownId == null || spResultId == null)
      return '請選擇已有的親本與雜交結果。'
    if (spKnownId === spResultId)
      return '已有的親本與雜交結果須為不同種子。'
    return `共 ${otherParents.length} 種可能的另一種親本`
  }, [spKnownId, spResultId, otherParents.length])

  return (
    <div className="cross-calc-page">
      <CopyCropNameToast
        toastKey={copyToastKey}
        onDismiss={() => setCopyToastKey(null)}
      />
      <header className="cross-calc-header">
        <h1 className="cross-calc-title">雜交計算器</h1>
      </header>

      {loading && <p className="cross-calc-muted">載入中…</p>}
      {loadError && (
        <p className="cross-calc-muted cross-calc-error" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
        <>
          <div
            className="cross-calc-mode"
            role="tablist"
            aria-label="雜交計算類型"
          >
            <button
              type="button"
              role="tab"
              id="cross-tab-compute"
              aria-selected={mode === 'computeOutcomes'}
              aria-controls="cross-panel-compute"
              tabIndex={mode === 'computeOutcomes' ? 0 : -1}
              className={`cross-calc-mode-btn${mode === 'computeOutcomes' ? ' cross-calc-mode-btn--active' : ''}`}
              onClick={() => setMode('computeOutcomes')}
            >
              計算雜交結果
            </button>
            <button
              type="button"
              role="tab"
              id="cross-tab-search-parents"
              aria-selected={mode === 'searchParents'}
              aria-controls="cross-panel-search-parents"
              tabIndex={mode === 'searchParents' ? 0 : -1}
              className={`cross-calc-mode-btn${mode === 'searchParents' ? ' cross-calc-mode-btn--active' : ''}`}
              onClick={() => setMode('searchParents')}
            >
              搜尋親本
            </button>
          </div>

          {mode === 'computeOutcomes' ? (
            <div
              id="cross-panel-compute"
              role="tabpanel"
              aria-labelledby="cross-tab-compute"
            >
              <div className="cross-calc-parents">
                <ParentPicker
                  label="親本 A"
                  inputId="cross-parent-a"
                  listId="cross-suggest-a"
                  seeds={seeds}
                  selectedId={parentAId}
                  query={queryA}
                  open={openA}
                  onOpenChange={(o) => {
                    setOpenA(o)
                    if (o) setOpenB(false)
                  }}
                  onQueryChange={(q) => {
                    setQueryA(q)
                    setParentAId(null)
                  }}
                  onSelect={(s) => {
                    setParentAId(s.seedId)
                    setQueryA(s.name)
                  }}
                />
                <ParentPicker
                  label="親本 B"
                  inputId="cross-parent-b"
                  listId="cross-suggest-b"
                  seeds={seeds}
                  selectedId={parentBId}
                  query={queryB}
                  open={openB}
                  onOpenChange={(o) => {
                    setOpenB(o)
                    if (o) setOpenA(false)
                  }}
                  onQueryChange={(q) => {
                    setQueryB(q)
                    setParentBId(null)
                  }}
                  onSelect={(s) => {
                    setParentBId(s.seedId)
                    setQueryB(s.name)
                  }}
                />
              </div>

              <p
                className="cross-calc-muted"
                style={{ marginBottom: '0.75rem' }}
              >
                {statusLine}
              </p>

              {parentAId != null &&
              parentBId != null &&
              parentAId !== parentBId ? (
                <div className="cross-calc-table-shell">
                  <div className="cross-calc-table-scroll">
                    <table className="cross-calc-table">
                      <thead>
                        <tr>
                          <th scope="col">{outcomeSortTh('outcome', '可能結果')}</th>
                          <th scope="col">{outcomeSortTh('loop', '迴圈')}</th>
                          <th scope="col">
                            {outcomeSortTh('efficiency', '效率')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOutcomes.length === 0 ? null : (
                          sortedOutcomes.map((row) => (
                            <tr key={row.outcomeSeedId}>
                              <td>
                                <div className="cross-calc-name-cell">
                                  <img
                                    src={publicUrl(
                                      `images/seed-icon/${row.outcomeSeedId}.png`,
                                    )}
                                    alt=""
                                    width={28}
                                    height={28}
                                    className="cross-calc-suggest-icon"
                                    loading="lazy"
                                  />
                                  <Link
                                    to={`/seed/${row.outcomeSeedId}`}
                                    className="cross-calc-name-link"
                                  >
                                    {row.outcomeName}
                                  </Link>
                                  <CopyCropNameButton
                                    name={row.outcomeName}
                                    onCopied={() =>
                                      setCopyToastKey(Date.now())
                                    }
                                  />
                                </div>
                              </td>
                              <td>
                                <span
                                  className={
                                    row.isLoop
                                      ? 'cross-calc-loop cross-calc-loop--yes'
                                      : 'cross-calc-loop cross-calc-loop--no'
                                  }
                                >
                                  {row.isLoop ? '迴圈' : '—'}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={effClass(row.efficiencyRating)}
                                >
                                  {row.efficiency ?? '—'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              id="cross-panel-search-parents"
              role="tabpanel"
              aria-labelledby="cross-tab-search-parents"
            >
              <div className="cross-calc-parents">
                <ParentPicker
                  label="已有的親本"
                  inputId="cross-sp-known"
                  listId="cross-sp-suggest-known"
                  seeds={seeds}
                  selectedId={spKnownId}
                  query={spQueryKnown}
                  open={spOpenKnown}
                  onOpenChange={(o) => {
                    setSpOpenKnown(o)
                    if (o) setSpOpenResult(false)
                  }}
                  onQueryChange={(q) => {
                    setSpQueryKnown(q)
                    setSpKnownId(null)
                  }}
                  onSelect={(s) => {
                    setSpKnownId(s.seedId)
                    setSpQueryKnown(s.name)
                  }}
                />
                <ParentPicker
                  label="雜交結果"
                  inputId="cross-sp-result"
                  listId="cross-sp-suggest-result"
                  seeds={seeds}
                  selectedId={spResultId}
                  query={spQueryResult}
                  open={spOpenResult}
                  onOpenChange={(o) => {
                    setSpOpenResult(o)
                    if (o) setSpOpenKnown(false)
                  }}
                  onQueryChange={(q) => {
                    setSpQueryResult(q)
                    setSpResultId(null)
                  }}
                  onSelect={(s) => {
                    setSpResultId(s.seedId)
                    setSpQueryResult(s.name)
                  }}
                />
              </div>

              <p
                className="cross-calc-muted"
                style={{ marginBottom: '0.75rem' }}
              >
                {searchParentsStatusLine}
              </p>

              {spKnownId != null &&
              spResultId != null &&
              spKnownId !== spResultId ? (
                <div className="cross-calc-table-shell">
                  <div className="cross-calc-table-scroll">
                    <table className="cross-calc-table">
                      <thead>
                        <tr>
                          <th scope="col">
                            {otherParentSortTh('other', '另一種親本')}
                          </th>
                          <th scope="col">
                            {otherParentSortTh('loop', '迴圈')}
                          </th>
                          <th scope="col">
                            {otherParentSortTh('efficiency', '效率')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOtherParents.length === 0 ? null : (
                          sortedOtherParents.map((row) => (
                            <tr key={row.otherParentSeedId}>
                              <td>
                                <div className="cross-calc-name-cell">
                                  <img
                                    src={publicUrl(
                                      `images/seed-icon/${row.otherParentSeedId}.png`,
                                    )}
                                    alt=""
                                    width={28}
                                    height={28}
                                    className="cross-calc-suggest-icon"
                                    loading="lazy"
                                  />
                                  <Link
                                    to={`/seed/${row.otherParentSeedId}`}
                                    className="cross-calc-name-link"
                                  >
                                    {row.otherParentName}
                                  </Link>
                                  <CopyCropNameButton
                                    name={row.otherParentName}
                                    onCopied={() =>
                                      setCopyToastKey(Date.now())
                                    }
                                  />
                                </div>
                              </td>
                              <td>
                                <span
                                  className={
                                    row.isLoop
                                      ? 'cross-calc-loop cross-calc-loop--yes'
                                      : 'cross-calc-loop cross-calc-loop--no'
                                  }
                                >
                                  {row.isLoop ? '迴圈' : '—'}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={effClass(row.efficiencyRating)}
                                >
                                  {row.efficiency ?? '—'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  )
}
