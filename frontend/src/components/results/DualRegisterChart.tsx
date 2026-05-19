import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BitFieldDef } from '../../mock/data'
import Heatmap2D from '../charts/Heatmap2D'
import Scatter from '../charts/Scatter'

type ViewMode = 'heatmap' | 'scatter'

interface Props {
  rows: Array<{ testCase: string; values: number[] }>
  bitFields: BitFieldDef[]
  caseRange: { from: number; to: number }
}

export default function DualRegisterChart({ rows, bitFields, caseRange }: Props) {
  const { t } = useTranslation()
  // 預設挑兩個 magnitude 類欄位作 X / Y（如果有的話）
  const defaultX = bitFields.findIndex((bf) => bf.name === 'SPE_IN_WIDTH')
  const defaultY = bitFields.findIndex((bf) => bf.name === 'SPE_IN_HEIGHT')

  const [xIdx, setXIdx] = useState<number>(defaultX >= 0 ? defaultX : 0)
  const [yIdx, setYIdx] = useState<number>(defaultY >= 0 ? defaultY : Math.min(1, bitFields.length - 1))
  const [view, setView] = useState<ViewMode>('scatter')

  const ready = xIdx >= 0 && yIdx >= 0 && bitFields[xIdx] && bitFields[yIdx]

  return (
    <div>
      <div className="toolbar">
        <div className="group">
          <label>{t('results.dualRegister.xAxis')}</label>
          <select value={xIdx} onChange={(e) => setXIdx(Number(e.target.value))} style={{ minWidth: 200 }}>
            {bitFields.map((bf, i) => (
              <option key={i} value={i}>{bf.name} [{bf.width}b]</option>
            ))}
          </select>
        </div>
        <div className="group">
          <label>{t('results.dualRegister.yAxis')}</label>
          <select value={yIdx} onChange={(e) => setYIdx(Number(e.target.value))} style={{ minWidth: 200 }}>
            {bitFields.map((bf, i) => (
              <option key={i} value={i}>{bf.name} [{bf.width}b]</option>
            ))}
          </select>
        </div>
        <div className="divider" />
        <div className="group">
          <div className="inline-toggle">
            <button
              className={view === 'heatmap' ? 'active' : ''}
              onClick={() => setView('heatmap')}
            >
              {t('results.dualRegister.viewHeatmap')}
            </button>
            <button
              className={view === 'scatter' ? 'active' : ''}
              onClick={() => setView('scatter')}
            >
              {t('results.dualRegister.viewScatter')}
            </button>
          </div>
        </div>
      </div>

      {!ready ? (
        <div className="empty-state">{t('results.dualRegister.pickFirst')}</div>
      ) : view === 'heatmap' ? (
        <div className="card" style={{ marginBottom: 0 }}>
          <Heatmap2D
            rows={rows}
            xFieldIndex={xIdx}
            yFieldIndex={yIdx}
            xFieldName={bitFields[xIdx].name}
            yFieldName={bitFields[yIdx].name}
            caseRange={caseRange}
          />
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 0 }}>
          <Scatter
            rows={rows}
            xFieldIndex={xIdx}
            yFieldIndex={yIdx}
            xFieldName={bitFields[xIdx].name}
            yFieldName={bitFields[yIdx].name}
            caseRange={caseRange}
          />
        </div>
      )}
    </div>
  )
}
