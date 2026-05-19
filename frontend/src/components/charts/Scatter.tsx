import ReactECharts from 'echarts-for-react'

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
  caseRange
}: Props) {
  const fromIdx = Math.max(0, caseRange.from - 1)
  const toIdx = Math.min(rows.length, caseRange.to)
  const slicedRows = rows.slice(fromIdx, toIdx)

  if (slicedRows.length === 0) {
    return <div className="empty-state">No data in selected range</div>
  }

  const data = slicedRows.map((r) => ({
    name: r.testCase,
    value: [r.values[xFieldIndex] ?? 0, r.values[yFieldIndex] ?? 0]
  }))

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const testCase = params.data?.name ?? ''
        const [x, y] = params.value as [number, number]
        return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;">
          <div><b>${testCase}</b></div>
          <div>X (${xFieldName}) = ${x}</div>
          <div>Y (${yFieldName}) = ${y}</div>
        </div>`
      }
    },
    grid: {
      left: 80,
      right: 30,
      top: 30,
      bottom: 70
    },
    xAxis: {
      type: 'value',
      name: xFieldName,
      nameLocation: 'middle',
      nameGap: 35,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { color: '#4b5563', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } }
    },
    yAxis: {
      type: 'value',
      name: yFieldName,
      nameLocation: 'middle',
      nameGap: 55,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { color: '#4b5563', fontSize: 10 },
      splitLine: { lineStyle: { color: '#e5e7eb' } }
    },
    series: [
      {
        type: 'scatter',
        data,
        symbolSize: 6,
        itemStyle: {
          color: '#1f3a8a',
          opacity: 0.55
        },
        emphasis: {
          itemStyle: {
            color: '#1f3a8a',
            opacity: 1,
            shadowBlur: 6,
            shadowColor: 'rgba(31, 58, 138, 0.5)'
          }
        }
      }
    ]
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 420, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  )
}
