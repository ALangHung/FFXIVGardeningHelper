# FFXIV 園藝小幫手

以 [React](https://react.dev/) + [Vite](https://vite.dev/) 建置的《最終幻想 XIV》園藝參考網頁，介面為**繁體中文**，協助查詢種子、雜交結果與規劃田地版面。

## 功能概覽

| 頁面 | 路徑 | 說明 |
|------|------|------|
| 種子列表 | `/` | 瀏覽與搜尋種子，可進入詳情 |
| 雜交計算器 | `/cross` | 依親本組合推算雜交相關結果 |
| 田地管理 | `/fields` | 在格狀田地上配置種子、輔助版面規劃 |
| 種子詳情 | `/seed/:seedId` | 單一種子的詳細資訊與相關資料 |

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

種子相關 JSON 體積較大；開發與建置使用的公開資料位於 **`public/data/`**（例如 `seeds-by-id.json`、`seeds-summary.json`）。`data/` 目錄可用於腳本產出或中間檔。

| 指令 | 用途 |
|------|------|
| `npm run scrape:seeds` | 自 ffxivgardening.com 擷取種子詳情頁並寫入 `data/` |
| `npm run apply:tw-names` | 套用繁中物品名稱等（見腳本說明） |
| `npm run build:seeds-summary` | 產生列表／搜尋用摘要 JSON |
| `npm run translate:harvest-locations` | 採集地點等翻譯處理 |
| `npm run download:seed-icons` | 下載種子圖示資源 |
| `npm run copy:seeds-by-id` | 將 `seeds-by-id` 等複製到 `public/data/` 供前端載入 |

更新資料後請確認 `public/data/` 內容與建置流程一致，必要時重新執行 `npm run build`。

## 專案結構（精簡）

```
├── data/                 # 腳本產出之原始／大型 JSON（可選）
├── public/data/          # 前端 fetch 使用的公開資料
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

## 免責與版權

本專案為玩家社群工具，遊戲內名稱、圖示與數值之版權歸 Square Enix 與相關權利人所有。資料來源網站之使用請遵守各站條款；擷取腳本僅供維護本專案資料時謹慎使用。

## 授權

若未另行於儲存庫標示授權條款，請以專案內實際 `LICENSE` 檔案（若有）為準。
