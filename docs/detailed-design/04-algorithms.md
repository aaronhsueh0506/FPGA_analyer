# FPGA Register Analyzer — 系統詳細設計

> 版本：v0.44　|　日期：2026-06-25　|　開發者：Aaron Hsueh　|　[← 回索引](index.md)　|　[← 上一份：動態行為](03-dynamics.md)　·　[下一份：品質屬性 →](05-quality.md)

本份內容簡述：第 8 章，演算法詳述。涵蓋 Bit-field 解析、值解讀格式（unsigned / signed / fp32）、格式感知理論界線、組合分析 Top-N、Range 涵蓋率與 Histogram 自動分箱（含 minValue 偏移與 fp32 路徑）的偽程式碼。

---

## 8. 演算法詳述 (Algorithms)

### 8.1 Bit Field 解析

```text
INPUT:
  excel_rows : List[Row]
  dat_lines  : List[str]
OUTPUT:
  result : List[{ testCase, values[] }]
  warnings : List[str]

# Step A: 建立 Registers Dictionary
registers := {}
current_addr := None
FOR each row in excel_rows:
  IF row.ADDR ≠ NULL AND row.Register ≠ NULL:
    current_addr := row.ADDR.upper()
    registers[current_addr] := { name: row.Register, bitfields: [] }
  IF row.Member ≠ NULL:
    IF "_" in row.Bits:
      hi, lo := parseRange(row.Bits)        # "5_4" → 5, 4
      width  := hi - lo + 1
      low_bit := lo
    ELSE:
      low_bit := int(row.Bits)
      width  := 1
    registers[current_addr].bitfields.append({
      name: row.Member,
      low_bit: low_bit,
      width: width,
      ini: row.INI
    })

# Step B: 解析 dat
addr_value_map := {}
FOR each line in dat_lines:
  IF len(line.trim()) ≠ 12: continue
  addr  := line[0:4].upper()
  value := parseInt(line[4:12], 16)
  addr_value_map[addr] := value

# Step C: 對應 + 提取
output_row := { testCase: dat_filename, values: [] }
FOR each bf in flatten(registers.bitfields):  # 依固定順序，例如依 Excel 出現順序
  addr := bf.registerAddr
  IF addr not in addr_value_map:
    output_row.values.append(NULL)
    warnings.append("Missing address {addr} in dat")
    continue
  value := addr_value_map[addr]
  mask  := (1 << bf.width) - 1
  extracted := (value >> bf.low_bit) & mask
  output_row.values.append(extracted)

# Step D: 未知 address
FOR addr in addr_value_map:
  IF addr not in registers:
    warnings.append("Unknown address: {addr}")
```

### 8.2 值解讀格式（Value Interpretation，v0.44）

後端永遠儲存 unsigned 原始整數；**前端**才依每個 magnitude bit field 的「解讀格式」`format ∈ {uint, sint, fp32}`（存於 `FieldRange.format` → rangeMap → localStorage，每個 register 一份）把原始值轉成實際數值。helper 定義於 `useBitFieldTypes.ts`。

```text
# interpretValue：把 unsigned 原始值依格式解讀成實際數值
INPUT:
  raw    : int     # 後端的 unsigned 原始值
  width  : int     # bit field 位寬
  format : 'uint' | 'sint' | 'fp32'   # 預設 uint
OUTPUT:
  value : number   # sint 可為負；fp32 為浮點

FUNCTION interpretValue(raw, width, format):
  IF format == 'sint':
    w := min(width, 32)
    signBit := 2 ** (w - 1)            # 用 2**w，避免 w=32 時 1<<31 溢位
    # 二補數：最高位為 1 代表負值，減去 2^w 還原
    RETURN raw >= signBit ? raw - 2 ** w : raw

  IF format == 'fp32':
    # IEEE-754 重新解讀：同一段 32-bit pattern 直接當 float32 讀出
    buf := new ArrayBuffer(4)
    new Uint32Array(buf)[0] := raw >>> 0    # 寫入 unsigned 32-bit pattern
    RETURN new Float32Array(buf)[0]         # 以 float32 讀出

  RETURN raw                            # uint：原樣返回
```

> **溢位陷阱（v0.44 修正）**：JavaScript 的位元運算（`<<`）以 **32-bit signed** 進行。`width = 31` 時 `1 << 31` 會溢位成負數 `-2147483648`，使理論最大 `(1 << 31) - 1` 變成負值，下游 `new Array(size)` 因負長度而拋出 `Array length must be a positive integer` 導致統計頁崩潰。因此所有界線運算一律改用 `2 ** w`（浮點冪次，無 32-bit 溢位）：`formatBounds`、`validValueCount`、`computeBitMax`、`safeMaxValue`、`heatmapData` 與 mock 資料皆已切換。

### 8.3 格式感知理論界線（formatBounds，v0.44）

`formatBounds(width, format)` 回傳該欄位在「解讀後數值域」的理論上下限，供直方圖座標範圍、範圍輸入框 min/max 限制、超範圍驗證與涵蓋率分母使用。

```text
INPUT:
  width  : int
  format : 'uint' | 'sint' | 'fp32'
OUTPUT:
  { min, max }

FUNCTION formatBounds(width, format):
  IF format == 'sint':
    w := min(width, 32)
    RETURN { min: -(2 ** (w - 1)), max: 2 ** (w - 1) - 1 }   # 例：8-bit → -128 ~ 127
  # uint 與 fp32（fp32 無整數界線，沿用 unsigned 界線）
  max := width >= 32 ? 0xFFFFFFFF : (2 ** width) - 1          # 用 2**w，避免 width=31 時 1<<31 溢位成負數
  RETURN { min: 0, max }
```

UI：magnitude 的有效範圍彈窗（`RangePopup`）最上方有單選 `<select>`（Unsigned / Signed；`width === 32` 才出現 FP32）。選 FP32 時 min/max 輸入框 disabled 並清空；選 Signed 時驗證與 `<input min/max>` 改用 `formatBounds`，允許負的有效範圍下限。

### 8.4 組合分析 Top-N

```text
INPUT:
  rows : List[{ testCase, values[] }]
  pickedFields : List[int]        # bit field index 清單
  N : int                          # 例如 10
OUTPUT:
  top : List[{ key, count, percent }]

counts := Map<string, int>{}
FOR each row in rows:
  key := pickedFields.map(i => row.values[i]).join('|')
  counts[key] := (counts[key] OR 0) + 1

arr := counts.entries().sortDesc(by: count).take(N)
total := rows.length
return arr.map(entry => {
  key:     entry.key,
  count:   entry.count,
  percent: entry.count / total * 100
})
```

### 8.5 Range 涵蓋率計算（Overall Tab，v0.44 格式感知）

涵蓋率改為「**先解讀**、**再算**」：每個值先過 `interpretValue`（signed 可為負、fp32 為浮點），理論範圍改用 `formatBounds`，涵蓋率分母改用格式感知的 `validValueCount`（見下）。fp32 欄位無整數界線，理論範圍欄顯示「FP32」、涵蓋率欄顯示「—」。

```text
INPUT:
  bitFields : List[BitFieldDef]
  types     : TypeMap                # 標 'magnitude' 的才算
  rows      : List[Row]
  rangeMap  : RangeMap               # 每欄位的 format / 自訂 min/max
OUTPUT:
  coverage : List[{ name, width, format, bitMin, bitMax,
                    effMin, effMax, actMin, actMax, unique, pct }]

result := []
FOR each bf in bitFields:
  IF types[bf.name] ≠ 'magnitude': continue

  fr     := rangeMap[bf.name]
  format := fr.format OR 'uint'
  bounds := formatBounds(bf.width, format)        # 格式感知理論界線
  bitMin := bounds.min ; bitMax := bounds.max
  effMin := fr.min ≠ NULL ? fr.min : bitMin       # 使用者自訂值優先
  effMax := fr.max ≠ NULL ? fr.max : bitMax

  actMin := +∞ ; actMax := −∞ ; uniqInRange := Set{}
  FOR each row in rows:
    raw := row.values[indexOf bf]
    IF raw is not number: continue
    v := interpretValue(raw, bf.width, format)     # 先解讀
    actMin := min(actMin, v) ; actMax := max(actMax, v)
    IF isValueInRange(v, fr): uniqInRange.add(v)

  refSpan := validValueCount(fr, bf.width)         # 格式感知分母
  pct := refSpan > 0 ? uniqInRange.size / refSpan * 100 : 0
  # fp32 欄位：理論範圍顯示 "FP32"、pct 顯示 "—"

  result.append({ name: bf.name, width: bf.width, format,
                  bitMin, bitMax, effMin, effMax,
                  actMin, actMax, unique: uniqInRange.size, pct })

return result
```

```text
# validValueCount：涵蓋率分母（合法值個數），v0.44 格式感知
INPUT:
  range : FieldRange | undefined     # 含 format / min / max / parsedSegments
  width : int
OUTPUT:
  count : int

FUNCTION validValueCount(range, width):
  bounds := formatBounds(width, range.format)       # 未自訂的那一端用格式預設
  IF range.parsedSegments 非空:                     # 片段範圍：各段長度相加
    RETURN Σ (hi - lo + 1) over parsedSegments
  lo := range.min ≠ NULL ? range.min : bounds.min   # signed 預設下限為負，避免用 0 算錯
  hi := range.max ≠ NULL ? range.max : bounds.max
  RETURN max(0, hi - lo + 1)
```

### 8.6 Histogram 自動分箱（v0.44 含 minValue 偏移與 fp32 路徑）

輸入的 `values` **已在上游（StatsPanel）依格式解讀**，所以可能含負值（signed）或浮點（fp32）。圖表元件以 `isFloat` 旗標（取代舊的 `interpretAs`）選擇分箱路徑；整數小值分支改用 `minValue` 偏移，讓 signed 負值也能正確落格。

```text
INPUT:
  values   : number[]    # 已解讀；signed 可為負、fp32 為浮點
  minValue : number      # 解讀後數值域下限（signed 可為負）
  maxValue : number      # 解讀後數值域上限
  isFloat  : bool        # fp32 為 true
  allowedValues? : number[]   # mode 片段範圍時，只建合法位置的 bar
OUTPUT:
  bins : List[{ label, count }]
BIN_COUNT := 20

# 路徑 1：fp32 浮點 — 以實際 finite 值的 min/max 等寬切 20 桶
IF isFloat:
  finite := values where isFinite(v)
  IF finite 為空: RETURN [{ label: "NaN/Inf", count: values.length }]
  fMin := min(finite) ; fMax := max(finite)
  fRange := (fMax - fMin) OR 1
  step := fRange / BIN_COUNT
  bins := for i from 0 to BIN_COUNT-1:
            lo := fMin + step*i
            hi := i == BIN_COUNT-1 ? fMax : fMin + step*(i+1)
            { label: "{fmtFloat(lo)}~{fmtFloat(hi)}", count: 0 }
  FOR each f in values where isFinite(f):
    idx := clamp(floor((f - fMin) / fRange * BIN_COUNT), 0, BIN_COUNT-1)
    bins[idx].count += 1
  RETURN bins

# 路徑 2：整數離散小值（含 minValue 偏移，支援負值）
ELSE IF maxValue ≥ minValue AND (maxValue - minValue) ≤ 20:
  IF allowedValues 非空:                  # mode 片段：只建合法值的 bar
    bins := allowedValues.map(v => { label: str(v), count: 0 })
    FOR each v in values: 命中 allowedValues 的位置 += 1
  ELSE:
    size := maxValue - minValue + 1       # span 已由 minValue 偏移保證為正
    bins := for i from 0 to size-1: { label: str(minValue + i), count: 0 }
    FOR each v in values:
      idx := clamp(v - minValue, 0, size - 1)   # 以 minValue 為原點，負值也正確落格
      bins[idx].count += 1
  RETURN bins

# 路徑 3：整數連續大範圍 — 以 [minValue, maxValue] 等寬切 20 桶
ELSE:
  range := (maxValue - minValue) OR 1
  step := range / BIN_COUNT
  bins := for i from 0 to BIN_COUNT-1:
            lo := minValue + step*i
            hi := i == BIN_COUNT-1 ? maxValue : minValue + step*(i+1)
            { label: "{round(lo)}-{round(hi)}", count: 0 }
  FOR each v in values:
    idx := clamp(floor((v - minValue) / range * BIN_COUNT), 0, BIN_COUNT-1)
    bins[idx].count += 1
  RETURN bins
```

> StatsPanel 上游決定 `minValue` / `maxValue`：有自訂範圍時用 `fr.min` / `fr.max`，否則用 `formatBounds(width, format)` 的下/上限（signed 下限為負）。fp32 欄位另傳 `isFloat = true`。直方圖前的值已先過 `interpretValue` 與 `isValueInRange` 過濾。

---

> 導覽：[← 上一份:動態行為](03-dynamics.md)　|　[索引](index.md)　|　[下一份：品質屬性 →](05-quality.md)
