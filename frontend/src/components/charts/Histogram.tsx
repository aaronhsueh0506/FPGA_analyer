import ReactECharts from 'echarts-for-react'

interface Props {
  title: string
  values: number[]
  maxValue: number
  minValue?: number
  interpretAs?: 'int' | 'fp32'
}

const BIN_COUNT = 20

function safeMax(maxValue: number): number {
  if (maxValue >= 0xffffffff) return 0xffffffff
  if (maxValue < 0) return 0
  return maxValue
}

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

export default function Histogram({ title, values, maxValue: rawMaxValue, minValue = 0, interpretAs = 'int' }: Props) {
  const maxValue = safeMax(rawMaxValue)
  if (values.length === 0) {
    return (
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 6,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
          }}
        >
          {title}
        </div>
        <div className="empty-state">No data</div>
      </div>
    )
  }

  const total = values.length
  let labels: string[] = []
  let counts: number[] = []

  if (interpretAs === 'fp32') {
    const floatValues = values.map(v => int32ToFloat32(v))
    const finite = floatValues.filter(f => isFinite(f))
    if (finite.length === 0) {
      labels = ['NaN/Inf']
      counts = [values.length]
    } else {
      const fMin = Math.min(...finite)
      const fMax = Math.max(...finite)
      const fRange = fMax - fMin || 1
      const step = fRange / BIN_COUNT
      counts = new Array(BIN_COUNT).fill(0)
      labels = []
      for (let i = 0; i < BIN_COUNT; i++) {
        const lo = fMin + step * i
        const hi = i === BIN_COUNT - 1 ? fMax : fMin + step * (i + 1)
        labels.push(`${formatFloat(lo)}~${formatFloat(hi)}`)
      }
      for (const f of floatValues) {
        if (!isFinite(f)) continue
        let idx = Math.floor(((f - fMin) / fRange) * BIN_COUNT)
        idx = Math.max(0, Math.min(BIN_COUNT - 1, idx))
        counts[idx]++
      }
    }
  } else if (maxValue <= 20) {
    const size = maxValue + 1
    counts = new Array(size).fill(0)
    labels = []
    for (let i = 0; i < size; i++) {
      labels.push(String(i))
    }
    for (const v of values) {
      const idx = Math.max(0, Math.min(size - 1, v))
      counts[idx]++
    }
  } else {
    counts = new Array(BIN_COUNT).fill(0)
    labels = []
    const range = maxValue - minValue || 1
    const step = range / BIN_COUNT
    for (let i = 0; i < BIN_COUNT; i++) {
      const lo = minValue + step * i
      const hi = i === BIN_COUNT - 1 ? maxValue : minValue + step * (i + 1)
      labels.push(`${Math.round(lo)}-${Math.round(hi)}`)
    }
    for (const v of values) {
      let idx = Math.floor(((v - minValue) / range) * BIN_COUNT)
      if (idx >= BIN_COUNT) idx = BIN_COUNT - 1
      if (idx < 0) idx = 0
      counts[idx]++
    }
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        const label = p.name
        const count = p.value as number
        const pct = ((count / total) * 100).toFixed(1)
        return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;">
          <div><b>${label}</b>: ${count} (${pct}%)</div>
        </div>`
      }
    },
    grid: {
      left: 50,
      right: 20,
      top: 20,
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
        type: 'bar',
        data: counts,
        itemStyle: { color: '#1f3a8a' },
        emphasis: {
          itemStyle: {
            color: '#1f3a8a',
            shadowBlur: 4,
            shadowColor: 'rgba(31, 58, 138, 0.4)'
          }
        },
        barCategoryGap: '10%'
      }
    ]
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
        }}
      >
        {title}
      </div>
      <ReactECharts
        option={option}
        style={{ height: 220, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
}
