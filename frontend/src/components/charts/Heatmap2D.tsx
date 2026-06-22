import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactECharts from 'echarts-for-react'
import {
  computeAxisStats,
  planAxisWithDensity,
  buildAxisBins,
  decideMode,
  percentileCap,
  GRID_MAX_PERAX,
  GRID_MAX_CELLS,
  LABEL_CELL_MAX,
  SMOOTH_TARGET,
  BLUR_TARGET,
  type Density,
} from './heatmapData'

const GRID = { left: 110, right: 80, top: 24, bottom: 100 }
// low (few) -> high (many): deep blue ... red
const BLUE_RED = ['#1f3a8a', '#2563eb', '#22d3ee', '#34d399', '#fde047', '#fb923c', '#ef4444']

const TIP_STYLE = 'font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;'

type RenderMode = 'auto' | 'grid' | 'fine' | 'blur'
type Cap = 100 | 95 | 90 | 80

const MODE_OPTIONS: RenderMode[] = ['auto', 'grid', 'fine', 'blur']
const MODE_LABEL: Record<RenderMode, string> = {
  auto: 'modeAuto',
  grid: 'modeGrid',
  fine: 'modeFine',
  blur: 'modeBlur',
}
const DENSITY_OPTIONS: Density[] = ['auto', 'fine', 'coarse', 'coarser']
const DENSITY_LABEL: Record<Density, string> = {
  auto: 'densityAuto',
  fine: 'densityFine',
  coarse: 'densityCoarse',
  coarser: 'densityCoarser',
}
const CAP_OPTIONS: Cap[] = [100, 95, 90, 80]

interface Props {
  rows: Array<{ testCase: string; values: number[] }>
  xFieldIndex: number
  yFieldIndex: number
  xFieldName: string
  yFieldName: string
  caseRange: { from: number; to: number }
  xFieldWidth?: number
  yFieldWidth?: number
}

export default function Heatmap2D({
  rows,
  xFieldIndex,
  yFieldIndex,
  xFieldName,
  yFieldName,
  caseRange,
  xFieldWidth,
  yFieldWidth,
}: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<RenderMode>('auto')
  const [cap, setCap] = useState<Cap>(95)
  const [density, setDensity] = useState<Density>('auto')
  const hmContainerRef = useRef<HTMLDivElement>(null)

  // a new axis / case range invalidates a manual density choice
  useEffect(() => {
    setDensity('auto')
  }, [xFieldIndex, yFieldIndex, caseRange.from, caseRange.to])

  // ---- shared data pipeline ----
  const fromIdx = Math.max(0, caseRange.from - 1)
  const toIdx = Math.min(rows.length, caseRange.to)
  const slicedRows = rows.slice(fromIdx, toIdx)

  const pairs: Array<[number, number]> = []
  for (const r of slicedRows) {
    const x = r.values[xFieldIndex]
    const y = r.values[yFieldIndex]
    if (
      x == null || y == null ||
      !Number.isFinite(x) || !Number.isFinite(y) ||
      x < 0 || y < 0
    ) continue
    pairs.push([x, y])
  }
  const total = pairs.length

  const statsX = computeAxisStats(pairs.map((p) => p[0]), xFieldWidth)
  const statsY = computeAxisStats(pairs.map((p) => p[1]), yFieldWidth)

  const effectiveMode: 'grid' | 'fine' | 'blur' =
    mode === 'auto' ? decideMode(statsX.distinct, statsY.distinct) : mode

  const target =
    effectiveMode === 'fine' ? SMOOTH_TARGET : effectiveMode === 'blur' ? BLUR_TARGET : GRID_MAX_PERAX

  const binsX = buildAxisBins(planAxisWithDensity(statsX, target, density))
  const binsY = buildAxisBins(planAxisWithDensity(statsY, target, density))

  const cellCounts = new Map<string, number>()
  for (const [x, y] of pairs) {
    const xi = binsX.indexOf(x)
    const yi = binsY.indexOf(y)
    if (xi < 0 || yi < 0) continue
    cellCounts.set(xi + ',' + yi, (cellCounts.get(xi + ',' + yi) ?? 0) + 1)
  }

  const heatData: Array<[number, number, number]> = []
  let maxCount = 0
  cellCounts.forEach((c, key) => {
    const [xi, yi] = key.split(',').map(Number)
    heatData.push([xi, yi, c])
    if (c > maxCount) maxCount = c
  })

  const cappedMax = Math.max(1, percentileCap(heatData.map((d) => d[2]), cap))
  const isCapped = cappedMax < maxCount

  // value-domain for the blurred (heatmap.js) coordinate mapping
  const xCatVals = binsX.values
  const yCatVals = binsY.values
  const xMinV = xCatVals.length ? xCatVals[0] : 0
  const xMaxV = xCatVals.length ? xCatVals[xCatVals.length - 1] : 1
  const yMinV = yCatVals.length ? yCatVals[0] : 0
  const yMaxV = yCatVals.length ? yCatVals[yCatVals.length - 1] : 1
  const xRangeV = xMaxV - xMinV || 1
  const yRangeV = yMaxV - yMinV || 1

  // ---- heatmap.js blob (blur mode only) ----
  useEffect(() => {
    if (effectiveMode !== 'blur') return
    if (typeof h337 === 'undefined') return
    const container = hmContainerRef.current
    if (!container || heatData.length === 0) return
    const W = container.offsetWidth
    const H = container.offsetHeight
    if (W === 0 || H === 0) return

    const xCells = xCatVals.length
    const yCells = yCatVals.length
    const xSpacing = xCells > 1 ? W / (xCells - 1) : W
    const ySpacing = yCells > 1 ? H / (yCells - 1) : H
    // overlapping kernels -> smooth KDE field (the v0.42 look); the percentile
    // cap (not raw max) handles the colour so it no longer washes out to all-red
    const radius = Math.max(8, Math.min(Math.max(xSpacing, ySpacing) * 1.2, Math.min(W, H) * 0.08))

    container.innerHTML = ''
    const hm = h337.create({ container, maxOpacity: 0.9, minOpacity: 0, blur: 0.65, radius })
    hm.setData({
      max: cappedMax,
      data: heatData.map(([xi, yi, c]) => ({
        x: Math.round(((xCatVals[xi] - xMinV) / xRangeV) * W),
        y: Math.round(H - ((yCatVals[yi] - yMinV) / yRangeV) * H),
        value: c,
      })),
    })
    return () => {
      container.innerHTML = ''
    }
  })

  const renderControls = () => (
    <div className="toolbar" style={{ marginBottom: 12 }}>
      <div className="group">
        <label>{t('results.dualRegister.renderMode')}</label>
        <div className="inline-toggle">
          {MODE_OPTIONS.map((m) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {t('results.dualRegister.' + MODE_LABEL[m])}
            </button>
          ))}
        </div>
      </div>
      <div className="divider" />
      <div className="group">
        <label>{t('results.dualRegister.density')}</label>
        <div className="inline-toggle">
          {DENSITY_OPTIONS.map((d) => (
            <button key={d} className={density === d ? 'active' : ''} onClick={() => setDensity(d)}>
              {t('results.dualRegister.' + DENSITY_LABEL[d])}
            </button>
          ))}
        </div>
      </div>
      <div className="divider" />
      <div className="group">
        <label>{t('results.dualRegister.cap')}</label>
        <div className="inline-toggle">
          {CAP_OPTIONS.map((c) => (
            <button key={c} className={cap === c ? 'active' : ''} onClick={() => setCap(c)}>
              {c}%
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (total === 0) {
    return (
      <div>
        {renderControls()}
        <div className="empty-state">{t('results.noDataInRange')}</div>
      </div>
    )
  }

  const pxPerRow = effectiveMode === 'grid' ? 22 : 12
  const height = Math.max(420, Math.min(900, binsY.values.length * pxPerRow + 200))

  // ---- blurred (heatmap.js) branch: invisible value-axis scatter + h337 overlay ----
  if (effectiveMode === 'blur') {
    const scatterData = heatData.map(([xi, yi, c]) => [xCatVals[xi], yCatVals[yi], c])
    const blurOption = {
      tooltip: {
        trigger: 'item',
        position: 'top',
        formatter: (params: any) => {
          const [x, y, c] = params.value as [number, number, number]
          const pct = ((c / total) * 100).toFixed(1)
          const xLab = binsX.step > 0 ? `${x}-${x + binsX.step - 1}` : `${x}`
          const yLab = binsY.step > 0 ? `${y}-${y + binsY.step - 1}` : `${y}`
          return `<div style="${TIP_STYLE}">
            <div><b>X (${xFieldName}) = ${xLab}</b></div>
            <div>Y (${yFieldName}) = ${yLab}</div>
            <div>Count: ${c} (${pct}%)</div>
          </div>`
        },
      },
      grid: GRID,
      xAxis: {
        type: 'value', min: xMinV, max: xMaxV, name: xFieldName,
        nameLocation: 'middle', nameGap: 55, nameTextStyle: { color: '#374151', fontSize: 12 },
        axisLabel: { rotate: 45, fontSize: 10, color: '#4b5563' }, axisTick: { show: false },
      },
      yAxis: {
        type: 'value', min: yMinV, max: yMaxV, name: yFieldName,
        nameLocation: 'middle', nameGap: 85, nameTextStyle: { color: '#374151', fontSize: 12 },
        axisLabel: { fontSize: 10, color: '#4b5563' }, axisTick: { show: false },
      },
      series: [{ type: 'scatter', data: scatterData, symbolSize: 8, itemStyle: { opacity: 0 }, emphasis: { disabled: true } }],
    }

    return (
      <div>
        {renderControls()}
        <div style={{ position: 'relative' }}>
          <ReactECharts option={blurOption} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />
          <div style={{
            position: 'absolute', left: GRID.left, top: GRID.top, right: GRID.right, bottom: GRID.bottom,
            pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div ref={hmContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{
            position: 'absolute', right: 5, top: GRID.top, bottom: GRID.bottom, width: 14,
            background: 'linear-gradient(to top, transparent, #0000ff 25%, #00ffff 50%, #00ff00 65%, #ffff00 80%, #ff0000 100%)',
            borderRadius: 2, pointerEvents: 'none',
          }}>
            <span style={{ position: 'absolute', top: -14, left: 0, fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap' }}>
              {cappedMax}{isCapped ? '+' : ''}
            </span>
            <span style={{ position: 'absolute', bottom: -14, left: 0, fontSize: 9, color: '#6b7280' }}>0</span>
          </div>
        </div>
      </div>
    )
  }

  // ---- ECharts native heatmap branch (grid / fine) ----
  const showLabels = effectiveMode === 'grid' && heatData.length <= LABEL_CELL_MAX
  const xLabels = binsX.values.map(String)
  const yLabels = binsY.values.map(String)

  const option = {
    animation: false,
    tooltip: {
      trigger: 'item',
      position: 'top',
      formatter: (params: any) => {
        const [xi, yi, c] = params.value as [number, number, number]
        const xv = binsX.values[xi]
        const yv = binsY.values[yi]
        const xLab = binsX.step > 0 ? `${xv}-${xv + binsX.step - 1}` : `${xv}`
        const yLab = binsY.step > 0 ? `${yv}-${yv + binsY.step - 1}` : `${yv}`
        const pct = ((c / total) * 100).toFixed(1)
        return `<div style="${TIP_STYLE}">
          <div><b>X (${xFieldName}) = ${xLab}</b></div>
          <div>Y (${yFieldName}) = ${yLab}</div>
          <div>Count: ${c} (${pct}%)</div>
        </div>`
      },
    },
    grid: GRID,
    xAxis: {
      type: 'category',
      data: xLabels,
      name: xFieldName,
      nameLocation: 'middle',
      nameGap: 55,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: {
        rotate: 45, fontSize: 10, color: '#4b5563',
        interval: xLabels.length > 30 ? Math.ceil(xLabels.length / 30) : 0,
      },
      axisTick: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      name: yFieldName,
      nameLocation: 'middle',
      nameGap: 85,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: {
        fontSize: 10, color: '#4b5563',
        interval: yLabels.length > 40 ? Math.ceil(yLabels.length / 40) : 0,
      },
      axisTick: { show: false },
      splitArea: { show: false },
    },
    visualMap: {
      type: 'continuous',
      show: true,
      min: 0,
      max: cappedMax,
      calculable: true,
      orient: 'vertical',
      right: 8,
      top: GRID.top,
      itemHeight: 140,
      text: [isCapped ? `${cappedMax}+` : `${cappedMax}`, '0'],
      textStyle: { color: '#6b7280', fontSize: 9 },
      inRange: { color: BLUE_RED },
    },
    series: [
      {
        type: 'heatmap',
        data: heatData,
        progressive: heatData.length > 3000 ? 1000 : 0,
        progressiveThreshold: 3000,
        label: {
          show: showLabels,
          fontSize: 9,
          color: '#111827',
          formatter: (p: any) => String((p.value as any[])[2]),
        },
        itemStyle: {
          borderColor: effectiveMode === 'grid' ? '#ffffff' : 'transparent',
          borderWidth: effectiveMode === 'grid' ? 1 : 0,
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' } },
      },
    ],
  }

  return (
    <div>
      {renderControls()}
      <ReactECharts
        key={`${effectiveMode}-${cap}-${density}-${xLabels.length}x${yLabels.length}`}
        option={option}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
