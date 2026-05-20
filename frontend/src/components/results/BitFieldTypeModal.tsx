import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { BitFieldDef, BitFieldType } from '../../mock/data'
import { defaultBitFieldType } from '../../mock/data'
import type { TypeMap, RangeMap } from '../../hooks/useBitFieldTypes'

interface Props {
  open: boolean
  onClose: () => void
  bitFields: BitFieldDef[]
  types: TypeMap
  onApply: (next: TypeMap) => void
  onApplyRanges: (next: RangeMap) => void
  rangeMap: RangeMap
  onReset: () => void
}

export default function BitFieldTypeModal({
  open, onClose, bitFields, types, onApply, onApplyRanges, rangeMap, onReset
}: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<TypeMap>(types)
  const [draftRanges, setDraftRanges] = useState<RangeMap>(rangeMap)

  useEffect(() => {
    if (open) {
      setDraft(types)
      setDraftRanges(rangeMap)
    }
  }, [open, types, rangeMap])

  if (!open) return null

  const setType = (name: string, type: BitFieldType) => {
    setDraft((prev) => ({ ...prev, [name]: type }))
  }

  const setRangePart = (name: string, part: 'min' | 'max', raw: string) => {
    const val = raw === '' ? undefined : Number(raw)
    setDraftRanges((prev) => ({
      ...prev,
      [name]: { ...prev[name], [part]: val }
    }))
  }

  const apply = () => {
    onApply(draft)
    onApplyRanges(draftRanges)
    onClose()
  }

  const resetToDefaults = () => {
    const next: TypeMap = {}
    for (const bf of bitFields) next[bf.name] = defaultBitFieldType(bf)
    setDraft(next)
    setDraftRanges({})
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{t('results.bitFieldType.title')}</h3>
        <p className="card-subtitle" style={{ marginTop: 0 }}>
          {t('results.bitFieldType.hint')}
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
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
              <span>{t('results.bitFieldType.colMin')}</span>
              <span>{t('results.bitFieldType.colMax')}</span>
            </div>
            {bitFields.map((bf) => {
              const isMag = draft[bf.name] === 'magnitude'
              const r = draftRanges[bf.name] ?? {}
              return (
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
                  <input
                    type="number"
                    style={{ width: '100%', fontSize: 12, padding: '2px 4px', opacity: isMag ? 1 : 0.3 }}
                    disabled={!isMag}
                    placeholder="—"
                    value={r.min ?? ''}
                    onChange={(e) => setRangePart(bf.name, 'min', e.target.value)}
                  />
                  <input
                    type="number"
                    style={{ width: '100%', fontSize: 12, padding: '2px 4px', opacity: isMag ? 1 : 0.3 }}
                    disabled={!isMag}
                    placeholder="—"
                    value={r.max ?? ''}
                    onChange={(e) => setRangePart(bf.name, 'max', e.target.value)}
                  />
                </div>
              )
            })}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => { onReset(); setDraftRanges({}); onClose() }}>
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
