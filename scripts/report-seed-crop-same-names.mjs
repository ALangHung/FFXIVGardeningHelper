/**
 * 列出 seeds-i18n.json 中種子道具與作物名稱相同的 seedId（依語系）。
 * Run: node scripts/report-seed-crop-same-names.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const I18N = join(ROOT, 'public', 'data', 'i18n', 'seeds-i18n.json')

const LOCALES = ['zh-Hant', 'en', 'ja', 'zh-Hans']

async function main() {
  const { bySeedId } = JSON.parse(await readFile(I18N, 'utf8'))

  const byLocale = Object.fromEntries(LOCALES.map((loc) => [loc, []]))

  for (const id of Object.keys(bySeedId).sort((a, b) => Number(a) - Number(b))) {
    const e = bySeedId[id]
    if (e?.crop == null) continue
    for (const loc of LOCALES) {
      const a = (e?.seedItem?.[loc] ?? '').trim()
      const b = (e.crop[loc] ?? '').trim()
      if (a && a === b) byLocale[loc].push({ seedId: id, name: a })
    }
  }

  for (const loc of LOCALES) {
    const rows = byLocale[loc]
    console.log(`\n=== ${loc} 種子與作物名稱相同（共 ${rows.length} 筆）===`)
    for (const { seedId, name } of rows) {
      console.log(`  seedId ${seedId}\t${name}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
