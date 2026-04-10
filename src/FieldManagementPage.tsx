import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { CopyCropNameButton, CopyCropNameToast } from './CopyCropNameUi'
import type { SeedSummary } from './seedSummaryTypes'
import { filterSeeds, resolveSeedFromQuery } from './seedPickerQuery'
import type { SeedRecord } from './seedDetailTypes'
import { getSeedById, loadSeedsById, loadSeedsSummaryMerged } from './seedDataApi'
import {
  findIntercrossOutcomes,
  getParentSeedIdsOnResultConfirmedCrosses,
} from './crossOutcomes'
import { SeedFavoriteHeartIcon } from './SeedFavoriteHeartIcon'
import { useSeedFavoriteIds } from './seedFavorites'
import { publicUrl } from './publicUrl'
import {
  loadFieldsLocal,
  resetSeedDetailPath,
  saveFieldsLocal,
  setSeedDetailActiveSection,
  seedDetailHref,
} from './sessionUiState'
import {
  FIELD_SLOTS,
  computeCrossHintsAtPlant,
  fieldHasFertilizableSlot,
  fieldHasHarvestReadySlot,
  getNextFertilizeEligibleAt,
  growMsFromSeedRecord,
  slotCanReceiveFertilize,
  slotReadyToHarvest,
  visibleCrossHints,
} from './fieldGridLogic'
import {
  applyFieldGridDrop,
  buildBoardCells,
  computeBoardColsFromContainer,
  duplicateGardenField,
  nextFreeGridIndex,
  trimTrailingEmptyBoardCells,
} from './fieldBoardLayout'
import type {
  CrossHintAtPlant,
  FieldPlotNumber,
  FieldSlotId,
  GardenField,
  PotBaseColor,
  PlotSlot,
} from './fieldStateTypes'
import {
  canUndoFertilize,
  FERTILIZE_UNDO_WINDOW_MS,
  FIELD_LOCATION_MAX_CHARS,
  POT_SLOT_LOCATION_MAX_CHARS,
  formatFieldHeading,
  normalizeFieldLocation,
} from './fieldStateTypes'
import {
  cropNameZhFromEntry,
  fallbackFlowerpotCropLine,
  loadFlowerpotCropsByColor,
  type FlowerpotColorKey,
  type FlowerpotSeedColorEntry,
} from './flowerpotCropsByColor'
import './FieldManagementPage.css'

function createEmptySlots(): PlotSlot[] {
  return FIELD_SLOTS.map((s) => ({
    id: s.id,
    seedId: null,
    seedName: null,
    growMs: null,
    harvestDeadline: null,
    lastFertilizeAt: null,
    potColorLastActionAt: null,
    crossAtPlant: null,
    clearUndo: null,
    potColorSteps: [],
    potActionUndo: null,
  }))
}

const POT_SLOT_IDS: FieldSlotId[] = [0, 1, 2, 3]
const POT_ACTION_COOLDOWN_MS = 60 * 60 * 1000
const POT_COLOR_LABEL: Record<PotBaseColor, string> = {
  red: '紅',
  blue: '藍',
  yellow: '黃',
}

const POT_COLOR_TOOLTIP_LABEL: Record<PotBaseColor, string> = {
  red: '緋紅',
  blue: '青藍',
  yellow: '金黃',
}

function isFlowerpotExclusiveSeed(seed: SeedRecord | null | undefined): boolean {
  return seed?.seedType === 'Flowerpot'
}

function dedupePotColorSteps(steps: PotBaseColor[]): PotBaseColor[] {
  const seen = new Set<PotBaseColor>()
  const out: PotBaseColor[] = []
  for (const c of steps) {
    if (seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

function computePotResultColors(steps: PotBaseColor[]): FlowerpotColorKey[] {
  const uniq = dedupePotColorSteps(steps)
  if (uniq.length === 0) return ['red']
  if (uniq.length === 1) return [uniq[0]]
  if (uniq.length >= 3) return ['white', 'black', 'mixed']
  const sorted = [...uniq].sort().join('+')
  if (sorted === 'blue+red') return ['purple']
  if (sorted === 'blue+yellow') return ['green']
  return ['orange']
}

function computePotResultLines(
  slot: PlotSlot,
  seed: SeedRecord | null | undefined,
  flowerpotEntry: FlowerpotSeedColorEntry | undefined,
): string[] {
  if (slot.seedId == null || !seed) return []
  const colors = computePotResultColors(slot.potColorSteps)
  const out = colors.map((color) => {
    const fromJson = cropNameZhFromEntry(flowerpotEntry, color)
    return fromJson ?? fallbackFlowerpotCropLine(color, seed.name)
  })
  return out.slice(0, 3)
}

function isPotActionUndoActive(slot: PlotSlot, now: number): boolean {
  const u = slot.potActionUndo
  if (!u) return false
  return now - u.time <= FERTILIZE_UNDO_WINDOW_MS
}

function isPotActionCoolingDown(slot: PlotSlot, now: number): boolean {
  const last = Math.max(
    slot.lastFertilizeAt ?? Number.NEGATIVE_INFINITY,
    slot.potColorLastActionAt ?? Number.NEGATIVE_INFINITY,
  )
  if (!Number.isFinite(last)) return false
  return now - last < POT_ACTION_COOLDOWN_MS
}

function latestFertilizeAtFromSlots(slots: PlotSlot[]): number | null {
  let latest: number | null = null
  for (const s of slots) {
    const candidate = Math.max(
      s.lastFertilizeAt ?? Number.NEGATIVE_INFINITY,
      s.potColorLastActionAt ?? Number.NEGATIVE_INFINITY,
    )
    if (!Number.isFinite(candidate)) continue
    if (latest == null || candidate > latest) latest = candidate
  }
  return latest
}

/** 格內顯示：作物／收成道具名（`SeedRecord.name`），相容舊 session 僅存種子包名時。 */
function plotSlotCropLabel(
  slot: PlotSlot,
  seedsById: Record<string, SeedRecord> | null,
): string {
  if (slot.seedId == null) return ''
  const fromRec = seedsById?.[String(slot.seedId)]?.name?.trim()
  if (fromRec) return fromRec
  return slot.seedName?.trim() ?? `種子 #${slot.seedId}`
}

/** 格內複製按鈕：優先複製種子包道具名（seedItemName）。 */
function plotSlotSeedItemLabel(
  slot: PlotSlot,
  seedsById: Record<string, SeedRecord> | null,
): string | null {
  if (slot.seedId == null) return null
  const seedItem = seedsById?.[String(slot.seedId)]?.seedItemName?.trim()
  if (seedItem) return seedItem
  return null
}

function fieldBlockDragShouldCancel(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.closest(
      'button, a, input, textarea, select, [data-field-no-drag]',
    ) != null
  )
}

/** 編輯版面拖曳田地時：田地管理捲動區（#app-main）上／下此比例內會自動捲動。 */
const FIELD_DRAG_SCROLL_EDGE_RATIO = 0.2
/** 每幀最大捲動量（px，整數），並依距離邊緣加權；以 rAF 合併避免同幀多次 scrollBy 造成抖動。 */
const FIELD_DRAG_SCROLL_MAX_DELTA = 22

function computeFieldBoardDragScrollDelta(
  clientY: number,
  scrollRoot: HTMLElement,
): number {
  const rect = scrollRoot.getBoundingClientRect()
  const h = rect.height
  if (h <= 0) return 0
  const localY = clientY - rect.top
  const topTh = h * FIELD_DRAG_SCROLL_EDGE_RATIO
  const bottomTh = h * (1 - FIELD_DRAG_SCROLL_EDGE_RATIO)
  if (localY < topTh) {
    const intensity = Math.min(1, (topTh - localY) / topTh)
    return -Math.round(FIELD_DRAG_SCROLL_MAX_DELTA * intensity)
  }
  if (localY > bottomTh) {
    const intensity = Math.min(1, (localY - bottomTh) / (h - bottomTh))
    return Math.round(FIELD_DRAG_SCROLL_MAX_DELTA * intensity)
  }
  return 0
}

function formatRemaining(deadline: number | null, now: number): string {
  if (deadline == null) return '—'
  const ms = deadline - now
  if (ms <= 0) return '已可收成'
  const totalSec = Math.floor(ms / 1000)
  if (totalSec <= 0) return '不足1秒'

  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const pad2 = (n: number) => n.toString().padStart(2, '0')

  if (days > 0) {
    return `${days}天${hours}時${minutes}分${seconds}秒`
  }
  if (hours > 0) {
    return `${hours}時${minutes}分${pad2(seconds)}秒`
  }
  if (minutes > 0) {
    return `${minutes}分${pad2(seconds)}秒`
  }
  return `${seconds}秒`
}

function FieldCellCrossOutcomesInline({ hint }: { hint: CrossHintAtPlant }) {
  const n = hint.outcomes.length
  if (n === 0) return null
  const line1 = hint.outcomes[0]!.name
  let line2 = ''
  if (n >= 3) {
    line2 = `${hint.outcomes[1]!.name}…等${n}種`
  } else if (n === 2) {
    line2 = hint.outcomes[1]!.name
  }
  return (
    <div className="field-cell-cross-outcomes">
      <div className="field-cell-cross-outcomes-line">{line1}</div>
      <div className="field-cell-cross-outcomes-line">
        {line2 || '\u00A0'}
      </div>
    </div>
  )
}

function FieldCellCrossTooltip({ hint }: { hint: CrossHintAtPlant }) {
  if (hint.outcomes.length === 0) return null
  return (
    <div className="field-cross-cell-tooltip" role="tooltip">
      <div className="field-cross-cell-tooltip-line">
        {hint.dirLabel}鄰 {hint.neighborName}
      </div>
      {hint.outcomes.map((o) => (
        <div key={o.seedId} className="field-cross-cell-tooltip-line">
          {o.name}
        </div>
      ))}
    </div>
  )
}

export function FieldManagementPage() {
  const [fields, setFields] = useState<GardenField[]>(() => loadFieldsLocal())
  const favoriteSeedIds = useSeedFavoriteIds()
  const [seeds, setSeeds] = useState<SeedSummary[]>([])
  const [seedsById, setSeedsById] = useState<Record<string, SeedRecord> | null>(
    null,
  )
  const [flowerpotBySeedId, setFlowerpotBySeedId] = useState<
    Record<string, FlowerpotSeedColorEntry> | null
  >(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [copyToast, setCopyToast] = useState<{
    key: number
    message: string
  } | null>(null)

  const [newFieldOpen, setNewFieldOpen] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [draftLocation, setDraftLocation] = useState('')
  const [draftPlotNumber, setDraftPlotNumber] = useState<FieldPlotNumber>(1)

  const [deleteConfirmFieldId, setDeleteConfirmFieldId] = useState<
    string | null
  >(null)

  const [potSlotLocEdit, setPotSlotLocEdit] = useState<{
    fieldId: string
    slotId: FieldSlotId
  } | null>(null)
  const [potSlotLocDraft, setPotSlotLocDraft] = useState('')

  const [pickerTarget, setPickerTarget] = useState<{
    fieldId: string
    slotId: FieldSlotId
  } | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  /** 鍵盤／ARIA 用：目前選中的清單項索引 */
  const [pickerHighlight, setPickerHighlight] = useState<number | null>(null)
  /** 雜交提示篩選：只顯示可與鄰格作物雜交的種子（localStorage 持久化） */
  const [pickerCrossFilter, setPickerCrossFilter] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ffxivgh.pickerCrossFilter.v1') === '1'
    } catch {
      return false
    }
  })

  const togglePickerCrossFilter = useCallback(() => {
    setPickerCrossFilter((v) => {
      const next = !v
      try {
        localStorage.setItem('ffxivgh.pickerCrossFilter.v1', next ? '1' : '0')
      } catch {}
      return next
    })
  }, [])

  /** 雜交目標子代：期望的子代種子的搜尋文字 */
  const [pickerCrossTargetQuery, setPickerCrossTargetQuery] = useState('')
  const pickerCrossTargetQueryRef = useRef('')
  pickerCrossTargetQueryRef.current = pickerCrossTargetQuery
  /** 雜交目標子代 ID（已選定） */
  const [pickerCrossTargetId, setPickerCrossTargetId] = useState<number | null>(null)
  /** 雜交目標建議清單是否開啟 */
  const [pickerCrossTargetOpen, setPickerCrossTargetOpen] = useState(false)
  /** 雜交目標建議清單鍵盤游標 */
  const [pickerCrossTargetActiveIdx, setPickerCrossTargetActiveIdx] = useState(-1)
  const pickerCrossTargetInputRef = useRef<HTMLInputElement | null>(null)
  const pickerCrossTargetListId = useId()

  const plantInFlightRef = useRef(false)
  /** 關閉選種視窗後延遲解析種子用的 timer，開新視窗或再次關閉時須清除以免誤植。 */
  const pickerDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  const pickerListId = useId()

  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null)
  const [dragOverCellIndex, setDragOverCellIndex] = useState<number | null>(
    null,
  )
  /** 編輯模式拖曳時，依最末列動態追加的空白列數（每列 boardCols 格）。 */
  const [dragBoardExtraRows, setDragBoardExtraRows] = useState(0)

  /** 總覽棋盤目前每橫排欄數（`computeBoardColsFromContainer`，非固定 3）。初值僅在首次測量前暫用。 */
  const [boardCols, setBoardCols] = useState(1)
  const fieldsBoardRef = useRef<HTMLDivElement>(null)

  /** 棋盤格已成功觸發 `drop` 時為 true，避免接著的 `dragend` 再套用「最後高亮空白格」邏輯。 */
  const layoutGridDropHandledRef = useRef(false)

  /** 版面編輯：開啟時可拖曳田地棋盤、刪除／複製田、編輯位置；關閉時才可施肥、收成重種。 */
  const [fieldLayoutEditMode, setFieldLayoutEditMode] = useState(false)

  useEffect(() => {
    saveFieldsLocal(fields)
  }, [fields])

  useLayoutEffect(() => {
    const board = fieldsBoardRef.current
    if (!board) return
    const fieldPage = board.closest('.field-page')
    if (!(fieldPage instanceof HTMLElement)) return

    const updateCols = () => {
      const w = board.getBoundingClientRect().width
      const cols = computeBoardColsFromContainer(
        w,
        getComputedStyle(fieldPage),
      )
      setBoardCols(cols)
    }

    updateCols()
    const ro = new ResizeObserver(() => updateCols())
    ro.observe(board)
    return () => ro.disconnect()
  }, [fields.length, fieldLayoutEditMode])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  /** 逾時後清除 fertilizeUndo，使「取消施肥」按鈕與 session 一致 */
  useEffect(() => {
    setFields((prev) => {
      let changed = false
      const next = prev.map((f) => {
        const fieldUndoExpired =
          f.fertilizeUndo != null &&
          nowTick - f.fertilizeUndo.time >= FERTILIZE_UNDO_WINDOW_MS
        const slots = f.slots.map((s) => {
          const u = s.potActionUndo
          if (u == null) return s
          if (nowTick - u.time < FERTILIZE_UNDO_WINDOW_MS) return s
          changed = true
          return { ...s, potActionUndo: null }
        })
        if (fieldUndoExpired) {
          changed = true
          return { ...f, fertilizeUndo: null, slots }
        }
        if (slots !== f.slots) return { ...f, slots }
        return f
      })
      return changed ? next : prev
    })
  }, [nowTick])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [merged, byId, flowerpotPayload] = await Promise.all([
          loadSeedsSummaryMerged(),
          loadSeedsById(),
          loadFlowerpotCropsByColor().catch(() => null),
        ])
        if (cancelled) return
        setSeeds(merged)
        setSeedsById(byId)
        setFlowerpotBySeedId(flowerpotPayload?.bySeedId ?? null)
        setLoadError(null)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const fieldMetaDialogOpen = newFieldOpen || editingFieldId != null

  const closeFieldMetaDialog = useCallback(() => {
    setNewFieldOpen(false)
    setEditingFieldId(null)
  }, [])

  const confirmFieldMeta = useCallback(() => {
    const loc = normalizeFieldLocation(draftLocation)
    const plot = draftPlotNumber
    if (editingFieldId) {
      setFields((prev) =>
        prev.map((f) =>
          f.id === editingFieldId
            ? { ...f, locationLabel: loc, plotNumber: plot }
            : f,
        ),
      )
      setEditingFieldId(null)
      return
    }
    const id = crypto.randomUUID()
    const gridIndex = nextFreeGridIndex(fields)
    setFields((prev) => [
      ...prev,
      {
        id,
        locationLabel: loc,
        plotNumber: plot,
        gridIndex,
        slots: createEmptySlots(),
        lastFertilizeTime: null,
        fertilizeUndo: null,
      },
    ])
    setNewFieldOpen(false)
  }, [draftLocation, draftPlotNumber, editingFieldId, fields])

  const openNewField = () => {
    setEditingFieldId(null)
    setDraftLocation('')
    setDraftPlotNumber(1)
    setNewFieldOpen(true)
  }

  const applyPlantWithGrowMs = useCallback(
    async (
      fieldId: string,
      slotId: FieldSlotId,
      seed: SeedSummary,
      growMs: number,
    ) => {
      if (!seedsById || !Number.isFinite(growMs) || growMs <= 0) return
      const rec = await getSeedById(seed.seedId)
      const deadline = Date.now() + growMs
      setFields((prev) =>
        prev.map((f) => {
          if (f.id !== fieldId) return f
          const tempSlots = f.slots.map((s) => {
            if (s.id !== slotId) return s
            return {
              ...s,
              seedId: seed.seedId,
              seedName: rec?.name?.trim() || seed.name,
              growMs,
              harvestDeadline: deadline,
              lastFertilizeAt: null,
              potColorLastActionAt: null,
              clearUndo: null,
              crossAtPlant: null,
              potColorSteps: [],
              potActionUndo: null,
            }
          })
          const hint = computeCrossHintsAtPlant(
            seedsById,
            seed.seedId,
            tempSlots,
            slotId,
          )
          const slots = tempSlots.map((s) =>
            s.id === slotId ? { ...s, crossAtPlant: hint } : s,
          )
          return { ...f, slots }
        }),
      )
    },
    [seedsById],
  )

  /** 選種後直接依種子資料中的收成時間種植（不再開啟自訂天／時／分／秒彈窗）。 */
  const plantSelectedSeed = useCallback(
    async (fieldId: string, slotId: FieldSlotId, seed: SeedSummary) => {
      if (plantInFlightRef.current) return
      plantInFlightRef.current = true
      try {
        if (!seedsById) return
        const rec =
          seedsById[String(seed.seedId)] ?? (await getSeedById(seed.seedId))
        const growMs = growMsFromSeedRecord(rec)
        if (growMs == null || growMs <= 0) return
        await applyPlantWithGrowMs(fieldId, slotId, seed, growMs)
        setPickerTarget(null)
      } finally {
        plantInFlightRef.current = false
      }
    },
    [seedsById, applyPlantWithGrowMs],
  )

  const clearPickerDismissTimer = useCallback(() => {
    if (pickerDismissTimerRef.current != null) {
      clearTimeout(pickerDismissTimerRef.current)
      pickerDismissTimerRef.current = null
    }
  }, [])

  /** 關閉「選擇種子」視窗；延遲後依輸入嘗試解析唯一／名稱完全相符的種子並種植（與雜交計算器失焦邏輯一致）。 */
  const dismissSeedPicker = useCallback(() => {
    clearPickerDismissTimer()
    const t = pickerTarget
    const q = pickerQuery
    setPickerTarget(null)
    if (!t) return
    pickerDismissTimerRef.current = window.setTimeout(() => {
      pickerDismissTimerRef.current = null
      if (plantInFlightRef.current) return
      const resolved = resolveSeedFromQuery(seeds, q, favoriteSeedIds)
      if (!resolved) return
      void plantSelectedSeed(t.fieldId, t.slotId, resolved)
    }, 150)
  }, [
    pickerTarget,
    pickerQuery,
    seeds,
    favoriteSeedIds,
    plantSelectedSeed,
    clearPickerDismissTimer,
  ])

  const clearSlot = useCallback(
    (
      fieldId: string,
      slotId: FieldSlotId,
      mode: 'trash' | 'harvest',
    ) => {
      setFields((prev) =>
        prev.map((f) => {
          if (f.id !== fieldId) return f
          const slots = f.slots.map((s) => {
            if (s.id !== slotId) return s
            if (mode === 'harvest') {
              return {
                id: s.id,
                seedId: null,
                seedName: null,
                growMs: null,
                harvestDeadline: null,
                lastFertilizeAt: null,
                potColorLastActionAt: null,
                crossAtPlant: null,
                clearUndo: null,
                potColorSteps: [],
                potActionUndo: null,
              }
            }
            const undo: PlotSlot['clearUndo'] =
              s.seedId != null
                ? {
                    seedId: s.seedId,
                    seedName: s.seedName ?? '',
                    growMs: s.growMs,
                    harvestDeadline: s.harvestDeadline,
                    lastFertilizeAt: s.lastFertilizeAt,
                    potColorLastActionAt: s.potColorLastActionAt,
                    crossAtPlant: s.crossAtPlant,
                    potColorSteps: s.potColorSteps,
                  }
                : null
            return {
              id: s.id,
              seedId: null,
              seedName: null,
              growMs: null,
              harvestDeadline: null,
              lastFertilizeAt: null,
              potColorLastActionAt: null,
              crossAtPlant: null,
              clearUndo: undo,
              potColorSteps: [],
              potActionUndo: null,
            }
          })
          return { ...f, slots }
        }),
      )
    },
    [],
  )

  const harvestAndReplantField = useCallback(
    (fieldId: string) => {
      if (!seedsById) return
      const now = Date.now()
      setFields((prev) =>
        prev.map((f) => {
          if (f.id !== fieldId) return f
          const replantIds = new Set<FieldSlotId>()
          const slotsPass1 = f.slots.map((slot) => {
            if (!slotReadyToHarvest(slot, now)) return slot
            if (slot.seedId == null || slot.growMs == null) return slot
            replantIds.add(slot.id)
            return {
              ...slot,
              harvestDeadline: now + slot.growMs,
              lastFertilizeAt: null,
              potColorLastActionAt: null,
              clearUndo: null,
              potColorSteps: [],
              potActionUndo: null,
            }
          })
          if (replantIds.size === 0) return f
          const slots = slotsPass1.map((slot) => {
            if (!replantIds.has(slot.id) || slot.seedId == null) return slot
            const hint = computeCrossHintsAtPlant(
              seedsById,
              slot.seedId,
              slotsPass1,
              slot.id,
            )
            return { ...slot, crossAtPlant: hint }
          })
          return { ...f, slots }
        }),
      )
    },
    [seedsById],
  )

  const restoreClearedSlot = useCallback((fieldId: string, slotId: FieldSlotId) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f
        const slots = f.slots.map((s) => {
          if (s.id !== slotId || !s.clearUndo) return s
          const u = s.clearUndo
          return {
            id: s.id,
            seedId: u.seedId,
            seedName: u.seedName,
            growMs: u.growMs,
            harvestDeadline: u.harvestDeadline,
            lastFertilizeAt: u.lastFertilizeAt,
            potColorLastActionAt: u.potColorLastActionAt,
            crossAtPlant: u.crossAtPlant,
            clearUndo: null,
            potColorSteps: u.potColorSteps,
            potActionUndo: null,
          }
        })
        return { ...f, slots }
      }),
    )
  }, [])

  const applyPotColorFertilizer = useCallback(
    (fieldId: string, slotId: FieldSlotId, color: PotBaseColor) => {
      const now = Date.now()
      setFields((prev) =>
        prev.map((f) => {
          if (f.id !== fieldId) return f
          let changed = false
          const slots = f.slots.map((s) => {
            if (s.id !== slotId || s.seedId == null) return s
            const undoActive = isPotActionUndoActive(s, now)
            const cooldownActive = isPotActionCoolingDown(s, now)
            if (undoActive) return s
            if (cooldownActive) return s
            const next = dedupePotColorSteps([...s.potColorSteps, color]).slice(0, 3)
            changed = true
            return {
              ...s,
              potColorLastActionAt: now,
              potColorSteps: next,
              potActionUndo: {
                time: now,
                action: color as PotBaseColor,
                before: {
                  harvestDeadline: s.harvestDeadline,
                  lastFertilizeAt: s.lastFertilizeAt,
                  potColorLastActionAt: s.potColorLastActionAt,
                  potColorSteps: s.potColorSteps,
                },
              },
            }
          })
          if (!changed) return f
          return {
            ...f,
            slots,
            lastFertilizeTime: latestFertilizeAtFromSlots(slots),
          }
        }),
      )
    },
    [],
  )

  const undoPotSlotAction = useCallback((fieldId: string, slotId: FieldSlotId) => {
    const now = Date.now()
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f
        const slots = f.slots.map((s) => {
          if (s.id !== slotId || !isPotActionUndoActive(s, now) || !s.potActionUndo) {
            return s
          }
          return {
            ...s,
            harvestDeadline: s.potActionUndo.before.harvestDeadline,
            lastFertilizeAt: s.potActionUndo.before.lastFertilizeAt,
            potColorLastActionAt: s.potActionUndo.before.potColorLastActionAt,
            potColorSteps: s.potActionUndo.before.potColorSteps,
            potActionUndo: null,
          }
        })
        return {
          ...f,
          slots,
          lastFertilizeTime: latestFertilizeAtFromSlots(slots),
        }
      }),
    )
  }, [])

  const fertilizeField = useCallback(
    (fieldId: string) => {
      const now = Date.now()
      setFields((prev) =>
        prev.map((f) => {
          if (f.id !== fieldId) return f
          const deadlinesBefore: Partial<Record<FieldSlotId, number | null>> = {}
          const lastFertilizeAtBefore: Partial<
            Record<FieldSlotId, number | null>
          > = {}
          let any = false
          for (const slot of f.slots) {
            deadlinesBefore[slot.id] = slot.harvestDeadline
            lastFertilizeAtBefore[slot.id] = slot.lastFertilizeAt
            if (slotCanReceiveFertilize(slot, now) && slot.harvestDeadline != null) {
              any = true
            }
          }
          if (!any) return f
          const slots = f.slots.map((slot) => {
            if (!slotCanReceiveFertilize(slot, now) || slot.harvestDeadline == null)
              return slot
            const remaining = slot.harvestDeadline - now
            const newDeadline = now + remaining * 0.99
            return {
              ...slot,
              harvestDeadline: newDeadline,
              lastFertilizeAt: now,
            }
          })
          return {
            ...f,
            slots,
            lastFertilizeTime: now,
            fertilizeUndo: {
              time: now,
              deadlinesBefore,
              lastFertilizeAtBefore,
              lastFertilizeTimeBefore: f.lastFertilizeTime,
            },
          }
        }),
      )
    },
    [],
  )

  const undoFertilizeField = useCallback((fieldId: string) => {
    const now = Date.now()
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId || !canUndoFertilize(f, now)) return f
        const last = f.fertilizeUndo!
        const slots = f.slots.map((slot) => {
          const d =
            slot.id in last.deadlinesBefore
              ? last.deadlinesBefore[slot.id]
              : undefined
          const lb = last.lastFertilizeAtBefore
          const l =
            lb != null && slot.id in lb ? lb[slot.id] : undefined
          if (d === undefined && l === undefined) return slot
          return {
            ...slot,
            harvestDeadline: d !== undefined ? d : slot.harvestDeadline,
            lastFertilizeAt: l !== undefined ? l : slot.lastFertilizeAt,
          }
        })
        return {
          ...f,
          slots,
          fertilizeUndo: null,
          lastFertilizeTime: last.lastFertilizeTimeBefore ?? null,
        }
      }),
    )
  }, [])

  const deleteField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId))
    setDeleteConfirmFieldId(null)
  }

  const duplicateField = useCallback((fieldId: string) => {
    setFields((prev) => {
      const src = prev.find((f) => f.id === fieldId)
      if (!src) return prev
      return [...prev, duplicateGardenField(src, prev)]
    })
  }, [])

  useEffect(() => {
    if (fieldLayoutEditMode) return
    setDraggingFieldId(null)
    setDragOverCellIndex(null)
    setDragBoardExtraRows(0)
  }, [fieldLayoutEditMode])

  useEffect(() => {
    if (!draggingFieldId) setDragBoardExtraRows(0)
  }, [draggingFieldId])

  useEffect(() => {
    if (!fieldLayoutEditMode || !draggingFieldId) return
    const scrollRoot = document.getElementById('app-main')
    if (!(scrollRoot instanceof HTMLElement)) return

    let lastClientY = 0
    let rafId: number | null = null

    const flushScroll = () => {
      rafId = null
      const delta = computeFieldBoardDragScrollDelta(lastClientY, scrollRoot)
      if (delta !== 0) {
        scrollRoot.scrollBy(0, delta)
      }
    }

    const onDragOver = (e: DragEvent) => {
      lastClientY = e.clientY
      if (rafId != null) return
      rafId = requestAnimationFrame(flushScroll)
    }

    document.addEventListener('dragover', onDragOver, true)
    return () => {
      document.removeEventListener('dragover', onDragOver, true)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [fieldLayoutEditMode, draggingFieldId])

  const baseBoardCells = useMemo(
    () =>
      buildBoardCells(fields, {
        padToFullRows: fieldLayoutEditMode,
        boardCols,
      }),
    [fields, fieldLayoutEditMode, boardCols],
  )

  const boardCellsForView = useMemo(() => {
    if (!fieldLayoutEditMode) {
      return trimTrailingEmptyBoardCells(baseBoardCells)
    }
    if (!draggingFieldId || dragBoardExtraRows === 0) {
      return baseBoardCells
    }
    const L = baseBoardCells.length
    const append = Array.from(
      { length: dragBoardExtraRows * boardCols },
      (_, i) => ({
        index: L + i,
        field: null as GardenField | null,
      }),
    )
    return [...baseBoardCells, ...append]
  }, [
    baseBoardCells,
    fieldLayoutEditMode,
    draggingFieldId,
    dragBoardExtraRows,
    boardCols,
  ])

  const growBoardIfDragNeedsRowBelow = useCallback(
    (slotIndex: number) => {
      if (!draggingFieldId) return
      const L = baseBoardCells.length
      setDragBoardExtraRows((er) => {
        const currentTotal = L + er * boardCols
        const r = Math.floor(slotIndex / boardCols)
        const lastRow = Math.floor((currentTotal - 1) / boardCols)
        if (r !== lastRow) return er
        const neededCells = (r + 2) * boardCols
        if (neededCells <= currentTotal) return er
        const delta = neededCells - currentTotal
        return er + Math.ceil(delta / boardCols)
      })
    },
    [draggingFieldId, baseBoardCells, boardCols],
  )

  /** 目標格的鄰格（有種植作物）之種子 ID 列表，用於雜交篩選 */
  const pickerNeighborSeedIds = useMemo<number[]>(() => {
    if (!pickerTarget) return []
    const field = fields.find((f) => f.id === pickerTarget.fieldId)
    if (!field) return []
    const meta = FIELD_SLOTS.find((s) => s.id === pickerTarget.slotId)
    if (!meta) return []
    const byId = new Map<FieldSlotId, PlotSlot>()
    for (const s of field.slots) byId.set(s.id, s)
    const ids: number[] = []
    for (const [dr, dc] of [
      [meta.row, meta.col + 1],
      [meta.row + 1, meta.col],
      [meta.row - 1, meta.col],
      [meta.row, meta.col - 1],
    ] as [number, number][]) {
      const nb = FIELD_SLOTS.find((s) => s.row === dr && s.col === dc)
      if (!nb) continue
      const seedId = byId.get(nb.id)?.seedId
      if (seedId != null) ids.push(seedId)
    }
    return ids
  }, [pickerTarget, fields])

  /** 目標格所屬田地是否為盆栽（盆栽無雜交篩選） */
  const pickerTargetIsPot = useMemo(() => {
    if (!pickerTarget) return false
    const field = fields.find((f) => f.id === pickerTarget.fieldId)
    return field?.plotNumber === 'pot'
  }, [pickerTarget, fields])

  /** 雜交目標子代建議清單（只在篩選開啟且下拉展開時計算） */
  const pickerCrossTargetSuggestions = useMemo(() => {
    if (!pickerCrossFilter || !pickerCrossTargetOpen) return []
    return filterSeeds(
      seeds,
      pickerCrossTargetId != null ? '' : pickerCrossTargetQuery,
      favoriteSeedIds,
    )
  }, [
    pickerCrossFilter,
    pickerCrossTargetOpen,
    seeds,
    pickerCrossTargetQuery,
    pickerCrossTargetId,
    favoriteSeedIds,
  ])

  const pickerCrossTargetActiveSuggestion =
    pickerCrossTargetActiveIdx >= 0 &&
    pickerCrossTargetActiveIdx < pickerCrossTargetSuggestions.length
      ? pickerCrossTargetSuggestions[pickerCrossTargetActiveIdx]
      : null

  const pickerCrossTargetDisplayValue =
    pickerCrossTargetId != null
      ? (seeds.find((s) => s.seedId === pickerCrossTargetId)?.name ??
        pickerCrossTargetQuery)
      : pickerCrossTargetQuery

  const pickerSeeds = useMemo(() => {
    const base = filterSeeds(seeds, pickerQuery, favoriteSeedIds)
    if (!pickerCrossFilter || !seedsById || pickerTargetIsPot) return base

    // 有鄰格作物：依鄰格雜交可能性篩選（原有邏輯）
    if (pickerNeighborSeedIds.length > 0) {
      return base.filter((s) => {
        const canCross = pickerNeighborSeedIds.some(
          (nid) => findIntercrossOutcomes(seedsById, s.seedId, nid).length > 0,
        )
        if (!canCross) return false
        if (pickerCrossTargetId == null) return true
        return pickerNeighborSeedIds.some((nid) =>
          findIntercrossOutcomes(seedsById, s.seedId, nid).some(
            (o) => o.outcomeSeedId === pickerCrossTargetId,
          ),
        )
      })
    }

    // 無鄰格作物 + 雜交目標子代：列出該結果的所有親代
    if (pickerCrossTargetId != null) {
      const parentIds = getParentSeedIdsOnResultConfirmedCrosses(
        seedsById,
        pickerCrossTargetId,
      )
      return base.filter((s) => parentIds.has(s.seedId))
    }

    // 無鄰格作物 + 無雜交目標：列出可用於雜交的親代
    const crossableIds = new Set<number>()
    for (const seed of Object.values(seedsById)) {
      for (const c of seed.confirmedCrosses ?? []) {
        const a = c.parentA.seedId
        const b = c.parentB.seedId
        if (a != null && Number.isFinite(a)) crossableIds.add(a)
        if (b != null && Number.isFinite(b)) crossableIds.add(b)
      }
    }
    return base.filter((s) => crossableIds.has(s.seedId))
  }, [
    seeds,
    pickerQuery,
    favoriteSeedIds,
    pickerCrossFilter,
    pickerTargetIsPot,
    seedsById,
    pickerNeighborSeedIds,
    pickerCrossTargetId,
  ])

  useEffect(() => {
    if (!pickerTarget) return
    setPickerHighlight(pickerSeeds.length > 0 ? 0 : null)
  }, [pickerTarget, pickerQuery, pickerSeeds.length])

  useEffect(() => {
    if (!pickerTarget || pickerHighlight == null) return
    const el = document.getElementById(`field-picker-opt-${pickerHighlight}`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [pickerTarget, pickerHighlight, pickerSeeds.length])

  useEffect(() => {
    if (!pickerTarget) return
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      dismissSeedPicker()
    }
    document.addEventListener('keydown', onDocKey, true)
    return () => document.removeEventListener('keydown', onDocKey, true)
  }, [pickerTarget, dismissSeedPicker])

  useEffect(
    () => () => {
      clearPickerDismissTimer()
    },
    [clearPickerDismissTimer],
  )

  const confirmPickerSeed = useCallback(
    (s: SeedSummary) => {
      if (!pickerTarget) return
      void plantSelectedSeed(
        pickerTarget.fieldId,
        pickerTarget.slotId,
        s,
      )
    },
    [pickerTarget, plantSelectedSeed],
  )

  const handlePickerSearchKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissSeedPicker()
        return
      }
      const n = pickerSeeds.length
      if (n === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPickerHighlight((h) => {
          const cur = h ?? -1
          return Math.min(cur + 1, n - 1)
        })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPickerHighlight((h) => {
          const cur = h ?? n
          return Math.max(cur - 1, 0)
        })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const idx = pickerHighlight ?? 0
        const s = pickerSeeds[idx]
        if (s) confirmPickerSeed(s)
      }
    },
    [pickerSeeds, pickerHighlight, confirmPickerSeed, dismissSeedPicker],
  )

  return (
    <div
      className={
        fieldLayoutEditMode
          ? 'field-page field-page--layout-edit'
          : 'field-page'
      }
    >
      <header className="field-page-header">
        <h1 className="field-page-title">田地管理</h1>
        <div className="field-toolbar">
          <button
            type="button"
            className="field-btn field-btn--primary"
            onClick={openNewField}
          >
            新增田地
          </button>
          <button
            type="button"
            className={
              fieldLayoutEditMode
                ? 'field-btn field-btn--primary field-btn--toggle-on'
                : 'field-btn'
            }
            aria-pressed={fieldLayoutEditMode}
            title={
              fieldLayoutEditMode
                ? '結束版面編輯，可再次施肥與收成重種'
                : '調整田地棋盤位置、刪除或複製田'
            }
            onClick={() => setFieldLayoutEditMode((v) => !v)}
          >
            {fieldLayoutEditMode ? '完成編輯' : '編輯版面'}
          </button>
        </div>
      </header>
      {fieldLayoutEditMode && !loading && !loadError ? (
        <p className="field-layout-edit-banner" role="status">
          編輯版面中：可拖曳田地卡片調整棋盤位置，或使用複製／刪除。施肥與收成重種請先按「完成編輯」。
        </p>
      ) : null}

      <CopyCropNameToast
        toastKey={copyToast?.key ?? null}
        message={copyToast?.message}
        onDismiss={() => setCopyToast(null)}
      />

      {loading && <p className="field-muted">載入中…</p>}
      {loadError ? (
        <p className="field-muted" style={{ color: '#fca5a5' }} role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && fields.length === 0 ? (
        <div className="field-empty-hint">
          <p className="field-empty-hint-lead">
            尚無田地。請點上方「新增田地」開始你的耕田人生。
          </p>
          <ul className="field-empty-hint-rules">
            <li>
              <strong>雜交提示</strong>
              ：種下作物時，依鄰格右 → 下 → 上 → 左順序尋找第一個鄰格進行雜交，格中會顯示可能獲得的種子。滑鼠懸停可看到完整資訊。
            </li>
            <li>
              <strong>施肥</strong>
              ：僅作用於已種植、尚未可收成，且該格施肥冷卻已結束的格子，每格施肥後需隔1小時才可再對該格施肥。效果為將剩餘收成時間縮短為原本的 99%（即剩餘時間 × 0.99）。施肥後1分鐘內可取消本次施肥，避免誤操作。
            </li>
            <li>
              <strong>總覽棋盤</strong>
              ：田地以固定寬度卡片排列，每列可放幾塊依視窗寬度自動計算；開啟「編輯版面」後可拖曳田地卡片調整位置。
            </li>
          </ul>
        </div>
      ) : null}

      {!loading && !loadError && fields.length > 0 ? (
        <div className="field-fields-board" ref={fieldsBoardRef}>
          {boardCellsForView.map(({ index, field }) => (
            <div
              key={field?.id ?? `board-slot-${index}`}
              className={
                fieldLayoutEditMode && dragOverCellIndex === index
                  ? 'field-board-slot field-board-slot--drag-over'
                  : 'field-board-slot'
              }
              onDragOver={(e) => {
                if (!fieldLayoutEditMode) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverCellIndex(index)
                growBoardIfDragNeedsRowBelow(index)
              }}
              onDrop={(e) => {
                if (!fieldLayoutEditMode) return
                e.preventDefault()
                const id = e.dataTransfer.getData('application/x-ffxiv-field-id')
                if (id) {
                  layoutGridDropHandledRef.current = true
                  setFields((prev) => applyFieldGridDrop(prev, id, index))
                }
                setDragOverCellIndex(null)
                setDraggingFieldId(null)
              }}
            >
              {field ? (
                <section
                  className={
                    draggingFieldId === field.id
                      ? 'field-block field-block--dragging'
                      : fieldLayoutEditMode
                        ? 'field-block field-block--layout-drag'
                        : 'field-block'
                  }
                  draggable={fieldLayoutEditMode}
                  onDragStart={(e) => {
                    if (!fieldLayoutEditMode) {
                      e.preventDefault()
                      return
                    }
                    if (fieldBlockDragShouldCancel(e.target)) {
                      e.preventDefault()
                      return
                    }
                    setDragBoardExtraRows(0)
                    layoutGridDropHandledRef.current = false
                    e.dataTransfer.setData(
                      'application/x-ffxiv-field-id',
                      field.id,
                    )
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingFieldId(field.id)
                  }}
                  onDragEnd={() => {
                    if (
                      fieldLayoutEditMode &&
                      !layoutGridDropHandledRef.current &&
                      dragOverCellIndex !== null
                    ) {
                      const targetCell = boardCellsForView.find(
                        (c) => c.index === dragOverCellIndex,
                      )
                      if (targetCell?.field == null) {
                        setFields((prev) =>
                          applyFieldGridDrop(
                            prev,
                            field.id,
                            dragOverCellIndex,
                          ),
                        )
                      }
                    }
                    layoutGridDropHandledRef.current = false
                    setDraggingFieldId(null)
                    setDragOverCellIndex(null)
                  }}
                >
                  <div className="field-block-top">
                    <div className="field-block-title-wrap">
                      <h2 className="field-block-title">
                        {formatFieldHeading(field)}
                      </h2>
                      {fieldLayoutEditMode ? (
                        <button
                          type="button"
                          draggable={false}
                          className="field-title-edit-btn"
                          aria-label="修改田地位置與編號"
                          title="修改田地位置與編號"
                          onClick={() => {
                            setNewFieldOpen(false)
                            setDraftLocation(field.locationLabel)
                            setDraftPlotNumber(field.plotNumber)
                            setEditingFieldId(field.id)
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                    <div className="field-block-toolbar">
                      {fieldLayoutEditMode ? (
                        <>
                          <button
                            type="button"
                            draggable={false}
                            className="field-title-edit-btn"
                            aria-label="複製此田"
                            title="複製此田（含各格作物與倒數）"
                            onClick={() => duplicateField(field.id)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <rect
                                width="14"
                                height="14"
                                x="8"
                                y="8"
                                rx="2"
                                ry="2"
                              />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            draggable={false}
                            className="field-title-edit-btn field-title-edit-btn--danger"
                            aria-label="刪除此田"
                            title="刪除此田"
                            onClick={() => setDeleteConfirmFieldId(field.id)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" x2="10" y1="11" y2="17" />
                              <line x1="14" x2="14" y1="11" y2="17" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        (() => {
                          const canFertilize = fieldHasFertilizableSlot(
                            field,
                            nowTick,
                          )
                          const canHarvestReplant = fieldHasHarvestReadySlot(
                            field,
                            nowTick,
                          )
                          const showUndo = canUndoFertilize(field, nowTick)
                          const nextAt = getNextFertilizeEligibleAt(
                            field,
                            nowTick,
                          )
                          const fertilizeDisabledTitle =
                            nextAt != null
                              ? `下次施肥時間: ${new Date(nextAt).toLocaleString(undefined, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}`
                              : '目前無可施肥的格子；請在有作物的格子種植並待收成進行中。'
                          return (
                            <>
                              {showUndo ? (
                                <button
                                  type="button"
                                  draggable={false}
                                  className="field-title-edit-btn"
                                  aria-label="取消施肥"
                                  title="取消施肥，施肥後一分鐘內可以取消，避免誤操作。"
                                  onClick={() => undoFertilizeField(field.id)}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                  >
                                    <path d="M3 7v6h6" />
                                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  draggable={false}
                                  className="field-title-edit-btn field-title-edit-btn--primary"
                                  aria-label="施肥"
                                  onClick={() => fertilizeField(field.id)}
                                  disabled={!canFertilize}
                                  title={
                                    canFertilize
                                      ? '施肥：對冷卻已結束且有剩餘收成時間的格子生效（每格 1 小時冷卻）'
                                      : fertilizeDisabledTitle
                                  }
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                  >
                                    <path d="M12 3c-4 6-8 8-8 12a8 8 0 0 0 16 0c0-4-4-6-8-12z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                type="button"
                                draggable={false}
                                className="field-block-replant-btn"
                                aria-label="收成重種，適用本塊田內已可收成之格子"
                                title={
                                  canHarvestReplant
                                    ? '將本田所有「已可收成」的格子視為採收後立刻重種同一作物，收成計時重新開始。'
                                    : '目前沒有已可收成的格子。'
                                }
                                disabled={!canHarvestReplant || !seedsById}
                                onClick={() =>
                                  harvestAndReplantField(field.id)
                                }
                              >
                                收成重種
                              </button>
                            </>
                          )
                        })()
                      )}
                    </div>
                  </div>
                  {(() => {
                    const displayLastFertilizeTime =
                      field.plotNumber === 'pot'
                        ? latestFertilizeAtFromSlots(field.slots)
                        : field.lastFertilizeTime
                    return (
                  <p className="field-last-fertilize">
                    上次施肥：
                    {displayLastFertilizeTime != null
                      ? new Date(displayLastFertilizeTime).toLocaleString(
                          undefined,
                          {
                            dateStyle: 'medium',
                            timeStyle: 'medium',
                          },
                        )
                      : '尚未施肥'}
                  </p>
                    )
                  })()}

                  <div className="field-grid-wrap">
                    {field.plotNumber === 'pot' ? (
                      <div
                        className="field-grid field-grid--pot"
                        aria-label={`${formatFieldHeading(field)} 盆栽格`}
                      >
                        {POT_SLOT_IDS.map((sid, idx) => {
                          const slot = field.slots.find((s) => s.id === sid)!
                          const canHarvest = slotReadyToHarvest(slot, nowTick)
                          const seedRec =
                            slot.seedId != null
                              ? seedsById?.[String(slot.seedId)] ?? null
                              : null
                          const isPotExclusive = isFlowerpotExclusiveSeed(seedRec)
                          const cropLabel = plotSlotCropLabel(slot, seedsById)
                          const seedItemName = plotSlotSeedItemLabel(slot, seedsById)
                          const dyeFormula = dedupePotColorSteps(slot.potColorSteps)
                            .map((c) => POT_COLOR_LABEL[c])
                            .join('+')
                          const dyeLines = computePotResultLines(
                            slot,
                            seedRec,
                            seedRec ? flowerpotBySeedId?.[String(seedRec.seedId)] : undefined,
                          )
                          const potUndoActive = isPotActionUndoActive(slot, nowTick)
                          const potUndoAction = potUndoActive
                            ? slot.potActionUndo?.action ?? null
                            : null
                          const potCooldownActive = isPotActionCoolingDown(
                            slot,
                            nowTick,
                          )
                          const potSlotLoc = field.potSlotLocations?.[String(sid)] ?? ''
                          return (
                            <div key={`${field.id}-pot-${sid}`} className="field-cell">
                              <div className="field-cell-main">
                                <div className="field-cell-head">
                                  <span className="field-cell-label">
                                    <span className="field-cell-label-key">
                                      {idx + 1}
                                    </span>
                                    {potSlotLoc ? (
                                      <span className="field-pot-slot-loc">{potSlotLoc}</span>
                                    ) : null}
                                    {fieldLayoutEditMode ? (
                                      <button
                                        type="button"
                                        draggable={false}
                                        className="field-pot-slot-loc-edit-btn"
                                        aria-label={`修改盆栽 ${idx + 1} 位置`}
                                        title={`修改盆栽 ${idx + 1} 位置`}
                                        onClick={() => {
                                          setPotSlotLocDraft(potSlotLoc)
                                          setPotSlotLocEdit({ fieldId: field.id, slotId: sid })
                                        }}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden
                                        >
                                          <path d="M12 20h9" />
                                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        </svg>
                                      </button>
                                    ) : null}
                                  </span>
                                  {slot.seedId != null && !canHarvest ? (
                                    <button
                                      type="button"
                                      draggable={false}
                                      className="field-cell-clear"
                                      aria-label="清除此格作物"
                                      title="清除此格作物"
                                      onClick={() => clearSlot(field.id, sid, 'trash')}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden
                                      >
                                        <path d="M3 6h18" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        <line x1="10" x2="10" y1="11" y2="17" />
                                        <line x1="14" x2="14" y1="11" y2="17" />
                                      </svg>
                                    </button>
                                  ) : null}
                                  {slot.seedId == null && slot.clearUndo != null ? (
                                    <button
                                      type="button"
                                      draggable={false}
                                      className="field-cell-restore"
                                      aria-label="還原清除前的作物"
                                      title="還原清除前的作物"
                                      onClick={() => restoreClearedSlot(field.id, sid)}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden
                                      >
                                        <path d="M3 7v6h6" />
                                        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                                      </svg>
                                    </button>
                                  ) : null}
                                </div>
                                <div className="field-cell-seed">
                                  {slot.seedId != null ? (
                                    <div className="field-cell-seed-row">
                                      <Link
                                        to={seedDetailHref(
                                          'fields',
                                          slot.seedId,
                                        )}
                                        draggable={false}
                                        className="field-cell-seed-link"
                                        onClick={() => {
                                          setSeedDetailActiveSection('fields')
                                          resetSeedDetailPath(
                                            'fields',
                                            slot.seedId!,
                                          )
                                        }}
                                      >
                                        {cropLabel}
                                      </Link>
                                      {seedItemName ? (
                                        <CopyCropNameButton
                                          name={seedItemName}
                                          className="field-cell-seed-copy-btn"
                                          ariaLabel={`複製種子名稱：${seedItemName}`}
                                          title="複製種子名稱"
                                          onCopied={(text) =>
                                            setCopyToast({
                                              key: Date.now(),
                                              message: `已複製種子名稱：${text}`,
                                            })
                                          }
                                        />
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="field-cell-seed-empty">未設定</span>
                                  )}
                                </div>
                                {slot.seedId != null && isPotExclusive ? (
                                  <div className="field-pot-dye-status">
                                    <div className="field-pot-dye-formula">
                                      {dyeFormula || '尚未使用油粕'}
                                    </div>
                                    <div className="field-pot-dye-lines">
                                      {(dyeLines.length > 0 ? dyeLines : ['—']).map((line, i) => (
                                        <div key={`${i}-${line}`} className="field-pot-dye-line">
                                          {line}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                {slot.seedId != null && isPotExclusive && !canHarvest ? (
                                  <div className="field-pot-bottom">
                                    <div className="field-pot-dye-actions" data-field-no-drag>
                                      {(['red', 'blue', 'yellow'] as const).map((colorKey) => (
                                        <button
                                          key={colorKey}
                                          type="button"
                                          draggable={false}
                                          className={`field-pot-color-btn field-pot-color-btn--${colorKey}${
                                            potUndoAction === colorKey
                                              ? ' field-pot-color-btn--undo'
                                              : ''
                                          }`}
                                          title={
                                            potUndoAction === colorKey
                                              ? `取消本次${POT_COLOR_TOOLTIP_LABEL[colorKey]}色油粕`
                                              : `使用${POT_COLOR_TOOLTIP_LABEL[colorKey]}色油粕`
                                          }
                                          onClick={() => {
                                            if (potUndoAction === colorKey) {
                                              undoPotSlotAction(field.id, sid)
                                              return
                                            }
                                            applyPotColorFertilizer(field.id, sid, colorKey)
                                          }}
                                          disabled={
                                            potUndoAction === colorKey
                                              ? false
                                              : potUndoActive || potCooldownActive
                                          }
                                        >
                                          {potUndoAction === colorKey ? (
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              aria-hidden
                                            >
                                              <path d="M3 7v6h6" />
                                              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                                            </svg>
                                          ) : (
                                            POT_COLOR_LABEL[colorKey]
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="field-cell-time field-cell-time--pot">
                                      {formatRemaining(slot.harvestDeadline, nowTick)}
                                    </div>
                                  </div>
                                ) : null}
                                {slot.seedId != null && !isPotExclusive && !canHarvest ? (
                                  <div className="field-cell-time">
                                    {formatRemaining(slot.harvestDeadline, nowTick)}
                                  </div>
                                ) : null}
                              </div>
                              {slot.seedId != null && canHarvest ? (
                                <button
                                  type="button"
                                  draggable={false}
                                  className="field-cell-btn field-cell-btn--harvest"
                                  aria-label="收成並清空此格"
                                  title="收成並清空此格"
                                  onClick={() => clearSlot(field.id, sid, 'harvest')}
                                >
                                  收成
                                </button>
                              ) : null}
                              {slot.seedId == null ? (
                                <button
                                  type="button"
                                  draggable={false}
                                  className="field-cell-btn"
                                  onClick={() => {
                                    clearPickerDismissTimer()
                                    setPickerQuery('')
                                    setPickerTarget({
                                      fieldId: field.id,
                                      slotId: sid,
                                    })
                                  }}
                                >
                                  設定作物
                                </button>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div
                        className="field-grid"
                        aria-label={`${formatFieldHeading(field)} 九宮格`}
                      >
                        {[0, 1, 2].flatMap((row) =>
                          [0, 1, 2].map((col) => {
                            if (row === 1 && col === 1) {
                              return (
                                <div
                                  key={`${field.id}-c`}
                                  className="field-cell field-cell--center"
                                  title="不可種植"
                                >
                                  ✕
                                </div>
                              )
                            }
                            const sid = FIELD_SLOTS.find(
                              (s) => s.row === row && s.col === col,
                            )!.id
                            const slot = field.slots.find((s) => s.id === sid)!
                            const canHarvest = slotReadyToHarvest(slot, nowTick)
                            const crossHintsUi = visibleCrossHints(slot.crossAtPlant)
                            const cropLabel = plotSlotCropLabel(slot, seedsById)
                            const seedItemName = plotSlotSeedItemLabel(slot, seedsById)
                            return (
                              <div
                                key={`${field.id}-${sid}`}
                                className={
                                  crossHintsUi.length > 0
                                    ? 'field-cell field-cell--has-cross-hint'
                                    : 'field-cell'
                                }
                              >
                                <div className="field-cell-main">
                                  <div className="field-cell-head">
                                    <span className="field-cell-label">
                                      <span className="field-cell-label-key">
                                        {FIELD_SLOTS.find((x) => x.id === sid)!.label}
                                      </span>
                                    </span>
                                    {slot.seedId != null && !canHarvest ? (
                                      <button
                                        type="button"
                                        draggable={false}
                                        className="field-cell-clear"
                                        aria-label="清除此格作物"
                                        title="清除此格作物"
                                        onClick={() => clearSlot(field.id, sid, 'trash')}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden
                                        >
                                          <path d="M3 6h18" />
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                          <line x1="10" x2="10" y1="11" y2="17" />
                                          <line x1="14" x2="14" y1="11" y2="17" />
                                        </svg>
                                      </button>
                                    ) : null}
                                    {slot.seedId == null && slot.clearUndo != null ? (
                                      <button
                                        type="button"
                                        draggable={false}
                                        className="field-cell-restore"
                                        aria-label="還原清除前的作物"
                                        title="還原清除前的作物"
                                        onClick={() => restoreClearedSlot(field.id, sid)}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden
                                        >
                                          <path d="M3 7v6h6" />
                                          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                                        </svg>
                                      </button>
                                    ) : null}
                                  </div>
                                  <div className="field-cell-seed">
                                    {slot.seedId != null ? (
                                      <div className="field-cell-seed-row">
                                        <Link
                                          to={seedDetailHref(
                                            'fields',
                                            slot.seedId,
                                          )}
                                          draggable={false}
                                          className="field-cell-seed-link"
                                          onClick={() => {
                                            setSeedDetailActiveSection('fields')
                                            resetSeedDetailPath(
                                              'fields',
                                              slot.seedId!,
                                            )
                                          }}
                                        >
                                          {cropLabel}
                                        </Link>
                                        {seedItemName ? (
                                          <CopyCropNameButton
                                            name={seedItemName}
                                            className="field-cell-seed-copy-btn"
                                            ariaLabel={`複製種子名稱：${seedItemName}`}
                                            title="複製種子名稱"
                                            onCopied={(text) =>
                                              setCopyToast({
                                                key: Date.now(),
                                                message: `已複製種子名稱：${text}`,
                                              })
                                            }
                                          />
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="field-cell-seed-empty">
                                        未設定
                                      </span>
                                    )}
                                  </div>
                                  {slot.seedId != null && crossHintsUi[0] != null ? (
                                    <FieldCellCrossOutcomesInline hint={crossHintsUi[0]} />
                                  ) : null}
                                  {slot.seedId != null && !canHarvest ? (
                                    <div className="field-cell-time">
                                      {formatRemaining(slot.harvestDeadline, nowTick)}
                                    </div>
                                  ) : null}
                                </div>
                                {slot.seedId != null && canHarvest ? (
                                  <button
                                    type="button"
                                    draggable={false}
                                    className="field-cell-btn field-cell-btn--harvest"
                                    aria-label="收成並清空此格"
                                    title="收成並清空此格"
                                    onClick={() => clearSlot(field.id, sid, 'harvest')}
                                  >
                                    收成
                                  </button>
                                ) : null}
                                {slot.seedId == null ? (
                                  <button
                                    type="button"
                                    draggable={false}
                                    className="field-cell-btn"
                                    onClick={() => {
                                      clearPickerDismissTimer()
                                      setPickerQuery('')
                                      setPickerTarget({
                                        fieldId: field.id,
                                        slotId: sid,
                                      })
                                    }}
                                  >
                                    設定作物
                                  </button>
                                ) : null}
                                {crossHintsUi[0] != null ? (
                                  <FieldCellCrossTooltip hint={crossHintsUi[0]} />
                                ) : null}
                              </div>
                            )
                          }),
                        )}
                      </div>
                    )}
                  </div>
                </section>
              ) : fieldLayoutEditMode ? (
                <div
                  className={
                    draggingFieldId
                      ? 'field-board-empty field-board-empty--active'
                      : 'field-board-empty'
                  }
                >
                  {draggingFieldId ? '放開以放置' : '空白格'}
                </div>
              ) : (
                <div className="field-board-slot-phantom" aria-hidden />
              )}
            </div>
          ))}
        </div>
      ) : null}

      {fieldMetaDialogOpen && !loadError ? (
        <div
          className="field-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-meta-dialog-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeFieldMetaDialog()
          }}
        >
          <div
            className={`field-modal field-modal--add-field${
              editingFieldId ? '' : ''
            }`}
          >
            <div className="field-modal-head" id="field-meta-dialog-title">
              {editingFieldId ? '編輯田地' : '新增田地'}
            </div>
            <div className="field-add-field-body">
              <fieldset className="field-add-field-group">
                <label className="field-add-field-input-label" htmlFor="field-location-input">
                  位置（最多 {FIELD_LOCATION_MAX_CHARS} 字）
                </label>
                <div className="field-add-field-input-wrap">
                  <input
                    id="field-location-input"
                    className="field-add-field-text"
                    maxLength={FIELD_LOCATION_MAX_CHARS}
                    value={draftLocation}
                    onChange={(e) => setDraftLocation(e.target.value)}
                    placeholder="例：個人房"
                    autoComplete="off"
                  />
                  <span
                    className="field-add-field-charcount"
                    aria-live="polite"
                  >
                    {draftLocation.length}/{FIELD_LOCATION_MAX_CHARS}
                  </span>
                </div>
              </fieldset>
              <fieldset className="field-add-field-group">
                <legend className="field-add-field-legend">田編號</legend>
                <div className="field-add-field-options">
                  {editingFieldId && draftPlotNumber === 'pot' ? (
                    <label className="field-add-field-radio">
                      <input
                        type="radio"
                        name="field-plot"
                        checked
                        disabled
                      />
                      盆栽
                    </label>
                  ) : (
                    <>
                      {([1, 2, 3] as const).map((n) => (
                        <label key={n} className="field-add-field-radio">
                          <input
                            type="radio"
                            name="field-plot"
                            checked={draftPlotNumber === n}
                            onChange={() => setDraftPlotNumber(n)}
                          />
                          {n} 號
                        </label>
                      ))}
                      {!editingFieldId && (
                        <label className="field-add-field-radio">
                          <input
                            type="radio"
                            name="field-plot"
                            checked={draftPlotNumber === 'pot'}
                            onChange={() => setDraftPlotNumber('pot')}
                          />
                          盆栽
                        </label>
                      )}
                    </>
                  )}
                </div>
              </fieldset>
              <div className="field-add-field-actions">
                <button
                  type="button"
                  className="field-btn"
                  onClick={closeFieldMetaDialog}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="field-btn field-btn--primary"
                  onClick={confirmFieldMeta}
                >
                  {editingFieldId ? '儲存' : '建立'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmFieldId && !loadError ? (
        <div
          className="field-modal-backdrop field-modal-backdrop--confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-delete-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmFieldId(null)
          }}
        >
          <div className="field-modal field-modal--confirm">
            <div className="field-modal-head" id="field-delete-title">
              刪除此田？
            </div>
            <div className="field-confirm-body">
              <p className="field-confirm-text">此操作無法復原。</p>
              <div className="field-add-field-actions">
                <button
                  type="button"
                  className="field-btn"
                  onClick={() => setDeleteConfirmFieldId(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="field-btn field-btn--danger"
                  onClick={() => deleteField(deleteConfirmFieldId)}
                >
                  刪除
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {potSlotLocEdit && !loadError ? (
        <div
          className="field-modal-backdrop field-modal-backdrop--confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pot-slot-loc-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPotSlotLocEdit(null)
          }}
        >
          <div className="field-modal field-modal--confirm">
            <div className="field-modal-head" id="pot-slot-loc-title">
              修改盆栽位置
            </div>
            <div className="field-confirm-body">
              <div className="field-add-field-input-wrap">
                <input
                  className="field-add-field-text"
                  maxLength={POT_SLOT_LOCATION_MAX_CHARS}
                  value={potSlotLocDraft}
                  onChange={(e) => setPotSlotLocDraft(e.target.value)}
                  placeholder="例：樓梯左邊"
                  autoComplete="off"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const { fieldId, slotId } = potSlotLocEdit
                      const loc = potSlotLocDraft.trim().slice(0, POT_SLOT_LOCATION_MAX_CHARS)
                      setFields((prev) =>
                        prev.map((f) => {
                          if (f.id !== fieldId) return f
                          const locs = { ...f.potSlotLocations }
                          if (loc) {
                            locs[String(slotId)] = loc
                          } else {
                            delete locs[String(slotId)]
                          }
                          return { ...f, potSlotLocations: Object.keys(locs).length > 0 ? locs : undefined }
                        }),
                      )
                      setPotSlotLocEdit(null)
                    }
                  }}
                />
                <span className="field-add-field-charcount" aria-live="polite">
                  {potSlotLocDraft.length}/{POT_SLOT_LOCATION_MAX_CHARS}
                </span>
              </div>
              <div className="field-add-field-actions">
                <button
                  type="button"
                  className="field-btn"
                  onClick={() => setPotSlotLocEdit(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="field-btn field-btn--primary"
                  onClick={() => {
                    const { fieldId, slotId } = potSlotLocEdit
                    const loc = potSlotLocDraft.trim().slice(0, POT_SLOT_LOCATION_MAX_CHARS)
                    setFields((prev) =>
                      prev.map((f) => {
                        if (f.id !== fieldId) return f
                        const locs = { ...f.potSlotLocations }
                        if (loc) {
                          locs[String(slotId)] = loc
                        } else {
                          delete locs[String(slotId)]
                        }
                        return { ...f, potSlotLocations: Object.keys(locs).length > 0 ? locs : undefined }
                      }),
                    )
                    setPotSlotLocEdit(null)
                  }}
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pickerTarget && !loadError ? (
        <div
          className="field-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-picker-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) dismissSeedPicker()
          }}
        >
          <div className="field-modal">
            <div className="field-modal-head" id="field-picker-title">
              選擇種子
              {!pickerTargetIsPot && pickerCrossFilter && (
                <div className="field-picker-target-combobox">
                  <div className="field-picker-target-input-wrap">
                    <input
                      ref={pickerCrossTargetInputRef}
                      type="search"
                      className="field-picker-target-input"
                      placeholder="雜交目標子代"
                      autoComplete="off"
                      role="combobox"
                      aria-label="期望雜交出的子代"
                      aria-expanded={
                        pickerCrossTargetOpen &&
                        pickerCrossTargetSuggestions.length > 0
                      }
                      aria-controls={
                        pickerCrossTargetOpen &&
                        pickerCrossTargetSuggestions.length > 0
                          ? pickerCrossTargetListId
                          : undefined
                      }
                      aria-autocomplete="list"
                      aria-activedescendant={
                        pickerCrossTargetActiveSuggestion != null
                          ? `${pickerCrossTargetListId}-opt-${pickerCrossTargetActiveSuggestion.seedId}`
                          : undefined
                      }
                      value={pickerCrossTargetDisplayValue}
                      onChange={(e) => {
                        setPickerCrossTargetId(null)
                        setPickerCrossTargetQuery(e.target.value)
                        setPickerCrossTargetOpen(true)
                      }}
                      onFocus={() => setPickerCrossTargetOpen(true)}
                      onKeyDown={(e) => {
                        if (
                          !pickerCrossTargetOpen &&
                          (e.key === 'ArrowDown' || e.key === 'ArrowUp')
                        ) {
                          e.preventDefault()
                          setPickerCrossTargetOpen(true)
                          setPickerCrossTargetActiveIdx(
                            pickerCrossTargetSuggestions.length > 0 ? 0 : -1,
                          )
                          return
                        }
                        if (!pickerCrossTargetOpen) return
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setPickerCrossTargetActiveIdx((i) =>
                            i < 0
                              ? 0
                              : Math.min(
                                  i + 1,
                                  pickerCrossTargetSuggestions.length - 1,
                                ),
                          )
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setPickerCrossTargetActiveIdx((i) =>
                            i < 0
                              ? pickerCrossTargetSuggestions.length - 1
                              : Math.max(i - 1, 0),
                          )
                        } else if (e.key === 'Enter') {
                          if (pickerCrossTargetActiveSuggestion == null) return
                          e.preventDefault()
                          setPickerCrossTargetId(
                            pickerCrossTargetActiveSuggestion.seedId,
                          )
                          setPickerCrossTargetQuery(
                            pickerCrossTargetActiveSuggestion.name,
                          )
                          setPickerCrossTargetOpen(false)
                          pickerCrossTargetInputRef.current?.blur()
                        } else if (e.key === 'Escape') {
                          e.stopPropagation()
                          setPickerCrossTargetOpen(false)
                          setPickerCrossTargetActiveIdx(-1)
                        }
                      }}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setPickerCrossTargetOpen(false)
                          if (pickerCrossTargetId != null) return
                          const q = pickerCrossTargetQueryRef.current
                          const resolved = resolveSeedFromQuery(
                            seeds,
                            q,
                            favoriteSeedIds,
                          )
                          if (resolved) {
                            setPickerCrossTargetId(resolved.seedId)
                            setPickerCrossTargetQuery(resolved.name)
                          }
                        }, 150)
                      }}
                    />
                    {pickerCrossTargetDisplayValue ? (
                      <button
                        type="button"
                        className="field-picker-target-clear"
                        aria-label="清除雜交目標子代"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setPickerCrossTargetId(null)
                          setPickerCrossTargetQuery('')
                          setPickerCrossTargetOpen(true)
                          setPickerCrossTargetActiveIdx(-1)
                          pickerCrossTargetInputRef.current?.focus()
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  {pickerCrossTargetOpen &&
                  pickerCrossTargetSuggestions.length > 0 ? (
                    <ul
                      id={pickerCrossTargetListId}
                      className="field-picker-target-suggestions"
                      role="listbox"
                      aria-label="期望子代建議"
                    >
                      {pickerCrossTargetSuggestions.map((s, idx) => (
                        <li key={s.seedId} role="none">
                          <button
                            type="button"
                            role="option"
                            id={`${pickerCrossTargetListId}-opt-${s.seedId}`}
                            aria-selected={idx === pickerCrossTargetActiveIdx}
                            className={`field-picker-target-suggest-btn${idx === pickerCrossTargetActiveIdx ? ' field-picker-target-suggest-btn--active' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() =>
                              setPickerCrossTargetActiveIdx(idx)
                            }
                            onClick={() => {
                              setPickerCrossTargetId(s.seedId)
                              setPickerCrossTargetQuery(s.name)
                              setPickerCrossTargetOpen(false)
                            }}
                          >
                            <img
                              src={publicUrl(s.iconUrl)}
                              alt=""
                              width={20}
                              height={20}
                              loading="lazy"
                            />
                            <span className="field-picker-target-suggest-name">
                              {s.name}
                            </span>
                            {favoriteSeedIds.has(s.seedId) ? (
                              <SeedFavoriteHeartIcon
                                variant="solid"
                                className="field-modal-item-fav-icon"
                              />
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
              {!pickerTargetIsPot && (
                <button
                  type="button"
                  className={`field-picker-cross-filter-btn${pickerCrossFilter ? ' field-picker-cross-filter-btn--on' : ''}`}
                  onClick={togglePickerCrossFilter}
                  title={
                    pickerCrossFilter
                      ? '關閉雜交篩選'
                      : pickerNeighborSeedIds.length === 0
                        ? '只顯示可用於雜交的種子'
                        : '只顯示可與鄰格雜交的種子'
                  }
                >
                  <span className="field-picker-cross-filter-indicator" aria-hidden="true" />
                  雜交提示篩選
                </button>
              )}
            </div>
            <input
              id="field-picker-search"
              type="search"
              className="field-modal-search"
              placeholder="搜尋名稱…"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              onKeyDown={handlePickerSearchKeyDown}
              autoFocus
              autoComplete="off"
              role="combobox"
              aria-expanded
              aria-controls={pickerListId}
              aria-autocomplete="list"
              aria-activedescendant={
                pickerHighlight != null &&
                pickerHighlight >= 0 &&
                pickerHighlight < pickerSeeds.length
                  ? `field-picker-opt-${pickerHighlight}`
                  : undefined
              }
            />
            <ul
              id={pickerListId}
              className="field-modal-list"
              role="listbox"
              aria-label="種子清單"
            >
              {pickerSeeds.map((s, i) => (
                <li key={s.seedId} role="presentation">
                  <button
                    id={`field-picker-opt-${i}`}
                    type="button"
                    role="option"
                    aria-selected={pickerHighlight === i}
                    className={`field-modal-item${
                      pickerHighlight === i ? ' field-modal-item--highlight' : ''
                    }`}
                    onMouseEnter={() => setPickerHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      void plantSelectedSeed(
                        pickerTarget.fieldId,
                        pickerTarget.slotId,
                        s,
                      )
                    }}
                  >
                    <img
                      src={publicUrl(s.iconUrl)}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                    />
                    <span className="field-modal-item-name">{s.name}</span>
                    {favoriteSeedIds.has(s.seedId) ? (
                      <span
                        className="field-modal-item-fav"
                        title="最愛"
                        aria-label="最愛"
                      >
                        <SeedFavoriteHeartIcon
                          variant="solid"
                          className="field-modal-item-fav-icon"
                        />
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
