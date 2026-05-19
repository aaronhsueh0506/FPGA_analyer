# FPGA Register Analyzer — 系統詳細設計

> 版本：v0.4.0　|　[← 回索引](index.md)　|　[← 上一份：動態行為](03-dynamics.md)　·　[下一份：品質屬性 →](05-quality.md)

本份內容簡述：第 8 章，演算法詳述。涵蓋 Bit-field 解析、組合分析 Top-N、Range 涵蓋率與 Histogram 自動分箱的偽程式碼。

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

### 8.2 組合分析 Top-N

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

### 8.3 Range 涵蓋率計算（Overall Tab）

```text
INPUT:
  bitFields : List[BitFieldDef]
  types     : TypeMap                # 標 'magnitude' 的才算
  rows      : List[Row]
OUTPUT:
  coverage : List[{ name, width, theoMax, actMin, actMax, unique, pct }]

result := []
FOR each bf in bitFields:
  IF types[bf.name] ≠ 'magnitude': continue

  vals := rows.map(r => r.values[indexOf bf])
  theoMax := IF bf.width == 32 THEN 0xFFFFFFFF ELSE (1 << bf.width) - 1
  actMin := min(vals)
  actMax := max(vals)
  unique := new Set(vals).size
  pct := IF theoMax > 0 THEN (actMax - actMin) / theoMax * 100 ELSE 0

  result.append({ name: bf.name, width: bf.width,
                  theoMax, actMin, actMax, unique, pct })

return result
```

### 8.4 Histogram 自動分箱

```text
INPUT:
  values : number[]
  maxValue : number
OUTPUT:
  bins : List[{ label, count }]

IF maxValue ≤ 20:
  # 離散：每個整數一個 bin
  bins := for v from 0 to maxValue:
            { label: v, count: count of v in values }
ELSE:
  # 連續：分 20 bins
  binSize := ceil((maxValue + 1) / 20)
  bins := for i from 0 to 19:
            lo := i * binSize
            hi := min((i+1) * binSize - 1, maxValue)
            { label: "{lo}-{hi}",
              count: count(v in values where lo ≤ v ≤ hi) }

return bins
```

---

> 導覽：[← 上一份:動態行為](03-dynamics.md)　|　[索引](index.md)　|　[下一份：品質屬性 →](05-quality.md)
