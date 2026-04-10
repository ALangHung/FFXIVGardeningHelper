import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SeedSummary } from './seedSummaryTypes'
import type { SeedRecord } from './seedDetailTypes'
import {
  loadSeedsById,
  loadSeedsSummaryMerged,
  loadUniversalisMinPricesByItemId,
} from './seedDataApi'
import type {
  IntercrossOutcome,
  OtherParentCandidate,
} from './crossOutcomes'
import {
  findIntercrossOutcomes,
  findOtherParentsFromResult,
  getCompatibleParentSeedIds,
  getParentSeedIdsOnResultConfirmedCrosses,
  getPossibleResultSeedIdsForKnownParent,
} from './crossOutcomes'
import { CopyCropNameButton, CopyCropNameToast } from './CopyCropNameUi'
import { publicUrl } from './publicUrl'
import { SearchClearButton } from './SearchClearButton'
import { formatDurationEn, durationToSortHours } from './seedFormat'
import {
  loadCrossCalcUiState,
  resetSeedDetailPath,
  saveCrossCalcUiState,
  setSeedDetailActiveSection,
  type CrossCalcMode,
  type OtherParentSortKey,
  type OutcomeSortKey,
} from './sessionUiState'
import { hasMarketAccess } from './marketAccess'
import { PriceSpinner } from './PriceSpinner'
import { SeedFavoriteHeartIcon } from './SeedFavoriteHeartIcon'
import { useSeedFavoriteIds } from './seedFavorites'
import {
  filterSeeds,
  normalizeSeedQuery,
  resolveSeedFromQuery,
} from './seedPickerQuery'
import './CrossCalculatorPage.css'

const MARKET_ITEM_BASE = 'https://beherw.github.io/FFXIV_Market/item'

function marketItemUrl(itemId: number): string {
  return `${MARKET_ITEM_BASE}/${itemId}`
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
  keyboardSelectEnabled,
  selectedAssistiveText,
  stackOrder = 'first',
  onOpenChange,
  onQueryChange,
  onSelect,
  favoriteIds,
  restrictToSeedIds,
  excludeSeedId,
}: {
  label: string
  inputId: string
  listId: string
  seeds: SeedSummary[]
  selectedId: number | null
  query: string
  open: boolean
  keyboardSelectEnabled?: boolean
  selectedAssistiveText?: string | null
  stackOrder?: 'first' | 'second'
  onOpenChange: (open: boolean) => void
  onQueryChange: (q: string) => void
  onSelect: (s: SeedSummary) => void
  favoriteIds: ReadonlySet<number>
  /** 非 null 時僅顯示此集合內的種子（與另一親代可雜交者）。 */
  restrictToSeedIds?: ReadonlySet<number> | null
  /** 從選項與 blur 解析中排除（避免與另一欄選到同一顆）。 */
  excludeSeedId?: number | null
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const queryRef = useRef(query)
  const selectedIdRef = useRef(selectedId)
  const restrictToSeedIdsRef = useRef(restrictToSeedIds)
  const excludeSeedIdRef = useRef(excludeSeedId)
  queryRef.current = query
  selectedIdRef.current = selectedId
  restrictToSeedIdsRef.current = restrictToSeedIds
  excludeSeedIdRef.current = excludeSeedId
  const [activeIndex, setActiveIndex] = useState(-1)
  const summaryById = useMemo(() => {
    const m = new Map<number, SeedSummary>()
    for (const s of seeds) m.set(s.seedId, s)
    return m
  }, [seeds])

  const displayValue =
    selectedId != null ? (summaryById.get(selectedId)?.name ?? '') : query

  const suggestions = useMemo(() => {
    let list = filterSeeds(seeds, selectedId != null ? '' : query, favoriteIds)
    if (restrictToSeedIds != null) {
      list = list.filter((s) => restrictToSeedIds.has(s.seedId))
    }
    if (excludeSeedId != null) {
      list = list.filter((s) => s.seedId !== excludeSeedId)
    }
    return list
  }, [
    seeds,
    query,
    selectedId,
    favoriteIds,
    restrictToSeedIds,
    excludeSeedId,
  ])
  const activeSuggestion =
    activeIndex >= 0 && activeIndex < suggestions.length
      ? suggestions[activeIndex]
      : null

  const showNoMatches =
    selectedId == null &&
    suggestions.length === 0 &&
    (normalizeSeedQuery(query).length > 0 ||
      (restrictToSeedIds != null && restrictToSeedIds.size === 0))

  const assistiveHasVisibleLine =
    (selectedId != null && selectedAssistiveText) ||
    (showNoMatches && !open)

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1)
      return
    }
    if (selectedId != null) {
      setActiveIndex(-1)
      return
    }
    const nq = normalizeSeedQuery(query)
    if (nq.length > 0 && suggestions.length > 0) {
      setActiveIndex(0)
    } else {
      setActiveIndex(-1)
    }
  }, [open, query, selectedId, suggestions])

  return (
    <div className={`cross-calc-picker cross-calc-picker--${stackOrder}`}>
      <label className="cross-calc-field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="cross-calc-combobox">
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
            aria-expanded={open && (suggestions.length > 0 || showNoMatches)}
            aria-controls={
              open && (suggestions.length > 0 || showNoMatches)
                ? listId
                : undefined
            }
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeSuggestion != null
                ? `${listId}-opt-${activeSuggestion.seedId}`
                : undefined
            }
            ref={inputRef}
            value={displayValue}
            onChange={(e) => {
              onQueryChange(e.target.value)
            }}
            onFocus={() => onOpenChange(true)}
            onKeyDown={(e) => {
              if (!keyboardSelectEnabled) return
              if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault()
                onOpenChange(true)
                if (suggestions.length > 0) {
                  setActiveIndex(e.key === 'ArrowUp' ? suggestions.length - 1 : 0)
                }
                return
              }
              if (!open) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (suggestions.length === 0) return
                setActiveIndex((idx) =>
                  idx < 0 ? 0 : Math.min(idx + 1, suggestions.length - 1),
                )
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                if (suggestions.length === 0) return
                setActiveIndex((idx) =>
                  idx < 0 ? suggestions.length - 1 : Math.max(idx - 1, 0),
                )
                return
              }
              if (e.key === 'Enter') {
                if (activeSuggestion == null) return
                e.preventDefault()
                onSelect(activeSuggestion)
                onOpenChange(false)
                inputRef.current?.blur()
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                onOpenChange(false)
                setActiveIndex(-1)
              }
            }}
            onBlur={() => {
              window.setTimeout(() => {
                onOpenChange(false)
                if (selectedIdRef.current != null) return
                const q = queryRef.current
                const r = restrictToSeedIdsRef.current
                const ex = excludeSeedIdRef.current
                let pool = seeds
                if (r != null) {
                  pool = seeds.filter((s) => r.has(s.seedId))
                }
                if (ex != null) {
                  pool = pool.filter((s) => s.seedId !== ex)
                }
                const resolved = resolveSeedFromQuery(pool, q, favoriteIds)
                if (resolved) onSelect(resolved)
              }, 150)
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
        {open && selectedId == null && showNoMatches ? (
          <div
            id={listId}
            className="cross-calc-suggestions cross-calc-suggestions--empty"
            role="listbox"
            aria-label="搜尋結果"
          >
            <p className="cross-calc-suggestions-empty" role="status">
              沒有符合的種子
            </p>
          </div>
        ) : open && suggestions.length > 0 ? (
          <ul id={listId} className="cross-calc-suggestions" role="listbox">
            {suggestions.map((s, idx) => (
              <li key={s.seedId} role="none">
                <button
                  type="button"
                  role="option"
                  id={`${listId}-opt-${s.seedId}`}
                  aria-selected={idx === activeIndex}
                  className={`cross-calc-suggest-btn${idx === activeIndex ? ' cross-calc-suggest-btn--active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
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
                  <span className="cross-calc-suggest-name">{s.name}</span>
                  {favoriteIds.has(s.seedId) ? (
                    <span
                      className="cross-calc-suggest-fav"
                      title="最愛"
                      aria-label="最愛"
                    >
                      <SeedFavoriteHeartIcon
                        variant="solid"
                        className="cross-calc-suggest-fav-icon"
                      />
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p
        className={`cross-calc-picker-assistive${
          assistiveHasVisibleLine ? '' : ' cross-calc-picker-assistive--placeholder'
        }${showNoMatches && !open ? ' cross-calc-picker-assistive--nomatch' : ''}`}
      >
        {selectedId != null && selectedAssistiveText
          ? selectedAssistiveText
          : showNoMatches && !open
            ? '沒有符合的種子'
            : '\u00A0'}
      </p>
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
  priceBySeedId: Record<number, { seedMinPrice: number | null; cropMinPrice: number | null; cropItemId: number | null }>,
): number {
  const m = dir
  const normalizePrice = (v: number | null): number | null => {
    if (v == null || !Number.isFinite(v) || v <= 0) return null
    return v
  }
  const compareNullableNumber = (av: number | null, bv: number | null): number => {
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return m * (av - bv)
  }
  switch (key) {
    case 'outcome':
      return m * a.outcomeName.localeCompare(b.outcomeName, 'zh-Hant')
    case 'growTime':
      return m * (durationToSortHours(a.outcomeGrowTime) - durationToSortHours(b.outcomeGrowTime))
    case 'seedMinPrice':
      return compareNullableNumber(
        normalizePrice(priceBySeedId[a.outcomeSeedId]?.seedMinPrice ?? null),
        normalizePrice(priceBySeedId[b.outcomeSeedId]?.seedMinPrice ?? null),
      )
    case 'cropMinPrice': {
      const aPrice =
        priceBySeedId[a.outcomeSeedId]?.cropItemId == null
          ? null
          : normalizePrice(priceBySeedId[a.outcomeSeedId]?.cropMinPrice ?? null)
      const bPrice =
        priceBySeedId[b.outcomeSeedId]?.cropItemId == null
          ? null
          : normalizePrice(priceBySeedId[b.outcomeSeedId]?.cropMinPrice ?? null)
      return compareNullableNumber(aPrice, bPrice)
    }
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
  priceBySeedId: Record<number, { seedMinPrice: number | null; cropMinPrice: number | null; cropItemId: number | null }>,
): number {
  const m = dir
  const normalizePrice = (v: number | null): number | null => {
    if (v == null || !Number.isFinite(v) || v <= 0) return null
    return v
  }
  const compareNullableNumber = (av: number | null, bv: number | null): number => {
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return m * (av - bv)
  }
  switch (key) {
    case 'other':
      return m * a.otherParentName.localeCompare(b.otherParentName, 'zh-Hant')
    case 'growDays':
      return compareNullableNumber(a.otherParentGrowDays, b.otherParentGrowDays)
    case 'seedMinPrice':
      return compareNullableNumber(
        normalizePrice(priceBySeedId[a.otherParentSeedId]?.seedMinPrice ?? null),
        normalizePrice(priceBySeedId[b.otherParentSeedId]?.seedMinPrice ?? null),
      )
    case 'cropMinPrice': {
      const aPrice =
        priceBySeedId[a.otherParentSeedId]?.cropItemId == null
          ? null
          : normalizePrice(priceBySeedId[a.otherParentSeedId]?.cropMinPrice ?? null)
      const bPrice =
        priceBySeedId[b.otherParentSeedId]?.cropItemId == null
          ? null
          : normalizePrice(priceBySeedId[b.otherParentSeedId]?.cropMinPrice ?? null)
      return compareNullableNumber(aPrice, bPrice)
    }
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
  const navigate = useNavigate()
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
  const [copyToast, setCopyToast] = useState<{
    key: number
    message: string
  } | null>(null)
  const [marketEnabled, setMarketEnabled] = useState(false)
  const [priceBySeedId, setPriceBySeedId] = useState<
    Record<
      number,
      {
        seedItemId: number | null
        seedMinPrice: number | null
        cropMinPrice: number | null
        cropItemId: number | null
      }
    >
  >({})
  const [priceLoading, setPriceLoading] = useState(false)
  const favoriteSeedIds = useSeedFavoriteIds()

  const resolvedParentAId = useMemo(() => {
    if (parentAId != null) return parentAId
    return resolveSeedFromQuery(seeds, queryA, favoriteSeedIds)?.seedId ?? null
  }, [parentAId, queryA, seeds, favoriteSeedIds])

  const resolvedParentBId = useMemo(() => {
    if (parentBId != null) return parentBId
    return resolveSeedFromQuery(seeds, queryB, favoriteSeedIds)?.seedId ?? null
  }, [parentBId, queryB, seeds, favoriteSeedIds])

  const compatibleIdsForPickerA = useMemo(() => {
    if (!seedsById || resolvedParentBId == null) return null
    return getCompatibleParentSeedIds(seedsById, resolvedParentBId)
  }, [seedsById, resolvedParentBId])

  const compatibleIdsForPickerB = useMemo(() => {
    if (!seedsById || resolvedParentAId == null) return null
    return getCompatibleParentSeedIds(seedsById, resolvedParentAId)
  }, [seedsById, resolvedParentAId])

  const resolvedSpKnownId = useMemo(() => {
    if (spKnownId != null) return spKnownId
    return (
      resolveSeedFromQuery(seeds, spQueryKnown, favoriteSeedIds)?.seedId ??
      null
    )
  }, [spKnownId, spQueryKnown, seeds, favoriteSeedIds])

  const resolvedSpResultId = useMemo(() => {
    if (spResultId != null) return spResultId
    return (
      resolveSeedFromQuery(seeds, spQueryResult, favoriteSeedIds)?.seedId ??
      null
    )
  }, [spResultId, spQueryResult, seeds, favoriteSeedIds])

  const compatibleIdsForSpKnown = useMemo(() => {
    if (!seedsById || resolvedSpResultId == null) return null
    return getParentSeedIdsOnResultConfirmedCrosses(
      seedsById,
      resolvedSpResultId,
    )
  }, [seedsById, resolvedSpResultId])

  const compatibleIdsForSpResult = useMemo(() => {
    if (!seedsById || resolvedSpKnownId == null) return null
    return getPossibleResultSeedIdsForKnownParent(
      seedsById,
      resolvedSpKnownId,
    )
  }, [seedsById, resolvedSpKnownId])

  const prevParentPairKeyRef = useRef<string | null>(null)
  const prevSpPairKeyRef = useRef<string | null>(null)

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
    if (!marketEnabled) {
      setPriceBySeedId({})
      setPriceLoading(false)
      return
    }
    if (seeds.length === 0) {
      setPriceLoading(false)
      return
    }
    let cancelled = false
    setPriceLoading(true)
    ;(async () => {
      try {
        const itemIds: number[] = []
        for (const s of seeds) {
          if (s.seedItemId != null) itemIds.push(s.seedItemId)
          if (s.cropItemId != null) itemIds.push(s.cropItemId)
        }
        const uniqIds = [...new Set(itemIds)]
        const prices = await loadUniversalisMinPricesByItemId(uniqIds)
        if (cancelled) return
        const next: Record<
          number,
          {
            seedItemId: number | null
            seedMinPrice: number | null
            cropMinPrice: number | null
            cropItemId: number | null
          }
        > = {}
        for (const s of seeds) {
          next[s.seedId] = {
            seedItemId: s.seedItemId ?? null,
            seedMinPrice: s.seedItemId == null ? null : prices[s.seedItemId] ?? null,
            cropMinPrice: s.cropItemId == null ? null : prices[s.cropItemId] ?? null,
            cropItemId: s.cropItemId ?? null,
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
  }, [seeds, marketEnabled])

  useEffect(() => {
    if (marketEnabled) return
    if (outcomeSortKey === 'seedMinPrice' || outcomeSortKey === 'cropMinPrice') {
      setOutcomeSortKey('efficiency')
      setOutcomeSortDir(-1)
    }
  }, [marketEnabled, outcomeSortKey])

  useEffect(() => {
    if (marketEnabled) return
    if (
      otherParentSortKey === 'seedMinPrice' ||
      otherParentSortKey === 'cropMinPrice'
    ) {
      setOtherParentSortKey('efficiency')
      setOtherParentSortDir(-1)
    }
  }, [marketEnabled, otherParentSortKey])

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
      compareOutcomes(a, b, outcomeSortKey, outcomeSortDir, priceBySeedId),
    )
    return rows
  }, [outcomes, outcomeSortKey, outcomeSortDir, priceBySeedId])

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
      return '請選擇兩個親代以查詢可能結果。'
    if (parentAId === parentBId) return '請選擇兩個不同的親代。'
    return `共 ${outcomes.length} 種可能結果`
  }, [parentAId, parentBId, outcomes.length])

  const seedSummaryById = useMemo(() => {
    const m = new Map<number, SeedSummary>()
    for (const s of seeds) m.set(s.seedId, s)
    return m
  }, [seeds])

  const parentAHarvestText = useMemo(() => {
    if (parentAId == null) return null
    const growTime = seedSummaryById.get(parentAId)?.growTime ?? null
    return `收成天數：${formatDurationEn(growTime)}`
  }, [parentAId, seedSummaryById])

  const parentBHarvestText = useMemo(() => {
    if (parentBId == null) return null
    const growTime = seedSummaryById.get(parentBId)?.growTime ?? null
    return `收成天數：${formatDurationEn(growTime)}`
  }, [parentBId, seedSummaryById])

  const spKnownHarvestText = useMemo(() => {
    if (spKnownId == null) return null
    const growTime = seedSummaryById.get(spKnownId)?.growTime ?? null
    return `收成天數：${formatDurationEn(growTime)}`
  }, [spKnownId, seedSummaryById])

  const spResultHarvestText = useMemo(() => {
    if (spResultId == null) return null
    const growTime = seedSummaryById.get(spResultId)?.growTime ?? null
    return `收成天數：${formatDurationEn(growTime)}`
  }, [spResultId, seedSummaryById])

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
      compareOtherParents(a, b, otherParentSortKey, otherParentSortDir, priceBySeedId),
    )
    return rows
  }, [otherParents, otherParentSortKey, otherParentSortDir, priceBySeedId])

  function marketPriceText(seedId: number, kind: 'seed' | 'crop') {
    if (priceLoading) return <PriceSpinner />
    const p = priceBySeedId[seedId]
    if (!p) return '—'
    if (kind === 'crop' && p.cropItemId == null) return '不支援盆栽作物'
    const itemId = kind === 'seed' ? p.seedItemId : p.cropItemId
    const raw = kind === 'seed' ? p.seedMinPrice : p.cropMinPrice
    const text =
      raw == null || !Number.isFinite(raw) || raw <= 0
        ? '交易版上沒資料'
        : `${Math.round(raw).toLocaleString('zh-Hant')} G`
    if (itemId == null) return text
    return (
      <a
        href={marketItemUrl(itemId)}
        target="_blank"
        rel="noreferrer"
        className="cross-calc-market-link"
        onClick={(e) => e.stopPropagation()}
      >
        {text}
      </a>
    )
  }

  const searchParentsStatusLine = useMemo(() => {
    if (spKnownId == null || spResultId == null)
      return '請選擇已有的親代與雜交結果。'
    if (spKnownId === spResultId)
      return '已有的親代與雜交結果須為不同種子。'
    return `共 ${otherParents.length} 種可能的另一種親代`
  }, [spKnownId, spResultId, otherParents.length])

  return (
    <div className="cross-calc-page">
      <CopyCropNameToast
        toastKey={copyToast?.key ?? null}
        message={copyToast?.message}
        onDismiss={() => setCopyToast(null)}
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
              搜尋親代
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
                  label="親代 A"
                  inputId="cross-parent-a"
                  listId="cross-suggest-a"
                  seeds={seeds}
                  favoriteIds={favoriteSeedIds}
                  selectedId={parentAId}
                  query={queryA}
                  open={openA}
                  keyboardSelectEnabled
                  selectedAssistiveText={parentAHarvestText}
                  restrictToSeedIds={compatibleIdsForPickerA}
                  excludeSeedId={resolvedParentBId}
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
                  label="親代 B"
                  inputId="cross-parent-b"
                  listId="cross-suggest-b"
                  seeds={seeds}
                  favoriteIds={favoriteSeedIds}
                  selectedId={parentBId}
                  query={queryB}
                  open={openB}
                  stackOrder="second"
                  keyboardSelectEnabled
                  selectedAssistiveText={parentBHarvestText}
                  restrictToSeedIds={compatibleIdsForPickerB}
                  excludeSeedId={resolvedParentAId}
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
                          <th scope="col">{outcomeSortTh('growTime', '收成天數')}</th>
                          {marketEnabled ? (
                            <th scope="col">
                              {outcomeSortTh('seedMinPrice', '種子最低價')}
                            </th>
                          ) : null}
                          {marketEnabled ? (
                            <th scope="col">
                              {outcomeSortTh('cropMinPrice', '作物最低價')}
                            </th>
                          ) : null}
                          <th scope="col">{outcomeSortTh('loop', '迴圈')}</th>
                          <th scope="col">
                            {outcomeSortTh('efficiency', '效率')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOutcomes.length === 0 ? null : (
                          sortedOutcomes.map((row) => (
                            <tr
                              key={row.outcomeSeedId}
                              className="cross-calc-result-tr"
                              onClick={() => {
                                setSeedDetailActiveSection('cross')
                                resetSeedDetailPath('cross', row.outcomeSeedId)
                                navigate(`/seed/${row.outcomeSeedId}`)
                              }}
                            >
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSeedDetailActiveSection('cross')
                                      resetSeedDetailPath('cross', row.outcomeSeedId)
                                    }}
                                  >
                                    {row.outcomeName}
                                  </Link>
                                  <span
                                    onClick={(e) => e.stopPropagation()}
                                    role="presentation"
                                  >
                                    <CopyCropNameButton
                                      name={row.outcomeName}
                                      onCopied={(text) =>
                                        setCopyToast({
                                          key: Date.now(),
                                          message: `已複製：${text}`,
                                        })
                                      }
                                    />
                                  </span>
                                </div>
                              </td>
                              <td>
                                {formatDurationEn(row.outcomeGrowTime)}
                              </td>
                              {marketEnabled ? (
                                <td>
                                  {marketPriceText(row.outcomeSeedId, 'seed')}
                                </td>
                              ) : null}
                              {marketEnabled ? (
                                <td>
                                  {marketPriceText(row.outcomeSeedId, 'crop')}
                                </td>
                              ) : null}
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
                  label="已有的親代"
                  inputId="cross-sp-known"
                  listId="cross-sp-suggest-known"
                  seeds={seeds}
                  favoriteIds={favoriteSeedIds}
                  selectedId={spKnownId}
                  query={spQueryKnown}
                  open={spOpenKnown}
                  keyboardSelectEnabled
                  selectedAssistiveText={spKnownHarvestText}
                  restrictToSeedIds={compatibleIdsForSpKnown}
                  excludeSeedId={resolvedSpResultId}
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
                  favoriteIds={favoriteSeedIds}
                  selectedId={spResultId}
                  query={spQueryResult}
                  open={spOpenResult}
                  stackOrder="second"
                  keyboardSelectEnabled
                  selectedAssistiveText={spResultHarvestText}
                  restrictToSeedIds={compatibleIdsForSpResult}
                  excludeSeedId={resolvedSpKnownId}
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
                            {otherParentSortTh('other', '另一種親代')}
                          </th>
                          <th scope="col">
                            {otherParentSortTh('growDays', '收成天數')}
                          </th>
                          {marketEnabled ? (
                            <th scope="col">
                              {otherParentSortTh('seedMinPrice', '種子最低價')}
                            </th>
                          ) : null}
                          {marketEnabled ? (
                            <th scope="col">
                              {otherParentSortTh('cropMinPrice', '作物最低價')}
                            </th>
                          ) : null}
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
                            <tr
                              key={row.otherParentSeedId}
                              className="cross-calc-result-tr"
                              onClick={() => {
                                setSeedDetailActiveSection('cross')
                                resetSeedDetailPath('cross', row.otherParentSeedId)
                                navigate(`/seed/${row.otherParentSeedId}`)
                              }}
                            >
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSeedDetailActiveSection('cross')
                                      resetSeedDetailPath(
                                        'cross',
                                        row.otherParentSeedId,
                                      )
                                    }}
                                  >
                                    {row.otherParentName}
                                  </Link>
                                  <span
                                    onClick={(e) => e.stopPropagation()}
                                    role="presentation"
                                  >
                                    <CopyCropNameButton
                                      name={row.otherParentName}
                                      onCopied={(text) =>
                                        setCopyToast({
                                          key: Date.now(),
                                          message: `已複製：${text}`,
                                        })
                                      }
                                    />
                                  </span>
                                </div>
                              </td>
                              <td>
                                {row.otherParentGrowDays != null
                                  ? `${row.otherParentGrowDays}天`
                                  : '—'}
                              </td>
                              {marketEnabled ? (
                                <td>
                                  {marketPriceText(row.otherParentSeedId, 'seed')}
                                </td>
                              ) : null}
                              {marketEnabled ? (
                                <td>
                                  {marketPriceText(row.otherParentSeedId, 'crop')}
                                </td>
                              ) : null}
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
