import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { BitFieldDef } from '../../mock/data'

interface Props {
  open: boolean
  onClose: () => void
  bitFields: BitFieldDef[]
  selectedIndices: number[]
  onApply: (next: number[]) => void
}

export default function ColumnSelectorModal({ open, onClose, bitFields, selectedIndices, onApply }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Set<number>>(new Set(selectedIndices))

  useEffect(() => {
    if (open) setDraft(new Set(selectedIndices))
  }, [open, selectedIndices])

  if (!open) return null

  const toggle = (idx: number) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const selectAll = () => setDraft(new Set(bitFields.map((_, i) => i)))
  const clear = () => setDraft(new Set())

  const apply = () => {
    const arr = Array.from(draft).sort((a, b) => a - b)
    onApply(arr)
    onClose()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{t('results.columnSelector')}</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={selectAll}>{t('results.selectAll')}</button>
          <button className="btn btn-sm" onClick={clear}>{t('results.clearSelection')}</button>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
            {draft.size} / {bitFields.length}
          </div>
        </div>
        <div className="modal-body">
          <div className="column-grid">
            {bitFields.map((bf, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={draft.has(i)}
                  onChange={() => toggle(i)}
                />
                <span className="mono" style={{ fontSize: 13 }}>{bf.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>[{bf.width}]</span>
              </label>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={apply}>{t('results.apply')}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
