import { useEffect, useState } from 'react'
import type { BitFieldDef, BitFieldType } from '../mock/data'
import { defaultBitFieldType } from '../mock/data'

const STORAGE_PREFIX = 'fpga-bit-field-types-'
const RANGE_STORAGE_PREFIX = 'fpga-bit-field-ranges-'

export type TypeMap = Record<string, BitFieldType>
export interface FieldRange { min?: number; max?: number }
export type RangeMap = Record<string, FieldRange>

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
    const r = rangeMap[fieldName]
    if (!r) return false
    if (r.min !== undefined && value < r.min) return true
    if (r.max !== undefined && value > r.max) return true
    return false
  }

  const isMode = (name: string) => types[name] === 'mode'
  const modeFieldNames = () => bitFields.filter((bf) => types[bf.name] === 'mode').map((bf) => bf.name)

  return { types, update, bulkSet, reset, rangeMap, setRangeMap, isOutOfRange, isMode, modeFieldNames }
}
