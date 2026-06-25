# FPGA Register Analyzer — 系統詳細設計

> 版本：v0.44　|　日期：2026-06-25　|　開發者：Aaron Hsueh　|　[← 回索引](index.md)　|　[← 上一份：概述與元件](01-overview-and-components.md)　·　[下一份：動態行為 →](03-dynamics.md)

本份內容簡述：3-4 章，資料模型與元件介面。涵蓋 TypeScript / Pydantic / SQLite schema、前端關鍵元件 Props 與後端 REST API contract。

---

## 3. 資料模型詳述

### 3.1 前端 TypeScript 型別

從 `frontend/src/mock/data.ts` 與相關 hook：

```ts
// 一個 bit field 的定義（從 Excel 解析來）
export interface BitFieldDef {
  name: string             // 例如 "SPE_CORE_MODE"
  width: number            // bit 寬度，1 ~ 32
  registerName: string     // 所屬 register 名稱
  registerAddr: string     // hex address，4 字元，例如 "0010"
}

// 一個 Register 定義的 metadata
export interface RegisterDefinition {
  id: number
  name: string
  originalFilename: string
  registerCount: number
  bitfieldCount: number
  uploadedAt: string       // ISO format
}

// 一個 batch 的摘要
export interface BatchSummary {
  id: number
  name: string             // 自動命名 YYYYMMDD_HHmmss
  registerName: string
  datCount: number
  warningCount: number
  analyzedAt: string
}

// batch 詳細資料（含實際結果矩陣）
export interface BatchDetail {
  summary: BatchSummary
  bitFields: BitFieldDef[]                              // 75 個
  rows: Array<{
    testCase: string                                    // 檔名，如 "speg1.dat"
    values: number[]                                    // 對應 bitFields 順序，已解析的數值
  }>
  warnings: string[]
}

// bit field 類型
export type BitFieldType = 'mode' | 'magnitude' | 'others'

// localStorage 中存的 type 對照表
export type TypeMap = Record<string /* bf.name */, BitFieldType>
```

#### Bit Field 有效範圍與解讀格式（`useBitFieldTypes.ts`，v0.44）

```ts
// 數值 (magnitude) 欄位的「解讀格式」：unsigned 整數 / signed 二補數 / IEEE-754 float（僅 32-bit）。
// 後端永遠存 unsigned 原始值，此設定只是前端「怎麼解讀」。
export type ValueFormat = 'uint' | 'sint' | 'fp32'

// 一個 bit field 的有效範圍設定（存入 rangeMap → localStorage，每個 register 一份）
export interface FieldRange {
  min?: number
  max?: number
  segments?: string                  // mode 片段範圍原始輸入字串（v0.42）
  parsedSegments?: [number, number][] // 解析後排序非重疊區段（v0.42）
  format?: ValueFormat               // v0.44 新增：magnitude 欄位的解讀格式（預設 uint）
}

// localStorage 中存的 range 對照表（key = bf.name）
export type RangeMap = Record<string, FieldRange>
```

`FieldRange.format` 只影響前端如何解讀後端送來的 unsigned 原始值，後端與資料庫一律儲存 unsigned 整數。`format` 沿用既有的 `rangeMap` 持久化機制（localStorage key `fpga-bit-field-ranges-{registerId}`），每個 register definition 一份。

### 3.2 後端 Pydantic / SQLAlchemy 模型（規劃）

```python
# Pydantic：API 入出參數 schema
class RegisterDefinitionOut(BaseModel):
    id: int
    name: str
    original_filename: str
    register_count: int
    bitfield_count: int
    uploaded_at: datetime

class BatchOut(BaseModel):
    id: int
    name: str
    register_name: str
    dat_count: int
    warning_count: int
    analyzed_at: datetime

class BatchDetailOut(BaseModel):
    summary: BatchOut
    bit_fields: List[BitFieldDef]
    rows: List[BatchRow]                  # testCase + values
    warnings: List[str]

# SQLAlchemy ORM
class RegisterDefinitionORM(Base):
    __tablename__ = "register_definitions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False)
    original_filename = Column(Text)
    file_path = Column(Text, nullable=False)
    register_count = Column(Integer)
    bitfield_count = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    batches = relationship("BatchORM", back_populates="register")

class BatchORM(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text)
    register_definition_id = Column(Integer, ForeignKey("register_definitions.id"), nullable=False)
    dat_count = Column(Integer)
    warning_count = Column(Integer, default=0)
    result_csv_path = Column(Text)
    result_xlsx_path = Column(Text)
    analyzed_at = Column(DateTime, default=datetime.utcnow)
    register = relationship("RegisterDefinitionORM", back_populates="batches")
```

### 3.3 SQLite Schema（含索引）

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
    name TEXT,
    register_definition_id INTEGER NOT NULL,
    dat_count INTEGER,
    warning_count INTEGER DEFAULT 0,
    result_csv_path TEXT,
    result_xlsx_path TEXT,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (register_definition_id) REFERENCES register_definitions(id) ON DELETE RESTRICT
);

-- 索引（加速歷史查詢）
CREATE INDEX idx_batches_analyzed_at ON batches(analyzed_at DESC);
CREATE INDEX idx_batches_register_id ON batches(register_definition_id);
```

外鍵 `ON DELETE RESTRICT`：當 batch 還參考某個 register 時，禁止刪除該 register。

### 3.4 共用值處理 Helper（`useBitFieldTypes.ts`，v0.44）

magnitude 欄位的「解讀格式」相關邏輯集中在 `useBitFieldTypes.ts`，供 StatsPanel / OverallPanel / Results 等多個元件共用：

```ts
// 把後端的 unsigned 原始值，依欄位格式解讀成實際數值（signed 可為負、fp32 為浮點）。
export function interpretValue(raw: number, width: number, format?: ValueFormat): number
//   sint：二補數 — raw >= 2^(w-1) 時回傳 raw - 2^w，否則回傳 raw
//   fp32：把 32-bit 位元樣式以 Uint32Array 寫入、再以 Float32Array 重解讀為浮點
//   uint（或未指定）：原值不變
//   （皆以 2 ** w 計算，避免 width=31/32 時 1<<w 溢位成負數）

// 依格式回傳「理論上下限」。
export function formatBounds(width: number, format?: ValueFormat): { min: number; max: number }
//   uint：{ min: 0, max: 2^w - 1 }
//   sint：{ min: -2^(w-1), max: 2^(w-1) - 1 }
//   fp32：無整數界線，沿用 uint

// v0.42 既有：解析 mode 片段範圍字串、判斷值是否落在有效範圍內。
export function parseSegments(input: string, maxVal: number): { parsed: [number, number][]; error?: string }
export function isValueInRange(value: number, range: FieldRange | undefined): boolean

// v0.44 改為 format-aware：以 formatBounds 取得未自訂那一端的預設上下限，
// 避免 signed 欄位用 0 當下限算錯涵蓋率分母。
export function validValueCount(range: FieldRange | undefined, width: number): number
//   有 parsedSegments：各片段長度總和
//   否則：lo = range.min ?? formatBounds.min，hi = range.max ?? formatBounds.max，回傳 max(0, hi - lo + 1)
```

> **width=31 溢位修正（v0.44）**：JS 的 `<<` 為 32-bit 帶號運算，`(1<<31)-1` 會溢位成負數，導致 Statistics 分頁直方圖建立陣列時拋出「Array length must be a positive integer」。所有 `bitMax` 計算（`formatBounds`、`validValueCount`、`computeBitMax`、`safeMaxValue`、`heatmapData`、mock/data）一律改用 `2 ** w - 1`；Histogram 小值整數分支另外防護負的 span。

---

## 4. 元件介面 (Interfaces)

### 4.1 前端關鍵元件 Props

#### `ResultsTable.tsx`

```ts
interface Props {
  rows: Array<{ testCase: string; values: number[] }>
  bitFields: BitFieldDef[]
  visibleIndices: number[]              // 父元件給的「可見欄」index 陣列
  format: 'hex' | 'dec'
  setFormat: (f: 'hex' | 'dec') => void
  prefix: string                        // 從檔名萃取編號用
  setPrefix: (p: string) => void
  onOpenColumnSelector: () => void      // 開欄位設定 modal
}
```

內部 state：`rowsPerPage`（10/50/100/500，預設 100）、`page`、`gotoInput`

#### `DualRegisterChart.tsx`

```ts
interface Props {
  rows: Array<{ testCase: string; values: number[] }>
  bitFields: BitFieldDef[]
  caseRange: { from: number; to: number }
}
```

內部 state：`xIdx`、`yIdx`、`view: 'heatmap' | 'scatter'`

#### `StatsPanel.tsx`

```ts
interface Props {
  rows: Array<{ testCase: string; values: number[] }>  // 已是 rangedRows（v0.29 起）
  bitFields: BitFieldDef[]
  types: TypeMap                       // 來自 useBitFieldTypes
  rangeMap: RangeMap                   // 來自 useBitFieldTypes（含 min/max/segments/format）
}
```

v0.44：magnitude 卡片先以 `interpretValue(raw, width, format)` 解讀每個值，再丟進 `computeStats`、範圍過濾與 `<Histogram>`；直方圖上下限由自訂 `min/max` 或 `formatBounds(width, format)` 決定。fp32 欄位以 `isFloat` 傳給圖表元件。v0.5 的 Int / FP32 切換已移除（格式改由欄位設定 popup 決定）。

#### `OverallPanel.tsx`

```ts
interface Props {
  summary: BatchSummary
  rows: Array<{ testCase: string; values: number[] }>  // 已是 rangedRows（v0.29 起）
  bitFields: BitFieldDef[]
  types: TypeMap
  rangeMap: RangeMap                   // 來自 useBitFieldTypes（含 min/max/segments/format）
}
```

v0.44：涵蓋率計算前先以 `interpretValue` 解讀值再算 min / max / 不同值 / 涵蓋率；理論範圍用 `formatBounds(width, format)`。fp32 欄位該列顯示「FP32」、涵蓋率顯示「—」（浮點無離散涵蓋率意義）。

#### `BitFieldTypeModal.tsx`

```ts
interface Props {
  open: boolean
  onClose: () => void
  bitFields: BitFieldDef[]
  types: TypeMap
  onApply: (next: TypeMap) => void
  onApplyRanges: (next: RangeMap) => void   // 套用有效範圍 + 格式
  rangeMap: RangeMap
  onReset: () => void
}
```

magnitude 欄位的有效範圍彈窗 `RangePopup`（v0.44）在最上方加一個單選 `<select>`：Unsigned / Signed，`width === 32` 時才額外出現 FP32。其 callback 簽名為 `onApply(name, min, max, format: ValueFormat)`。選 FP32 時 min / max 輸入框 disabled 並清空；選 Signed 時驗證與 `<input min/max>` 改用 `formatBounds`，允許負的下限。mode 欄位仍使用 `ModeRangePopup`（v0.42，min/max + 片段範圍）。

i18n（v0.44）：新增 `results.bitFieldType.format*` 系列 key（`formatLabel` / `formatUnsigned` / `formatSigned` / `formatFp32` / `formatFp32Hint`）；移除舊的 `interpretInt` / `interpretFP32` / `fp32OnlyFor32bit`；`rangeErrorOutOfBounds` 改為帶 `{{min}}` 與 `{{max}}` 兩個變數。

**套用範圍**：解讀格式套用於統計分析（StatsPanel）、Overall 涵蓋率（OverallPanel）、超出範圍警告（`Results.tsx` 與 `ResultsTable` 高亮判斷在比較前先 `interpretValue`）。**不套用**：主資料表的儲存格數值、以及 2D 熱力圖 / 散佈圖，皆維持顯示後端原始 unsigned 值。

#### `useBitFieldTypes(registerId, bitFields)` Hook 回傳值

```ts
{
  types: TypeMap
  update(name: string, type: BitFieldType): void
  bulkSet(map: TypeMap): void
  reset(): void
  rangeMap: RangeMap                            // 有效範圍 + 格式（每 register 一份）
  setRangeMap(map: RangeMap): void              // 寫入 localStorage
  isOutOfRange(fieldName: string, value: number): boolean
  isMode(name: string): boolean
  modeFieldNames(): string[]
}
```

#### `Histogram.tsx`（v0.44 介面變更）

```ts
interface Props {
  title: string
  values: number[]            // 已在上游依欄位格式解讀（signed 可為負、fp32 為浮點）
  maxValue: number
  minValue?: number           // 預設 0；支援負值偏移
  isFloat?: boolean           // 取代 v0.5 的 interpretAs:'int'|'fp32'
  allowedValues?: number[]    // v0.42：mode 片段範圍只建合法位置的 bar
}
```

v0.44：prop 由 `interpretAs: 'int' | 'fp32'` 改為 `isFloat: boolean`（值已在呼叫端 `interpretValue` 解讀完畢）。整數小值分支（`maxValue - minValue <= 20`）以 `minValue` 偏移建桶以支援負值。

#### `ValueCurve.tsx`（v0.44 介面變更）

```ts
interface Props {
  values: number[]            // 已在上游依欄位格式解讀
  isFloat?: boolean           // 取代 v0.5 的 interpretAs:'int'|'fp32'
}
```

### 4.2 後端 REST API Contract（規劃中）

#### POST `/api/registers`

**Request**：`multipart/form-data`
- `file`: `.xlsx` 檔案

**Response 200**：
```json
{
  "id": 1,
  "name": "SPE Registers (v1)",
  "original_filename": "spe_registers_sample.xlsx",
  "register_count": 47,
  "bitfield_count": 75,
  "uploaded_at": "2026-05-14T10:12:00Z"
}
```

**Response 400**（Excel 格式錯誤）：
```json
{ "detail": "Sheet 'Registers' not found in workbook" }
```

#### GET `/api/registers`

**Response 200**：`Array<RegisterDefinitionOut>`

#### DELETE `/api/registers/{id}`

**Response 204**：成功
**Response 409**（仍有 batch 參考）：`{ "detail": "Register is referenced by 3 batches; delete those first." }`

#### POST `/api/batches`

**Request**：`multipart/form-data`
- `register_id` (form field)
- `files` (重複多次，N 個 `.dat`)

**Response 200**：
```json
{
  "batch_id": 101,
  "status": "completed",
  "dat_count": 2000,
  "warning_count": 3,
  "analyzed_at": "2026-05-14T10:12:00Z"
}
```

**Response 400**：
```json
{ "detail": "register_id required" }
```

#### GET `/api/batches`

**Response 200**：`Array<BatchOut>` 依 `analyzed_at` 由新到舊。

#### GET `/api/batches/{id}`

**Response 200**：完整 `BatchDetailOut`（含 rows）。
- 注意：100 筆 dat × 75 bit field = 7500 數字，JSON 約 100KB；2000 筆約 2MB，需考慮 gzip。

**Response 404**：`{ "detail": "Batch not found" }`

#### GET `/api/batches/{id}/download.csv`

**Response 200**：`text/csv` 串流，`Content-Disposition: attachment; filename="batch_{id}.csv"`

#### GET `/api/batches/{id}/download.xlsx`

**Response 200**：`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 串流

---

> 導覽：[← 上一份：概述與元件](01-overview-and-components.md)　|　[索引](index.md)　|　[下一份：動態行為 →](03-dynamics.md)
