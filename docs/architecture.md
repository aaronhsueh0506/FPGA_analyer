# FPGA Register Analyzer — 系統架構文件

> 版本：v0.31.0　|　日期：2026-05-20　|　開發者：Aaron Hsueh

---

## 1. 專案概述 (Overview)

FPGA Register Analyzer 是一個前後端網頁工具，用於整理 FPGA 測試案例的 Register 值分布。

每次 FPGA 跑出一輪測試，會產生一個 `.dat` 檔（記錄該 test case 各 register 的實際 32-bit 值）；對應的 Register 結構定義在一份 Excel（描述 address、bit field、初始值）。本工具的核心價值是：

1. 把 `.dat` 解析為人類可讀的 bit-field 值。
2. 把多個 `.dat`（最多 100 個）並列比較，產生一張「test case × bit field」的彙整表。
3. 視覺化為熱力圖，快速看出值的密集程度。
4. 儲存歷史紀錄供日後查詢。
5. 輸出 CSV 與 Excel 報告。

工具設計為本機可跑、未來可打包分發給同事，**無 AI 功能**，所有分析邏輯為固定演算法。

---

## 2. 核心對應演算法

### 2.1 Excel (Register 定義表) Schema

- 單一 sheet 名稱：`Registers`
- 表頭位於第 7 列，欄位如下：

| 欄位 | 說明 | 範例 |
| --- | --- | --- |
| `ADDR` | Register 的 hex address（4 字元） | `0010` |
| `Register` | Register 名稱 | `SPE_Function_Enable_Register` |
| `INI` | Bit field 的初始值（hex） | `0x0` / `0x1` |
| `Bits` | Bit 範圍 | `5_4`（高位_低位）或 `10`（單一位） |
| `Member` | Bit field 名稱 | `SPE_CORE_MODE` |

- 同一 Register 可有多個 Bit Field：後續列 `ADDR` 與 `Register` 留空代表延續上一個 register。
- 樣本檔 (`spe_registers_sample.xlsx`) 統計：47 個 Register、75 個 Bit Field。

### 2.2 dat (Test Case 資料) Schema

- ASCII 文字檔，每行 12 個 hex 字元：
  - 前 4 字元 = address
  - 後 8 字元 = 32-bit value

```
0010 000c0802    ← ADDR=0010, VALUE=0x000C0802
0070 00330018    ← ADDR=0070, VALUE=0x00330018
```

### 2.3 對應演算法（核心邏輯）

```python
# Step 1：載入 Excel，建立 register 字典
for row in excel_rows:
    if row.ADDR and row.Register:
        current_addr = row.ADDR.upper()
        registers[current_addr] = {"name": row.Register, "bitfields": []}
    if row.Member:
        if "_" in row.Bits:
            hi, lo = parse_range(row.Bits)        # "5_4" -> (5, 4)
            low_bit, width = lo, hi - lo + 1
        else:
            low_bit, width = int(row.Bits), 1
        registers[current_addr]["bitfields"].append({
            "name": row.Member,
            "low_bit": low_bit,
            "width": width,
            "ini": row.INI
        })

# Step 2：解析 dat，匹配 address，提取 bit field
for line in dat_lines:
    addr = line[0:4].upper()
    value = int(line[4:12], 16)
    if addr in registers:
        for bf in registers[addr]["bitfields"]:
            mask = (1 << bf["width"]) - 1
            extracted_value = (value >> bf["low_bit"]) & mask
    else:
        warnings.append(f"Unknown address: {addr}")
```

### 2.4 驗證範例

以 `0x0010 = SPE_Function_Enable_Register`，dat 值 `0x000C0802` 為例：

| Bit Field | Bits | 提取公式 | 結果 |
| --- | --- | --- | --- |
| SPE_CORE_MODE | [1:0] | `(0x000C0802 >> 0) & 0x3` | `0x2` |
| SPE_POST_MODE | [5:4] | `(0x000C0802 >> 4) & 0x3` | `0x0` |
| SPE_NORM_EN | [11] | `(0x000C0802 >> 11) & 0x1` | `0x1` |
| SPE_DELTA_TRIM_MODE | [19:18] | `(0x000C0802 >> 18) & 0x3` | `0x3` |

---

## 3. 技術棧

| 層 | 技術 | 用途 |
| --- | --- | --- |
| 前端 | React 18 + Vite + TypeScript | SPA 框架、開發伺服器、型別檢查 |
| 前端 UI | 自寫 CSS（白底簡潔風） | 不依賴大型元件庫，避免風格污染 |
| 前端 i18n | `react-i18next` | 中英文切換 |
| 前端視覺化 | ECharts 或 Plotly.js | 熱力圖 |
| 前端路由 | `react-router-dom` | 五個頁面切換 |
| 後端 | Python 3.11 + FastAPI | REST API、自動 OpenAPI 文件 |
| 後端 Excel | openpyxl | 讀寫 xlsx |
| 後端資料 | pandas | 結果表整理、CSV 輸出 |
| 後端資料庫 | SQLite (stdlib `sqlite3`) | 索引、metadata |
| 部署 | 本機 (uvicorn) | 未來可用 PyInstaller 打包 |

---

## 4. 系統架構圖

```
┌──────────────────── Frontend (React + Vite) ────────────────────┐
│                                                                  │
│  Sidebar (左側選單)         Main Content                         │
│  ├ Dashboard                                                     │
│  ├ Register 管理            ┌──────────────────────────────────┐ │
│  ├ 分析 (Analyze)           │ Page 內容隨路由切換              │ │
│  ├ 歷史紀錄                 │                                  │ │
│  ├ 設定 (語言)              └──────────────────────────────────┘ │
│  └ 版本資訊 (置中底部)                                            │
│      點擊 → Modal: 版本號 / 日期 / Aaron Hsueh                   │
│                                                                  │
└─────────────────────── REST API (JSON) ──────────────────────────┘
                              ▼
┌──────────────────── Backend (FastAPI) ──────────────────────────┐
│  Routes                      Services                            │
│  /api/registers              ExcelParser   (openpyxl)            │
│  /api/batches                DatParser                           │
│  /api/batches/{id}           Analyzer     (核心 bit 解析)        │
│  /api/batches/{id}/download  Reporter     (CSV / Excel 輸出)     │
│  /api/version                Heatmapper   (聚合給前端)           │
└──────────────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────── Storage ────────────────────────────────┐
│  data/                                                           │
│  ├ index.db                ← SQLite 索引（metadata）             │
│  ├ registers/                                                    │
│  │   └ {register_id}/spe_registers.xlsx                          │
│  └ batches/                                                      │
│      └ {batch_id}/                                               │
│          ├ result.csv      ← test case × bit field 結果表        │
│          ├ result.xlsx                                           │
│          └ dats/           ← 原始 dat 備份                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. 前端設計

### 5.1 共用版面 (Layout)

- 左側固定寬度 sidebar（約 240px）：白底 + 細灰邊框，包含選單項與底部「版本資訊」按鈕。
- 主內容區白底，最大寬度 1280px 置中。
- 右上角放語系切換按鈕（`繁體中文` / `English`）。
- **整站無 emoji**；色系建議：白底、深灰文字 (#1F2937)、強調色深藍 (#1F3A8A)。

### 5.2 頁面 / 路由

| 路由 | 名稱 | 功能 |
| --- | --- | --- |
| `/` | Dashboard | 顯示已上傳 Register 數量、歷史 batch 數量、最近 3 筆 batch 連結 |
| `/registers` | Register 管理 | 上傳 Excel、列出所有 Excel 版本、刪除（無 batch 依賴時） |
| `/analyze` | 分析 | 三步驟流程：選 Register → 上傳 dat → 開始分析 |
| `/results/:batchId` | 分析結果 | 表格、熱力圖、警告、下載按鈕 |
| `/history` | 歷史紀錄 | Batch 列表，可重看歷史結果 |

### 5.3 分析頁面流程

```
[ Step 1 ]  選擇 Register Excel ▼  (下拉顯示已上傳的 Excel)
                ↓
[ Step 2 ]  匯入 dat 檔案（可一次上傳大量）
            [ 拖曳區域 or 選擇多檔按鈕 ]
            已選擇 100 個 dat：speg1.dat ~ speg100.dat (列表 + 移除)
                ↓
[ Step 3 ]  [開始分析] 按鈕 (前兩步完成才 enable)
                ↓
            進度條 / 處理中提示
                ↓
            完成 → 自動跳轉 /results/{batchId}
```

### 5.4 結果頁 Tab 結構（v0.3）

結果頁共五個 Tab，由左至右排列：

| # | Tab | 內容 |
| - | --- | --- |
| 1 | 表格檢視 | 行 = test case，欄 = bit field；支援 prefix / case range / 欄位篩選 / 分頁，可切換 Hex / Decimal（**預設 Decimal**） |
| 2 | 資料散佈分析 | 兩個 X / Y 下拉，可切換 2D heatmap 與 scatter 兩種視覺化（內容沿用原雙 Register 分析） |
| 3 | 統計分析 | 上半部：Mode 類型欄位直方圖；下半部：Magnitude 類型欄位直方圖 + stats 摘要（min / max / mean / median / stddev） |
| 4 | Overall | 基本摘要 + 類型分佈 + Magnitude range 涵蓋率表 + 組合分析 Top-10（最少 2 欄位，**無上限**） |
| 5 | 警告訊息 | Unknown address 列表與其他解析訊息（內容不變） |

頂部摘要：batch 名稱、Register 版本、dat 數量、警告數。
右上角下載按鈕：`下載 CSV` / `下載 Excel`。

#### Bit Field 類型

每個 bit field 可在類型 modal 中標記為以下三類之一：

| 類型 | 用途 | 預設判定 |
| --- | --- | --- |
| Mode | 列舉型欄位，進入 Mode 直方圖 | 名稱含 `EN` 或 `MODE` |
| Magnitude | 連續/量值欄位，進入 Magnitude 直方圖、scatter 預設與 range 涵蓋率 | 其他欄位（非 Mode、非 Others） |
| Others | 不參與直方圖與 scatter 預設 | 不會自動判定，需使用者手動指定 |

使用者於 modal 內的調整會以 localStorage 覆寫預設值。

### 5.5 版本資訊 Modal

點擊 sidebar 底部「版本資訊」按鈕跳出：

| 欄位 | 內容 |
| --- | --- |
| 版本號 | `v0.1.0` |
| 發行日期 | `2026-05-14` |
| 開發者 | `Aaron Hsueh` |
| 系統名稱 | FPGA Register Analyzer |

### 5.6 國際化 (i18n)

- 使用 `react-i18next`。
- 語言檔：`frontend/src/i18n/zh-TW.json` 與 `en.json`。
- 預設 `zh-TW`。
- 涵蓋：所有按鈕、選單、表格欄位提示、錯誤訊息、Modal 內容。

---

## 6. 後端 API 設計

| Method | Path | 說明 | 回應 |
| --- | --- | --- | --- |
| POST | `/api/registers` | 上傳 Register Excel（multipart） | `{ id, name, register_count, bitfield_count }` |
| GET | `/api/registers` | 列出所有 Excel 版本 | `[{ id, name, uploaded_at, register_count, bitfield_count }]` |
| DELETE | `/api/registers/{id}` | 刪除 Excel 版本（無 batch 依賴時） | 204 No Content |
| POST | `/api/batches` | 建 batch：`register_id` + N 個 dat 檔（multipart） | `{ batch_id, status }` |
| GET | `/api/batches` | 列出所有 batch | `[{ id, register_name, dat_count, analyzed_at, warning_count }]` |
| GET | `/api/batches/{id}` | 取得 batch 詳情（含分析結果 JSON） | `{ summary, table, heatmap_data, warnings }` |
| GET | `/api/batches/{id}/download.csv` | 下載 CSV | `text/csv` |
| GET | `/api/batches/{id}/download.xlsx` | 下載 Excel | `application/vnd.openxmlformats...` |
| GET | `/api/version` | 版本資訊 | `{ version, build_date, author }` |

---

## 7. 資料模型

### 7.1 SQLite Schema

```sql
CREATE TABLE register_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    original_filename TEXT,
    file_path TEXT NOT NULL,
    register_count INTEGER,
    bitfield_count INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,                                 -- 自動命名：YYYYMMDD_HHmmss
    register_definition_id INTEGER NOT NULL,
    dat_count INTEGER,
    warning_count INTEGER,                     -- unknown address 數
    result_csv_path TEXT,
    result_xlsx_path TEXT,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (register_definition_id) REFERENCES register_definitions(id)
);
```

### 7.2 CSV / Excel 輸出格式

每個 batch 產生兩份檔案 (`result.csv` 與 `result.xlsx`)：

| TestCase | SPE_CORE_MODE | SPE_POST_MODE | SPE_FILT_EN | SPE_NORM_EN | ... (共 75 個 bit field 欄位) |
| --- | --- | --- | --- | --- | --- |
| speg1.dat | 0x2 | 0x0 | 0x0 | 0x1 | ... |
| speg2.dat | 0x1 | 0x1 | 0x1 | 0x0 | ... |
| ... | | | | | |

- 行 (rows) = test case，依上傳順序排列。
- 欄 (columns) = bit field，順序依 Excel 中 register address 由小到大。
- 數值預設以 hex 呈現（前綴 `0x`）。

---

## 8. 目錄結構

```
FPGA analyer/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint
│   │   ├── api/
│   │   │   ├── registers.py
│   │   │   └── batches.py
│   │   ├── services/
│   │   │   ├── excel_parser.py
│   │   │   ├── dat_parser.py
│   │   │   ├── analyzer.py      # 核心 bit field 解析
│   │   │   └── reporter.py      # CSV / Excel 輸出
│   │   ├── db.py
│   │   └── models.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── VersionModal.tsx
│   │   │   ├── LanguageToggle.tsx
│   │   │   └── Heatmap.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Registers.tsx
│   │   │   ├── Analyze.tsx
│   │   │   ├── Results.tsx
│   │   │   └── History.tsx
│   │   ├── i18n/                # zh-TW.json / en.json
│   │   └── api/                 # axios client
│   ├── index.html
│   └── package.json
├── data/                        # gitignore
│   ├── index.db
│   ├── registers/
│   └── batches/
├── docs/
│   ├── architecture.md
│   └── architecture.html
├── spe_registers_sample.xlsx
├── speg1.dat
└── README.md
```

---

## 9. 資料流程示意

### 9.1 上傳 Register Excel

```
User → Frontend (Registers 頁) → POST /api/registers (multipart)
  ↓
Backend: ExcelParser 驗證格式 → 存到 data/registers/{id}/
  ↓
SQLite: INSERT INTO register_definitions
  ↓
回傳 metadata → Frontend 更新列表
```

### 9.2 分析 N 個 dat

```
User 選 Register + 上傳 N 個 dat → POST /api/batches (multipart)
  ↓
Backend: DatParser 解析每個 dat → Analyzer 套用 register 定義
  ↓
產生 result.csv 與 result.xlsx 到 data/batches/{batch_id}/
  ↓
SQLite: INSERT INTO batches
  ↓
回傳 batch_id → Frontend 跳轉 /results/{batchId}
  ↓
GET /api/batches/{id} 取得結果 JSON → 渲染表格 / 熱力圖
```

### 9.3 歷史查詢

```
User 開 /history → GET /api/batches → 顯示列表
  ↓
點某筆 → 跳 /results/{batchId} → 重看結果
```

---

## 10. 需求對照表

| # | 需求 | 對應設計章節 |
| --- | --- | --- |
| 1 | 協助整理 Register 值分布表 | §2 對應演算法、§7.2 輸出格式 |
| 2 | 前後端網頁 | §3 技術棧、§4 架構圖 |
| 3 | 前端可匯入 Excel 與 dat | §5.2 Registers / Analyze 頁面 |
| 4 | 左側選單，底部置中版本資訊 | §5.1 Layout、§5.5 版本 Modal |
| 6 | 中英文切換 | §5.6 i18n |
| 7 | 無 emoji | §5.1 整站無 emoji |
| 8 | 上傳 Excel + 大量 dat | §5.2、§6 API、§5.3 流程 |
| 9 | 白色背景 | §5.1 Layout |
| 10 | Excel 上傳後另一頁下拉選 + 匯入 dat + 分析按鈕 | §5.3 三步驟流程 |
| 11 | 無 AI，分析後寫 csv / excel | §2 演算法、§7.2 輸出 |
| 12 | 前端檢視結果 + 熱力圖 | §5.4 三 Tab 結果頁 |
| 13 | xlsx / dat 對應關係 | §2 已釐清並驗證 |
| — | 歷史查詢 | §5.2 History、§9.3 流程 |

---

## 11. 開發里程碑

| 階段 | 內容 | 狀態 |
| --- | --- | --- |
| Phase 0 | 範例檔分析、對應關係確認 | 完成 |
| Phase 1 | 系統架構文件（本文件 + HTML） | 完成 |
| Phase 2 | 前端骨架（mock 資料，五個頁面 + sidebar + i18n） | 進行中 |
| Phase 3 | 後端 API + 分析邏輯 | 待開發 |
| Phase 4 | 前後端串接、整合測試 | 待開發 |
| Phase 5 | PyInstaller 打包、分發 | 待開發 |

---

## 12. 未來擴充考量

- **多 register 結構並存**：未來如果有其他 IP block 的 register（不是 SPE），可以上傳不同 Excel 並各自分析。SQLite 設計已支援。
- **欄位篩選與排序**：結果表 75 欄太寬，可加上「只顯示某些 register / bit field」的篩選器。
- **匯出比較報告**：找出多個 batch 之間的差異（diff report）。
- **Bit field 註解**：Excel 可擴充 description 欄位，UI 顯示 tooltip。
- **打包成單一執行檔**：用 PyInstaller 把後端打包，前端 build 後當靜態檔 serve。

---

## 14. 變更歷程

### Phase 1 (v0.1) — 基礎骨架

五頁面（Dashboard / Registers / Analyze / Results / History）+ 左側 sidebar + i18n（zh-TW / en）+ 版本資訊 Modal。

### Phase 2 (v0.2) — 大量上傳與多視覺化

- 支援單一 batch 最多 2000 個 dat 檔上傳。
- 新增資料夾選擇器（webkitdirectory），可整個資料夾匯入。
- 表格檢視加入 prefix 篩選、case range、欄位篩選、分頁。
- 結果頁擴充為四個 Tab：表格檢視、熱力圖、雙 Register 分析、統計分析、警告訊息。
- 新增 bit field 類型 modal，可在分析前手動標記欄位類型。
- 統計分析加入組合分析（支援 2~5 個欄位組合）。

### Phase 3 (v0.3) — Overall 與類型細化

- 移除「分布熱力圖」Tab。
- 「雙 Register 分析」改名為「資料散佈分析」（顯示名稱調整，內容沿用 2D heatmap + scatter）。
- 新增 Overall Tab：基本摘要、類型分佈、Magnitude range 涵蓋率、組合分析 Top-10。
- 統計分析增加 Magnitude 直方圖區段及 stats 摘要（min / max / mean / median / stddev）。
- Bit Field 類型新增 `Others`，共三類（Mode / Magnitude / Others），Others 不參與直方圖與 scatter 預設。
- 預設 Mode 判定改為名稱關鍵字判斷：名稱含 `EN` 或 `MODE` → mode；其他 → magnitude；Others 需手動指定。
- 組合分析移除欄位數量上限，僅保留下限 2，並由 Stats Tab 移至 Overall Tab。

### Phase 4 (v0.4) — V-model 詳細設計文件

新建 `docs/detailed-design/` 子目錄，包含 5 份 markdown + HTML 詳細設計文件（序列圖、資料流圖、狀態圖，使用 Mermaid CDN 渲染）。

### Phase 5 (v0.5) — UI 微調（Modal / FP32 / 表格 / 散佈圖）

- BitFieldTypeModal 加寬（max-width 720 → 1000 px），三個類型按鈕完整顯示。
- Magnitude histogram 加 Int / FP32 (IEEE 754) toggle，非 32-bit 欄位 disabled。
- 表格數值欄 `.data-table td.mono` 改置中；TestCase 欄保持左對齊。
- 資料散佈分析預設進入 Scatter 檢視（原預設 Heatmap）。
- 2D Heatmap 改為 category 軸，以 unique sorted 值為分類，不強制分 bin。

### Phase 6 (v0.6) — UI 微調（欄位預設 / 折疊 / histogram 修正）

- 表格欄位預設過濾 Others 類型（不顯示）。
- 組合分析欄位選擇器加折疊/展開按鈕（預設折疊）。
- Mode histogram 固定 4 cols；Magnitude histogram 固定 3 cols。
- Case range 上限改 10000。
- Histogram X 軸底部空間自適應；stats 格子改 3 欄（2 行）；FP32 模式依浮點值排序分箱。

### Phase 7 (v0.7) — UI 微調（i18n 修正 / Modal Portal / 彩虹色階 / ValueCurve）

- 補 `results.overall.analyzedAt` i18n key。
- VersionModal / BitFieldTypeModal / ColumnSelectorModal 改用 `ReactDOM.createPortal` 渲染至 `document.body`，修正 backdrop 層級錯誤。
- 2D Heatmap 改彩虹九色漸層（藍 → 紅）。
- 新增 `ValueCurve.tsx`：平滑面積折線圖，Magnitude 卡片底部「詳細曲線」按鈕展開後顯示。

### Phase 8 (v0.8) — UI 修正（2D 熱力圖 binning / Magnitude 卡片結構調整）

- 2D Heatmap：unique 值 > 30 時自動 bin 成 20 等寬桶（category axis）。
- Magnitude 卡片恢復：直方圖 + stats 摘要永遠顯示；底部新增「詳細曲線」展開 ValueCurve。
- ValueCurve 加 auto-binning（unique > 50 → 30 桶），確保曲線平滑。

### Phase 9–16 (v0.9–0.16) — 高斯熱力圖導入（heatmap.js）

高斯熱力圖從規劃到最終穩定，歷經多個 phase：

- **Phase 9 (v0.9)**：規劃 heatmap.js 雙層架構（ECharts 軸/tooltip + heatmap.js canvas overlay）。
- **Phase 12 (v0.12)**：正式實作；撤回 Phase 10/11 對 Magnitude histogram maxVal 的改動（恢復理論最大值做全範圍視圖）。
- **Phase 13 (v0.13)**：修正白畫面 — ECharts `type: 'heatmap'` 必須搭配 `visualMap`，加入 `visualMap: { show: false }`。
- **Phase 14 (v0.14)**：`vite.config.ts` 加 `optimizeDeps: { include: ['heatmap.js'] }`，改善 esbuild 相容性。
- **Phase 15 (v0.15)**：heatmap.js 改動態 `import()` 載入，繞過 ESM parse 階段衝突。
- **Phase 16 (v0.16)**：heatmap.js 最終方案 — 複製 `heatmap.min.js` 至 `frontend/public/`，以傳統 `<script>` 標籤載入為全域 `h337`，解決 Safari UMD 嚴格模式問題。

### Phase 10–11 (v0.10–0.11) — Histogram 值域修正（後撤回）

Phase 10 把 Magnitude histogram maxVal 改為 `stats.max` 以修正 32-bit 欄位所有資料擠在第一 bin 的問題；Phase 11 進一步讓 int 分箱從 `stats.min` 開始。兩項改動後在 Phase 12 撤回：恢復理論最大值（全範圍視角），實際值域細節改由 ValueCurve 負責展示。

### Phase 17 (v0.17) — heatmap.js position override 修正

heatmap.js CanvasRenderer 會把 container 強制設為 `position: relative`，導致 overlay div 高度塌縮為 0。在 heatmap.js container（`hmContainerRef`）外加一層 wrapper div 持有 `position: absolute`，inner div 以 `width: 100%; height: 100%` 填滿，解決白畫面。

### Phase 18–19 (v0.18–0.19) — 銳利度微調

- Phase 18：`blur: 0.75 → 0.35`，`radius * 1.5 → * 0.9`，降低模糊讓熱點邊緣清晰。
- Phase 19：`blur: 0.35 → 0.25`，`radius * 0.9 → * 1.2`，在更清晰的同時擴大 blob 覆蓋範圍。

### Phase 20 (v0.20) — 連續軸（移除 binning）

移除 Phase 8 的固定分桶系統。改以實際值（不量化）做連續座標：ECharts 改 `type: 'value'` 軸 + 透明 `type: 'scatter'` series 負責 tooltip；heatmap.js blob 依值比例自由定位，Gaussian 模糊在整個值域連續擴散。

### Phase 21 (v0.21) — 量化（step=5）+ Colorbar + 組合分析折疊

- 2D Heatmap 以步長 5 量化 X/Y 值（`Math.round(v / 5) * 5`），將相鄰 5 個整數合併為一個 blob，密度對比更明顯。
- 新增右側 Colorbar：CSS 漸層（透明 → 藍 → 青 → 綠 → 黃 → 紅）配合頂端 maxCount 與底端 0 標籤，直觀說明顏色對應密度。
- OverallPanel 組合分析欄位選擇器改回預設折疊。

### Phase 22 (v0.22) — 後端 Excel 格式偵測 + IRM 錯誤提示

- `backend/app/api/registers.py`：以 magic bytes（前 4 個位元組）偵測實際格式，不依賴副檔名。OLE2（`\xD0\xCF\x11\xE0`）路由至 xlrd 轉換、ZIP（`PK\x03\x04`）直接作為 xlsx 開啟。
- 當 OLE2 是 IRM/password-protected（xlrd 回報「Can't find workbook」）時，給出清楚的操作指引（在 Excel 中全選複製，貼到新空白活頁簿後另存 xlsx）。
- 修正 xlrd `sheet_visibility` 屬性應以 list index 存取而非函式呼叫。

### Phase 29 (v0.29) — Case Range 改為 ID 過濾 + Overall 參考上限調整

- **Case Range ID 過濾**：原本 Case Range 工具列的 from/to 以列表位置（陣列 slice）篩選，遇到非連續 ID（如 speg1, speg3, speg7）時範圍語意不符。現改為從 testCase 檔名以 `^{prefix}(\d+)` regex 萃取數字 ID，`rangedRows` 改用 `filter(id >= from && id <= to)`；工具列右側的「/ N」改為顯示最大 case ID 而非總筆數；「全選」按鈕的 `caseTo` 也重設為 max ID。新增 `extractCaseId()` helper（定義於 `Results.tsx`），與 `ResultsTable.tsx` 的 `extractCaseNumber()` 使用相同 regex。
- **StatsPanel / OverallPanel 改接 rangedRows**：原本兩個元件接收全部 `detail.rows` + `caseRange` 再自行 slice；現在直接接收 `rangedRows`，移除 `caseRange` prop 與 `slicedRows` useMemo，計算邏輯不變。
- **Overall 參考上限改用使用者設定值**：`OverallPanel` 新增 `rangeMap` prop。Magnitude Range 涵蓋率表中「理論最大」欄位，若該 bit field 在「Bit Field 類型設定」中已設定 max，則顯示使用者設定值（`effectiveMax`）而非 `2^width - 1`；涵蓋率計算也改用 `effectiveMax - effectiveMin` 作為分母，使百分比具備實際業務意義。

### Phase 28 (v0.28) — Bit Field 類型設定 Modal UI 調整

- **列表 grid 修正**：將 `modal-list-row` 的 `grid-template-columns` 從六欄改為 `1.4fr 0.4fr 1fr 1.6fr 88px`（五欄），給類型 toggle 三個按鈕更充裕的空間，防止被擠壓。
- **有效範圍按鈕風格統一**：沿用 `.btn .btn-sm` 樣式；未設定時顯示「預設」（灰色），已設定時顯示 `min ~ max`（深藍 `.btn-primary`），視覺上與全站風格一致。
- **設定有效範圍 Popup 排版改善**：Min / Max 改用 `grid` 二列排版（標籤固定 48px 靠右，input 撐滿），不再換行；「清除範圍」靠左，「取消 / 套用」靠右，符合操作習慣。

### Phase 27 (v0.27) — Bit Field 類型設定 Modal 範圍按鈕化

- **有效範圍 inline inputs → popup 按鈕**：原本主列最後兩欄為 Min / Max inline 數字輸入框，導致 modal 寬度不足、類型 toggle 被擠壓。改為在每列末尾放一個小型按鈕，點擊後以 `createPortal` 彈出小型 popup 填寫 Min / Max；popup 包含「清除範圍」「取消」「套用」三個按鈕。
- **i18n**：新增 `results.bitFieldType.colRange`、`rangeDefault`、`rangePopupTitle`、`clearRange`。

### Phase 31 (v0.31) — 未知 Address 警告改為全批次摘要

- **警告去重邏輯修正**：原本 `analyzer.py` 中 `seen_unknown` set 在整個 batch 共用，每個未知 address 只記錄第一個遇到的 dat 檔，導致警告看起來像「只有某一個 test case 有問題」，其實所有 dat 都有相同的未知 address。
- **改為全批次計數**：改用 `unknown_counts: Dict[str, int]` 統計每個未知 address 在幾個 test case 出現，batch 處理完後一次產出摘要警告，格式為「Unknown address 0x{addr} (N test cases)」，語意正確、不誤導。

### Phase 30 (v0.30) — Bit Field 類型設定 Toggle 寬度修正

- **英文模式空白修正**：`BitFieldTypeModal` 的三選一 toggle（Mode / Magnitude / Others）使用 `.inline-toggle`（`display: inline-flex`），中文文字長度剛好填滿欄位，但切換英文後文字較短導致右側出現空白。改為 inline style 覆寫 `display: flex; width: 100%`，並為每個 button 加 `flex: 1`，確保 toggle 填滿類型欄寬度，中英文外觀一致。

### Phase 26 (v0.26) — Prefix 修正 + 時區修正 + Bit Field 有效範圍設定

- **Prefix 大小寫不分 + 資料夾上傳相容**：`extractCaseNumber()` 加 `i` flag（case-insensitive），並修正資料夾上傳（`folder/speg1.dat`）時原本回傳資料夾名的錯誤，現在改為取出 `/` 後的檔名再套 prefix regex。
- **時區修正**：後端 `datetime.utcnow()` 全面改為 `datetime.now(timezone.utc)`，Pydantic 序列化時帶 `+00:00` 後綴。前端新增 `api/dateUtils.ts`（`formatLocalDate()`），對舊資料庫中無時區後綴的字串自動補 `Z`，確保所有時間顯示均為本地時區。
- **Bit Field 有效範圍設定**：在「Bit Field 類型設定」Modal 為 magnitude 類型的欄位新增 Min / Max 輸入框（選填）。設定儲存至 `fpga-bit-field-ranges-{registerId}` localStorage。表格中超出範圍的數值以紅色底色 + 紅字標示，滑鼠懸停顯示有效範圍。
- **超出範圍警告**：警告訊息 Tab 新增「超出有效範圍的數值」區塊（置於未知 address 列表上方），列出所有違規的 test case、bit field、數值與設定範圍。Tab 標籤的計數也含超出範圍筆數。

### Phase 25 (v0.25) — 啟動腳本修正 + localStorage 版本升級

- **macOS 啟動腳本**：`scripts/macOS/start.sh` 新增 Step 3，在啟動 uvicorn 前自動偵測 port 8000 是否被佔用（`lsof -ti :8000`），若有則強制終止舊 process，解決多次啟動後 `[Errno 48] address already in use` 的問題。
- **localStorage 版本升級**：將 `fpga-visible-cols-{registerName}` 升級為 `fpga-visible-cols-v2-{registerName}`、`fpga-combo-picked-{registerName}` 升級為 `fpga-combo-picked-v2-{registerName}`，清除 Phase 24 前殘留的舊快取，確保首次進入自動套用「只顯示 mode 欄位」的正確預設值。

### Phase 24 (v0.24) — UI 偏好持久化 + Bit Field 預設規則調整 + Types 同步

- **欄位顯示持久化**：Results 頁的「欄位顯示」選擇以 `fpga-visible-cols-{registerName}` 存入 localStorage（存欄位名稱而非 index，跨批次穩定）。初次進入無記錄時預設顯示全部 mode 欄位。
- **組合分析持久化**：Overall Tab 的「組合分析」勾選欄位以 `fpga-combo-picked-{registerName}` 存入 localStorage。初次進入無記錄時預設勾選全部 mode 欄位。
- **defaultBitFieldType 調整**：改用 `_` 拆 token 做精確比對，避免 `END`、`LENGTH` 等誤判為 EN；規則：token 為 `EN` / `ENABLE` / `MODE` → mode；token 為 `ERR` / `CHKSUM` → others；其餘 → magnitude。
- **Types 同步**：在「Bit Field 類型設定」Modal 套用後，表格欄位顯示與組合分析勾選自動同步為當下的 mode 欄位清單（用 `useRef` 跳過初次載入，避免蓋掉 localStorage 儲存的手動選擇）。
- **Windows 分發**：Windows 無需安裝 Node.js / npm；在 Mac 執行 `npm run build` 後將 `frontend/dist/` 提交 git，Windows 只需 `git pull` 並重啟後端即可使用最新前端。

### Phase 23 (v0.23) — Register 命名 + 表格排序 + 範圍篩選 + ERR/CHKSUM 預設 others

- **Register 版本命名**：上傳 Register Excel 時可輸入自訂版本名稱（選填），後端 `POST /api/registers` 接受 `name` 表單欄位；留空則自動使用檔名 stem。
- **表格排序**：`Results.tsx` 以 `localeCompare({ numeric: true })` 對所有 rows 按 testCase 檔名升序排列，確保 speg1 < speg2 < speg10。
- **表格範圍篩選**：Case range 工具列（從第 N 筆到第 M 筆）擴展至表格檢視 Tab，與 Dual/Stats/Overall Tab 行為一致。
- **ERR/CHKSUM 預設 others**：`defaultBitFieldType()` 新增判斷：bit field 名稱含 `ERR` 或 `CHKSUM`（不分大小寫）時預設歸類為 `others`，不出現在任何分析視圖。

### Phase 34 (v0.34) — 組合分析顯示修正 + Mode 直方圖範圍篩選 + 熱力圖連續分布調整

- **組合分析「其他」列顯示修正**：OverallPanel 組合分析表格的「其他 (others)」列，`#` 欄改顯示「其他」翻譯文字，各 register 欄改顯示「—」，取代原本每欄重複顯示「其他」字樣。
- **Mode 直方圖範圍篩選**：`StatsPanel` 新增 `rangeMap` prop；mode 類 bit field 若在「Bit Field 類型設定」中設有自訂範圍（min/max），直方圖只顯示落在 `[effectiveMin, effectiveMax]` 區間內的值，並將 X 軸範圍對齊有效範圍，排除超出範圍的資料點。`Results.tsx` 同步傳入 `rangeMap`。
- **2D 熱力圖連續分布調整**：`QUANT_STEP` 維持 5；`radius` 改為 `max(spacing × 3, 50)` 且上限 `min(W,H) × 40%`；`blur` 提高至 0.75，使相鄰 blob 大量重疊，追求氣象預報式連續色塊效果。

### Phase 35 (v0.35) — 熱力圖 radius 修正

真實資料（SPE_IN_WIDTH × SPE_IN_HEIGHT，各約 27 個量化值，Y 方向像素間距 ~15px）下，Phase 34 的 radius ≈ 99px（為 Y 間距的 6 倍），造成所有 blob 完全重疊、全圖一片紅。新公式：`radius = min(maxSpacing × 1.2, chartHeight × 8%)`，約 32px，相鄰 blob 輕微重疊即可，讓密集列（如 X=65 的垂直帶）顯著比稀疏區域更熱。`blur` 調降至 0.65。

### Phase 40 (v0.40) — 結果表格值篩選

表格工具列新增「值篩選」功能（預設關閉）：

- 工具列加入 checkbox 開關（預設 unchecked）；勾選後展開 bit field 下拉選單與數值輸入框。
- 篩選邏輯：`row.values[selectedFieldIdx] === target`，只顯示符合條件的行。
- 分頁計數、上下頁、跳頁全部基於篩選後資料，不影響 case range 過濾（兩者並行）。
- 切換欄位或數值時自動 reset 到第 1 頁。

**改動檔案**：`frontend/src/components/results/ResultsTable.tsx`（`filterEnabled / filterFieldIdx / filterRawValue` state + `filteredRows` useMemo + toolbar UI）；i18n 新增 `results.valueFilter`。

---

### Phase 39 (v0.39) — TestCase ID 路徑萃取修正

`extractCaseNumber()`（`ResultsTable.tsx`）與 `extractCaseId()`（`Results.tsx`）改用完整路徑掃描演算法，同時支援兩種目錄結構：

- **策略 A**：任一路徑元件符合 `^{prefix}(\d+)`（如 `a/speg1/LL0_reg.dat` → `#1`）
- **策略 B**：路徑元件完全等於 prefix 且下一元件為純數字（如 `a/speg/1/LL0_reg.dat` → `#1`）
- Fallback：顯示檔名（向下相容舊格式）

舊格式 `speg1.dat` 仍正常（策略 A 命中檔名元件）。

**改動檔案**：`frontend/src/components/results/ResultsTable.tsx`（`extractCaseNumber`）、`frontend/src/pages/Results.tsx`（`extractCaseId`）。

---

### Phase 38 (v0.38) — Magnitude 直方圖套用手動設定的上下限

`StatsPanel.tsx` 的 Magnitude 區塊改為讀取 `rangeMap`（Bit Field 類型設定 modal 中手動填寫的上下限）：

- 若 `rangeMap[bf.name]` 有設定 `min` 或 `max`，直方圖 X 軸改用此範圍（`minValue` / `maxValue` 傳入 `Histogram`），並過濾超出範圍的資料點。
- 未設定時行為不變（X 軸為 0 ~ 理論最大值）。
- 此行為與 Mode 欄位的既有邏輯一致（Mode 自 Phase 早期即已套用 `rangeMap`）。

**改動檔案**：`frontend/src/components/results/StatsPanel.tsx`（Magnitude map callback，加入 `r / effectiveMin / effectiveMax / hasRange / values` 計算，與 Mode 區塊平行）。

### Phase 37 (v0.37) — Test Case ID 改從資料夾名稱取得

`extractCaseId()` 函式（`Results.tsx`）邏輯調整：優先從 `testCase` 字串的 **immediate parent 資料夾名稱** 取 ID，無資料夾結構時 fallback 到檔名。

- 適用場景：`.dat` 檔名不固定，但放在命名為 `{prefix}{id}/` 的資料夾內（如 `speg1/adc_out.dat`）。
- 前端上傳邏輯（`batches.ts`）已於先前版本保留 `webkitRelativePath`，後端 `testCase` 欄位存入完整相對路徑（如 `speg1/adc_out.dat`）。
- 前端解析：取最後一個 `/` 前的最後一段路徑（immediate parent），對 `^{prefix}(\d+)` 做 match；若失敗再對檔名做 match（向下相容舊批次資料）。

**後端邏輯**：上傳時 `fname = upload.filename`，analyzer 直接以此作為 `testCase`，無需更動。

---

### Phase 36 (v0.36) — Bit Field 預設分類規則擴充

`defaultBitFieldType()` 新增以下 others 判斷規則：

1. **Register name 含 `INTERRUPT`**（大小寫不分）→ others，不論 bit field 名稱為何。
2. **Token 關鍵字**（以 `_` 分詞後精確比對）：`DMA`、`CYCLE`、`CHECK`、`SUM`、`CHECKSUM`、`LSB`、`MSB`、`DRAM`、`ADDR`、`INTERRUPT`、`INT` → others。
3. **EN/ENABLE/MODE 與上述 others 關鍵字同時出現 → others 優先**（EN/ENABLE/MODE 只有在不含 others token 時才判為 mode）。

既有規則（ERR / CHKSUM → others；EN / ENABLE / MODE → mode；其餘 → magnitude）保持不變，納入新的優先序。

---

> **延伸閱讀 — 系統詳細設計**
>
> 本文件為高階「系統架構」（what & why）。詳細元件分解、序列圖、資料流圖、狀態圖、API contract、演算法偽程式碼請見：
>
> 詳細設計按主題拆為 5 份子文件，從索引頁進入：
>
> - [detailed-design/index.md](detailed-design/index.md) — Markdown 索引（GitHub 預覽可直接渲染 Mermaid）
> - [detailed-design/index.html](detailed-design/index.html) — HTML 索引（Mermaid CDN 視覺化）
>
> 5 份子文件：概述與元件 / 資料模型與介面 / 動態行為 / 演算法 / 品質屬性
