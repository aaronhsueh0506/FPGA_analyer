import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { BatchSummary, BitFieldDef } from '../../mock/data'
import type { TypeMap, RangeMap } from '../../hooks/useBitFieldTypes'

interface Props {
  summary: BatchSummary
  rows: Array<{ testCase: string; values: number[] }>
  bitFields: BitFieldDef[]
  types: TypeMap
  rangeMap: RangeMap
}

const MIN_FIELDS = 2
const TOP_N = 10

function computeTheoreticalMax(width: number): number {
  if (width >= 32) return 0xffffffff
  if (width <= 0) return 0
  return (1 << width) - 1
}

export default function OverallPanel({ summary, rows, bitFields, types, rangeMap }: Props) {
  const { t } = useTranslation()

  const typeCounts = useMemo(() => {
    let mode = 0
    let magnitude = 0
    let others = 0
    for (const bf of bitFields) {
      const tp = types[bf.name]
      if (tp === 'mode') mode++
      else if (tp === 'magnitude') magnitude++
      else if (tp === 'others') others++
      else magnitude++
    }
    return { mode, magnitude, others }
  }, [bitFields, types])

  const magnitudeRows = useMemo(() => {
    const out: Array<{
      name: string
      width: number
      bitMin: number
      bitMax: number
      effectiveMin: number
      effectiveMax: number
      hasCustomRange: boolean
      actualMin: number
      actualMax: number
      uniqueCount: number
      coveragePct: string
    }> = []
    for (let i = 0; i < bitFields.length; i++) {
      const bf = bitFields[i]
      if (types[bf.name] !== 'magnitude') continue
      const bitMax = computeTheoreticalMax(bf.width)
      const bitMin = 0
      const userMax = rangeMap[bf.name]?.max
      const userMin = rangeMap[bf.name]?.min
      const effectiveMax = userMax !== undefined ? userMax : bitMax
      const effectiveMin = userMin !== undefined ? userMin : bitMin
      const hasCustomRange = userMin !== undefined || userMax !== undefined
      if (rows.length === 0) {
        out.push({
          name: bf.name,
          width: bf.width,
          bitMin,
          bitMax,
          effectiveMin,
          effectiveMax,
          hasCustomRange,
          actualMin: 0,
          actualMax: 0,
          uniqueCount: 0,
          coveragePct: '0.00'
        })
        continue
      }
      let mn = Infinity
      let mx = -Infinity
      const uniqInRange = new Set<number>()
      for (const r of rows) {
        const v = r.values[i]
        if (typeof v !== 'number') continue
        if (v < mn) mn = v
        if (v > mx) mx = v
        if (v >= effectiveMin && v <= effectiveMax) uniqInRange.add(v)
      }
      const actualMin = mn === Infinity ? 0 : mn
      const actualMax = mx === -Infinity ? 0 : mx
      const refSpan = effectiveMax - effectiveMin + 1
      const pctNum = refSpan > 0 ? (uniqInRange.size / refSpan) * 100 : 0
      out.push({
        name: bf.name,
        width: bf.width,
        bitMin,
        bitMax,
        effectiveMin,
        effectiveMax,
        hasCustomRange,
        actualMin,
        actualMax,
        uniqueCount: uniqInRange.size,
        coveragePct: pctNum.toFixed(2)
      })
    }
    return out
  }, [bitFields, types, rows, rangeMap])

  const comboKey = `fpga-combo-picked-v2-${summary.registerName}`

  const initialPicked = useMemo<number[]>(() => {
    const saved = localStorage.getItem(comboKey)
    if (saved) {
      try {
        const names: string[] = JSON.parse(saved)
        const nameSet = new Set(names)
        const indices = bitFields.map((_, i) => i).filter(i => nameSet.has(bitFields[i].name))
        if (indices.length >= MIN_FIELDS) return indices
      } catch { /* ignore */ }
    }
    const modeIdx: number[] = []
    for (let i = 0; i < bitFields.length; i++) {
      if (types[bitFields[i].name] === 'mode') modeIdx.push(i)
      if (modeIdx.length >= 3) break
    }
    if (modeIdx.length >= 2) return modeIdx
    const fallback: number[] = []
    for (let i = 0; i < Math.min(3, bitFields.length); i++) fallback.push(i)
    return fallback
  }, [bitFields, types]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pickedFields, setPickedFields] = useState<number[]>(initialPicked)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [allComboOpen, setAllComboOpen] = useState(false)

  useEffect(() => {
    const names = pickedFields.map(i => bitFields[i]?.name).filter(Boolean)
    localStorage.setItem(comboKey, JSON.stringify(names))
  }, [pickedFields, comboKey, bitFields])

  // Sync picked fields when user changes bit field types (skip initial load)
  const typesReady = useRef(false)
  useEffect(() => {
    if (Object.keys(types).length === 0) return
    if (!typesReady.current) { typesReady.current = true; return }
    const modeIdx: number[] = []
    for (let i = 0; i < bitFields.length; i++) {
      if (types[bitFields[i].name] === 'mode') modeIdx.push(i)
    }
    setPickedFields(modeIdx.length >= MIN_FIELDS ? modeIdx : bitFields.map((_, i) => i).slice(0, MIN_FIELDS))
  }, [types]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePick = (idx: number) => {
    setPickedFields((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
    )
  }

  const comboResult = useMemo(() => {
    if (pickedFields.length < MIN_FIELDS) return null
    const counts = new Map<string, number>()
    for (const r of rows) {
      const key = pickedFields.map((i) => r.values[i]).join('|')
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const allItems = Array.from(counts.entries())
      .map(([k, n]) => ({ key: k, count: n }))
      .sort((a, b) => b.count - a.count)
    const total = rows.length || 1
    const topItems = allItems.slice(0, TOP_N)
    const othersCount = allItems.slice(TOP_N).reduce((s, x) => s + x.count, 0)
    return { topItems, allItems, total, othersCount }
  }, [rows, pickedFields])

  return (
    <div>
      {/* Section 1 — Basic summary */}
      <div className="card">
        <h3 className="card-title">{t('results.overall.summary')}</h3>
        <div className="summary-row">
          <span className="summary-chip">
            {t('results.summaryBatch')}: <span className="mono">{summary.name}</span>
          </span>
          <span className="summary-chip">
            {t('results.summaryRegister')}: <span className="mono">{summary.registerName}</span>
          </span>
          <span className="summary-chip">
            {t('results.summaryDatCount')}: <span className="mono">{summary.datCount}</span>
          </span>
          <span className="summary-chip">
            {t('results.summaryWarnings')}: <span className="mono">{summary.warningCount}</span>
          </span>
          <span className="summary-chip">
            {t('results.overall.analyzedAt')}: <span className="mono">{summary.analyzedAt}</span>
          </span>
        </div>
      </div>

      {/* Section 2 — Type distribution */}
      <div className="card">
        <h3 className="card-title">{t('results.overall.typeDistribution')}</h3>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">{t('results.bitFieldType.mode')}</div>
            <div className="stat-value mono">{typeCounts.mode}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('results.bitFieldType.magnitude')}</div>
            <div className="stat-value mono">{typeCounts.magnitude}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('results.bitFieldType.others')}</div>
            <div className="stat-value mono">{typeCounts.others}</div>
          </div>
        </div>
      </div>

      {/* Section 3 — Magnitude range coverage */}
      <div className="card">
        <h3 className="card-title">{t('results.overall.rangeCoverage')}</h3>
        {magnitudeRows.length === 0 ? (
          <div className="empty-state">{t('results.overall.noMagnitude')}</div>
        ) : (
          <div className="table-scroll" style={{ maxHeight: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bit Field</th>
                  <th>{t('results.bitFieldType.colWidth')}</th>
                  <th>{t('results.overall.colRangeInUse')}</th>
                  <th>{t('results.overall.colActualMin')}</th>
                  <th>{t('results.overall.colActualMax')}</th>
                  <th>{t('results.overall.colUniqueCount')}</th>
                  <th>{t('results.overall.colCoveragePct')}</th>
                </tr>
              </thead>
              <tbody>
                {magnitudeRows.map((row) => (
                  <tr key={row.name}>
                    <td className="mono text-left">{row.name}</td>
                    <td className="mono">{row.width}</td>
                    <td className="mono">
                      {row.hasCustomRange ? (
                        <>
                          {row.effectiveMin}~{row.effectiveMax}
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                            {' '}({row.bitMin}~{row.bitMax})
                          </span>
                        </>
                      ) : (
                        `${row.bitMin}~${row.bitMax}`
                      )}
                    </td>
                    <td className="mono">{row.actualMin}</td>
                    <td className="mono">{row.actualMax}</td>
                    <td className="mono">{row.uniqueCount}</td>
                    <td className="mono">{row.coveragePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4 — Combination analysis (Top-10) */}
      <div className="card">
        <h3 className="card-title">{t('results.overall.combinationTitle')}</h3>
        <p className="card-subtitle">{t('results.overall.pickFields')}</p>
        <button
          className="btn btn-sm"
          style={{ marginBottom: 8 }}
          onClick={() => setPickerOpen(p => !p)}
        >
          {pickerOpen ? t('results.overall.hidePicker') : t('results.overall.showPicker')}
          {` (${pickedFields.length} ${t('results.overall.selected')})`}
        </button>

        {pickerOpen && (
        <div className="column-grid" style={{ marginBottom: 12 }}>
          {bitFields.map((bf, i) => (
            <label key={i} style={{ opacity: types[bf.name] !== 'mode' ? 0.45 : 1 }}>
              <input
                type="checkbox"
                checked={pickedFields.includes(i)}
                onChange={() => togglePick(i)}
              />
              <span className="mono" style={{ fontSize: 13 }}>
                {bf.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                [{bf.width}b{types[bf.name] === 'mode' ? '' : ' · ' + (types[bf.name] || 'mag')}]
              </span>
            </label>
          ))}
        </div>
        )}

        {pickedFields.length < MIN_FIELDS ? (
          <div className="warning-banner">{t('results.stats.tooFewFields')}</div>
        ) : comboResult ? (
          <>
            <div className="table-scroll" style={{ maxHeight: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {pickedFields.map((idx) => (
                      <th key={idx} className="mono">
                        {bitFields[idx].name}
                      </th>
                    ))}
                    <th>{t('results.stats.count')}</th>
                    <th>{t('results.stats.percent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {comboResult.topItems.map((item, ri) => {
                    const parts = item.key.split('|')
                    const pct = (item.count / comboResult.total) * 100
                    return (
                      <tr key={ri}>
                        <td className="mono">{ri + 1}</td>
                        {parts.map((p, pi) => (
                          <td key={pi} className="mono">{p}</td>
                        ))}
                        <td className="mono">{item.count}</td>
                        <td className="mono">{pct.toFixed(2)}%</td>
                      </tr>
                    )
                  })}
                  {comboResult.othersCount > 0 && (
                    <tr style={{ color: 'var(--text-tertiary)' }}>
                      <td className="mono">—</td>
                      {pickedFields.map((_, pi) => (
                        <td key={pi} className="mono" style={{ fontStyle: 'italic' }}>
                          {t('results.overall.othersCombo')}
                        </td>
                      ))}
                      <td className="mono">{comboResult.othersCount}</td>
                      <td className="mono">
                        {((comboResult.othersCount / comboResult.total) * 100).toFixed(2)}%
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {comboResult.allItems.length > TOP_N && (
              <button
                className="btn btn-sm"
                style={{ marginTop: 8 }}
                onClick={() => setAllComboOpen(true)}
              >
                {t('results.overall.showAllCombos', { count: comboResult.allItems.length })}
              </button>
            )}
          </>
        ) : null}
      </div>

      {allComboOpen && comboResult && createPortal(
        <div
          className="modal-backdrop"
          onClick={() => setAllComboOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setAllComboOpen(false)}
        >
          <div
            className="modal modal-wide"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {t('results.overall.allCombosTitle', { count: comboResult.allItems.length })}
              </h2>
              <button className="modal-close" onClick={() => setAllComboOpen(false)}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {pickedFields.map((idx) => (
                      <th key={idx} className="mono">{bitFields[idx].name}</th>
                    ))}
                    <th>{t('results.stats.count')}</th>
                    <th>{t('results.stats.percent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {comboResult.allItems.map((item, ri) => {
                    const parts = item.key.split('|')
                    const pct = (item.count / comboResult.total) * 100
                    return (
                      <tr key={ri}>
                        <td className="mono">{ri + 1}</td>
                        {parts.map((p, pi) => (
                          <td key={pi} className="mono">{p}</td>
                        ))}
                        <td className="mono">{item.count}</td>
                        <td className="mono">{pct.toFixed(2)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
