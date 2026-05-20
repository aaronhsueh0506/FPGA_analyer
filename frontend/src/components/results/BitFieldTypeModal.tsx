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

interface RangePopupState {
  fieldName: string
  min: string
  max: string
}

function RangePopup({
  state,
  onApply,
  onClose,
}: {
  state: RangePopupState
  onApply: (name: string, min: string, max: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [min, setMin] = useState(state.min)
  const [max, setMax] = useState(state.max)

  return createPortal(
    <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 320, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title">{t('results.bitFieldType.rangePopupTitle')}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 16 }} className="mono">
          {state.fieldName}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 32, color: 'var(--text-secondary)' }}>{t('results.bitFieldType.colMin')}</span>
            <input
              type="number"
              autoFocus
              style={{ flex: 1, fontSize: 13, padding: '4px 8px' }}
              placeholder="—"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 32, color: 'var(--text-secondary)' }}>{t('results.bitFieldType.colMax')}</span>
            <input
              type="number"
              style={{ flex: 1, fontSize: 13, padding: '4px 8px' }}
              placeholder="—"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button
            className="btn btn-sm"
            onClick={() => { setMin(''); setMax('') }}
          >
            {t('results.bitFieldType.clearRange')}
          </button>
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() => { onApply(state.fieldName, min, max); onClose() }}
          >
            {t('results.apply')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function BitFieldTypeModal({
  open, onClose, bitFields, types, onApply, onApplyRanges, rangeMap, onReset
}: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<TypeMap>(types)
  const [draftRanges, setDraftRanges] = useState<RangeMap>(rangeMap)
  const [rangePopup, setRangePopup] = useState<RangePopupState | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(types)
      setDraftRanges(rangeMap)
      setRangePopup(null)
    }
  }, [open, types, rangeMap])

  if (!open) return null

  const setType = (name: string, type: BitFieldType) => {
    setDraft((prev) => ({ ...prev, [name]: type }))
  }

  const applyRangeParts = (name: string, minRaw: string, maxRaw: string) => {
    const min = minRaw === '' ? undefined : Number(minRaw)
    const max = maxRaw === '' ? undefined : Number(maxRaw)
    setDraftRanges((prev) => ({
      ...prev,
      [name]: { min, max }
    }))
  }

  const openRangePopup = (bf: BitFieldDef) => {
    const r = draftRanges[bf.name] ?? {}
    setRangePopup({
      fieldName: bf.name,
      min: r.min !== undefined ? String(r.min) : '',
      max: r.max !== undefined ? String(r.max) : '',
    })
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

  const rangeLabel = (name: string) => {
    const r = draftRanges[name]
    if (!r || (r.min === undefined && r.max === undefined)) return '—'
    const lo = r.min !== undefined ? String(r.min) : '—'
    const hi = r.max !== undefined ? String(r.max) : '—'
    return `${lo} ~ ${hi}`
  }

  return createPortal(
    <>
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
                <span>{t('results.bitFieldType.colRange')}</span>
              </div>
              {bitFields.map((bf) => {
                const isMag = draft[bf.name] === 'magnitude'
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
                    <button
                      className="btn btn-sm"
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                        fontSize: 11,
                        opacity: isMag ? 1 : 0.35,
                        cursor: isMag ? 'pointer' : 'default',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                      disabled={!isMag}
                      onClick={() => isMag && openRangePopup(bf)}
                    >
                      {rangeLabel(bf.name)}
                    </button>
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
      </div>
      {rangePopup && (
        <RangePopup
          state={rangePopup}
          onApply={applyRangeParts}
          onClose={() => setRangePopup(null)}
        />
      )}
    </>,
    document.body
  )
}
