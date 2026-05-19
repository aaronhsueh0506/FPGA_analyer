import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listRegisters, uploadRegister, deleteRegister, renameRegister, type RegisterDefinition } from '../api/registers'

export default function Registers() {
  const { t } = useTranslation()
  const [items, setItems] = useState<RegisterDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [versionName, setVersionName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  const load = () => {
    listRegisters()
      .then(setItems)
      .catch(() => setError('Failed to load register definitions'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const created = await uploadRegister(files[0], versionName)
      setItems((prev) => [created, ...prev])
      setVersionName('')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('registers.confirmDelete'))) return
    try {
      await deleteRegister(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? t('registers.deleteFailed'))
    }
  }

  const startEdit = (r: RegisterDefinition) => {
    setEditingId(r.id)
    setEditingName(r.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const confirmEdit = async (id: number) => {
    const trimmed = editingName.trim()
    if (!trimmed) return
    try {
      const updated = await renameRegister(id, trimmed)
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
      cancelEdit()
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? t('registers.renameFailed'))
    }
  }

  if (loading) return <div className="page"><div className="empty-state">Loading...</div></div>

  return (
    <div className="page">
      <h1 className="page-title">{t('registers.title')}</h1>

      {error && <div className="warning-banner">{error}</div>}

      <div className="card">
        <h3 className="card-title">{t('registers.uploadTitle')}</h3>
        <p className="card-subtitle">{t('registers.uploadHint')}</p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            {t('registers.versionName')}
          </label>
          <input
            type="text"
            className="prefix-input"
            placeholder={t('registers.versionNamePlaceholder')}
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            style={{ width: 320 }}
          />
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
            {t('registers.versionNameHint')}
          </span>
        </div>

        <div
          className={`dropzone${dragOver ? ' drag-over' : ''}`}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        >
          <div>{uploading ? t('registers.uploading') : t('registers.uploadOrDrag')}</div>
          <div className="dropzone-hint">.xlsx</div>
          <input
            ref={fileInputRef}
            className="hidden-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">{t('registers.listTitle')}</h3>
        {items.length === 0 ? (
          <div className="empty-state">{t('registers.empty')}</div>
        ) : (
          <div className="table-scroll" style={{ maxHeight: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('registers.colName')}</th>
                  <th>{t('registers.colFile')}</th>
                  <th>{t('registers.colRegisterCount')}</th>
                  <th>{t('registers.colBitfieldCount')}</th>
                  <th>{t('registers.colUploadedAt')}</th>
                  <th>{t('registers.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {editingId === r.id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="text"
                            className="prefix-input"
                            value={editingName}
                            autoFocus
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEdit(r.id)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            style={{ width: 180 }}
                          />
                          <button className="btn btn-sm btn-primary" onClick={() => confirmEdit(r.id)}>
                            {t('common.confirm')}
                          </button>
                          <button className="btn btn-sm" onClick={cancelEdit}>
                            {t('common.cancel')}
                          </button>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {r.name}
                          <button
                            className="btn btn-sm"
                            style={{ padding: '1px 8px', fontSize: 11 }}
                            onClick={() => startEdit(r)}
                          >
                            {t('registers.actionRename')}
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="mono">{r.original_filename}</td>
                    <td>{r.register_count}</td>
                    <td>{r.bitfield_count}</td>
                    <td>{new Date(r.uploaded_at).toLocaleString()}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>
                        {t('registers.actionDelete')}
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
