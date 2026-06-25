# FPGA Register Analyzer — 系統詳細設計

> 版本：v0.44　|　日期：2026-06-25　|　開發者：Aaron Hsueh　|　[← 回索引](index.md)　|　[← 上一份：演算法](04-algorithms.md)　·　（末份）

本份內容簡述：9-12 章，品質屬性。涵蓋錯誤處理與例外流程、效能考量、安全考量與文件變更歷程。

---

## 9. 錯誤處理與例外流程

### 9.1 Excel 格式錯誤

| 情境 | 偵測點 | 處理 |
| --- | --- | --- |
| 不是 .xlsx | 前端副檔名檢查 + 後端 magic bytes | 前端：拒絕上傳，提示「請選 .xlsx」 |
| 缺 sheet "Registers" | ExcelParser openpyxl | 400 `{"detail": "Sheet 'Registers' not found"}` |
| 表頭不在第 7 列 | ExcelParser 檢查欄位名稱 | 400 `{"detail": "Expected headers ADDR/Register/INI/Bits/Member at row 7"}` |
| ADDR 不是 4-char hex | ExcelParser 逐列驗證 | 在 warnings 中標示該列，繼續 |
| Bits 格式錯（不是數字或 X_Y） | parseRange | 該 bit field 跳過 + warning |

### 9.2 dat 格式錯誤

| 情境 | 處理 |
| --- | --- |
| 行長度不是 12 | 該行跳過 + warning「Line {n} bad length」 |
| 非 hex 字元 | 該行跳過 + warning |
| Address 在 dat 但不在 Excel | 加入 warnings list；繼續分析其他 |
| Address 在 Excel 但不在 dat | bit field 的值為 NULL；前端顯示 "—" |

### 9.3 後端 API HTTP 狀態

```mermaid
graph TD
    REQ[請求進入] --> V{schema 驗證}
    V -->|失敗| E422[422 Unprocessable<br/>(Pydantic)]
    V -->|成功| L{業務邏輯}
    L -->|資源不存在| E404[404 Not Found]
    L -->|格式錯| E400[400 Bad Request]
    L -->|衝突<br/>有 batch 用該 register| E409[409 Conflict]
    L -->|未預期錯誤| E500[500 Internal]
    L -->|成功| OK[200/201/204]
```

### 9.4 前端錯誤處理

- 網路失敗：toast 顯示「連線失敗，請稍後重試」+ retry 按鈕
- 大檔上傳逾時：顯示「處理中」spinner，超過 60s 提示可能仍在後端處理
- JSON 解析失敗：fallback 顯示原始錯誤碼

### 9.5 ErrorBoundary 與經驗教訓

結果頁的 Tab 內容（`Results.tsx`）以 React `ErrorBoundary`（`frontend/src/components/ErrorBoundary.tsx`）包覆，任一 Tab 在渲染期間丟出例外時，只會把該區塊降級為錯誤畫面，而不會讓整頁白屏。這在 v0.44 開發期間實際攔下一個會讓統計分頁崩潰的 bug：

| 項目 | 內容 |
| --- | --- |
| 症狀 | 開啟「統計分析」Tab 時整個 Tab 崩潰，ErrorBoundary 攔截到 `RangeError: Array length must be a positive integer`。 |
| 根因 | bit width = 31 的欄位計算理論最大值時用了 `(1 << 31) - 1`。JS 的 `<<` 是 **32-bit 帶號** 位移，`1 << 31` 會溢位成負數（`-2147483648`），導致 `bitMax` 變成負值；下游以 `bitMax + 1` 之類的長度建立陣列（`new Array(size)`）時，`size` 為負，丟出 `RangeError`。 |
| 修正 | 所有 `bitMax` / 理論上限計算一律改用 `2 ** w`（不再用 `1 << w`），避免帶號位移溢位：涵蓋 `formatBounds()`、`validValueCount()`、`computeBitMax`、`safeMaxValue`、`heatmapData` 與 mock 資料產生。`formatBounds()` 對 32-bit 直接回傳 `0xffffffff`、其餘回傳 `(2 ** width) - 1`。 |
| 防禦性護欄 | `Histogram.tsx` 的整數小值分支在建立 bar 陣列前先檢查 `maxValue >= minValue`（`size = maxValue - minValue + 1` 才會是正數）；條件不成立則退回連續分箱，杜絕負長度陣列。 |

**教訓**：JavaScript 位元運算符（`<<`、`>>`、`|`、`&`）一律以 32-bit **帶號** 整數運算，處理可能達 32 位寬的暫存器欄位時，凡涉及「2 的 n 次方」務必改用 `2 ** n` 指數運算，而非位移。同時對任何「以計算結果當作陣列長度」的程式碼加上正數護欄，配合 ErrorBoundary 讓單一元件的錯誤不擴散成全頁崩潰。

---

## 10. 效能考量

### 10.1 大量 dat (2000+) 客戶端處理

- 在 Analyze 頁，已選檔案列表**只渲染前 50 筆 + 「+N more」**，避免 React reconciler 處理 2000 個 row。
- 上傳前**不在前端解析 dat 內容**，僅檢查副檔名與計數，交給後端解析。

### 10.2 表格 Pagination

| 維度 | 限制 |
| --- | --- |
| 75 bit fields × 2000 testCase = 150,000 cells | 一次性渲染會卡 |
| 每頁 100（預設） / 最大 500 | 一次最多渲染 75 × 500 = 37,500 cells |
| 配合 column selector | 使用者可進一步壓低欄數 |

### 10.3 Heatmap 渲染

- 採用 **canvas renderer** 而非 SVG（ECharts `renderer: 'canvas'`），大資料量更穩
- DualRegisterChart 已限制：unique value > 50 時自動分 20 bins（Heatmap2D 內部）
- Scatter 大量點時 opacity 0.55 讓重疊區自然加深

### 10.4 Seeded Random Mock

- `generateMockBatchDetail(batchId)` 用 `batchId * 9301 + 49297` 作 seed
- 同 batchId 多次呼叫得到相同 rows（Tab 切換不會重新洗牌）
- 不同 batchId 給不同分布

---

## 11. 安全考量

### 11.1 檔案上傳

- 副檔名白名單：`.xlsx`（registers）/ `.dat`（batches）
- 檔案大小上限：建議 `xlsx` ≤ 10MB、`dat` ≤ 100KB / 檔，總 batch ≤ 500MB
- openpyxl 預設**不執行 macro**，VBA 程式碼被忽略
- 儲存路徑使用 `id` 作目錄名（非使用者上傳檔名），避免 path traversal

### 11.2 SQL Injection

- 使用 **SQLAlchemy ORM**，所有查詢透過 parameterized statements
- 不直接拼接 SQL 字串

### 11.3 XSS

- React 預設**自動 escape** dangerouslySetInnerHTML 才會繞過
- ECharts tooltip formatter 回傳 HTML 字串時，內容皆由內部資料組成（檔名、bit field 名稱），不接受 user-supplied raw HTML
- 檔名顯示前用 `String()` 包裝

### 11.4 webkitdirectory

- 瀏覽器 API，無法讀取絕對路徑（只給檔案內容 + relative path）
- 不會洩露使用者磁碟結構

---

## 12. 文件變更歷程

下表彙整專案自首版起的演進（細節以 [../architecture.md](../architecture.md) 的「變更歷程」為準）：

| 版本 | 日期 | 變更摘要 |
| --- | --- | --- |
| v0.1 | 2026-05-14 | 基礎骨架：五頁面（Dashboard / Registers / Analyze / Results / History）+ 左側 sidebar + i18n（zh-TW / en）+ 版本資訊 Modal。 |
| v0.2 | 2026-05 | 大量上傳（單 batch 最多 2000 dat）+ 資料夾選擇器；表格 prefix / case range / 欄位篩選 / 分頁；新增 bit field 類型 modal 與組合分析。 |
| v0.3 | 2026-05 | Overall Tab（基本摘要、類型分佈、Magnitude range 涵蓋率、組合分析 Top-10）；統計分析加 Magnitude 直方圖 + stats 摘要；類型新增 Others（Mode / Magnitude / Others 三類）。 |
| v0.4.0 | 2026-05-14 | 本詳細設計文件首版 — 對應 architecture v0.3.0；含序列圖、資料流圖、狀態圖、API contract、演算法。 |
| v0.5–v0.8 | 2026-05 | UI 微調：Modal 加寬、Magnitude 直方圖 Int / FP32 toggle、表格數值置中、散佈圖預設 Scatter、2D Heatmap category 軸與 binning 調整、ValueCurve 平滑折線圖。 |
| v0.9–v0.20 | 2026-05 | 高斯熱力圖導入（heatmap.js）：雙層架構、白畫面修正、ESM / UMD 載入策略、position override 修正、銳利度微調，最終改連續軸（移除固定 binning）。 |
| v0.21–v0.22 | 2026-05 | 2D Heatmap 量化（step=5）+ Colorbar；後端 Excel 以 magic bytes 偵測格式（OLE2 / ZIP）+ IRM / 密碼保護錯誤提示。 |
| v0.23–v0.31 | 2026-05/06 | Register 版本命名、表格自然排序、Case Range 改 ID 過濾、UI 偏好持久化（localStorage）、Bit Field 預設分類規則擴充、時區修正、Bit Field 有效範圍設定與超範圍警告、未知 address 改全批次摘要。 |
| v0.34–v0.36 | 2026-06 | 組合分析顯示修正、Mode 直方圖範圍篩選、熱力圖 radius / blur 連續分布調整、Test Case ID 改從資料夾名稱取得、預設分類規則再擴充。 |
| v0.37–v0.41 | 2026-06 | Magnitude 直方圖套用手動上下限、TestCase ID 路徑萃取演算法強化、結果表格值篩選（單一 → 多條件 AND）。 |
| v0.42 | 2026-06 | Mode bit field 片段有效範圍（`segments` / `parsedSegments`），新增 `parseSegments` / `isValueInRange` / `validValueCount` 共用函式；Overall 加 Mode Segment Coverage。 |
| v0.43 | 2026-06 | 自適應熱力圖 + 散佈圖資源預算分區（新增 `heatmapData.ts`、重寫 `Heatmap2D`、對數著色、0.5MB 資源上限線、X/Y 對調）；熱力圖格內字體可調（v0.43.2：數字 +/− 微調框 6–28px + 顯示數字開關）。 |
| **v0.44** | **2026-06-25** | **每欄位數值解讀格式（`ValueFormat = 'uint' \| 'sint' \| 'fp32'`）**：magnitude 欄位可選 Unsigned / Signed / FP32（FP32 限 width=32）；新增共用 helper `interpretValue()` / `formatBounds()`，套用於統計、Overall 涵蓋率、超範圍警告（主資料表與 2D 熱力圖維持原始 unsigned 顯示）；圖表介面由 `interpretAs` 改為 `isFloat`。**並修正 width=31 帶號位移溢位（`(1<<31)-1` 變負值）導致統計分頁崩潰的 bug**，全面改用 `2 ** w` 並於 Histogram 加負長度護欄（見 §9.5）；2D 熱力圖格內字體上限 28 → 40px。 |

> 對應的「系統架構」（簡略版）：[../architecture.md](../architecture.md)

---

> 導覽：[← 上一份：演算法](04-algorithms.md)　|　[索引](index.md)　|　（末份）
