import { useEffect, useState } from 'react'
import type { BitFieldDef, BitFieldType } from '../mock/data'
import { defaultBitFieldType } from '../mock/data'

const STORAGE_PREFIX = 'fpga-bit-field-types-'

export type TypeMap = Record<string, BitFieldType>

function loadFromStorage(registerId: number | string): TypeMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + registerId)
    return raw ? (JSON.parse(raw) as TypeMap) : null
  } catch {
    return null
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
 * 讀取 / 寫入「bit field 類型」設定到 localStorage。
 * 每個 register definition 一份設定。
 */
export function useBitFieldTypes(registerId: number | string, bitFields: BitFieldDef[]) {
  const [types, setTypes] = useState<TypeMap>(() => {
    const stored = loadFromStorage(registerId)
    return stored ?? buildDefaults(bitFields)
  })

  useEffect(() => {
    const stored = loadFromStorage(registerId)
    setTypes(stored ?? buildDefaults(bitFields))
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

  const isMode = (name: string) => types[name] === 'mode'
  const modeFieldNames = () => bitFields.filter((bf) => types[bf.name] === 'mode').map((bf) => bf.name)

  return { types, update, bulkSet, reset, isMode, modeFieldNames }
}
