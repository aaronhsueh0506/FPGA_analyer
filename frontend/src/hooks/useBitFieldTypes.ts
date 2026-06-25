import { useEffect, useState } from 'react'
import type { BitFieldDef, BitFieldType } from '../mock/data'
import { defaultBitFieldType } from '../mock/data'

const STORAGE_PREFIX = 'fpga-bit-field-types-'
const RANGE_STORAGE_PREFIX = 'fpga-bit-field-ranges-'

export type TypeMap = Record<string, BitFieldType>

// 數值 (magnitude) 欄位的「解讀格式」：unsigned 整數 / signed 二補數 / IEEE-754 float (僅 32-bit)。
// 後端永遠存 unsigned 原始值，此設定是前端「怎麼解讀」。
export type ValueFormat = 'uint' | 'sint' | 'fp32'

export interface FieldRange {
  min?: number
  max?: number
  segments?: string
  parsedSegments?: [number, number][]
  format?: ValueFormat
}
export type RangeMap = Record<string, FieldRange>

/** 把後端的 unsigned 原始值，依欄位格式解讀成實際數值（signed 可為負、fp32 為浮點）。 */
export function interpretValue(raw: number, width: number, format?: ValueFormat): number {
  if (format === 'sint') {
    const w = Math.min(width, 32)
    const signBit = 2 ** (w - 1)
    return raw >= signBit ? raw - 2 ** w : raw
  }
  if (format === 'fp32') {
    const buf = new ArrayBuffer(4)
    new Uint32Array(buf)[0] = raw >>> 0
    return new Float32Array(buf)[0]
  }
  return raw
}

/** 依格式回傳「理論上下限」（unsigned 0~2^w-1；signed -2^(w-1)~2^(w-1)-1）。fp32 無整數界線，沿用 unsigned。 */
export function formatBounds(width: number, format?: ValueFormat): { min: number; max: number } {
  if (format === 'sint') {
    const w = Math.min(width, 32)
    return { min: -(2 ** (w - 1)), max: 2 ** (w - 1) - 1 }
  }
  const max = width >= 32 ? 0xffffffff : (2 ** width) - 1 // 用 2**w 避免 width=31 時 1<<31 溢位成負數
  return { min: 0, max }
}

export function parseSegments(
  input: string,
  maxVal: number
): { parsed: [number, number][]; error?: string } {
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return { parsed: [] }
  const result: [number, number][] = []
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)-(\d+)$/)
    const singleMatch = part.match(/^(\d+)$/)
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10)
      const hi = parseInt(rangeMatch[2], 10)
      if (lo > hi) return { parsed: [], error: `order:${part}` }
      if (hi > maxVal) return { parsed: [], error: `bounds:${hi}:${maxVal}` }
      result.push([lo, hi])
    } else if (singleMatch) {
      const v = parseInt(singleMatch[1], 10)
      if (v > maxVal) return { parsed: [], error: `bounds:${v}:${maxVal}` }
      result.push([v, v])
    } else {
      return { parsed: [], error: `format:${part}` }
    }
  }
  const sorted = [...result].sort((a, b) => a[0] - b[0])
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] <= sorted[i - 1][1]) return { parsed: [], error: 'overlap' }
  }
  return { parsed: sorted }
}

export function isValueInRange(value: number, range: FieldRange | undefined): boolean {
  if (!range) return true
  if (range.parsedSegments && range.parsedSegments.length > 0) {
    return range.parsedSegments.some(([lo, hi]) => value >= lo && value <= hi)
  }
  if (range.min !== undefined && value < range.min) return false
  if (range.max !== undefined && value > range.max) return false
  return true
}

export function validValueCount(range: FieldRange | undefined, width: number): number {
  // 依格式取理論上下限，未自訂的那一端用該格式預設（signed 下限為負，避免用 0 當下限算錯涵蓋率）
  const bounds = formatBounds(width, range?.format)
  if (range?.parsedSegments && range.parsedSegments.length > 0) {
    return range.parsedSegments.reduce((sum, [lo, hi]) => sum + hi - lo + 1, 0)
  }
  const lo = range?.min ?? bounds.min
  const hi = range?.max ?? bounds.max
  return Math.max(0, hi - lo + 1)
}

function loadFromStorage(registerId: number | string): TypeMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + registerId)
    return raw ? (JSON.parse(raw) as TypeMap) : null
  } catch {
    return null
  }
}

function loadRangesFromStorage(registerId: number | string): RangeMap {
  try {
    const raw = localStorage.getItem(RANGE_STORAGE_PREFIX + registerId)
    return raw ? (JSON.parse(raw) as RangeMap) : {}
  } catch {
    return {}
  }
}

function buildDefaults(bitFields: BitFieldDef[]): TypeMap {
  const map: TypeMap = {}
  for (const bf of bitFields) {
    map[bf.name] = defaultBitFieldType(bf)
  }
  return map
}

/**
 * 讀取 / 寫入「bit field 類型」與「有效範圍」設定到 localStorage。
 * 每個 register definition 一份設定。
 */
export function useBitFieldTypes(registerId: number | string, bitFields: BitFieldDef[]) {
  const [types, setTypes] = useState<TypeMap>(() => {
    const stored = loadFromStorage(registerId)
    return stored ?? buildDefaults(bitFields)
  })

  const [rangeMap, setRangeMapState] = useState<RangeMap>(() =>
    loadRangesFromStorage(registerId)
  )

  useEffect(() => {
    const stored = loadFromStorage(registerId)
    setTypes(stored ?? buildDefaults(bitFields))
    setRangeMapState(loadRangesFromStorage(registerId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerId])

  const update = (name: string, type: BitFieldType) => {
    setTypes((prev) => {
      const next = { ...prev, [name]: type }
      localStorage.setItem(STORAGE_PREFIX + registerId, JSON.stringify(next))
      return next
    })
  }

  const bulkSet = (map: TypeMap) => {
    setTypes(map)
    localStorage.setItem(STORAGE_PREFIX + registerId, JSON.stringify(map))
  }

  const reset = () => {
    const defaults = buildDefaults(bitFields)
    setTypes(defaults)
    localStorage.removeItem(STORAGE_PREFIX + registerId)
  }

  const setRangeMap = (map: RangeMap) => {
    setRangeMapState(map)
    localStorage.setItem(RANGE_STORAGE_PREFIX + registerId, JSON.stringify(map))
  }

  const isOutOfRange = (fieldName: string, value: number): boolean => {
    return !isValueInRange(value, rangeMap[fieldName])
  }

  const isMode = (name: string) => types[name] === 'mode'
  const modeFieldNames = () => bitFields.filter((bf) => types[bf.name] === 'mode').map((bf) => bf.name)

  return { types, update, bulkSet, reset, rangeMap, setRangeMap, isOutOfRange, isMode, modeFieldNames }
}
