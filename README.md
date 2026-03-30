# FFXIV 園藝小幫手

以 [React](https://react.dev/) + [Vite](https://vite.dev/) 建置的《最終幻想 XIV》園藝參考網頁，介面為**繁體中文**，協助查詢種子、雜交結果與規劃田地版面。

## 功能概覽

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 種子列表 | `/` | 瀏覽與搜尋種子，可進入詳情；支援一鍵複製作物名稱 |
| 雜交計算器 | `/cross` | 依親本組合推算雜交結果，或由結果反查另一親本；支援一鍵複製名稱 |
| 田地管理 | `/fields` | 在格狀田地上配置種子、輔助版面規劃，並以本機儲存保留田地資料（關閉分頁／瀏覽器後仍有效） |
| 種子詳情 | `/seed/:seedId` | 單一種子詳細資訊、已確認雜交表（多語搜尋）、作物/種子產量提示 |

應用程式頂部亦標示資料來源連結（[ffxivgardening.com](https://www.ffxivgardening.com/)、[灰機 Wiki](https://ff14.huijiwiki.com/) 等）。

## 技術棧

- **執行環境**：Node.js（建議與 CI 對齊，例如 22）
- **前端**：React 19、React Router 7、TypeScript
- **建置**：Vite 8
- **資料**：執行期自 `public/data/` 載入 JSON（見下方「資料與維護腳本」）

## 快速開始

```bash
npm install
npm run dev
```

開發伺服器預設使用根路徑 `/`。建置產物會輸出至 `dist/`。

```bash
npm run build
npm run preview
```

## 部署與子路徑（GitHub Pages）

本專案建置時會讀取環境變數 **`VITE_BASE_PATH`**，須以**結尾斜線**的格式設定（例如 `/FFXIVGardeningHelper/`）。未設定時預設為 `/`。

- 本機若需模擬子路徑部署，可於建置前設定該變數後再執行 `npm run build`。
- [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) 在推送至 `main` 時會以 `/${{ github.event.repository.name }}/` 作為 `VITE_BASE_PATH` 建置並部署至 GitHub Pages；流程中會將 `dist/index.html` 複製為 `dist/404.html`，以利 SPA 路由。

執行期路由 basename 與靜態資源路徑會與 Vite 的 `base` 對齊（見 `src/main.tsx`、`src/publicUrl.ts`）。

## 資料與維護腳本

種子相關 JSON 體積較大；**擷取與建置腳本直接讀寫 `public/data/`**（與前端 fetch 路徑一致，無另存 `data/`）。

**多語名稱資料流**：① [ffxivgardening.com](https://www.ffxivgardening.com/)（擷取或 `public/data/seeds-gardening-en.json` 取得各 Seed 英文標題）→ ② [Teamcraft](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft) 靜態 JSON（`items` + `tw` + `zh`）對應道具 id → ③ `build:seeds-i18n` 寫入 **`public/data/i18n/seeds-i18n.json`（`seedItem` 種子包 + `crop` 收成物各四語系，以及合併搜尋字串 `nameSearchText`）**。列表／詳情／雜交畫面主顯示為作物名（`name`）；`seedItemName` 與 `nameSearchText` 仍由 i18n 合併供搜尋等用途。

| 指令 | 用途 |
|------|------|
| `npm run scrape:seeds` | 自 ffxivgardening.com 擷取種子詳情頁並寫入 `public/data/seeds-by-id.json`（英文 `name` 於各筆種子內） |
| `npm run fetch:seeds-gardening-en` | 選用：寫入 `public/data/seeds-gardening-en.json`（各頁英文標題）；若已擷取過可略過 |
| `npm run build:seeds-i18n` | 依 Teamcraft 產生 `public/data/i18n/seeds-i18n.json`（**`seedItem` + `crop` 多語** + 搜尋字串），並更新 `public/data/seeds-by-id.json`（移除內嵌名稱） |
| `npm run build:seeds-summary` | 產生 `public/data/seeds-summary.json`（不含名稱；顯示名由 i18n 合併） |
| `npm run translate:harvest-locations` | 採集地點等翻譯處理（就地更新 `public/data/seeds-by-id.json`） |
| `npm run download:seed-icons` | 下載種子圖示資源 |
| `npm run report:seed-crop-same` | 檢查 seedItem 與 crop 是否同名，協助資料檢核 |
| `npm run build:flowerpot-crops-by-color` | 依 `seeds-i18n.json` 的盆栽專用種子與腳本內混色英文對照，自 Teamcraft 產生 `public/data/flowerpot-crops-by-color.json`（八色染料＋混色收成之四語系名與 `teamcraftItemId`） |

**盆栽染色表**：`public/data/flowerpot-crops-by-color.json` 供種子詳情等畫面使用，記錄盆栽專用種子在八色染料與混色收成下的作物對應。種子與作物名稱以 `seeds-i18n.json` 為準；混色收成在 Teamcraft 上的英文基準須調整時，請編輯 `scripts/build-flowerpot-crops-by-color.mjs` 內的常數（如 `TEAMCRAFT_MIXED_EN`）。Teamcraft JSON 的取得方式與 `build:seeds-i18n` 相同（環境變數 `TEAMCRAFT_JSON`、本機 `ffxiv-teamcraft` 路徑，或遠端 `staging`）。`meta` 中「未染色」語意等同紅色染料，與檔案內 `note`／`fields.red` 一致。

**建議更新流程**（擷取新資料後）：`scrape:seeds` → `build:seeds-i18n`（可選 `fetch:seeds-gardening-en` 若無英文對照）→ `translate:harvest-locations`（若需要）→ `build:seeds-summary`。需維護盆栽染色表時，請在 `build:seeds-i18n` 完成（或至少已更新 `seeds-i18n.json`）後執行 `npm run build:flowerpot-crops-by-color`。

更新資料後請確認 `public/data/` 內容與建置流程一致，必要時重新執行 `npm run build`。

## 專案結構（精簡）

```
├── public/data/          # 種子 JSON、i18n、摘要、flowerpot-crops-by-color 等（腳本與前端共用路徑）
├── scripts/              # Node 維護腳本（.mjs）
├── src/
│   ├── App.tsx           # 路由與頂部導覽
│   ├── SeedListPage.tsx / SeedDetailPage.tsx
│   ├── CrossCalculatorPage.tsx
│   ├── FieldManagementPage.tsx
│   └── …
├── index.html
├── vite.config.ts
└── package.json
```

## 參考資料網站

- [FFXIV Gardening](https://www.ffxivgardening.com/)：種子、雜交配方與園藝資訊主要來源
- [灰機 Wiki（FF14）](https://ff14.huijiwiki.com/)：中文名稱與詞彙對照參考
- [FFXIV Teamcraft（Repo）](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft)：道具多語資料來源（`items`、`tw`、`zh` JSON）

## 免責與版權

本專案為玩家社群工具，遊戲內名稱、圖示與數值之版權歸 Square Enix 與相關權利人所有。資料來源網站之使用請遵守各站條款；擷取腳本僅供維護本專案資料時謹慎使用。

## 授權

若未另行於儲存庫標示授權條款，請以專案內實際 `LICENSE` 檔案（若有）為準。
