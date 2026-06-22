import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactECharts from 'echarts-for-react'
import { FORMATS, limitCurve, type AxisScale } from './heatmapData'

const SCALE_OPTIONS: AxisScale[] = ['linear', 'log']
const SCALE_LABEL: Record<AxisScale, string> = { linear: 'scaleLinear', log: 'scaleLog' }

interface Props {
  rows: Array<{ testCase: string; values: number[] }>
  xFieldIndex: number
  yFieldIndex: number
  xFieldName: string
  yFieldName: string
  caseRange: { from: number; to: number }
}

export default function Scatter({
  rows,
  xFieldIndex,
  yFieldIndex,
  xFieldName,
  yFieldName,
  caseRange,
}: Props) {
  const { t } = useTranslation()
  const [showLimit, setShowLimit] = useState(true)
  const [scale, setScale] = useState<AxisScale>('log')

  const fromIdx = Math.max(0, caseRange.from - 1)
  const toIdx = Math.min(rows.length, caseRange.to)
  const slicedRows = rows.slice(fromIdx, toIdx)

  if (slicedRows.length === 0) {
    return <div className="empty-state">{t('results.noDataInRange')}</div>
  }

  // log axes cannot plot <= 0, so drop those points in log mode
  const data = slicedRows
    .map((r) => ({ name: r.testCase, value: [r.values[xFieldIndex] ?? 0, r.values[yFieldIndex] ?? 0] as [number, number] }))
    .filter((d) => (scale === 'log' ? d.value[0] > 0 && d.value[1] > 0 : true))

  let xMin = Infinity
  let xMax = 0
  let yMin = Infinity
  let yMax = 0
  for (const d of data) {
    const [x, y] = d.value
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }
  if (!Number.isFinite(xMin)) xMin = 0
  if (!Number.isFinite(yMin)) yMin = 0

  const loX = scale === 'log' ? Math.max(1, xMin) : 0
  const loY = scale === 'log' ? Math.max(1, yMin) : 0

  const limitSeries = showLimit && xMax > 0
    ? FORMATS.map((f) => ({
        name: f.label,
        type: 'line',
        data: limitCurve(f.bytes, loX, xMax, loY, yMax, scale),
        showSymbol: false,
        smooth: false,
        clip: true,
        silent: true,
        lineStyle: { color: f.color, width: 1.5, type: 'dashed' },
        z: 1,
      }))
    : []

  const axisType = scale === 'log' ? 'log' : 'value'

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.seriesType !== 'scatter') return ''
        const testCase = params.data?.name ?? ''
        const [x, y] = params.value as [number, number]
        return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;">
          <div><b>${testCase}</b></div>
          <div>X (${xFieldName}) = ${x}</div>
          <div>Y (${yFieldName}) = ${y}</div>
        </div>`
      },
    },
    legend: showLimit
      ? { data: FORMATS.map((f) => f.label), top: 4, right: 8, itemWidth: 18, itemHeight: 8, textStyle: { fontSize: 10, color: '#6b7280' } }
      : undefined,
    grid: { left: 80, right: 30, top: showLimit ? 44 : 30, bottom: 70 },
    xAxis: {
      type: axisType,
      min: scale === 'log' ? undefined : 0,
      name: xFieldName,
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { color: '#4b5563', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
    },
    yAxis: {
      type: axisType,
      min: scale === 'log' ? undefined : 0,
      name: yFieldName,
      nameLocation: 'middle',
      nameGap: 55,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { color: '#4b5563', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
    },
    series: [
      {
        name: 'scatter',
        type: 'scatter',
        data,
        symbolSize: 6,
        itemStyle: { color: '#1f3a8a', opacity: 0.55 },
        emphasis: { itemStyle: { color: '#1f3a8a', opacity: 1, shadowBlur: 6, shadowColor: 'rgba(31, 58, 138, 0.5)' } },
        z: 2,
      },
      ...limitSeries,
    ],
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="group">
          <label>{t('results.dualRegister.axisScale')}</label>
          <div className="inline-toggle">
            {SCALE_OPTIONS.map((s) => (
              <button key={s} className={scale === s ? 'active' : ''} onClick={() => setScale(s)}>
                {t('results.dualRegister.' + SCALE_LABEL[s])}
              </button>
            ))}
          </div>
        </div>
        <div className="group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showLimit} onChange={(e) => setShowLimit(e.target.checked)} />
            {t('results.dualRegister.resourceLimit')}
          </label>
        </div>
      </div>
      <ReactECharts
        key={`${scale}-${showLimit}`}
        option={option}
        style={{ height: 520, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
