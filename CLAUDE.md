# CLAUDE.md

此檔案為 Claude Code（claude.ai/code）在本專案中工作時的指引。

## 建置與開發

```bash
npm run dev          # Vite 開發伺服器（HMR 熱更新）
npm run build        # tsc && vite build（TypeScript 檢查 + 正式建置）
npm run preview      # 本機預覽正式建置結果
```

未設定 lint 或測試指令。型別檢查透過 `npm run build` 中的 `tsc` 執行，亦可獨立使用 `npx tsc --noEmit`。

### 資料 Pipeline 腳本

`public/data/` 中的資料檔為預先建置。重新產生流程：

```bash
npm run scrape:seeds                    # 從 ffxivgardening.com 爬取 → seeds-by-id.json
npm run build:seeds-i18n                # 合併 Teamcraft i18n → seeds-i18n.json
npm run build:seeds-summary             # 擷取摘要 → seeds-summary.json
npm run translate:harvest-locations     # 新增繁體中文採集地點名稱
npm run build:flowerpot-crops-by-color  # 建立盆栽染色對應表
npm run report:multi-outcome-crosses    # 稽核結果超過 2 種的雜交組合 → reports/
npm run strip:multi-outcome-alternates  # 清除 seeds-by-id.json 中被標記組合的 alternate
```

取得新資料後建議執行順序：`scrape:seeds` → `build:seeds-i18n` → `translate:harvest-locations` → `build:seeds-summary`。

## 架構

**技術棧：** React 19 + TypeScript（strict）+ Vite + React Router DOM 7。無狀態管理套件、無元件庫。深色主題搭配自訂 CSS 變數。

### 路由（App.tsx）

| 路徑 | 元件 | 儲存方式 |
|------|------|----------|
| `/` | HomePage | — |
| `/tutorial` | TutorialPage | sessionStorage（最後分頁） |
| `/seeds` | SeedListPage | sessionStorage（篩選／排序） |
| `/cross` | CrossCalculatorPage | sessionStorage（計算器狀態） |
| `/fields` | FieldManagementPage | localStorage（田地資料） |
| `/seed/:seedId` | SeedDetailPage | sessionStorage（脈絡 + 瀏覽紀錄） |
| `/known-issues` | KnownIssuesPage | — |

`/seed/:seedId` 為**統一詳情頁**——脈絡（列表／雜交／田地）透過 sessionStorage 的 `seedDetailActiveSection` 追蹤。各區段各自維護已瀏覽種子 ID 序列，供返回導航使用。

### 資料載入（seedDataApi.ts）

從 `public/data/` 取得 JSON，搭配 Promise 去重（每種資料在同一工作階段僅 fetch 一次）：
- **seeds-summary.json** + **seeds-i18n.json** → 透過 `seedI18nMerge.ts` 合併，供列表頁使用
- **seeds-by-id.json** + **seeds-i18n.json** → 豐富化為 `SeedRecord`，供詳情／雜交頁使用
- 市場價格可選擇性從 Universalis API 取得（每批 50 筆 ID）

### 狀態持久化（sessionUiState.ts）

- **sessionStorage**：UI 篩選、排序、雜交計算器輸入、導航瀏覽紀錄、教學最後分頁、種子詳情脈絡
- **localStorage**：`GardenField[]`（田地管理持久化資料）、最愛種子 ID（透過 `storage` 事件跨分頁同步）

### 雜交邏輯（crossOutcomes.ts）

- `findIntercrossOutcomes(seedsById, parentA, parentB)` — 掃描所有種子的 `confirmedCrosses` 尋找匹配的親代組合，回傳主要 + alternate 結果，依結果 ID 去重並保留最佳效率
- `computeCrossHintsAtPlant(seedsById, seedId, slots, slotId)` — 檢查 4 個鄰格（右 → 下 → 上 → 左優先順序）是否有合法雜交配方；用於田地 UI 的種植時提示

### 田地管理（fieldGridLogic.ts + fieldBoardLayout.ts）

- 3×3 格，中央停用，8 個可種植格位（FieldSlotId 0–7 = 遊戲編號 1–8）
- 施肥：減少剩餘收成時間 1%，每格 1 小時冷卻，1 分鐘復原視窗
- 田地狀態包含 `lastFertilizeTime`（顯示用）與每格 `lastFertilizeAt`（冷卻用），搭配 `fertilizeUndo` 快照供復原

### 多語系（seedI18nMerge.ts）

支援語系：zh-Hant、en、ja、zh-Hans。顯示名稱解析：`seedItemDisplayName()` 取得種子名稱，`cropOrSeedDisplayName()` 取得作物名稱（優先使用 crop，不存在時退回 seedItem）。退回鏈在繁體中文缺失時會使用日文。

### 導覽列跳轉邏輯（sessionUiState.ts）

`seedListTabTarget`、`crossTabTarget`、`fieldsTabTarget` 決定點擊導覽列分頁時的目標：
- **在自己區段內** → 該區段主頁（點擊時清除瀏覽紀錄）
- **在其他區段且有已存瀏覽紀錄** → 上次瀏覽的 `/seed/:id`
- **無瀏覽紀錄** → 該區段主頁

`seedListTabTarget` 使用反向判斷（先檢查是否在列表區內，否則回傳已存種子）。`crossTabTarget` 與 `fieldsTabTarget` 原生採用相同模式。

## Commit Message 風格

採用 **Conventional Commits** 格式，描述文字使用**繁體中文**。

### 格式

單一焦點的變更：

```
<type>(<scope>): <繁體中文描述>
```

跨模組或涉及多個檔案的較大變更，加上 bullet 說明 body：

```
<type>(<scope>): <繁體中文描述>

- <模組／檔案>：<具體說明>
- <模組／檔案>：<具體說明>
```

### Type

| type | 用途 |
|------|------|
| `feat` | 新增功能 |
| `fix` | 修正 bug |
| `refactor` | 重構（不新增功能、不修 bug） |
| `style` | 純樣式／格式調整（CSS、排版） |
| `docs` | 文件更新 |
| `ci` | CI/CD 設定變更 |

### Scope（英文，小寫）

常用 scope 對應功能模組：

- `field` / `fields` — 田地管理頁
- `cross` / `cross-calc` — 雜交計算器
- `seed-detail` — 種子詳情頁
- `nav` — 頂部導覽列
- `ui` — 通用 UI 元件或跨頁互動
- `home` — 首頁
- `session` — Session 狀態管理
- `data` / `data+i18n` — 資料層或資料與 i18n 同步調整
- `css` — 全域樣式
- 若變更跨多個模組，省略 scope，直接寫 `feat: ...`

### Subject 描述規則

- 使用繁體中文
- 多個主題以「、」分隔，關聯動作以「並」連接
- 結尾不加標點符號

### Body 規則

- 每條 bullet 以 `- ` 開頭
- 格式：`- <模組名稱／檔案路徑>：<繁體中文說明>`
- 程式碼識別符（函式名、檔名、路徑）保留英文原名，其餘說明用繁體中文
- 同一 bullet 內多個子項以「、」或「；」分隔

### 範例

單行（單一模組）：

```
feat(field): 選種視窗雜交篩選新增期望結果輸入框
fix(cross): 雜交結果效率改由結果種子 confirmedCrosses 對應列取得
refactor(data): 種子 harvestLocation 移除「Slot N @ 」前綴
style(css): 調整全域滾動條樣式並保留容器圓角
```

多行（跨模組大變更）：

```
feat: 已知問題頁、多結果雜交維護腳本，並強化雜交／田地與文件

- 新增 KnownIssuesPage（/known-issues）：打包 reports/multi-outcome-cross-pairs.txt?raw、種子列表式名稱樣式、alternate 刪除線；App 頂欄與 HomePage 連結
- scripts：list-multi-outcome-cross-pairs.mjs、strip-multi-outcome-alternates.mjs；package.json 新增 report:multi-outcome-crosses、strip:multi-outcome-alternates
- public/data/seeds-by-id.json：依維護流程調整多結果組合之 alternate；reports/ 納入 multi-outcome 報告
- crossOutcomes.ts：補齊親代／結果反查等輔助函式
- CrossCalculatorPage（+ CSS）、FieldManagementPage、seedPickerQuery：種子搜尋／選取與介面調整
- README.md：頂欄與功能表補已知問題、維護指令與 reports/ 說明；vite-env.d.ts：*.txt?raw 宣告
```
