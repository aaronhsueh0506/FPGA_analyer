# FPGA Register Analyzer — 系統詳細設計

> 版本：v0.44　|　日期：2026-06-25　|　開發者：Aaron Hsueh　|　[← 回索引](index.md)　|　[← 上一份：資料模型與介面](02-data-and-interfaces.md)　·　[下一份：演算法 →](04-algorithms.md)

本份內容簡述：5-7 章，動態行為。涵蓋 6 個序列圖、6 個資料流圖與 4 個狀態圖。

---

## 5. 序列圖 (Sequence Diagrams)

### 5.1 SD-1：使用者上傳 Register Excel

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend<br/>(Registers.tsx)
    participant API as Backend<br/>(registers.py)
    participant EP as ExcelParser
    participant FS as Filesystem
    participant DB as SQLite

    U->>FE: 拖曳 spe_registers_sample.xlsx
    FE->>FE: 驗證副檔名 .xlsx
    FE->>API: POST /api/registers (multipart)
    API->>EP: parse(file_bytes)
    EP->>EP: 讀 sheet "Registers" 第 7 列起
    EP->>EP: 萃取 ADDR/Register/INI/Bits/Member
    EP-->>API: { registers: [...], stats: {...} }
    alt 解析成功
        API->>FS: 儲存 data/registers/{id}/spe.xlsx
        API->>DB: INSERT INTO register_definitions
        API-->>FE: 200 { id, register_count, bitfield_count }
        FE->>U: 列表新增一筆
    else 解析失敗
        API-->>FE: 400 { detail: "..." }
        FE->>U: 顯示錯誤提示
    end
```

### 5.2 SD-2：上傳 N 個 dat 並執行分析

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend<br/>(Analyze.tsx)
    participant API as Backend<br/>(batches.py)
    participant FS as Filesystem
    participant ANA as Analyzer
    participant REP as Reporter
    participant DB as SQLite

    U->>FE: 選 Register 下拉
    U->>FE: 拖曳 / 選資料夾 (2000 dat)
    FE->>FE: filter .dat 結尾
    U->>FE: 點「開始分析」
    FE->>API: POST /api/batches<br/>(register_id + 2000 files)

    API->>FS: 寫 data/batches/{id}/dats/*.dat
    API->>API: ExcelParser.load(register_id)
    loop 每個 dat
        API->>API: DatParser.parse(file)
    end
    API->>ANA: analyze(registers, all_dats)
    ANA->>ANA: 為每行 dat 解析 bit field
    ANA-->>API: result_matrix + warnings
    API->>REP: writeCsv + writeXlsx
    REP->>FS: data/batches/{id}/result.csv<br/>+ result.xlsx
    API->>DB: INSERT INTO batches
    API-->>FE: 200 { batch_id }

    FE->>FE: navigate(/results/{id})
    FE->>API: GET /api/batches/{id}
    API->>DB: SELECT batch
    API->>FS: 讀 result.csv → JSON
    API-->>FE: 200 { summary, table, warnings }
    FE->>U: 渲染五個 Tab
```

### 5.3 SD-3：切換 Bit Field 類型（純前端，localStorage）

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Results.tsx
    participant Modal as BitFieldTypeModal
    participant Hook as useBitFieldTypes
    participant LS as localStorage

    U->>FE: 點「Bit Field 類型設定」
    FE->>Modal: open = true, types
    Modal->>Modal: draft = {...types}
    U->>Modal: 把 SPE_CORE_MODE 改成 mode
    Modal->>Modal: setDraft({...draft, SPE_CORE_MODE: 'mode'})
    U->>Modal: 點「套用」
    Modal->>Hook: onApply(draft)
    Hook->>LS: setItem('fpga-bit-field-types-{id}', JSON)
    Hook->>FE: setTypes(draft) (re-render)
    FE->>U: Stats Tab 直方圖自動更新
```

### 5.4 SD-4：下載 CSV / Excel

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Results.tsx
    participant API as Backend
    participant FS as Filesystem

    U->>FE: 點「下載 CSV」
    FE->>API: GET /api/batches/{id}/download.csv
    API->>FS: open data/batches/{id}/result.csv
    API-->>FE: 200 text/csv stream<br/>Content-Disposition: attachment
    FE->>U: 瀏覽器觸發下載
```

### 5.5 SD-5：查詢歷史 batch

```mermaid
sequenceDiagram
    actor U as User
    participant FE as History.tsx
    participant API as Backend
    participant DB as SQLite

    U->>FE: 進入 /history
    FE->>API: GET /api/batches
    API->>DB: SELECT * FROM batches<br/>ORDER BY analyzed_at DESC
    DB-->>API: rows
    API-->>FE: 200 [{id, name, ...}]
    FE->>U: 渲染列表
    U->>FE: 點某筆「查看」
    FE->>FE: navigate(/results/{id})
```

### 5.6 SD-6：Results 頁 Tab 切換（純前端內部）

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Results.tsx (容器)
    participant Tab as Active Tab Component
    participant Hook as useBitFieldTypes
    participant Mock as mock data / state

    Note over FE: 初始：tab='table'
    FE->>Mock: generateMockBatchDetail(batchId)
    FE->>Hook: useBitFieldTypes(registerName, bitFields)
    Hook-->>FE: types

    U->>FE: 點「Overall」Tab
    FE->>FE: setTab('overall')
    FE->>Tab: <OverallPanel summary rows<br/>bitFields types caseRange />
    Tab->>Tab: useMemo: slicedRows, typeCounts, comboResult
    Tab->>U: 渲染四個區塊
```

---

## 6. 資料流圖 (Data Flow Diagrams)

### 6.1 DF-1：Excel → Registers Dictionary

```mermaid
graph LR
    A[Excel .xlsx<br/>spe_registers_sample.xlsx] --> B[openpyxl<br/>load_workbook]
    B --> C[Sheet 'Registers'<br/>第 7 列起]
    C --> D[ExcelParser<br/>逐列掃描]
    D --> E[delimiter check:<br/>ADDR+Register<br/>非空則新 register]
    E --> F[Bits parser<br/>'5_4' → 5,4<br/>'10' → 10,10]
    F --> G[Registers Dict<br/>{addr: {<br/>  name,<br/>  bitfields[]<br/>}}]
    G --> H[(快取於 RAM)]
```

### 6.2 DF-2：dat → AddressValuePairs

```mermaid
graph LR
    A[dat .dat<br/>ASCII 每行 12 字元] --> B[逐行讀]
    B --> C{trim & len==12?}
    C -->|是| D[前 4 = addr<br/>後 8 = value]
    C -->|否| W[警告：行格式錯]
    D --> E[parseInt addr hex<br/>parseInt value hex]
    E --> F[AddressValuePair<br/>list]
```

### 6.3 DF-3：Registers + Dat → Result Matrix（核心）

```mermaid
graph TB
    REG[Registers Dict<br/>by addr] --> ANA[Analyzer]
    DAT[Dat AddressValuePairs] --> ANA

    ANA --> CHK{addr<br/>in dict?}
    CHK -->|否| W[Warning:<br/>Unknown addr]
    CHK -->|是| BF[逐個 bit field<br/>計算 extracted]

    BF --> FORMULA["extracted =<br/>(value >> low_bit)<br/>& ((1 << width) - 1)"]

    FORMULA --> ROW[Result Row<br/>testCase + values]
    W --> WARN[Warning list]

    ROW --> MAT[Result Matrix<br/>N rows × 75 cols]
    WARN --> MAT
```

### 6.4 DF-4：Result Matrix → 輸出

```mermaid
graph LR
    A[Result Matrix<br/>in RAM] --> R{Reporter}
    R --> CSV[csv.writer<br/>每行 = testCase + values]
    R --> XLSX[openpyxl<br/>同欄位寫入]
    CSV --> F1[data/batches/{id}/result.csv]
    XLSX --> F2[data/batches/{id}/result.xlsx]

    A --> J[JSON 序列化<br/>給前端]
    J --> API[REST 回應]
```

### 6.5 DF-5：後端 JSON → 前端 UI 元件

```mermaid
graph TB
    API[後端 JSON<br/>summary + rows + warnings] --> FETCH[Results.tsx<br/>useEffect fetch]
    FETCH --> STATE[useState detail]

    STATE --> SHARED[共用 state<br/>caseRange<br/>visibleIndices<br/>format<br/>prefix<br/>types from hook]

    SHARED --> RT[ResultsTable]
    SHARED --> DR[DualRegisterChart]
    SHARED --> SP[StatsPanel]
    SHARED --> OP[OverallPanel]
    SHARED --> WV[警告 list]

    RT --> R1[本地 state:<br/>page, rowsPerPage]
    DR --> R2[本地 state:<br/>xIdx, yIdx, view]
    SP --> R3[計算:<br/>computeStats<br/>分類 mode/mag]
    OP --> R4[計算:<br/>typeCounts<br/>rangeCoverage<br/>combinations]
```

### 6.6 DF-6：數值解讀格式 (ValueFormat) 資料流（v0.44）

> 後端永遠儲存 unsigned 原始整數；`FieldRange.format`（`uint` / `sint` / `fp32`，存於 rangeMap → localStorage，每個 register 一份）只改變**前端怎麼解讀**這個原始值。共用 helper `interpretValue(raw, width, format)` 與 `formatBounds(width, format)` 定義於 `useBitFieldTypes.ts`。注意：主資料表儲存格與 2D 熱力圖／散佈圖**不**經過解讀，維持顯示原始 unsigned 值。

```mermaid
graph TB
    RAW[Raw unsigned int<br/>row.values i<br/>後端原始值] --> FMT{FieldRange.format<br/>uint / sint / fp32}

    FMT --> IV["interpretValue(raw,width,format)<br/>sint = 二補數<br/>raw≥2^(w-1) ? raw-2^w : raw<br/>fp32 = Uint32→Float32 重解讀"]

    IV --> SP[StatsPanel<br/>computeStats<br/>範圍過濾 + 直方圖<br/>bounds = formatBounds 或自訂 min/max]
    IV --> OP[OverallPanel<br/>min/max/不同值/涵蓋率<br/>理論範圍 = formatBounds<br/>fp32 顯示 FP32、涵蓋率 —]
    IV --> OOR[超範圍警告<br/>Results.tsx outOfRangeWarnings<br/>+ ResultsTable 紅色高亮<br/>比較前先解讀]

    RAW -.不解讀.-> TBL[主資料表儲存格<br/>ResultsTable 顯示<br/>原始 unsigned]
    RAW -.不解讀.-> HM[2D 熱力圖 / 散佈圖<br/>Heatmap2D / Scatter<br/>原始 unsigned]
```

---

## 7. 狀態圖 (State Diagrams)

### 7.1 ST-1：Analyze 頁三步驟狀態機

```mermaid
stateDiagram-v2
    [*] --> Step1_NoRegister
    Step1_NoRegister: Step 1<br/>未選 Register
    Step2_AwaitDat: Step 2<br/>已選 Register<br/>等待 dat
    Step3_Ready: Step 3<br/>可開始分析
    Analyzing: 分析中<br/>(mock 1.2s)
    Done: 完成

    Step1_NoRegister --> Step2_AwaitDat : 選 Register
    Step2_AwaitDat --> Step1_NoRegister : 換 Register / 清空
    Step2_AwaitDat --> Step3_Ready : 加入至少 1 個 dat
    Step3_Ready --> Step2_AwaitDat : 移除全部 dat
    Step3_Ready --> Analyzing : 點「開始分析」
    Analyzing --> Done : 完成
    Done --> [*] : navigate /results/{id}
```

### 7.2 ST-2：分析批次 Lifecycle（後端）

```mermaid
stateDiagram-v2
    [*] --> Received
    Received: 收到 multipart 請求
    Validating: 驗證 register_id<br/>+ 檔案格式
    Parsing: ExcelParser<br/>+ DatParser
    Analyzing: Analyzer 比對
    Reporting: 寫 CSV/XLSX
    Persisting: INSERT batches
    Done: 回應 200
    Failed: 回應 4xx/5xx

    Received --> Validating
    Validating --> Failed : 缺欄/格式錯
    Validating --> Parsing
    Parsing --> Failed : Excel 解析失敗
    Parsing --> Analyzing
    Analyzing --> Reporting
    Reporting --> Persisting
    Persisting --> Done
    Done --> [*]
    Failed --> [*]
```

### 7.3 ST-3：Bit Field 類型

```mermaid
stateDiagram-v2
    [*] --> CheckStorage
    CheckStorage: useBitFieldTypes init<br/>檢查 localStorage
    HasStorage: 有存檔
    NoStorage: 無存檔
    Heuristic: 跑啟發式<br/>名稱含 EN/MODE<br/>→ mode<br/>否則 magnitude
    Loaded: 載入 types map

    CheckStorage --> HasStorage : key 存在
    CheckStorage --> NoStorage : key 不存在
    HasStorage --> Loaded
    NoStorage --> Heuristic
    Heuristic --> Loaded

    state Loaded {
        [*] --> ModeMagOthers
        ModeMagOthers: 每個 bit field<br/>有 mode / magnitude / others
        ModeMagOthers --> ModeMagOthers : 使用者切換<br/>→ 寫 localStorage
        ModeMagOthers --> ResetDefaults : 點 reset<br/>→ 清 localStorage<br/>→ 重跑啟發式
        ResetDefaults --> ModeMagOthers
    }
```

### 7.4 ST-4：Results 頁 Tab

```mermaid
stateDiagram-v2
    [*] --> Table
    Table: 表格檢視<br/>(預設)
    Dual: 資料散佈分析
    Stats: 統計分析
    Overall: Overall
    Warnings: 警告訊息

    Table --> Dual : 點 Tab
    Dual --> Stats : 點 Tab
    Stats --> Overall : 點 Tab
    Overall --> Warnings : 點 Tab
    Warnings --> Table : 點 Tab
    Table --> Stats : 跳轉
    Table --> Overall : 跳轉
    Overall --> Table : 跳轉

    note right of Dual
      Case Range 工具列
      在 Dual/Stats/Overall
      上方顯示
    end note
```

---

> 導覽：[← 上一份：資料模型與介面](02-data-and-interfaces.md)　|　[索引](index.md)　|　[下一份：演算法 →](04-algorithms.md)
