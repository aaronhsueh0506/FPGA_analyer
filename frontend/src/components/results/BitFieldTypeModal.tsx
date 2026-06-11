import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { BitFieldDef, BitFieldType } from '../../mock/data'
import { defaultBitFieldType } from '../../mock/data'
import type { TypeMap, RangeMap, FieldRange } from '../../hooks/useBitFieldTypes'
import { parseSegments } from '../../hooks/useBitFieldTypes'

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
  width: number
  min: string
  max: string
}

interface ModeRangePopupState {
  fieldName: string
  width: number
  min: string
  max: string
  segments: string
}

function computeBitMax(width: number): number {
  if (width >= 32) return 0xffffffff
  if (width <= 0) return 0
  return (1 << width) - 1
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
  const [error, setError] = useState<string | null>(null)

  const bitMax = computeBitMax(state.width)

  const validate = (): string | null => {
    const minNum = min === '' ? undefined : Number(min)
    const maxNum = max === '' ? undefined : Number(max)
    if (minNum !== undefined && (!Number.isInteger(minNum) || minNum < 0 || minNum > bitMax)) {
      return t('results.bitFieldType.rangeErrorOutOfBounds', { max: bitMax })
    }
    if (maxNum !== undefined && (!Number.isInteger(maxNum) || maxNum < 0 || maxNum > bitMax)) {
      return t('results.bitFieldType.rangeErrorOutOfBounds', { max: bitMax })
    }
    if (minNum !== undefined && maxNum !== undefined && minNum > maxNum) {
      return t('results.bitFieldType.rangeErrorMinGtMax')
    }
    return null
  }

  const handleApply = () => {
    const err = validate()
    if (err) { setError(err); return }
    onApply(state.fieldName, min, max)
    onClose()
  }

  return createPortal(
    <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 340, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title" style={{ marginBottom: 4 }}>
          {t('results.bitFieldType.rangePopupTitle')}
        </h3>
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
          {state.fieldName}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
          0 ~ {bitMax} ({state.width} bit)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: '10px 8px', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>
            {t('results.bitFieldType.colMin')}
          </span>
          <input
            type="number"
            autoFocus
            min={0}
            max={bitMax}
            style={{ fontSize: 13, padding: '5px 8px', width: '100%' }}
            placeholder="—"
            value={min}
            onChange={(e) => { setMin(e.target.value); setError(null) }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>
            {t('results.bitFieldType.colMax')}
          </span>
          <input
            type="number"
            min={0}
            max={bitMax}
            style={{ fontSize: 13, padding: '5px 8px', width: '100%' }}
            placeholder="—"
            value={max}
            onChange={(e) => { setMax(e.target.value); setError(null) }}
          />
        </div>
        {error && (
          <div className="warning-banner" style={{ marginTop: 10, padding: '6px 10px', fontSize: 12 }}>
            {error}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-sm" onClick={() => { setMin(''); setMax(''); setError(null) }}>
            {t('results.bitFieldType.clearRange')}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleApply}>
              {t('results.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function ModeRangePopup({
  state,
  onApply,
  onClose,
}: {
  state: ModeRangePopupState
  onApply: (name: string, range: FieldRange) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [min, setMin] = useState(state.min)
  const [max, setMax] = useState(state.max)
  const [segmentEnabled, setSegmentEnabled] = useState(state.segments !== '')
  const [segInput, setSegInput] = useState(state.segments)
  const [minMaxError, setMinMaxError] = useState<string | null>(null)
  const [segError, setSegError] = useState<string | null>(null)

  const bitMax = computeBitMax(state.width)

  const validateMinMax = (): string | null => {
    const minNum = min === '' ? undefined : Number(min)
    const maxNum = max === '' ? undefined : Number(max)
    if (minNum !== undefined && (!Number.isInteger(minNum) || minNum < 0 || minNum > bitMax))
      return t('results.bitFieldType.rangeErrorOutOfBounds', { max: bitMax })
    if (maxNum !== undefined && (!Number.isInteger(maxNum) || maxNum < 0 || maxNum > bitMax))
      return t('results.bitFieldType.rangeErrorOutOfBounds', { max: bitMax })
    if (minNum !== undefined && maxNum !== undefined && minNum > maxNum)
      return t('results.bitFieldType.rangeErrorMinGtMax')
    return null
  }

  const validateSeg = (raw: string, currentMin = min, currentMax = max): string | null => {
    if (raw.trim() === '') return null
    const { error: err, parsed } = parseSegments(raw, bitMax)
    if (err) {
      if (err.startsWith('format:')) return t('results.bitFieldType.segmentErrorFormat')
      if (err.startsWith('bounds:')) {
        const parts = err.split(':')
        return t('results.bitFieldType.segmentErrorOutOfBounds', { val: parts[1], max: parts[2] })
      }
      if (err.startsWith('order:')) return t('results.bitFieldType.segmentErrorOrder')
      if (err === 'overlap') return t('results.bitFieldType.segmentErrorOverlap')
      return t('results.bitFieldType.segmentErrorFormat')
    }
    const minNum = currentMin === '' ? undefined : Number(currentMin)
    const maxNum = currentMax === '' ? undefined : Number(currentMax)
    if (minNum !== undefined || maxNum !== undefined) {
      const lo = minNum ?? 0
      const hi = maxNum ?? bitMax
      for (const [segLo, segHi] of parsed) {
        if (segLo < lo || segHi > hi) {
          return t('results.bitFieldType.segmentErrorOutsideRange', { min: lo, max: hi })
        }
      }
    }
    return null
  }

  const handleApply = () => {
    const mmErr = validateMinMax()
    if (mmErr) { setMinMaxError(mmErr); return }
    const minNum = min === '' ? undefined : Number(min)
    const maxNum = max === '' ? undefined : Number(max)
    if (segmentEnabled) {
      const err = validateSeg(segInput)
      if (err) { setSegError(err); return }
      if (segInput.trim() === '') {
        onApply(state.fieldName, { min: minNum, max: maxNum })
      } else {
        const { parsed } = parseSegments(segInput, bitMax)
        onApply(state.fieldName, { min: minNum, max: maxNum, segments: segInput.trim(), parsedSegments: parsed })
      }
    } else {
      onApply(state.fieldName, { min: minNum, max: maxNum })
    }
    onClose()
  }

  const handleClear = () => {
    setMin(''); setMax(''); setSegInput('')
    setMinMaxError(null); setSegError(null)
  }

  const handleToggleSegment = (checked: boolean) => {
    setSegmentEnabled(checked)
    setMinMaxError(null)
    setSegError(null)
  }

  return createPortal(
    <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 360, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title" style={{ marginBottom: 4 }}>
          {t('results.bitFieldType.rangePopupTitle')}
        </h3>
        <p className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
          {state.fieldName}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
          0 ~ {bitMax} ({state.width} bit)
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '48px 1fr',
          gap: '10px 8px',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>
            {t('results.bitFieldType.colMin')}
          </span>
          <input
            type="number"
            autoFocus
            min={0}
            max={bitMax}
            style={{ fontSize: 13, padding: '5px 8px', width: '100%' }}
            placeholder="—"
            value={min}
            onChange={(e) => {
              setMin(e.target.value)
              setMinMaxError(null)
              if (segmentEnabled) setSegError(validateSeg(segInput, e.target.value, max))
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>
            {t('results.bitFieldType.colMax')}
          </span>
          <input
            type="number"
            min={0}
            max={bitMax}
            style={{ fontSize: 13, padding: '5px 8px', width: '100%' }}
            placeholder="—"
            value={max}
            onChange={(e) => {
              setMax(e.target.value)
              setMinMaxError(null)
              if (segmentEnabled) setSegError(validateSeg(segInput, min, e.target.value))
            }}
          />
        </div>
        {minMaxError && !segmentEnabled && (
          <div className="warning-banner" style={{ marginTop: 10, padding: '6px 10px', fontSize: 12 }}>
            {minMaxError}
          </div>
        )}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 16,
          cursor: 'pointer',
          fontSize: 13,
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={segmentEnabled}
            onChange={(e) => handleToggleSegment(e.target.checked)}
          />
          {t('results.bitFieldType.segmentEnable')}
        </label>
        {segmentEnabled && (
          <div style={{ marginTop: 10 }}>
            <input
              type="text"
              autoFocus
              style={{ fontSize: 13, padding: '6px 8px', width: '100%' }}
              placeholder={t('results.bitFieldType.segmentPlaceholder')}
              value={segInput}
              onChange={(e) => { setSegInput(e.target.value); setSegError(validateSeg(e.target.value, min, max)) }}
            />
            {segError && (
              <div className="warning-banner" style={{ marginTop: 6, padding: '6px 10px', fontSize: 12 }}>
                {segError}
              </div>
            )}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-sm" onClick={handleClear}>
            {t('results.bitFieldType.clearRange')}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleApply}
              disabled={segmentEnabled ? !!segError : !!minMaxError}
            >
              {t('results.apply')}
            </button>
          </div>
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
  const [modeRangePopup, setModeRangePopup] = useState<ModeRangePopupState | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(types)
      setDraftRanges(rangeMap)
      setRangePopup(null)
      setModeRangePopup(null)
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

  const applyModeRange = (name: string, range: FieldRange) => {
    setDraftRanges((prev) => ({ ...prev, [name]: range }))
  }

  const openRangePopup = (bf: BitFieldDef) => {
    if (draft[bf.name] === 'mode') {
      const r = draftRanges[bf.name] ?? {}
      setModeRangePopup({
        fieldName: bf.name,
        width: bf.width,
        min: r.min !== undefined ? String(r.min) : '',
        max: r.max !== undefined ? String(r.max) : '',
        segments: r.segments ?? '',
      })
    } else {
      const r = draftRanges[bf.name] ?? {}
      setRangePopup({
        fieldName: bf.name,
        width: bf.width,
        min: r.min !== undefined ? String(r.min) : '',
        max: r.max !== undefined ? String(r.max) : '',
      })
    }
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

  const hasRange = (name: string) => {
    const r = draftRanges[name]
    if (!r) return false
    return r.min !== undefined || r.max !== undefined || (r.parsedSegments && r.parsedSegments.length > 0)
  }

  const rangeLabel = (name: string) => {
    const r = draftRanges[name]
    if (!r) return t('results.bitFieldType.rangeDefault')
    if (r.parsedSegments && r.parsedSegments.length > 0) return r.segments ?? 'seg'
    if (r.min === undefined && r.max === undefined) return t('results.bitFieldType.rangeDefault')
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
                const canSetRange = draft[bf.name] === 'magnitude' || draft[bf.name] === 'mode'
                return (
                  <div key={bf.name} className="modal-list-row">
                    <span className="mono">{bf.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{bf.width} bit</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }} className="mono">
                      {bf.registerName}
                    </span>
                    <div className="inline-toggle" style={{ display: 'flex', width: '100%' }}>
                      <button
                        className={draft[bf.name] === 'mode' ? 'active' : ''}
                        style={{ flex: 1 }}
                        onClick={() => setType(bf.name, 'mode')}
                      >
                        {t('results.bitFieldType.mode')}
                      </button>
                      <button
                        className={draft[bf.name] === 'magnitude' ? 'active' : ''}
                        style={{ flex: 1 }}
                        onClick={() => setType(bf.name, 'magnitude')}
                      >
                        {t('results.bitFieldType.magnitude')}
                      </button>
                      <button
                        className={draft[bf.name] === 'others' ? 'active' : ''}
                        style={{ flex: 1 }}
                        onClick={() => setType(bf.name, 'others')}
                      >
                        {t('results.bitFieldType.others')}
                      </button>
                    </div>
                    <button
                      className={`btn btn-sm${hasRange(bf.name) ? ' btn-primary' : ''}`}
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                        fontSize: 11,
                        opacity: canSetRange ? 1 : 0.3,
                        cursor: canSetRange ? 'pointer' : 'default',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: '100%',
                        textAlign: 'center',
                      }}
                      disabled={!canSetRange}
                      onClick={() => canSetRange && openRangePopup(bf)}
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
      {modeRangePopup && (
        <ModeRangePopup
          state={modeRangePopup}
          onApply={applyModeRange}
          onClose={() => setModeRangePopup(null)}
        />
      )}
    </>,
    document.body
  )
}
