import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listBatches, deleteBatch, type BatchSummaryAPI } from '../api/batches'
import { formatLocalDate } from '../api/dateUtils'

export default function History() {
  const { t } = useTranslation()
  const [batches, setBatches] = useState<BatchSummaryAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    listBatches()
      .then(setBatches)
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (id: number) => {
    if (!confirm(t('history.confirmDelete'))) return
    try {
      await deleteBatch(id)
      setBatches((prev) => prev.filter((b) => b.id !== id))
    } catch {
      alert(t('history.deleteFailed'))
    }
  }

  if (loading) return <div className="page"><div className="empty-state">Loading...</div></div>

  return (
    <div className="page">
      <h1 className="page-title">{t('history.title')}</h1>

      {error && <div className="warning-banner">{error}</div>}

      <div className="card">
        {batches.length === 0 ? (
          <div className="empty-state">{t('history.empty')}</div>
        ) : (
          <div className="table-scroll" style={{ maxHeight: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('history.colId')}</th>
                  <th>{t('history.colName')}</th>
                  <th>{t('history.colRegister')}</th>
                  <th>{t('history.colDatCount')}</th>
                  <th>{t('history.colWarnings')}</th>
                  <th>{t('history.colAnalyzedAt')}</th>
                  <th>{t('history.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="mono">#{b.id}</td>
                    <td className="mono">{b.name}</td>
                    <td>{b.register_name}</td>
                    <td>{b.dat_count}</td>
                    <td>
                      {b.warning_count > 0 ? (
                        <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{b.warning_count}</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>0</span>
                      )}
                    </td>
                    <td>{formatLocalDate(b.analyzed_at)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/results/${b.id}`} className="btn btn-sm btn-primary">
                        {t('history.view')}
                      </Link>
                      <button className="btn btn-sm" onClick={() => handleDelete(b.id)}>
                        {t('history.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
