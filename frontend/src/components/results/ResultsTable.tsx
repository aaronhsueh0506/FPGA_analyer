import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BitFieldDef, BitFieldType } from '../../mock/data'
import type { RangeMap } from '../../hooks/useBitFieldTypes'

type Format = 'hex' | 'dec'

interface Props {
  rows: Array<{ testCase: string; values: number[] }>
  bitFields: BitFieldDef[]
  visibleIndices: number[]
  format: Format
  setFormat: (f: Format) => void
  prefix: string
  setPrefix: (p: string) => void
  onOpenColumnSelector: () => void
  types?: Record<string, BitFieldType>
  rangeMap?: RangeMap
}

const ROWS_PER_PAGE_OPTIONS = [10, 50, 100, 500]

function extractCaseNumber(testCase: string, prefix: string): string {
  const parts = testCase.split('/')
  const filename = parts[parts.length - 1]
  if (!prefix) return filename
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${esc}(\\d+)`, 'i')
  // Strategy A: any path component matches prefix+number (e.g. "speg1")
  for (const part of parts) {
    const m = part.match(re)
    if (m) return `#${m[1]}`
  }
  // Strategy B: component equals prefix exactly, next component is a pure number (e.g. "speg/1/")
  const reExact = new RegExp(`^${esc}$`, 'i')
  for (let i = 0; i < parts.length - 1; i++) {
    if (reExact.test(parts[i]) && /^\d+$/.test(parts[i + 1])) {
      return `#${parts[i + 1]}`
    }
  }
  return filename
}

function isOutOfRange(value: number, fieldName: string, types?: Record<string, BitFieldType>, rangeMap?: RangeMap): boolean {
  if (!types || !rangeMap) return false
  if (types[fieldName] !== 'magnitude') return false
  const r = rangeMap[fieldName]
  if (!r) return false
  if (r.min !== undefined && value < r.min) return true
  if (r.max !== undefined && value > r.max) return true
  return false
}

export default function ResultsTable({
  rows, bitFields, visibleIndices, format, setFormat,
  prefix, setPrefix, onOpenColumnSelector, types, rangeMap
}: Props) {
  const { t } = useTranslation()
  const [rowsPerPage, setRowsPerPage] = useState(100)
  const [page, setPage] = useState(1)
  const [gotoInput, setGotoInput] = useState('')

  type FilterCondition = { fieldIdx: number; rawValue: string }
  const [filterEnabled, setFilterEnabled] = useState(false)
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([{ fieldIdx: 0, rawValue: '' }])

  const addCondition = () => setFilterConditions(prev => [...prev, { fieldIdx: 0, rawValue: '' }])
  const removeCondition = (i: number) => setFilterConditions(prev => prev.filter((_, idx) => idx !== i))
  const updateCondition = (i: number, patch: Partial<FilterCondition>) =>
    setFilterConditions(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))

  const activeConditions = filterConditions.filter(c => c.rawValue !== '' && Number.isFinite(Number(c.rawValue)))

  const filteredRows = useMemo(() => {
    if (!filterEnabled || activeConditions.length === 0) return rows
    return rows.filter(r => activeConditions.every(c => r.values[c.fieldIdx] === Number(c.rawValue)))
  }, [rows, filterEnabled, filterConditions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset page when filter changes
  useMemo(() => { setPage(1) }, [filterEnabled, filterConditions]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const startIdx = (currentPage - 1) * rowsPerPage
  const visibleRows = useMemo(
    () => filteredRows.slice(startIdx, startIdx + rowsPerPage),
    [filteredRows, startIdx, rowsPerPage]
  )

  const formatValue = (v: number) =>
    format === 'hex' ? `0x${v.toString(16).toUpperCase()}` : String(v)

  const onChangeRowsPerPage = (n: number) => {
    setRowsPerPage(n)
    setPage(1)
  }

  const goto = () => {
    const n = Number(gotoInput)
    if (!Number.isFinite(n)) return
    setPage(Math.min(totalPages, Math.max(1, Math.floor(n))))
    setGotoInput('')
  }

  return (
    <div>
      <div className="toolbar">
        <div className="group">
          <label>{t('results.prefix')}</label>
          <input
            type="text"
            className="prefix-input"
            placeholder={t('results.prefixPlaceholder')}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />
        </div>
        <div className="divider" />
        <div className="group">
          <button className="btn btn-sm" onClick={onOpenColumnSelector}>
            {t('results.columnSelector')} ({visibleIndices.length}/{bitFields.length})
          </button>
        </div>
        <div className="divider" />
        <div className="group">
          <label style={{ userSelect: 'none', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterEnabled}
              onChange={e => setFilterEnabled(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            {t('results.valueFilter')}
            {filterEnabled && activeConditions.length > 0 && (
              <span style={{ marginLeft: 4, color: 'var(--color-primary, #1f3a8a)', fontWeight: 600 }}>
                ({activeConditions.length})
              </span>
            )}
          </label>
        </div>
        <div className="divider" />
        <div className="group">
          <label>{t('results.rowsPerPage')}</label>
          <select
            value={rowsPerPage}
            onChange={(e) => onChangeRowsPerPage(Number(e.target.value))}
          >
            {ROWS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="divider" />
        <div className="group">
          <label>{t('results.displayFormat')}</label>
          <div className="toggle-group">
            <button className={format === 'dec' ? 'active' : ''} onClick={() => setFormat('dec')}>
              {t('results.formatDecimal')}
            </button>
            <button className={format === 'hex' ? 'active' : ''} onClick={() => setFormat('hex')}>
              {t('results.formatHex')}
            </button>
          </div>
        </div>
      </div>

      {filterEnabled && (
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filterConditions.map((cond, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={cond.fieldIdx}
                onChange={e => updateCondition(i, { fieldIdx: Number(e.target.value) })}
              >
                {bitFields.map((bf, idx) => (
                  <option key={idx} value={idx}>{bf.name}</option>
                ))}
              </select>
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>=</span>
              <input
                type="number"
                style={{ width: 90 }}
                value={cond.rawValue}
                onChange={e => updateCondition(i, { rawValue: e.target.value })}
                placeholder="0"
              />
              {filterConditions.length > 1 && (
                <button className="btn btn-sm" onClick={() => removeCondition(i)}
                  style={{ padding: '2px 8px', lineHeight: 1 }}>
                  ×
                </button>
              )}
            </div>
          ))}
          <div>
            <button className="btn btn-sm" onClick={addCondition}>
              {t('results.valueFilterAdd')}
            </button>
          </div>
        </div>
      )}

      <div className="table-scroll">
        {visibleIndices.length === 0 ? (
          <div className="empty-state">{t('results.noVisibleColumns')}</div>
        ) : visibleRows.length === 0 ? (
          <div className="empty-state">{t('results.noDataInRange')}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--table-header)', zIndex: 2 }}>
                  {t('results.testCase')}
                </th>
                {visibleIndices.map((idx) => (
                  <th key={idx} className="mono" style={{ whiteSpace: 'nowrap' }}>
                    {bitFields[idx].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, ri) => (
                <tr key={startIdx + ri}>
                  <td
                    className="mono text-left"
                    style={{ position: 'sticky', left: 0, background: 'var(--bg)', fontWeight: 600 }}
                  >
                    {extractCaseNumber(row.testCase, prefix)}
                  </td>
                  {visibleIndices.map((idx) => {
                    const v = row.values[idx]
                    const oor = isOutOfRange(v, bitFields[idx].name, types, rangeMap)
                    return (
                      <td
                        key={idx}
                        className="mono"
                        style={oor ? { background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626' } : undefined}
                        title={oor ? `Out of range [${rangeMap?.[bitFields[idx].name]?.min ?? '—'}, ${rangeMap?.[bitFields[idx].name]?.max ?? '—'}]` : undefined}
                      >
                        {formatValue(v)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button
          className="btn btn-sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
        >
          {t('results.prev')}
        </button>
        <span className="info">{t('results.page', { current: currentPage, total: totalPages })}</span>
        <button
          className="btn btn-sm"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
        >
          {t('results.next')}
        </button>
        <input
          type="range"
          min={1}
          max={totalPages}
          value={currentPage}
          onChange={(e) => setPage(Number(e.target.value))}
        />
        <span className="info">{t('results.gotoPage')}</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={gotoInput}
          onChange={(e) => setGotoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') goto()
          }}
        />
        <button className="btn btn-sm" onClick={goto} disabled={!gotoInput}>
          {t('results.apply')}
        </button>
      </div>
    </div>
  )
}
