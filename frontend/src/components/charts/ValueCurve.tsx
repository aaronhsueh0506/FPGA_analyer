import ReactECharts from 'echarts-for-react'

interface Props {
  values: number[]
  interpretAs?: 'int' | 'fp32'
}

const CURVE_BIN_THRESHOLD = 50
const CURVE_BIN_COUNT = 30

function int32ToFloat32(raw: number): number {
  const buf = new ArrayBuffer(4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  u32[0] = raw >>> 0
  return f32[0]
}

function formatFloat(f: number): string {
  if (!isFinite(f)) return 'NaN/Inf'
  if (f === 0) return '0'
  const abs = Math.abs(f)
  if (abs >= 1e-2 && abs < 1e5) return f.toPrecision(3)
  return f.toExponential(2)
}

export default function ValueCurve({ values, interpretAs = 'int' }: Props) {
  if (values.length === 0) {
    return <div className="empty-state">No data</div>
  }

  const freqMap = new Map<number, number>()
  for (const v of values) freqMap.set(v, (freqMap.get(v) ?? 0) + 1)

  let labels: string[]
  let counts: number[]

  if (interpretAs === 'fp32') {
    const entries: Array<[float: number, count: number]> = []
    freqMap.forEach((count, raw) => {
      entries.push([int32ToFloat32(raw), count])
    })
    entries.sort((a, b) => a[0] - b[0])

    if (entries.length > CURVE_BIN_THRESHOLD) {
      const finite = entries.filter(([f]) => isFinite(f))
      if (finite.length === 0) {
        labels = ['NaN/Inf']
        counts = [values.length]
      } else {
        const fMin = finite[0][0], fMax = finite[finite.length - 1][0]
        const fRange = fMax - fMin || 1
        const binLabels: string[] = []
        const binCounts: number[] = new Array(CURVE_BIN_COUNT).fill(0)
        for (let i = 0; i < CURVE_BIN_COUNT; i++) {
          const lo = fMin + (fRange / CURVE_BIN_COUNT) * i
          const hi = i === CURVE_BIN_COUNT - 1 ? fMax : fMin + (fRange / CURVE_BIN_COUNT) * (i + 1)
          binLabels.push(`${formatFloat(lo)}~${formatFloat(hi)}`)
        }
        for (const [f, c] of entries) {
          if (!isFinite(f)) continue
          let idx = Math.floor(((f - fMin) / fRange) * CURVE_BIN_COUNT)
          idx = Math.max(0, Math.min(CURVE_BIN_COUNT - 1, idx))
          binCounts[idx] += c
        }
        labels = binLabels
        counts = binCounts
      }
    } else {
      labels = entries.map(([f]) => formatFloat(f))
      counts = entries.map(([, c]) => c)
    }
  } else {
    const entries = [...freqMap.entries()].sort((a, b) => a[0] - b[0])

    if (entries.length > CURVE_BIN_THRESHOLD) {
      const vals = entries.map(([v]) => v)
      const min = vals[0], max = vals[vals.length - 1]
      const range = max - min || 1
      const binLabels: string[] = []
      const binCounts: number[] = new Array(CURVE_BIN_COUNT).fill(0)
      for (let i = 0; i < CURVE_BIN_COUNT; i++) {
        const lo = min + (range / CURVE_BIN_COUNT) * i
        const hi = i === CURVE_BIN_COUNT - 1 ? max : min + (range / CURVE_BIN_COUNT) * (i + 1)
        binLabels.push(`${Math.round(lo)}-${Math.round(hi)}`)
      }
      for (const [v, c] of entries) {
        let idx = Math.floor(((v - min) / range) * CURVE_BIN_COUNT)
        idx = Math.max(0, Math.min(CURVE_BIN_COUNT - 1, idx))
        binCounts[idx] += c
      }
      labels = binLabels
      counts = binCounts
    } else {
      labels = entries.map(([v]) => String(v))
      counts = entries.map(([, c]) => c)
    }
  }

  const total = values.length
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        const count = p.value as number
        const pct = ((count / total) * 100).toFixed(1)
        return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;">
          <div><b>${p.name}</b>: ${count} (${pct}%)</div>
        </div>`
      }
    },
    grid: {
      left: 50,
      right: 20,
      top: 16,
      bottom: labels.length > 12 ? 80 : 50
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        color: '#4b5563',
        fontSize: 10,
        rotate: labels.length > 12 ? 45 : 0
      },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#4b5563', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } }
    },
    series: [
      {
        type: 'line',
        data: counts,
        smooth: true,
        symbol: labels.length <= 50 ? 'circle' : 'none',
        symbolSize: 4,
        lineStyle: { color: '#1f3a8a', width: 2 },
        itemStyle: { color: '#1f3a8a' },
        areaStyle: { color: '#1f3a8a', opacity: 0.12 }
      }
    ]
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 200, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  )
}
