# FPGA Register Analyzer — Frontend

> 版本：v0.44　|　日期：2026-06-25　|　開發者：Aaron Hsueh

這是 FPGA Register Analyzer 的前端，使用 **React 18 + Vite + TypeScript**。

前端已不再是 mock 原型，現已串接 **Python FastAPI 後端**：Register Excel 上傳、dat 批次分析、結果查詢、CSV / Excel 下載皆透過後端 REST API 完成。`src/mock/data.ts` 僅保留版本資訊等少量靜態內容，分析資料一律來自後端。

前端預設透過 `axios` 連線後端（`src/api/client.ts` 的 `baseURL` 為 `http://localhost:8000`），請先啟動後端再使用前端。

---

## 給只想「直接使用」的人（Windows，免裝 Node.js）

前端已預先編譯並提交進 git（`frontend/dist/`），後端會把它當靜態檔 serve（FastAPI SPA mount）。因此分發到沒有 Node.js 的機器（例如 Windows 同事）時：

1. `git pull` 取得最新的 `frontend/dist/`。
2. 啟動後端（見 `scripts/Windows/start.bat`）。
3. 後端啟動後，瀏覽器開啟後端網址（預設 `http://localhost:8000`）即可使用，**完全不需要 Node.js / npm**。

> 開發者每次改完前端，請在 Mac 執行 `npm run build`，再把更新後的 `frontend/dist/` 一起 commit，Windows 端只要 `git pull` 並重啟後端就會看到最新前端。

---

## 給開發者：本機開發

### 啟動前置：安裝 Node.js

開發前端需要 Node.js（**僅開發者需要**；純使用者用上面的預編譯方式即可）。

#### 方式 A：用 Homebrew

```bash
brew install node
```

#### 方式 B：到官網下載

https://nodejs.org/ — 下載 LTS 版（建議 v20 以上），雙擊安裝。

安裝完成後確認版本：

```bash
node --version    # 應顯示 v20.x.x 或更高
npm --version
```

### 開發指令

```bash
cd "/Users/aaronhsueh/Desktop/FPGA analyer/frontend"
npm install        # 第一次需要，會裝相依套件
npm run dev        # 啟動開發伺服器，瀏覽器自動開啟 http://localhost:5173
npm run build      # 產生 production build 到 frontend/dist（tsc -b && vite build）
npm run preview    # 在本機預覽已 build 的 dist
```

開發時請確保後端（`http://localhost:8000`）已啟動，否則前端 API 呼叫會失敗。

---

## 技術棧重點

| 項目 | 說明 |
| --- | --- |
| 框架 | React 18 + Vite 5 + TypeScript 5 |
| 路由 | `react-router-dom` v6 |
| i18n | `react-i18next` + `i18next`（zh-TW / en，預設 zh-TW） |
| HTTP | `axios`（`src/api/client.ts`，baseURL `http://localhost:8000`） |
| 視覺化 | `echarts` + `echarts-for-react`、`heatmap.js`（高斯熱力圖） |
| 樣式 | 自寫 CSS（白底簡潔風，無大型元件庫，整站無 emoji） |

詳細版本見 `package.json`（目前 `version: 0.44.0`）。

---

## 頁面 / 路由

| 路由 | 名稱 | 功能 |
| --- | --- | --- |
| `/` | Dashboard | 統計卡片、最近批次、快速開始指引 |
| `/registers` | Register 管理 | 上傳 Register Excel（可自訂版本名稱）、列出 / 刪除版本 |
| `/analyze` | 分析 | 三步驟：選 Register → 上傳 dat（可整個資料夾匯入）→ 開始分析 |
| `/results/:batchId` | 分析結果 | 五個 Tab + 頂部摘要 + CSV / Excel 下載 |
| `/history` | 歷史紀錄 | Batch 列表，點「查看」回到結果頁 |

共用版面（`Layout.tsx`）：左側 sidebar、白底、右上角語言切換、sidebar 底部置中「版本資訊」按鈕（點擊跳 Modal：版本號 / 日期 / Aaron Hsueh）。

---

## 結果頁五個 Tab

結果頁（`Results.tsx`）由左至右共五個 Tab：

| # | Tab | 內容 |
| - | --- | --- |
| 1 | 表格檢視 | 行 = test case、欄 = bit field；支援 prefix / case range（依檔名或資料夾名萃取 ID 過濾）/ 欄位篩選 / 值篩選（多條件 AND）/ 分頁，可切換 Hex / Decimal（預設 Decimal） |
| 2 | 資料散佈分析 | X / Y 兩個下拉，可切換 2D 熱力圖與散佈圖；熱力圖支援自動 / 精準格狀 / 平滑模糊、密度、色階上限、字體微調等控制 |
| 3 | 統計分析 | Mode 類型欄位直方圖 + Magnitude 類型欄位直方圖與 stats 摘要（min / max / mean / median / stddev），可展開詳細曲線 |
| 4 | Overall | 基本摘要 + 類型分佈 + Magnitude range 涵蓋率表 + Mode segment 涵蓋率 + 組合分析 Top-10（最少 2 欄位，無上限） |
| 5 | 警告訊息 | 超出有效範圍的數值清單 + Unknown address 全批次摘要 |

---

## Bit Field 類型設定

`BitFieldTypeModal.tsx` 可把每個 bit field 標記為三類之一（Mode / Magnitude / Others），並可設定每欄位的有效範圍；設定以 localStorage 持久化（每個 register 一份，key 形如 `fpga-bit-field-ranges-{registerId}`）。

- **Mode**：列舉型，進入 Mode 直方圖；可設 min / max 與片段範圍（segments）。
- **Magnitude**：量值型，進入 Magnitude 直方圖、散佈圖預設與 range 涵蓋率；可設每欄位有效範圍。
- **Others**：不參與直方圖與散佈圖預設。

預設類型由名稱關鍵字判定（如含 `EN` / `ENABLE` / `MODE` → mode；`ERR` / `CHKSUM` 等 → others；其餘 → magnitude）。

### v0.44：每欄位「數值解讀格式」（magnitude）

magnitude 欄位的有效範圍彈窗（`RangePopup`）最上方新增一個單選下拉，選擇該欄位的解讀格式 `ValueFormat`：

| 格式 | 說明 |
| --- | --- |
| Unsigned（`uint`） | 無號整數，預設範圍 `0 ~ 2^width-1` |
| Signed（`sint`） | 二補數有號整數，預設範圍 `-2^(width-1) ~ 2^(width-1)-1`，允許負的下限 |
| FP32（`fp32`） | 僅 `width === 32` 時出現；以 IEEE 754 重解讀 32-bit pattern。選用時 min / max 輸入會 disabled 並清空 |

重點：**後端永遠儲存原始 unsigned 整數，格式只改變前端「怎麼解讀」這個值**。共用 helper 集中在 `src/hooks/useBitFieldTypes.ts`：`interpretValue(raw, width, format)`（sint 用二補數、fp32 用 `Uint32Array` / `Float32Array` 重解讀）與 `formatBounds(width, format)`。

套用範圍：統計分析（StatsPanel）、Overall 涵蓋率（OverallPanel，fp32 該欄顯示「FP32」、涵蓋率顯示「—」）、超出範圍警告（Results.tsx / ResultsTable 高亮）皆在比較前先 `interpretValue`。**不套用**於主資料表儲存格數值與 2D 熱力圖 / 散佈圖（這兩處維持顯示原始 unsigned 值）。

---

## 目錄結構

```
frontend/
├── src/
│   ├── main.tsx                      # entrypoint
│   ├── App.tsx                       # 路由設定
│   ├── api/
│   │   ├── client.ts                 # axios client（baseURL http://localhost:8000）
│   │   ├── registers.ts              # Register Excel 上傳 / 列表 / 刪除
│   │   ├── batches.ts                # 建 batch / 取得結果 / 下載
│   │   └── dateUtils.ts              # 時區處理（本地時間顯示）
│   ├── components/
│   │   ├── Layout.tsx                # sidebar + topbar + outlet
│   │   ├── Sidebar.tsx
│   │   ├── VersionModal.tsx
│   │   ├── LanguageToggle.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── charts/
│   │   │   ├── Heatmap2D.tsx         # 2D 熱力圖（ECharts + heatmap.js）
│   │   │   ├── Scatter.tsx           # 散佈圖（資源預算分區）
│   │   │   ├── Histogram.tsx         # 直方圖
│   │   │   ├── ValueCurve.tsx        # 詳細曲線
│   │   │   └── heatmapData.ts        # 分箱 / 自適應純函式
│   │   └── results/
│   │       ├── ResultsTable.tsx      # 表格檢視（篩選 / 分頁 / 值篩選）
│   │       ├── DualRegisterChart.tsx # 資料散佈分析（X/Y 選擇 + 對調）
│   │       ├── StatsPanel.tsx        # 統計分析
│   │       ├── OverallPanel.tsx      # Overall
│   │       ├── BitFieldTypeModal.tsx # Bit Field 類型 / 有效範圍 / 格式設定
│   │       └── ColumnSelectorModal.tsx
│   ├── hooks/
│   │   └── useBitFieldTypes.ts       # 類型 / 範圍 / 格式 + interpretValue / formatBounds
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Registers.tsx
│   │   ├── Analyze.tsx
│   │   ├── Results.tsx               # 五個 Tab 容器
│   │   └── History.tsx
│   ├── i18n/
│   │   ├── index.ts                  # react-i18next 設定
│   │   ├── zh-TW.json
│   │   └── en.json
│   ├── mock/
│   │   └── data.ts                   # 版本資訊等少量靜態內容
│   ├── types/
│   │   └── heatmap.d.ts              # heatmap.js 型別宣告
│   └── styles/
│       └── global.css                # 白底 / 深藍強調色
├── public/
│   └── heatmap.min.js                # 以 <script> 全域載入 h337
├── dist/                             # 已 build 並提交 git，供無 Node.js 機器直接 serve
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

> 註：`dist/` 不在 `.gitignore`，而是刻意提交進版控，讓沒有 Node.js 的機器可直接由後端 serve。請在每次前端變更後重新 `npm run build` 並一併提交。
