import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactECharts from 'echarts-for-react'

// Resource budget: W * H * bytesPerPixel must stay under this.
const RESOURCE_LIMIT = 500000
// fmt: 8-bit = 1 byte, 16-bit = 2 bytes, 32-bit = 4 bytes per pixel
const FORMATS = [
  { label: '8-bit (x1)', bytes: 1, color: '#16a34a' },
  { label: '16-bit (x2)', bytes: 2, color: '#f59e0b' },
  { label: '32-bit (x4)', bytes: 4, color: '#dc2626' },
]
const CURVE_SAMPLES = 240

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
    value: [r.values[xFieldIndex] ?? 0, r.values[yFieldIndex] ?? 0],
  }))

  // data bounds (X = W, Y = H) used to clip the constraint curves to the plot box
  let xMin = Infinity
  let xMax = 0
  let yMax = 0
  for (const d of data) {
    const [x, y] = d.value
    if (x < xMin) xMin = x
    if (x > xMax) xMax = x
    if (y > yMax) yMax = y
  }
  if (!Number.isFinite(xMin)) xMin = 0

  // Each curve is the boundary W*H*bytes = RESOURCE_LIMIT, i.e. H = LIMIT/(bytes*W).
  // Sample across the visible W range and keep only points inside the data box so
  // the lines never expand the axis scale.
  const limitSeries = showLimit && xMax > 0
    ? FORMATS.map((f) => {
        const cap = RESOURCE_LIMIT / f.bytes
        const wStart = Math.max(1, Math.floor(xMin))
        const wEnd = Math.max(wStart, Math.ceil(xMax))
        const pts: Array<[number, number]> = []
        for (let i = 0; i <= CURVE_SAMPLES; i++) {
          const w = wStart + ((wEnd - wStart) * i) / CURVE_SAMPLES
          if (w <= 0) continue
          const h = cap / w
          if (h >= 0 && h <= yMax) pts.push([w, h])
        }
        return {
          name: f.label,
          type: 'line',
          data: pts,
          showSymbol: false,
          smooth: false,
          clip: true,
          lineStyle: { color: f.color, width: 1.5, type: 'dashed' },
          emphasis: { disabled: true },
          tooltip: { show: false },
          z: 1,
        }
      })
    : []

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
      ? {
          data: FORMATS.map((f) => f.label),
          top: 4,
          right: 8,
          itemWidth: 18,
          itemHeight: 8,
          textStyle: { fontSize: 10, color: '#6b7280' },
        }
      : undefined,
    grid: {
      left: 80,
      right: 30,
      top: showLimit ? 40 : 30,
      bottom: 70,
    },
    xAxis: {
      type: 'value',
      min: 0,
      name: xFieldName,
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { color: '#4b5563', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
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
        emphasis: {
          itemStyle: {
            color: '#1f3a8a',
            opacity: 1,
            shadowBlur: 6,
            shadowColor: 'rgba(31, 58, 138, 0.5)',
          },
        },
        z: 2,
      },
      ...limitSeries,
    ],
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
          <input type="checkbox" checked={showLimit} onChange={(e) => setShowLimit(e.target.checked)} />
          {t('results.dualRegister.resourceLimit')}
        </label>
      </div>
      <ReactECharts
        key={showLimit ? 'limit-on' : 'limit-off'}
        option={option}
        style={{ height: 420, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
