export interface RegisterDefinition {
  id: number
  name: string
  originalFilename: string
  registerCount: number
  bitfieldCount: number
  uploadedAt: string
}

export interface BatchSummary {
  id: number
  name: string
  registerName: string
  datCount: number
  warningCount: number
  analyzedAt: string
}

export interface BitFieldDef {
  name: string
  width: number
  registerName: string
  registerAddr: string
}

export interface BatchDetail {
  summary: BatchSummary
  bitFields: BitFieldDef[]
  rows: Array<{ testCase: string; values: number[] }>
  warnings: string[]
}

export type BitFieldType = 'mode' | 'magnitude' | 'others'

export const mockRegisters: RegisterDefinition[] = [
  {
    id: 1,
    name: 'SPE Registers (v1)',
    originalFilename: 'spe_registers_sample.xlsx',
    registerCount: 47,
    bitfieldCount: 75,
    uploadedAt: '2026-05-12 14:23'
  },
  {
    id: 2,
    name: 'SPE Registers (v2 draft)',
    originalFilename: 'spe_registers_v2.xlsx',
    registerCount: 49,
    bitfieldCount: 78,
    uploadedAt: '2026-05-14 09:10'
  }
]

export const mockBatches: BatchSummary[] = [
  {
    id: 101,
    name: '20260514_101205',
    registerName: 'SPE Registers (v1)',
    datCount: 2000,
    warningCount: 3,
    analyzedAt: '2026-05-14 10:12'
  },
  {
    id: 102,
    name: '20260513_153401',
    registerName: 'SPE Registers (v1)',
    datCount: 320,
    warningCount: 0,
    analyzedAt: '2026-05-13 15:34'
  },
  {
    id: 103,
    name: '20260512_174822',
    registerName: 'SPE Registers (v1)',
    datCount: 80,
    warningCount: 1,
    analyzedAt: '2026-05-12 17:48'
  }
]

// 75 個 bit field，仿照 spe_registers_sample.xlsx 的結構：
// 同一 register 可能有多個 bit field
export const mockBitFields: BitFieldDef[] = [
  // Register 0x0000 SPE_Control_Register_0
  { name: 'SPE_SW_RST', width: 1, registerName: 'SPE_Control_Register_0', registerAddr: '0000' },
  { name: 'SPE_START', width: 1, registerName: 'SPE_Control_Register_0', registerAddr: '0000' },
  // 0x0004
  { name: 'INTE_FRM_END', width: 1, registerName: 'SPE_Interrupt_Enable_Register', registerAddr: '0004' },
  { name: 'INTE_DEC_ERR', width: 1, registerName: 'SPE_Interrupt_Enable_Register', registerAddr: '0004' },
  { name: 'INTE_NORM_ERR', width: 1, registerName: 'SPE_Interrupt_Enable_Register', registerAddr: '0004' },
  // 0x000C
  { name: 'DRAMUB_INO_RINGBUF_EN', width: 1, registerName: 'SPE_Function_Flow_Control_Register', registerAddr: '000C' },
  // 0x0010 SPE_Function_Enable_Register
  { name: 'SPE_CORE_MODE', width: 2, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_POST_MODE', width: 2, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_SCALAR_MODE', width: 2, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_FILT_EN', width: 1, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_NORM_EN', width: 1, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_LOG_EN', width: 1, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_CORE_DC_EN', width: 1, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_DELTA_TRIM_MODE', width: 2, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_LOAD_WEIGHT_EN', width: 1, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  { name: 'SPE_DELTA_HIGH_EFF_EN', width: 1, registerName: 'SPE_Function_Enable_Register', registerAddr: '0010' },
  // 0x0014 — 14
  { name: 'SPE_DMA_BURST_LEN', width: 4, registerName: 'SPE_DMA_Control_Register', registerAddr: '0014' },
  { name: 'SPE_DMA_PRIO', width: 2, registerName: 'SPE_DMA_Control_Register', registerAddr: '0014' },
  { name: 'SPE_DMA_OUTSTANDING', width: 4, registerName: 'SPE_DMA_Control_Register', registerAddr: '0014' },
  // 0x0018 — 17
  { name: 'SPE_CLK_GATE_EN', width: 1, registerName: 'SPE_Power_Register', registerAddr: '0018' },
  { name: 'SPE_LOW_POWER_MODE', width: 2, registerName: 'SPE_Power_Register', registerAddr: '0018' },
  // 0x001C — 19
  { name: 'SPE_DEBUG_EN', width: 1, registerName: 'SPE_Debug_Register', registerAddr: '001C' },
  { name: 'SPE_DEBUG_SEL', width: 4, registerName: 'SPE_Debug_Register', registerAddr: '001C' },
  // 0x0070 SPE_Size_Register_0 — 21
  { name: 'SPE_IN_WIDTH', width: 11, registerName: 'SPE_Size_Register_0', registerAddr: '0070' },
  { name: 'SPE_IN_HEIGHT', width: 16, registerName: 'SPE_Size_Register_0', registerAddr: '0070' },
  // 0x0074 — 23
  { name: 'SPE_IN_CHANNEL', width: 12, registerName: 'SPE_Channel_Register', registerAddr: '0074' },
  { name: 'SPE_OUT_CHANNEL', width: 12, registerName: 'SPE_Channel_Register', registerAddr: '0074' },
  // 0x0078 — 25
  { name: 'SPE_OUT_WIDTH', width: 11, registerName: 'SPE_Size_Register_1', registerAddr: '0078' },
  { name: 'SPE_OUT_HEIGHT', width: 16, registerName: 'SPE_Size_Register_1', registerAddr: '0078' },
  // 0x007C — 27
  { name: 'SPE_KERNEL_W', width: 5, registerName: 'SPE_Kernel_Register', registerAddr: '007C' },
  { name: 'SPE_KERNEL_H', width: 5, registerName: 'SPE_Kernel_Register', registerAddr: '007C' },
  { name: 'SPE_KERNEL_STRIDE', width: 4, registerName: 'SPE_Kernel_Register', registerAddr: '007C' },
  // 0x0080 Stride — 30
  { name: 'SPE_STRIDE_X', width: 4, registerName: 'SPE_Stride_Register', registerAddr: '0080' },
  { name: 'SPE_STRIDE_Y', width: 4, registerName: 'SPE_Stride_Register', registerAddr: '0080' },
  // 0x0084 Pad — 32
  { name: 'SPE_PAD_LEFT', width: 4, registerName: 'SPE_Pad_Register', registerAddr: '0084' },
  { name: 'SPE_PAD_TOP', width: 4, registerName: 'SPE_Pad_Register', registerAddr: '0084' },
  { name: 'SPE_PAD_RIGHT', width: 4, registerName: 'SPE_Pad_Register', registerAddr: '0084' },
  { name: 'SPE_PAD_BOTTOM', width: 4, registerName: 'SPE_Pad_Register', registerAddr: '0084' },
  // 0x0088 — 36
  { name: 'SPE_POST_COEFF0', width: 32, registerName: 'SPE_Post_Coeff_Register_0', registerAddr: '0088' },
  // 0x008C — 37
  { name: 'SPE_POST_COEFF1', width: 32, registerName: 'SPE_Post_Coeff_Register_1', registerAddr: '008C' },
  // 0x0090 — 38
  { name: 'SPE_FILT_THRESHOLD', width: 16, registerName: 'SPE_Filter_Register', registerAddr: '0090' },
  { name: 'SPE_FILT_MODE_SEL', width: 3, registerName: 'SPE_Filter_Register', registerAddr: '0090' },
  // 0x0094 — 40
  { name: 'SPE_NORM_SCALE', width: 16, registerName: 'SPE_Norm_Register', registerAddr: '0094' },
  { name: 'SPE_NORM_SHIFT', width: 5, registerName: 'SPE_Norm_Register', registerAddr: '0094' },
  // 0x0098 — 42
  { name: 'SPE_LOG_BASE_SEL', width: 2, registerName: 'SPE_Log_Register', registerAddr: '0098' },
  { name: 'SPE_LOG_OFFSET', width: 16, registerName: 'SPE_Log_Register', registerAddr: '0098' },
  // 0x009C — 44
  { name: 'SPE_DC_OFFSET', width: 12, registerName: 'SPE_DC_Register', registerAddr: '009C' },
  { name: 'SPE_DC_GAIN', width: 12, registerName: 'SPE_DC_Register', registerAddr: '009C' },
  // 0x00A0 — 46
  { name: 'SPE_DELTA_LO', width: 16, registerName: 'SPE_Delta_Register_0', registerAddr: '00A0' },
  { name: 'SPE_DELTA_HI', width: 16, registerName: 'SPE_Delta_Register_0', registerAddr: '00A0' },
  // 0x00A4 — 48
  { name: 'SPE_DELTA_TRIM_LO', width: 8, registerName: 'SPE_Delta_Register_1', registerAddr: '00A4' },
  { name: 'SPE_DELTA_TRIM_HI', width: 8, registerName: 'SPE_Delta_Register_1', registerAddr: '00A4' },
  // 0x00A8 — 50
  { name: 'SPE_SCALAR_FACTOR', width: 16, registerName: 'SPE_Scalar_Register', registerAddr: '00A8' },
  { name: 'SPE_SCALAR_SHIFT', width: 5, registerName: 'SPE_Scalar_Register', registerAddr: '00A8' },
  // 0x00AC — 52
  { name: 'SPE_WEIGHT_BASE_ADDR', width: 32, registerName: 'SPE_Weight_Addr_Register', registerAddr: '00AC' },
  // 0x00B0 — 53
  { name: 'SPE_INPUT_BASE_ADDR', width: 32, registerName: 'SPE_Input_Addr_Register', registerAddr: '00B0' },
  // 0x00B4 — 54
  { name: 'SPE_OUTPUT_BASE_ADDR', width: 32, registerName: 'SPE_Output_Addr_Register', registerAddr: '00B4' },
  // 0x00B8 — 55
  { name: 'SPE_RINGBUF_DEPTH', width: 12, registerName: 'SPE_Ringbuf_Register', registerAddr: '00B8' },
  { name: 'SPE_RINGBUF_THRESH', width: 12, registerName: 'SPE_Ringbuf_Register', registerAddr: '00B8' },
  // 0x00BC — 57
  { name: 'SPE_ACT_FUNC_SEL', width: 3, registerName: 'SPE_Activation_Register', registerAddr: '00BC' },
  { name: 'SPE_ACT_THRESHOLD', width: 16, registerName: 'SPE_Activation_Register', registerAddr: '00BC' },
  // 0x00C0 — 59
  { name: 'SPE_PIPELINE_DEPTH', width: 5, registerName: 'SPE_Pipeline_Register', registerAddr: '00C0' },
  { name: 'SPE_PIPELINE_STAGE', width: 4, registerName: 'SPE_Pipeline_Register', registerAddr: '00C0' },
  // 0x00C4 — 61
  { name: 'SPE_CACHE_SIZE', width: 8, registerName: 'SPE_Cache_Register', registerAddr: '00C4' },
  { name: 'SPE_CACHE_POLICY', width: 2, registerName: 'SPE_Cache_Register', registerAddr: '00C4' },
  // 0x00C8 — 63
  { name: 'SPE_QUANT_MODE', width: 2, registerName: 'SPE_Quant_Register', registerAddr: '00C8' },
  { name: 'SPE_QUANT_BIT', width: 5, registerName: 'SPE_Quant_Register', registerAddr: '00C8' },
  // 0x00CC — 65
  { name: 'SPE_SPARSE_MODE', width: 2, registerName: 'SPE_Sparse_Register', registerAddr: '00CC' },
  { name: 'SPE_SPARSE_RATIO', width: 8, registerName: 'SPE_Sparse_Register', registerAddr: '00CC' },
  // 0x00D0 — 67
  { name: 'SPE_BIAS_EN', width: 1, registerName: 'SPE_Bias_Register', registerAddr: '00D0' },
  { name: 'SPE_BIAS_VAL', width: 16, registerName: 'SPE_Bias_Register', registerAddr: '00D0' },
  // 0x00D4 — 69
  { name: 'SPE_DILATION_X', width: 4, registerName: 'SPE_Dilation_Register', registerAddr: '00D4' },
  { name: 'SPE_DILATION_Y', width: 4, registerName: 'SPE_Dilation_Register', registerAddr: '00D4' },
  // 0x00D8 — 71
  { name: 'SPE_GROUP_NUM', width: 8, registerName: 'SPE_Group_Register', registerAddr: '00D8' },
  // 0x00DC — 72
  { name: 'SPE_BATCH_SIZE', width: 8, registerName: 'SPE_Batch_Register', registerAddr: '00DC' },
  // 0x00E0 — 73
  { name: 'SPE_ROUND_MODE', width: 2, registerName: 'SPE_Round_Register', registerAddr: '00E0' },
  // 0x00E4 — 74
  { name: 'SPE_CHECKSUM_EN', width: 1, registerName: 'SPE_Checksum_Register', registerAddr: '00E4' }
]

/**
 * 預設啟發式：ERR / CHKSUM 視為 others，其餘全部視為 mode。
 * 兼容性：保留舊的「只傳 width」呼叫方式（已棄用，視為 mode）。
 */
export function defaultBitFieldType(bf: BitFieldDef | number): BitFieldType {
  if (typeof bf === 'number') {
    return 'magnitude'
  }
  const tokens = bf.name.toUpperCase().split('_')
  if (tokens.some(t => t === 'ERR' || t === 'CHKSUM')) {
    return 'others'
  }
  if (tokens.some(t => t === 'EN' || t === 'ENABLE' || t === 'MODE')) {
    return 'mode'
  }
  return 'magnitude'
}

/**
 * 種子隨機（讓 mock 結果穩定，但不同 batchId 給不同分布）
 */
function makeSeededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/**
 * 為了讓 mode 類 bit field 看起來有「常見組合」分布，
 * 我們讓 mode 類有 80% 機率產出 [0..3] 之間的少量代表值；magnitude 類給範圍內的均勻分布。
 */
function generateRow(rand: () => number, bitFields: BitFieldDef[]): number[] {
  return bitFields.map((bf) => {
    const max = (1 << Math.min(bf.width, 31)) - 1
    const type = defaultBitFieldType(bf)
    if (type === 'mode') {
      const cap = Math.min(max + 1, 4)
      const r = rand()
      if (r < 0.6) return 0
      if (r < 0.8) return 1
      if (r < 0.92) return Math.min(2, cap - 1)
      return Math.floor(rand() * cap)
    }
    // magnitude：給一個合理範圍
    if (bf.width >= 24) {
      return Math.floor(rand() * 0x10000)
    }
    if (bf.width >= 16) {
      // 集中在幾個常見數值，但仍有變化
      const buckets = [16, 32, 64, 128, 256, 512, 1024, 2048]
      const baseIdx = Math.floor(rand() * buckets.length)
      const base = buckets[baseIdx]
      const jitter = Math.floor(rand() * 8)
      return Math.min(max, base + jitter)
    }
    return Math.floor(rand() * (max + 1))
  })
}

const mockWarningsPool = [
  'Unknown address: 0x00FC (in speg17.dat, line 63)',
  'Unknown address: 0x0100 (in speg17.dat, line 64)',
  'Unknown address: 0x01A4 (in speg89.dat, line 105)',
  'Unknown address: 0x01F0 (in speg441.dat, line 89)',
  'Unknown address: 0x0200 (in speg441.dat, line 90)',
  'Unknown address: 0x0204 (in speg1207.dat, line 121)'
]

export function generateMockBatchDetail(batchId: number): BatchDetail {
  const summary = mockBatches.find((b) => b.id === batchId) || mockBatches[0]
  const rand = makeSeededRandom(batchId * 9301 + 49297)
  const rows: Array<{ testCase: string; values: number[] }> = []
  for (let i = 0; i < summary.datCount; i++) {
    rows.push({
      testCase: `speg${i + 1}.dat`,
      values: generateRow(rand, mockBitFields)
    })
  }
  return {
    summary,
    bitFields: mockBitFields,
    rows,
    warnings: mockWarningsPool.slice(0, summary.warningCount)
  }
}

export const versionInfo = {
  version: 'v0.31.0',
  releaseDate: '2026-05-20',
  author: 'Aaron Hsueh',
  system: 'FPGA Register Analyzer'
}

/** 共用色階（淡藍 → 深藍，避免破壞白底） */
export const heatmapColorScale = ['#ffffff', '#dbeafe', '#93c5fd', '#3b82f6', '#1f3a8a']
