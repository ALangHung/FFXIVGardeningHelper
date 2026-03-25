/**
 * 將 data/seeds-by-id.json 複製到 public/data/，供詳情頁 fetch。
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'data', 'seeds-by-id.json')
const DEST = join(ROOT, 'public', 'data', 'seeds-by-id.json')

async function main() {
  await mkdir(dirname(DEST), { recursive: true })
  await copyFile(SRC, DEST)
  console.log(`Copied ${SRC} -> ${DEST}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
