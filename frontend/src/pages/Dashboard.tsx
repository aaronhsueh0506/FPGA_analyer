import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listRegisters, type RegisterDefinition } from '../api/registers'
import { listBatches, type BatchSummaryAPI } from '../api/batches'

export default function Dashboard() {
  const { t } = useTranslation()
  const [registers, setRegisters] = useState<RegisterDefinition[]>([])
  const [batches, setBatches] = useState<BatchSummaryAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listRegisters(), listBatches()])
      .then(([regs, bats]) => {
        setRegisters(regs)
        setBatches(bats)
      })
      .catch(() => setError('Failed to connect to backend'))
      .finally(() => setLoading(false))
  }, [])

  const totalTestCases = batches.reduce((sum, b) => sum + (b.dat_count ?? 0), 0)
  const recent = batches.slice(0, 3)

  if (loading) return <div className="page"><div className="empty-state">Loading...</div></div>

  return (
    <div className="page">
      <h1 className="page-title">{t('dashboard.title')}</h1>
      <p className="page-subtitle">{t('dashboard.welcome')}</p>

      {error && <div className="warning-banner">{error}</div>}

      <div className="card">
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{t('dashboard.description')}</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.statRegisters')}</div>
          <div className="stat-value">{registers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.statBatches')}</div>
          <div className="stat-value">{batches.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.statTestCases')}</div>
          <div className="stat-value">{totalTestCases}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>{t('dashboard.recentBatches')}</h3>
          <Link to="/history" className="btn btn-sm">{t('dashboard.viewAll')}</Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">{t('dashboard.noBatches')}</div>
        ) : (
          <div className="recent-list">
            {recent.map((b) => (
              <Link key={b.id} to={`/results/${b.id}`} className="recent-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                  <div className="recent-meta">{b.register_name} · {b.dat_count} dat · {new Date(b.analyzed_at).toLocaleString()}</div>
                </div>
                <div className="recent-meta">{b.warning_count > 0 ? `${b.warning_count} warnings` : 'OK'}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">{t('dashboard.quickStart')}</h3>
        <ul className="simple-list">
          <li>{t('dashboard.step1')}</li>
          <li>{t('dashboard.step2')}</li>
          <li>{t('dashboard.step3')}</li>
        </ul>
      </div>
    </div>
  )
}
