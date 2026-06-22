import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactECharts from 'echarts-for-react'
import { FORMATS, limitCurve } from './heatmapData'

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

  const fromIdx = Math.max(0, caseRange.from - 1)
  const toIdx = Math.min(rows.length, caseRange.to)
  const slicedRows = rows.slice(fromIdx, toIdx)

  if (slicedRows.length === 0) {
    return <div className="empty-state">{t('results.noDataInRange')}</div>
  }

  const data = slicedRows.map((r) => ({
    name: r.testCase,
    value: [r.values[xFieldIndex] ?? 0, r.values[yFieldIndex] ?? 0] as [number, number],
  }))

  let xMax = 0
  let yMax = 0
  for (const d of data) {
    const [x, y] = d.value
    if (x > xMax) xMax = x
    if (y > yMax) yMax = y
  }

  const loX = 0
  const loY = 0

  // Background budget zones: area under each W*H*bytes = 0.5MB boundary, layered so
  // the strictest (32-bit, smallest area, green) sits on top -> nested colored bands.
  // Near the origin = fits all formats (green); outward = only 8-bit (red); beyond = over budget (white).
  const zoneSeries = showLimit && xMax > 0
    ? FORMATS.map((f, idx) => ({
        name: f.label,
        type: 'line',
        data: limitCurve(f.bytes, loX, xMax, loY, yMax, 'linear', true),
        showSymbol: false,
        smooth: false,
        clip: true,
        silent: true,
        lineStyle: { color: f.color, width: 1, type: 'dashed' },
        areaStyle: { color: f.fill, opacity: 0.5, origin: 'start' },
        z: 1 + idx,
      }))
    : []

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.seriesType !== 'scatter') return ''
        const testCase = params.data?.name ?? ''
        const [x, y] = params.value as [number, number]
        const px = x * y
        return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;">
          <div><b>${testCase}</b></div>
          <div>X (${xFieldName}) = ${x}</div>
          <div>Y (${yFieldName}) = ${y}</div>
          <div>W*H = ${px.toLocaleString()} px</div>
        </div>`
      },
    },
    legend: showLimit
      ? { data: FORMATS.map((f) => f.label), top: 4, right: 8, itemWidth: 18, itemHeight: 8, textStyle: { fontSize: 10, color: '#6b7280' } }
      : undefined,
    grid: { left: 80, right: 30, top: showLimit ? 44 : 30, bottom: 70 },
    xAxis: {
      type: 'value',
      min: 0,
      name: xFieldName,
      nameLocation: 'middle',
      nameGap: 35,
      splitNumber: 10,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { color: '#4b5563', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
      minorTick: { show: true, splitNumber: 5 },
      minorSplitLine: { show: true, lineStyle: { color: '#f3f4f6' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      name: yFieldName,
      nameLocation: 'middle',
      nameGap: 55,
      splitNumber: 10,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { color: '#4b5563', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
      minorTick: { show: true, splitNumber: 5 },
      minorSplitLine: { show: true, lineStyle: { color: '#f3f4f6' } },
    },
    series: [
      ...zoneSeries,
      {
        name: 'scatter',
        type: 'scatter',
        data,
        symbolSize: 6,
        itemStyle: { color: '#1f3a8a', opacity: 0.55 },
        emphasis: { itemStyle: { color: '#1f3a8a', opacity: 1, shadowBlur: 6, shadowColor: 'rgba(31, 58, 138, 0.5)' } },
        z: 10,
      },
    ],
  }

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showLimit} onChange={(e) => setShowLimit(e.target.checked)} />
            {t('results.dualRegister.resourceLimit')}
          </label>
        </div>
      </div>
      <ReactECharts
        key={`${showLimit}`}
        option={option}
        style={{ height: 600, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
