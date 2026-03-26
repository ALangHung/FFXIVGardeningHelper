/**
 * Lists zh-Hant strings from seeds-i18n.json (seedItem + crop) with no exact `tw` match in tw-items.json.
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const I18N_JSON = join(ROOT, 'public', 'data', 'i18n', 'seeds-i18n.json')
const TW_ITEMS_JSON = join(
  ROOT,
  '..',
  'ffxiv-teamcraft',
  'libs',
  'data',
  'src',
  'lib',
  'json',
  'tw',
  'tw-items.json',
)

async function main() {
  const [i18nRaw, twRaw] = await Promise.all([
    readFile(I18N_JSON, 'utf8'),
    readFile(TW_ITEMS_JSON, 'utf8'),
  ])
  const { bySeedId } = JSON.parse(i18nRaw)
  const twItems = JSON.parse(twRaw)

  const twValues = new Set()
  for (const row of Object.values(twItems)) {
    if (row?.tw && typeof row.tw === 'string') twValues.add(row.tw.trim())
  }

  const names = new Set()
  for (const entry of Object.values(bySeedId)) {
    for (const key of ['seedItem', 'crop']) {
      const bundle = entry?.[key]
      const cw = bundle?.['zh-Hant']
      if (cw && typeof cw === 'string' && cw.trim() && cw.trim() !== '--')
        names.add(cw.trim())
    }
  }

  const missing = [...names].filter((n) => !twValues.has(n)).sort()

  console.log(
    `tw-items.json 內不重複的 tw 字串數量: ${twValues.size}`,
  )
  console.log(
    `seeds-i18n.json 內不重複的種子道具／作物（繁中）數量: ${names.size}`,
  )
  console.log(
    `\n以下 ${missing.length} 個名稱在 tw-items.json 中**沒有**任何一筆與之完全相同的「tw」欄位：\n`,
  )
  for (const m of missing) console.log(`  - ${m}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
