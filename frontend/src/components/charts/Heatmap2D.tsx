import { useEffect, useRef } from 'react'
import ReactECharts from 'echarts-for-react'

const GRID = { left: 110, right: 65, top: 20, bottom: 100 }
const QUANT_STEP = 1

function quantize(v: number): number {
  return Math.round(v / QUANT_STEP) * QUANT_STEP
}

interface Props {
  rows: Array<{ testCase: string; values: number[] }>
  xFieldIndex: number
  yFieldIndex: number
  xFieldName: string
  yFieldName: string
  caseRange: { from: number; to: number }
}

export default function Heatmap2D({
  rows,
  xFieldIndex,
  yFieldIndex,
  xFieldName,
  yFieldName,
  caseRange
}: Props) {
  const hmContainerRef = useRef<HTMLDivElement>(null)

  const fromIdx = Math.max(0, caseRange.from - 1)
  const toIdx = Math.min(rows.length, caseRange.to)
  const slicedRows = rows.slice(fromIdx, toIdx)

  const xValues = slicedRows.map((r) => r.values[xFieldIndex] ?? 0)
  const yValues = slicedRows.map((r) => r.values[yFieldIndex] ?? 0)

  const counts = new Map<string, number>()
  for (let i = 0; i < slicedRows.length; i++) {
    const qx = quantize(xValues[i])
    const qy = quantize(yValues[i])
    const key = `${qx},${qy}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const data: Array<[number, number, number]> = []
  let maxCount = 0
  counts.forEach((count, key) => {
    const [x, y] = key.split(',').map(Number)
    data.push([x, y, count])
    if (count > maxCount) maxCount = count
  })

  const allQX = data.map(([x]) => x)
  const allQY = data.map(([, y]) => y)
  const xMin = allQX.length ? Math.min(...allQX) : 0
  const xMax = allQX.length ? Math.max(...allQX) : 1
  const yMin = allQY.length ? Math.min(...allQY) : 0
  const yMax = allQY.length ? Math.max(...allQY) : 1
  const xRange = xMax - xMin || 1
  const yRange = yMax - yMin || 1
  const uniqueX = Array.from(new Set(allQX))
  const uniqueY = Array.from(new Set(allQY))

  const total = slicedRows.length

  useEffect(() => {
    const container = hmContainerRef.current
    if (!container || data.length === 0) return

    const W = container.offsetWidth
    const H = container.offsetHeight
    if (W === 0 || H === 0) return

    const xSpacing = uniqueX.length > 1 ? W / (uniqueX.length - 1) : W
    const ySpacing = uniqueY.length > 1 ? H / (uniqueY.length - 1) : H
    const radius = Math.min(
      Math.max(xSpacing, ySpacing) * 0.8,
      Math.min(W, H) * 0.15
    )

    container.innerHTML = ''
    const hm = h337.create({ container, maxOpacity: 0.9, minOpacity: 0, blur: 0.15, radius })
    hm.setData({
      max: maxCount,
      data: data.map(([x, y, count]) => ({
        x: Math.round((x - xMin) / xRange * W),
        y: Math.round(H - (y - yMin) / yRange * H),
        value: count
      }))
    })
  })

  if (slicedRows.length === 0) {
    return <div className="empty-state">No data in selected range</div>
  }

  const option = {
    visualMap: {
      show: false,
      min: 0,
      max: maxCount || 1
    },
    tooltip: {
      trigger: 'item',
      position: 'top',
      formatter: (params: any) => {
        const [x, y, count] = params.value as [number, number, number]
        const pct = ((count / total) * 100).toFixed(1)
        return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;">
          <div><b>X (${xFieldName}) = ${x}</b></div>
          <div>Y (${yFieldName}) = ${y}</div>
          <div>Count: ${count} (${pct}%)</div>
        </div>`
      }
    },
    grid: GRID,
    xAxis: {
      type: 'value',
      min: xMin,
      max: xMax,
      name: xFieldName,
      nameLocation: 'middle',
      nameGap: 55,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { rotate: 45, fontSize: 10, color: '#4b5563' },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      name: yFieldName,
      nameLocation: 'middle',
      nameGap: 85,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { fontSize: 10, color: '#4b5563' },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'scatter',
        data,
        symbolSize: 8,
        itemStyle: { opacity: 0 },
        emphasis: { disabled: true }
      }
    ]
  }

  const height = Math.max(420, Math.min(900, uniqueY.length * 14 + 200))

  return (
    <div style={{ position: 'relative' }}>
      <ReactECharts
        option={option}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
      <div
        style={{
          position: 'absolute',
          left: GRID.left,
          top: GRID.top,
          right: GRID.right,
          bottom: GRID.bottom,
          pointerEvents: 'none',
          overflow: 'hidden'
        }}
      >
        <div ref={hmContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <div style={{
        position: 'absolute',
        right: 5,
        top: GRID.top,
        bottom: GRID.bottom,
        width: 14,
        background: 'linear-gradient(to top, transparent, #0000ff 25%, #00ffff 50%, #00ff00 65%, #ffff00 80%, #ff0000 100%)',
        borderRadius: 2,
        pointerEvents: 'none'
      }}>
        <span style={{
          position: 'absolute', top: -14, left: 0,
          fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap'
        }}>{maxCount}</span>
        <span style={{
          position: 'absolute', bottom: -14, left: 0,
          fontSize: 9, color: '#6b7280'
        }}>0</span>
        <span style={{
          position: 'absolute', top: '50%', left: -20,
          fontSize: 9, color: '#6b7280',
          transform: 'rotate(-90deg) translateX(-50%)',
          transformOrigin: 'right center',
          whiteSpace: 'nowrap'
        }}>Count</span>
      </div>
    </div>
  )
}
