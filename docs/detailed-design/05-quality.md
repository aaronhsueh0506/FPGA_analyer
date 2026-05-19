# FPGA Register Analyzer — 系統詳細設計

> 版本：v0.4.0　|　[← 回索引](index.md)　|　[← 上一份：演算法](04-algorithms.md)　·　（末份）

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

| 版本 | 日期 | 變更 |
| --- | --- | --- |
| v0.4.0 | 2026-05-14 | 首版 — 對應 architecture v0.3.0；含序列圖、資料流圖、狀態圖、API contract、演算法 |

> 對應的「系統架構」（簡略版）：[../architecture.md](../architecture.md)

---

> 導覽：[← 上一份：演算法](04-algorithms.md)　|　[索引](index.md)　|　（末份）
