import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getBatch, downloadCsvUrl, downloadXlsxUrl, type BatchDetailAPI } from '../api/batches'
import { formatLocalDate } from '../api/dateUtils'
import type { BatchSummary, BitFieldDef } from '../mock/data'
import { defaultBitFieldType } from '../mock/data'
import { useBitFieldTypes } from '../hooks/useBitFieldTypes'
import ResultsTable from '../components/results/ResultsTable'
import DualRegisterChart from '../components/results/DualRegisterChart'
import StatsPanel from '../components/results/StatsPanel'
import OverallPanel from '../components/results/OverallPanel'
import ColumnSelectorModal from '../components/results/ColumnSelectorModal'
import BitFieldTypeModal from '../components/results/BitFieldTypeModal'
import { ErrorBoundary } from '../components/ErrorBoundary'

type Tab = 'table' | 'dual' | 'stats' | 'overall' | 'warnings'

function apiToDetail(api: BatchDetailAPI) {
  const summary: BatchSummary = {
    id: api.summary.id,
    name: api.summary.name ?? '',
    registerName: api.summary.register_name,
    datCount: api.summary.dat_count ?? 0,
    warningCount: api.summary.warning_count,
    analyzedAt: formatLocalDate(api.summary.analyzed_at),
  }
  const bitFields: BitFieldDef[] = api.bitFields.map((bf) => ({
    name: bf.name,
    width: bf.width,
    registerName: bf.register_name,
    registerAddr: bf.register_addr,
  }))
  const rows = api.rows.map((r) => ({
    testCase: r.testCase,
    values: r.values.map((v) => v ?? 0),
  }))
  return { summary, bitFields, rows, warnings: api.warnings }
}

function extractCaseId(testCase: string, prefix: string): number | null {
  const slashIdx = testCase.lastIndexOf('/')
  const filename = slashIdx !== -1 ? testCase.slice(slashIdx + 1) : testCase
  if (!prefix) return null
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`, 'i')
  const m = filename.match(re)
  return m ? parseInt(m[1], 10) : null
}

export default function Results() {
  const { t } = useTranslation()
  const { batchId } = useParams<{ batchId: string }>()
  const [apiData, setApiData] = useState<BatchDetailAPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = Number(batchId)
    if (!id) { setError('Invalid batch ID'); setLoading(false); return }
    getBatch(id)
      .then(setApiData)
      .catch(() => setError('Failed to load batch results'))
      .finally(() => setLoading(false))
  }, [batchId])

  const detail = useMemo(() => apiData ? apiToDetail(apiData) : null, [apiData])

  const sortedRows = useMemo(() => {
    if (!detail) return []
    return [...detail.rows].sort((a, b) =>
      a.testCase.localeCompare(b.testCase, undefined, { numeric: true, sensitivity: 'base' })
    )
  }, [detail])

  const { types, bulkSet, reset, rangeMap, setRangeMap } = useBitFieldTypes(
    detail?.summary.registerName ?? '',
    detail?.bitFields ?? []
  )

  const [tab, setTab] = useState<Tab>('table')
  const [format, setFormat] = useState<'hex' | 'dec'>('dec')
  const [prefix, setPrefix] = useState('speg')

  const maxCaseId = useMemo(() => {
    const ids = sortedRows
      .map(r => extractCaseId(r.testCase, prefix))
      .filter((id): id is number => id !== null)
    return ids.length > 0 ? Math.max(...ids) : sortedRows.length
  }, [sortedRows, prefix])

  const [visibleIndices, setVisibleIndices] = useState<number[]>([])
  const [caseFrom, setCaseFrom] = useState<number>(1)
  const [caseTo, setCaseTo] = useState<number>(0)
  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [typeModalOpen, setTypeModalOpen] = useState(false)

  const visibleColsKey = detail ? `fpga-visible-cols-v2-${detail.summary.registerName}` : null

  // Initialise range and visible columns once data loads
  useEffect(() => {
    if (!detail) return
    const cids = sortedRows.map(r => extractCaseId(r.testCase, prefix)).filter((id): id is number => id !== null)
    setCaseTo(cids.length > 0 ? Math.max(...cids) : sortedRows.length)

    const saved = visibleColsKey ? localStorage.getItem(visibleColsKey) : null
    if (saved) {
      try {
        const names: string[] = JSON.parse(saved)
        const nameSet = new Set(names)
        const indices = detail.bitFields.map((_, i) => i).filter(i => nameSet.has(detail.bitFields[i].name))
        if (indices.length > 0) { setVisibleIndices(indices); return }
      } catch { /* ignore */ }
    }
    setVisibleIndices(
      detail.bitFields.map((_, i) => i).filter(i => defaultBitFieldType(detail.bitFields[i]) === 'mode')
    )
  }, [detail]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist visible columns to localStorage whenever they change
  useEffect(() => {
    if (!visibleColsKey || !detail || visibleIndices.length === 0) return
    const names = visibleIndices.map(i => detail.bitFields[i].name)
    localStorage.setItem(visibleColsKey, JSON.stringify(names))
  }, [visibleIndices, visibleColsKey, detail])

  // Sync visible columns when user changes bit field types (skip initial load)
  const typesReady = useRef(false)
  useEffect(() => {
    if (Object.keys(types).length === 0) return
    if (!typesReady.current) { typesReady.current = true; return }
    if (!detail) return
    setVisibleIndices(
      detail.bitFields.map((_, i) => i).filter(i => types[detail.bitFields[i].name] === 'mode')
    )
  }, [types]) // eslint-disable-line react-hooks/exhaustive-deps

  // Must be before early returns to comply with Rules of Hooks
  const outOfRangeWarnings = useMemo(() => {
    if (!detail) return []
    const violations: Array<{ testCase: string; field: string; value: number; min?: number; max?: number }> = []
    for (const row of sortedRows) {
      for (let i = 0; i < detail.bitFields.length; i++) {
        const bf = detail.bitFields[i]
        if (types[bf.name] !== 'magnitude') continue
        const r = rangeMap[bf.name]
        if (!r) continue
        const v = row.values[i] ?? 0
        if ((r.min !== undefined && v < r.min) || (r.max !== undefined && v > r.max)) {
          violations.push({ testCase: row.testCase, field: bf.name, value: v, min: r.min, max: r.max })
        }
      }
    }
    return violations
  }, [sortedRows, detail, types, rangeMap])

  if (loading) return <div className="page"><div className="empty-state">Loading...</div></div>
  if (error || !detail) return <div className="page"><div className="warning-banner">{error ?? 'Error'}</div></div>

  const effectiveFrom = Math.max(1, caseFrom || 1)
  const effectiveTo = caseTo || maxCaseId
  const rangedRows = sortedRows.filter(r => {
    const id = extractCaseId(r.testCase, prefix)
    if (id === null) return true
    return id >= effectiveFrom && id <= effectiveTo
  })

  const showCaseRangeToolbar = tab === 'table' || tab === 'dual' || tab === 'stats' || tab === 'overall'

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">{t('results.title')}</h1>
          <div className="summary-row">
            <div className="summary-chip">
              <span className="label">{t('results.summaryBatch')}:</span>
              <span className="value">{detail.summary.name}</span>
            </div>
            <div className="summary-chip">
              <span className="label">{t('results.summaryRegister')}:</span>
              <span className="value">{detail.summary.registerName}</span>
            </div>
            <div className="summary-chip">
              <span className="label">{t('results.summaryDatCount')}:</span>
              <span className="value">{detail.summary.datCount}</span>
            </div>
            <div className={`summary-chip${detail.summary.warningCount > 0 ? ' warning' : ''}`}>
              <span className="label">{t('results.summaryWarnings')}:</span>
              <span className="value">{detail.summary.warningCount}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setTypeModalOpen(true)}>
            {t('results.bitFieldTypeSetting')}
          </button>
          <a className="btn" href={downloadCsvUrl(Number(batchId))} download>
            {t('results.downloadCsv')}
          </a>
          <a className="btn btn-primary" href={downloadXlsxUrl(Number(batchId))} download>
            {t('results.downloadXlsx')}
          </a>
        </div>
      </div>

      {showCaseRangeToolbar && (
        <div className="toolbar">
          <div className="group">
            <label>{t('results.caseRange')}</label>
            <input type="number" min={1} max={10000} value={caseFrom}
              onChange={(e) => setCaseFrom(Number(e.target.value) || 1)} />
            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
            <input type="number" min={1} max={10000} value={caseTo}
              onChange={(e) => setCaseTo(Number(e.target.value) || sortedRows.length)} />
            <span className="info" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              / {maxCaseId}
            </span>
          </div>
          <div className="divider" />
          <div className="group">
            <button className="btn btn-sm" onClick={() => { setCaseFrom(1); setCaseTo(maxCaseId) }}>
              {t('results.selectAll')}
            </button>
          </div>
        </div>
      )}

      <div className="tabs">
        {(['table', 'dual', 'stats', 'overall', 'warnings'] as Tab[]).map((t_) => (
          <button key={t_} className={`tab${tab === t_ ? ' active' : ''}`} onClick={() => setTab(t_)}>
            {t_ === 'table' && t('results.tabTable')}
            {t_ === 'dual' && t('results.tabDualRegister')}
            {t_ === 'stats' && t('results.tabStats')}
            {t_ === 'overall' && t('results.tabOverall')}
            {t_ === 'warnings' && (
              <>
                {t('results.tabWarnings')}
                {(detail.summary.warningCount > 0 || outOfRangeWarnings.length > 0)
                  ? ` (${detail.summary.warningCount + outOfRangeWarnings.length})`
                  : ''}
              </>
            )}
          </button>
        ))}
      </div>

      <ErrorBoundary>
        {tab === 'table' && (
          <ResultsTable
            rows={rangedRows}
            bitFields={detail.bitFields}
            visibleIndices={visibleIndices}
            format={format}
            setFormat={setFormat}
            prefix={prefix}
            setPrefix={setPrefix}
            onOpenColumnSelector={() => setColumnModalOpen(true)}
            types={types}
            rangeMap={rangeMap}
          />
        )}

        {tab === 'dual' && (
          <DualRegisterChart
            rows={rangedRows}
            bitFields={detail.bitFields}
            caseRange={{ from: 1, to: rangedRows.length }}
          />
        )}

        {tab === 'stats' && (
          <StatsPanel
            rows={rangedRows}
            bitFields={detail.bitFields}
            types={types}
          />
        )}

        {tab === 'overall' && (
          <OverallPanel
            summary={detail.summary}
            rows={rangedRows}
            bitFields={detail.bitFields}
            types={types}
            rangeMap={rangeMap}
          />
        )}

        {tab === 'warnings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {outOfRangeWarnings.length > 0 && (
              <div className="card">
                <h3 className="card-title">{t('results.outOfRangeTitle')} ({outOfRangeWarnings.length})</h3>
                <p className="card-subtitle">{t('results.outOfRangeHint')}</p>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('results.outOfRangeColCase')}</th>
                        <th>{t('results.outOfRangeColField')}</th>
                        <th>{t('results.outOfRangeColValue')}</th>
                        <th>{t('results.outOfRangeColRange')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outOfRangeWarnings.map((w, i) => (
                        <tr key={i}>
                          <td className="mono">{w.testCase}</td>
                          <td className="mono">{w.field}</td>
                          <td className="mono text-center" style={{ color: 'var(--color-error, #dc2626)' }}>{w.value}</td>
                          <td className="mono text-center">
                            {w.min !== undefined ? w.min : '—'} ~ {w.max !== undefined ? w.max : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="card">
              {detail.warnings.length === 0 ? (
                <div className="empty-state">{t('results.noWarnings')}</div>
              ) : (
                <>
                  <h3 className="card-title">{t('results.unknownAddrTitle')}</h3>
                  <ul className="simple-list">
                    {detail.warnings.map((w, i) => <li key={i} className="mono">{w}</li>)}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </ErrorBoundary>

      <div style={{ marginTop: 24 }}>
        <Link to="/history" className="btn btn-sm">{t('common.back')}</Link>
      </div>

      <ColumnSelectorModal
        open={columnModalOpen}
        onClose={() => setColumnModalOpen(false)}
        bitFields={detail.bitFields}
        selectedIndices={visibleIndices}
        onApply={setVisibleIndices}
      />
      <BitFieldTypeModal
        open={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        bitFields={detail.bitFields}
        types={types}
        onApply={bulkSet}
        onApplyRanges={setRangeMap}
        rangeMap={rangeMap}
        onReset={reset}
      />
    </div>
  )
}
