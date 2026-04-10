/**
 * 以與 src/crossOutcomes.ts 之 findIntercrossOutcomes 相同邏輯，
 * 枚舉全部種子兩兩雜交，列出「可能結果種類數 > 2」的親代組合。
 *
 * Run: node scripts/list-multi-outcome-cross-pairs.mjs
 * 報告：reports/multi-outcome-cross-pairs.txt
 *
 * 若演算法變更，請同步更新此檔與 crossOutcomes.ts。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SEEDS_JSON = join(ROOT, 'public', 'data', 'seeds-by-id.json')
const I18N_JSON = join(ROOT, 'public', 'data', 'i18n', 'seeds-i18n.json')
const OUT_REPORT = join(ROOT, 'reports', 'multi-outcome-cross-pairs.txt')

function effSortValue(e) {
  return e != null && Number.isFinite(e) ? e : Number.NEGATIVE_INFINITY
}

function pairMatch(idA, idB, p1, p2) {
  if (idA == null || idB == null) return false
  return (idA === p1 && idB === p2) || (idA === p2 && idB === p1)
}

function findCrossRowForParents(seed, parentId1, parentId2) {
  if (!seed?.confirmedCrosses?.length) return null
  for (const row of seed.confirmedCrosses) {
    if (pairMatch(row.parentA.seedId, row.parentB.seedId, parentId1, parentId2)) {
      return row
    }
  }
  return null
}

function efficiencyFromOutcomeRow(seedsById, outcomeSeedId, parentId1, parentId2, fallbackRow) {
  const rec = seedsById[String(outcomeSeedId)]
  const match = findCrossRowForParents(rec, parentId1, parentId2)
  const src = match ?? fallbackRow
  return {
    efficiency: src.efficiency,
    efficiencyRating: src.efficiencyRating,
    isLoop: src.isLoop,
  }
}

/**
 * 與 crossOutcomes.findIntercrossOutcomes 一致。
 */
function findIntercrossOutcomes(seedsById, parentId1, parentId2) {
  const raw = []
  for (const seed of Object.values(seedsById)) {
    for (const c of seed.confirmedCrosses ?? []) {
      if (!pairMatch(c.parentA.seedId, c.parentB.seedId, parentId1, parentId2)) continue
      const primaryEff = efficiencyFromOutcomeRow(
        seedsById,
        seed.seedId,
        parentId1,
        parentId2,
        c,
      )
      raw.push({
        outcomeSeedId: seed.seedId,
        outcomeName: null,
        kind: 'primary',
        outcomeGrowTime: seed.growTime ?? null,
        efficiency: primaryEff.efficiency,
        efficiencyRating: primaryEff.efficiencyRating,
        isLoop: primaryEff.isLoop,
      })
      const altId = c.alternate.seedId
      if (altId != null) {
        const altRec = seedsById[String(altId)]
        const altEff = efficiencyFromOutcomeRow(seedsById, altId, parentId1, parentId2, c)
        raw.push({
          outcomeSeedId: altId,
          outcomeName: null,
          kind: 'alternate',
          outcomeGrowTime: altRec?.growTime ?? null,
          efficiency: altEff.efficiency,
          efficiencyRating: altEff.efficiencyRating,
          isLoop: altEff.isLoop,
        })
      }
    }
  }

  const best = new Map()
  for (const row of raw) {
    const prev = best.get(row.outcomeSeedId)
    if (!prev) {
      best.set(row.outcomeSeedId, row)
      continue
    }
    const pv = effSortValue(prev.efficiency)
    const nv = effSortValue(row.efficiency)
    if (nv > pv) best.set(row.outcomeSeedId, row)
    else if (nv === pv && row.kind === 'primary' && prev.kind === 'alternate')
      best.set(row.outcomeSeedId, row)
  }

  return [...best.values()].sort((a, b) =>
    a.outcomeSeedId - b.outcomeSeedId,
  )
}

function seedZhName(bySeedId, id) {
  const e = bySeedId[String(id)]
  const n = e?.seedItem?.['zh-Hant']?.trim()
  return n || `種子 #${id}`
}

async function main() {
  const [seedsPayload, i18nPayload] = await Promise.all([
    readFile(SEEDS_JSON, 'utf8'),
    readFile(I18N_JSON, 'utf8'),
  ])
  const data = JSON.parse(seedsPayload)
  const seedsById = data.seedsById ?? {}
  const { bySeedId } = JSON.parse(i18nPayload)

  const ids = Object.keys(seedsById)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)

  const hits = []

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i]
      const b = ids[j]
      const outcomes = findIntercrossOutcomes(seedsById, a, b)
      if (outcomes.length > 2) {
        const names = outcomes.map((o) => ({
          id: o.outcomeSeedId,
          label: seedZhName(bySeedId, o.outcomeSeedId),
          kind: o.kind,
        }))
        hits.push({
          parentA: a,
          parentB: b,
          count: outcomes.length,
          outcomes: names,
        })
      }
    }
  }

  hits.sort((x, y) =>
    y.count !== x.count ? y.count - x.count : x.parentA - y.parentA || x.parentB - y.parentB,
  )

  const lines = []
  lines.push(
    `雜交可能結果超過 2 種的親代組合（與 findIntercrossOutcomes 去重邏輯相同）`,
    `種子數：${ids.length}，組合數：${(ids.length * (ids.length - 1)) / 2}，符合筆數：${hits.length}`,
    '',
  )

  for (const h of hits) {
    const pa = seedZhName(bySeedId, h.parentA)
    const pb = seedZhName(bySeedId, h.parentB)
    lines.push(
      `【${h.count} 種結果】親代 ${h.parentA}（${pa}）× ${h.parentB}（${pb}）`,
    )
    for (const o of h.outcomes) {
      lines.push(`  · ${o.id}\t${o.label}\t[${o.kind}]`)
    }
    lines.push('')
  }

  const text = lines.join('\n')
  await mkdir(dirname(OUT_REPORT), { recursive: true })
  await writeFile(OUT_REPORT, text, 'utf8')

  console.log(text)
  console.error(`\n已寫入 ${OUT_REPORT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
