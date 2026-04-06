/**
 * 依 reports/multi-outcome-cross-pairs.txt 中標為 [alternate] 的雜交結果，
 * 在 public/data/seeds-by-id.json 內將對應親本組合列上的 alternate.seedId 清除（改為 null）。
 *
 * 例如親本 32×40 的 alternate 為 39：在「結果種子」30 的 confirmedCrosses 中，
 * 找到 parent (32,40) 且 alternate.seedId===39 的列，改為 alternate: { seedId: null }。
 *
 * Run:
 *   node scripts/strip-multi-outcome-alternates.mjs
 *   node scripts/strip-multi-outcome-alternates.mjs --dry-run
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REPORT = join(ROOT, 'reports', 'multi-outcome-cross-pairs.txt')
const SEEDS_JSON = join(ROOT, 'public', 'data', 'seeds-by-id.json')

function pairMatch(idA, idB, p1, p2) {
  if (idA == null || idB == null) return false
  return (idA === p1 && idB === p2) || (idA === p2 && idB === p1)
}

/**
 * @returns {{ parentA: number, parentB: number, alternateSeedId: number }[]}
 */
function parseReport(text) {
  const targets = []
  /** @type {{ a: number, b: number } | null} */
  let section = null
  const headerRe = /^【\d+\s*種結果】親本\s+(\d+)（[^）]*）\s*×\s*(\d+)（/

  for (const line of text.split(/\r?\n/)) {
    const hm = line.match(headerRe)
    if (hm) {
      section = { a: Number(hm[1]), b: Number(hm[2]) }
      continue
    }
    if (!section) continue
    const bullet = line.match(/^\s*·\s*(\d+).*\[(primary|alternate)\]\s*$/)
    if (bullet && bullet[2] === 'alternate') {
      targets.push({
        parentA: section.a,
        parentB: section.b,
        alternateSeedId: Number(bullet[1]),
      })
    }
  }
  return targets
}

function applyStrip(seedsById, targets, dryRun) {
  const log = []
  let totalCleared = 0

  for (const t of targets) {
    let hits = 0
    for (const seed of Object.values(seedsById)) {
      for (const row of seed.confirmedCrosses ?? []) {
        if (
          !pairMatch(
            row.parentA?.seedId,
            row.parentB?.seedId,
            t.parentA,
            t.parentB,
          )
        )
          continue
        if (row.alternate?.seedId !== t.alternateSeedId) continue

        hits++
        log.push(
          `親本 ${t.parentA}×${t.parentB}，清除 alternate ${t.alternateSeedId}（列於結果種子 ${seed.seedId} 之 confirmedCrosses）`,
        )
        if (!dryRun) {
          row.alternate = { seedId: null }
        }
        totalCleared++
      }
    }
    if (hits === 0) {
      log.push(
        `⚠ 未找到：親本 ${t.parentA}×${t.parentB}，alternate ${t.alternateSeedId}`,
      )
    } else if (hits > 1) {
      log.push(
        `⚠ 同一條件命中 ${hits} 列（已全部清除）：親本 ${t.parentA}×${t.parentB}，alternate ${t.alternateSeedId}`,
      )
    }
  }

  return { log, totalCleared }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const [reportText, seedsPayload] = await Promise.all([
    readFile(REPORT, 'utf8'),
    readFile(SEEDS_JSON, 'utf8'),
  ])

  const targets = parseReport(reportText)
  if (targets.length === 0) {
    console.error(`報告中沒有解析到 [alternate] 列：${REPORT}`)
    process.exit(1)
  }

  const data = JSON.parse(seedsPayload)
  const seedsById = data.seedsById ?? {}

  const { log, totalCleared } = applyStrip(seedsById, targets, dryRun)

  for (const line of log) console.error(line)
  console.error(
    `\n報告 alternate 筆數：${targets.length}，已處理列數：${totalCleared}${dryRun ? '（dry-run，未寫入）' : ''}`,
  )

  if (!dryRun) {
    const out = `${JSON.stringify(data, null, 2)}\n`
    await writeFile(SEEDS_JSON, out, 'utf8')
    console.error(`已寫入 ${SEEDS_JSON}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
