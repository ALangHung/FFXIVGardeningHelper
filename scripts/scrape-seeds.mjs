/**
 * Fetches seed detail pages from ffxivgardening.com (SeedID 1–107) and writes JSON.
 * Run: node scripts/scrape-seeds.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'data')
const BASE = 'https://www.ffxivgardening.com/seed-details.php'

const DELAY_MS = 400

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseSeedIdFromHref(href) {
  if (!href) return null
  const m = String(href).match(/SeedID=(\d+)/i)
  return m ? Number(m[1], 10) : null
}

function parseMainDetails($) {
  const main = $('.col-sm-8.blog-main').first()
  const titleEl = main.find('h3').has('strong').first()
  const iconSrc = titleEl.find('img').attr('src') ?? null
  const name = titleEl.find('strong').last().text().trim()

  const fields = {}
  main.find('h5').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim()
    const colon = t.indexOf(':')
    if (colon === -1) return
    const key = t.slice(0, colon).trim()
    const val = t.slice(colon + 1).trim()
    fields[key] = val
  })

  return {
    name,
    iconPath: iconSrc,
    seedType: fields['Seed Type'] ?? null,
    growTime: fields['Grow Time'] ?? null,
    wiltTime: fields['Wilt Time'] ?? null,
    cropYield: fields['Crop Yield'] ?? null,
    seedYield: fields['Seed Yield'] ?? null,
    harvestLocation: fields['Harvest Location'] ?? null,
    nodeLevel: fields['Node Level'] ?? null,
  }
}

function parseDidYouKnow($) {
  const p = $('.blog-main.dyk p').first()
  if (!p.length) return null
  return p
    .html()
    ?.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim() ?? null
}

function parseConfirmedCrossesCount($) {
  const h1 = $('h1.blog-post-title').filter((_, el) => {
    return $(el).text().includes('CONFIRMED CROSSES')
  }).first()
  const small = h1.find('small').first().text().trim()
  const m = small.match(/\((\d+)\)/)
  return m ? Number(m[1], 10) : 0
}

function parseEfficiency(td) {
  const hidden = td.find('span[style*="display: none"]').first().text().trim()
  const num = hidden ? Number(hidden, 10) : null
  const img = td.find('img').attr('src') ?? ''
  let rating = null
  if (img.includes('green')) rating = 'green'
  else if (img.includes('yellow')) rating = 'yellow'
  else if (img.includes('red')) rating = 'red'
  return { value: Number.isFinite(num) ? num : null, rating }
}

function parseParentCell($, td) {
  const a = td.find('a').first()
  const href = a.attr('href') ?? ''
  const seedId = parseSeedIdFromHref(href)
  const growSpan = td.find('span.small').first().text().trim()
  const growM = growSpan.match(/\((\d+)\)/)
  const growDays = growM ? Number(growM[1], 10) : null
  const name = a
    .clone()
    .find('span')
    .remove()
    .end()
    .text()
    .trim()
  return { seedId, name: name || null, growDays }
}

function parseAlternateCell($, td) {
  const a = td.find('a').first()
  if (a.length) {
    const href = a.attr('href') ?? ''
    const seedId = parseSeedIdFromHref(href)
    const img = a.find('img').first()
    const name = img.attr('title')?.trim() || a.text().trim() || null
    return { seedId, name }
  }
  const txt = td.text().replace(/\s+/g, ' ').trim()
  return txt ? { seedId: null, name: txt } : { seedId: null, name: null }
}

function parseConfirmedCrosses($) {
  const rows = []
  $('#myTable tbody tr').each((_, tr) => {
    const cells = $(tr).find('td')
    if (cells.length < 8) return
    const loopClass = $(tr).attr('class') ?? ''
    const isLoop = /\bloop\b/.test(loopClass) && !loopClass.includes('nonloop')
    const parentA = parseParentCell($, cells.eq(1))
    const parentB = parseParentCell($, cells.eq(5))
    const alternate = parseAlternateCell($, cells.eq(6))
    const eff = parseEfficiency(cells.eq(7))
    rows.push({
      isLoop,
      parentA,
      parentB,
      alternate,
      efficiency: eff.value,
      efficiencyRating: eff.rating,
    })
  })
  return rows
}

function parseUsedInOtherCrosses($) {
  const out = []
  $('.used-in a.tooltip_display').each((_, a) => {
    const href = $(a).attr('onclick') ?? ''
    const m = href.match(/otherCrosses\((\d+),\s*(\d+)\)/)
    const text = $(a).clone().children().remove().end().text().replace(/\s+/g, ' ').trim()
    const img = $(a).find('img').first()
    const iconSrc = img.attr('src') ?? null
    const targetId = m ? Number(m[1], 10) : null
    if (targetId != null && text) {
      out.push({ seedId: targetId, name: text, iconPath: iconSrc })
    }
  })
  return out
}

async function fetchSeed(seedId) {
  const url = `${BASE}?SeedID=${seedId}`
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'FFXIVGardeningHelper/1.0 (+local dev; contact: none) respectful scraper',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  const html = await res.text()
  return html
}

function parsePage(html, seedId) {
  const $ = cheerio.load(html)
  const details = parseMainDetails($)
  const didYouKnow = parseDidYouKnow($)
  const confirmedCrossesCount = parseConfirmedCrossesCount($)
  const confirmedCrosses = parseConfirmedCrosses($)
  const usedInOtherCrosses = parseUsedInOtherCrosses($)

  const notObtainable = /not obtainable via intercrossing/i.test(
    $('.container').text(),
  )

  return {
    seedId,
    sourceUrl: `${BASE}?SeedID=${seedId}`,
    ...details,
    didYouKnow,
    confirmedCrossesCount,
    confirmedCrossCountMatches: confirmedCrosses.length === confirmedCrossesCount,
    confirmedCrosses,
    notObtainableViaIntercrossing: notObtainable,
    usedInOtherCrosses,
  }
}

async function main() {
  const seeds = []
  const errors = []

  for (let id = 1; id <= 107; id++) {
    try {
      const html = await fetchSeed(id)
      const row = parsePage(html, id)
      seeds.push(row)
      process.stdout.write(`OK ${id}/107 ${row.name ?? '?'}\n`)
    } catch (e) {
      errors.push({ seedId: id, error: String(e?.message ?? e) })
      process.stdout.write(`ERR ${id}/107 ${e?.message ?? e}\n`)
    }
    if (id < 107) await sleep(DELAY_MS)
  }

  await mkdir(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, 'seeds.json')
  const meta = {
    generatedAt: new Date().toISOString(),
    source: 'https://www.ffxivgardening.com/seed-details.php',
    seedIdRange: [1, 107],
    count: seeds.length,
    errors: errors.length ? errors : undefined,
  }
  await writeFile(outPath, JSON.stringify({ meta, seeds }, null, 2), 'utf8')

  const indexPath = join(OUT_DIR, 'seeds-by-id.json')
  const byId = Object.fromEntries(seeds.map((s) => [String(s.seedId), s]))
  await writeFile(
    indexPath,
    JSON.stringify({ meta, seedsById: byId }, null, 2),
    'utf8',
  )

  console.log(`\nWrote ${outPath}`)
  console.log(`Wrote ${indexPath}`)
  if (errors.length) console.warn(`Completed with ${errors.length} error(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
