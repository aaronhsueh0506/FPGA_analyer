# FPGA Register Analyzer — 系統詳細設計

> 版本：v0.4.0　|　[← 回索引](index.md)　|　[← 上一份：概述與元件](01-overview-and-components.md)　·　[下一份：動態行為 →](03-dynamics.md)

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
  rows: Array<{ testCase: string; values: number[] }>
  bitFields: BitFieldDef[]
  types: TypeMap                       // 來自 useBitFieldTypes
  caseRange: { from: number; to: number }
}
```

#### `OverallPanel.tsx`

```ts
interface Props {
  summary: BatchSummary
  rows: Array<{ testCase: string; values: number[] }>
  bitFields: BitFieldDef[]
  types: TypeMap
  caseRange: { from: number; to: number }
}
```

#### `BitFieldTypeModal.tsx`

```ts
interface Props {
  open: boolean
  onClose: () => void
  bitFields: BitFieldDef[]
  types: TypeMap
  onApply: (next: TypeMap) => void
  onReset: () => void
}
```

#### `useBitFieldTypes(registerId, bitFields)` Hook 回傳值

```ts
{
  types: TypeMap
  update(name: string, type: BitFieldType): void
  bulkSet(map: TypeMap): void
  reset(): void
  isMode(name: string): boolean
  modeFieldNames(): string[]
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
