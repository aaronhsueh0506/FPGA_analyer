import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listRegisters, type RegisterDefinition } from '../api/registers'
import { createBatch } from '../api/batches'

const PREVIEW_LIMIT = 50

export default function Analyze() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [registers, setRegisters] = useState<RegisterDefinition[]>([])
  const [registerId, setRegisterId] = useState<number | ''>('')
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listRegisters().then(setRegisters).catch(() => {})
  }, [])

  const step2Enabled = registerId !== ''
  const step3Enabled = step2Enabled && files.length > 0

  const handleAddFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const arr = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith('.dat'))
    setFiles((prev) => [...prev, ...arr])
  }

  const handleRemove = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx))
  }

  const handleAnalyze = async () => {
    if (registerId === '') return
    setAnalyzing(true)
    setError(null)
    setUploadPct(0)
    try {
      const batch = await createBatch(registerId, files, setUploadPct)
      navigate(`/results/${batch.id}`)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Analysis failed')
      setAnalyzing(false)
    }
  }

  const previewFiles = files.slice(0, PREVIEW_LIMIT)
  const moreCount = Math.max(0, files.length - PREVIEW_LIMIT)

  return (
    <div className="page">
      <h1 className="page-title">{t('analyze.title')}</h1>

      {error && <div className="warning-banner">{error}</div>}

      <div className="step-card">
        <div className="step-header">
          <div className="step-num">1</div>
          <div className="step-title">{t('analyze.step1Title')}</div>
        </div>
        <div className="form-row">
          <select
            value={registerId}
            onChange={(e) => setRegisterId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">{t('analyze.step1Placeholder')}</option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.register_count} registers · {r.bitfield_count} bit fields)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`step-card${step2Enabled ? '' : ' disabled'}`}>
        <div className="step-header">
          <div className="step-num">2</div>
          <div className="step-title">{t('analyze.step2Title')}</div>
        </div>

        <div className="dropzone-row">
          <div
            className={`dropzone${dragOver ? ' drag-over' : ''}`}
            onClick={() => step2Enabled && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (step2Enabled) setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (step2Enabled) handleAddFiles(e.dataTransfer.files) }}
            style={{ pointerEvents: step2Enabled ? 'auto' : 'none' }}
          >
            <div>{t('analyze.step2Hint')}</div>
            <div className="dropzone-hint">.dat</div>
          </div>
          <div className="dropzone-side-actions">
            <button className="btn" disabled={!step2Enabled} onClick={() => fileInputRef.current?.click()}>
              {t('analyze.selectFiles')}
            </button>
            <button className="btn" disabled={!step2Enabled} onClick={() => folderInputRef.current?.click()}>
              {t('analyze.selectFolder')}
            </button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept=".dat" multiple className="hidden-input"
          onChange={(e) => { handleAddFiles(e.target.files); e.target.value = '' }} />
        <input ref={folderInputRef} type="file" multiple className="hidden-input"
          // @ts-expect-error — non-standard but supported in Chromium / Safari / Firefox
          webkitdirectory="" directory=""
          onChange={(e) => { handleAddFiles(e.target.files); e.target.value = '' }} />

        {files.length > 0 && (
          <>
            <div className="file-actions-summary">
              <span>{t('analyze.selectedFiles', { count: files.length })}</span>
              <button className="btn btn-sm" onClick={() => setFiles([])}>
                {t('analyze.clearAll')}
              </button>
            </div>
            <div className="file-list">
              {previewFiles.map((f, i) => (
                <div key={i} className="file-row">
                  <span className="file-name">{f.name}</span>
                  <button className="btn btn-sm" onClick={() => handleRemove(i)}>
                    {t('analyze.remove')}
                  </button>
                </div>
              ))}
              {moreCount > 0 && (
                <div className="file-row" style={{ justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                  {t('analyze.fileListMore', { count: moreCount })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className={`step-card${step3Enabled ? '' : ' disabled'}`}>
        <div className="step-header">
          <div className="step-num">3</div>
          <div className="step-title">{t('analyze.step3Title')}</div>
        </div>
        {!step3Enabled && <p className="helper-text">{t('analyze.step3Disabled')}</p>}
        {analyzing && uploadPct < 100 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t('analyze.uploading')} {uploadPct}%
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${uploadPct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.2s' }} />
            </div>
          </div>
        )}
        {analyzing && uploadPct >= 100 && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {t('analyze.analyzing')}
          </div>
        )}
        <button className="btn btn-primary" disabled={!step3Enabled || analyzing} onClick={handleAnalyze}>
          {analyzing ? t('analyze.analyzing') : t('analyze.step3Button')}
        </button>
      </div>
    </div>
  )
}
