import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BitFieldDef } from '../../mock/data'
import type { TypeMap, RangeMap } from '../../hooks/useBitFieldTypes'
import { isValueInRange } from '../../hooks/useBitFieldTypes'
import Histogram from '../charts/Histogram'
import ValueCurve from '../charts/ValueCurve'

type InterpretMode = 'int' | 'fp32'

interface Props {
  rows: Array<{ testCase: string; values: number[] }>
  bitFields: BitFieldDef[]
  types: TypeMap
  rangeMap: RangeMap
}

function computeStats(rawValues: (number | undefined | null)[]) {
  const values = rawValues.filter((v): v is number => typeof v === 'number' && isFinite(v))
  if (values.length === 0) return { min: 0, max: 0, mean: 0, median: 0, stddev: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const min = sorted[0]
  const max = sorted[n - 1]
  const mean = values.reduce((s, v) => s + v, 0) / n
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2]
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const stddev = Math.sqrt(variance)
  return { min, max, mean, median, stddev }
}

function safeMaxValue(width: number): number {
  if (width >= 32) return 0xffffffff
  if (width <= 0) return 0
  return (1 << width) - 1
}

function fmt(n: number | undefined | null): string {
  if (n == null || !isFinite(n as number)) return '—'
  if (Number.isInteger(n)) return String(n)
  return (n as number).toFixed(2)
}

export default function StatsPanel({ rows, bitFields, types, rangeMap }: Props) {
  const { t } = useTranslation()
  const [interpretMap, setInterpretMap] = useState<Record<string, InterpretMode>>({})
  const [detailOpen, setDetailOpen] = useState<Record<string, boolean>>({})

  const setInterpret = (name: string, mode: InterpretMode) => {
    setInterpretMap((prev) => ({ ...prev, [name]: mode }))
  }

  const toggleDetail = (name: string) => {
    setDetailOpen((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const modeIndices = useMemo(
    () => bitFields.map((bf, i) => ({ bf, i })).filter(({ bf }) => types[bf.name] === 'mode'),
    [bitFields, types]
  )

  const magnitudeIndices = useMemo(
    () => bitFields.map((bf, i) => ({ bf, i })).filter(({ bf }) => types[bf.name] === 'magnitude'),
    [bitFields, types]
  )

  return (
    <div>
      <div className="card">
        <h3 className="card-title">{t('results.stats.histogramTitle')}</h3>
        <p className="card-subtitle">{t('results.stats.histogramHint')}</p>
        {modeIndices.length === 0 ? (
          <div className="empty-state">{t('results.stats.noMode')}</div>
        ) : (
          <div className="histogram-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {modeIndices.map(({ bf, i }) => {
              const allValues = rows.map((r) => r.values[i])
              const r = rangeMap[bf.name]
              const bitMax = safeMaxValue(bf.width)
              const hasRange = r && (r.min !== undefined || r.max !== undefined || (r.parsedSegments && r.parsedSegments.length > 0))
              const values = hasRange
                ? allValues.filter((v): v is number => typeof v === 'number' && isValueInRange(v, r))
                : allValues
              let effectiveMin = r?.min !== undefined ? r.min : 0
              let effectiveMax = r?.max !== undefined ? r.max : bitMax
              if (r?.parsedSegments && r.parsedSegments.length > 0) {
                effectiveMin = r.parsedSegments[0][0]
                effectiveMax = r.parsedSegments[r.parsedSegments.length - 1][1]
              }
              return (
                <div key={bf.name} className="histogram-card">
                  <div className="histogram-card-title mono">
                    {bf.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>[{bf.width}b]</span>
                  </div>
                  <Histogram title="" values={values} maxValue={effectiveMax} minValue={effectiveMin} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">{t('results.stats.magnitudeTitle')}</h3>
        <p className="card-subtitle">{t('results.stats.magnitudeHint')}</p>
        {magnitudeIndices.length === 0 ? (
          <div className="empty-state">{t('results.stats.noMagnitude')}</div>
        ) : (
          <div className="histogram-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {magnitudeIndices.map(({ bf, i }) => {
              const allValues = rows.map((r) => r.values[i])
              const r = rangeMap[bf.name]
              const bitMax = safeMaxValue(bf.width)
              const effectiveMin = r?.min !== undefined ? r.min : 0
              const effectiveMax = r?.max !== undefined ? r.max : bitMax
              const hasRange = r && (r.min !== undefined || r.max !== undefined)
              const values = hasRange
                ? allValues.filter((v): v is number => typeof v === 'number' && isValueInRange(v, r))
                : allValues
              const stats = computeStats(values)
              const is32 = bf.width === 32 && !hasRange
              const interpret: InterpretMode = (is32 ? interpretMap[bf.name] : undefined) || 'int'
              const isDetailOpen = !!detailOpen[bf.name]
              return (
                <div key={bf.name} className="histogram-card">
                  <div
                    className="histogram-card-title mono"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                  >
                    <span>
                      {bf.name}{' '}
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>[{bf.width}b]</span>
                    </span>
                    <span
                      className="inline-toggle"
                      style={{ fontSize: 11 }}
                      title={!is32 ? t('results.stats.fp32OnlyFor32bit') : undefined}
                    >
                      <button
                        className={interpret === 'int' ? 'active' : ''}
                        onClick={() => setInterpret(bf.name, 'int')}
                        style={{ padding: '3px 8px', fontSize: 11 }}
                      >
                        {t('results.stats.interpretInt')}
                      </button>
                      <button
                        className={interpret === 'fp32' ? 'active' : ''}
                        onClick={() => is32 && setInterpret(bf.name, 'fp32')}
                        disabled={!is32}
                        style={{ padding: '3px 8px', fontSize: 11, opacity: is32 ? 1 : 0.45, cursor: is32 ? 'pointer' : 'not-allowed' }}
                      >
                        {t('results.stats.interpretFP32')}
                      </button>
                    </span>
                  </div>
                  <Histogram title="" values={values} maxValue={effectiveMax} minValue={effectiveMin} interpretAs={interpret} />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 4,
                      padding: '6px 8px',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      borderTop: '1px solid var(--border)'
                    }}
                  >
                    <div><span style={{ color: 'var(--text-tertiary)' }}>{t('results.stats.min')}:</span> <span className="mono">{fmt(stats.min)}</span></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>{t('results.stats.max')}:</span> <span className="mono">{fmt(stats.max)}</span></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>{t('results.stats.mean')}:</span> <span className="mono">{fmt(stats.mean)}</span></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>{t('results.stats.median')}:</span> <span className="mono">{fmt(stats.median)}</span></div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>{t('results.stats.stddev')}:</span> <span className="mono">{fmt(stats.stddev)}</span></div>
                  </div>
                  <div style={{ padding: '4px 8px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 11 }}
                      onClick={() => toggleDetail(bf.name)}
                    >
                      {isDetailOpen ? t('results.stats.collapseCurve') : t('results.stats.detailCurve')}
                    </button>
                  </div>
                  {isDetailOpen && (
                    <ValueCurve values={values} interpretAs={interpret} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
