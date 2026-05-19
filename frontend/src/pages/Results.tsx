import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getBatch, downloadCsvUrl, downloadXlsxUrl, type BatchDetailAPI } from '../api/batches'
import type { BatchSummary, BitFieldDef } from '../mock/data'
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
    analyzedAt: new Date(api.summary.analyzed_at).toLocaleString(),
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

  const { types, bulkSet, reset } = useBitFieldTypes(
    detail?.summary.registerName ?? '',
    detail?.bitFields ?? []
  )

  const [tab, setTab] = useState<Tab>('table')
  const [format, setFormat] = useState<'hex' | 'dec'>('dec')
  const [prefix, setPrefix] = useState('speg')
  const [visibleIndices, setVisibleIndices] = useState<number[]>([])
  const [caseFrom, setCaseFrom] = useState<number>(1)
  const [caseTo, setCaseTo] = useState<number>(0)
  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [typeModalOpen, setTypeModalOpen] = useState(false)

  // Initialise range and visible columns once data loads
  useEffect(() => {
    if (!detail) return
    setCaseTo(sortedRows.length)
    setVisibleIndices(
      detail.bitFields.map((_, i) => i).filter(i => types[detail.bitFields[i].name] !== 'others')
    )
  }, [detail]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="page"><div className="empty-state">Loading...</div></div>
  if (error || !detail) return <div className="page"><div className="warning-banner">{error ?? 'Error'}</div></div>

  const clampedFrom = Math.max(1, Math.min(caseFrom, sortedRows.length))
  const clampedTo = Math.max(clampedFrom, Math.min(caseTo || sortedRows.length, sortedRows.length))
  const caseRange = { from: clampedFrom, to: clampedTo }
  const rangedRows = sortedRows.slice(clampedFrom - 1, clampedTo)

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
              / {sortedRows.length}
            </span>
          </div>
          <div className="divider" />
          <div className="group">
            <button className="btn btn-sm" onClick={() => { setCaseFrom(1); setCaseTo(sortedRows.length) }}>
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
              <>{t('results.tabWarnings')}{detail.summary.warningCount > 0 ? ` (${detail.summary.warningCount})` : ''}</>
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
            rows={detail.rows}
            bitFields={detail.bitFields}
            types={types}
            caseRange={caseRange}
          />
        )}

        {tab === 'overall' && (
          <OverallPanel
            summary={detail.summary}
            rows={detail.rows}
            bitFields={detail.bitFields}
            types={types}
            caseRange={caseRange}
          />
        )}

        {tab === 'warnings' && (
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
        onReset={reset}
      />
    </div>
  )
}
