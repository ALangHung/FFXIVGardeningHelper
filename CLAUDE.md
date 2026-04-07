# FFXIV Gardening Helper — 專案規則

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

### Body 規則（有多個變更點時使用）

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
- crossOutcomes.ts：補齊親本／結果反查等輔助函式
- CrossCalculatorPage（+ CSS）、FieldManagementPage、seedPickerQuery：種子搜尋／選取與介面調整
- README.md：頂欄與功能表補已知問題、維護指令與 reports/ 說明；vite-env.d.ts：*.txt?raw 宣告
```
