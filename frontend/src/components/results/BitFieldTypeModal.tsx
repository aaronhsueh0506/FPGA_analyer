import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { BitFieldDef, BitFieldType } from '../../mock/data'
import { defaultBitFieldType } from '../../mock/data'
import type { TypeMap } from '../../hooks/useBitFieldTypes'

interface Props {
  open: boolean
  onClose: () => void
  bitFields: BitFieldDef[]
  types: TypeMap
  onApply: (next: TypeMap) => void
  onReset: () => void
}

export default function BitFieldTypeModal({ open, onClose, bitFields, types, onApply, onReset }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<TypeMap>(types)

  useEffect(() => {
    if (open) setDraft(types)
  }, [open, types])

  if (!open) return null

  const setType = (name: string, type: BitFieldType) => {
    setDraft((prev) => ({ ...prev, [name]: type }))
  }

  const apply = () => {
    onApply(draft)
    onClose()
  }

  const resetToDefaults = () => {
    const next: TypeMap = {}
    for (const bf of bitFields) next[bf.name] = defaultBitFieldType(bf)
    setDraft(next)
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{t('results.bitFieldType.title')}</h3>
        <p className="card-subtitle" style={{ marginTop: 0 }}>
          {t('results.bitFieldType.hint')}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={resetToDefaults}>
            {t('results.bitFieldType.resetDefaults')}
          </button>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
            mode: {Object.values(draft).filter((v) => v === 'mode').length}
            {' · '}
            magnitude: {Object.values(draft).filter((v) => v === 'magnitude').length}
            {' · '}
            others: {Object.values(draft).filter((v) => v === 'others').length}
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-list">
            <div className="modal-list-row header">
              <span>{t('results.bitFieldType.colName')}</span>
              <span>{t('results.bitFieldType.colWidth')}</span>
              <span>{t('results.bitFieldType.colRegister')}</span>
              <span>{t('results.bitFieldType.colType')}</span>
            </div>
            {bitFields.map((bf) => (
              <div key={bf.name} className="modal-list-row">
                <span className="mono">{bf.name}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{bf.width} bit</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }} className="mono">
                  {bf.registerName}
                </span>
                <div className="inline-toggle">
                  <button
                    className={draft[bf.name] === 'mode' ? 'active' : ''}
                    onClick={() => setType(bf.name, 'mode')}
                  >
                    {t('results.bitFieldType.mode')}
                  </button>
                  <button
                    className={draft[bf.name] === 'magnitude' ? 'active' : ''}
                    onClick={() => setType(bf.name, 'magnitude')}
                  >
                    {t('results.bitFieldType.magnitude')}
                  </button>
                  <button
                    className={draft[bf.name] === 'others' ? 'active' : ''}
                    onClick={() => setType(bf.name, 'others')}
                  >
                    {t('results.bitFieldType.others')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => { onReset(); onClose() }}>
            {t('results.bitFieldType.resetDefaults')}
          </button>
          <button className="btn" style={{ marginLeft: 8 }} onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={apply}>
            {t('results.apply')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
