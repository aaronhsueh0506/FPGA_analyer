import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactECharts from 'echarts-for-react'
import {
  computeAxisStats,
  buildBins,
  binRange,
  percentileCap,
  limitCurve,
  FORMATS,
  GRID_MAX_PERAX,
  LABEL_CELL_MAX,
  BLUR_TARGET,
  type Density,
} from './heatmapData'

const GRID = { left: 110, right: 80, top: 24, bottom: 100 }
// low (few) -> high (many): deep blue ... red
const BLUE_RED = ['#1f3a8a', '#2563eb', '#22d3ee', '#34d399', '#fde047', '#fb923c', '#ef4444']
const TIP_STYLE = 'font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5;'

type RenderMode = 'auto' | 'grid' | 'blur'
type Cap = 100 | 95 | 90 | 80

const MODE_OPTIONS: RenderMode[] = ['auto', 'grid', 'blur']
const MODE_LABEL: Record<RenderMode, string> = { auto: 'modeAuto', grid: 'modeGrid', blur: 'modeBlur' }
const DENSITY_OPTIONS: Density[] = ['auto', 'fine', 'coarse', 'coarser']
const DENSITY_LABEL: Record<Density, string> = { auto: 'densityAuto', fine: 'densityFine', coarse: 'densityCoarse', coarser: 'densityCoarser' }
const CAP_OPTIONS: Cap[] = [100, 95, 90, 80]

// in-cell count number font is user-adjustable; axis tick labels stay fixed
const COUNT_FONT_MIN = 6
const COUNT_FONT_MAX = 28
const COUNT_FONT_DEFAULT = 10 // approx. prior "M" in-cell size, keeps the look
const AXIS_FONT_PX = 10 // axis tick labels fixed (pre-v0.43.1 behaviour)
const clampFont = (n: number) => Math.min(COUNT_FONT_MAX, Math.max(COUNT_FONT_MIN, Math.round(n)))

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
  const [showLimit, setShowLimit] = useState(true)
  const [countFont, setCountFont] = useState<number>(COUNT_FONT_DEFAULT)
  const [showNumbers, setShowNumbers] = useState(true)
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
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) continue
    pairs.push([x, y])
  }
  const total = pairs.length

  const statsX = computeAxisStats(pairs.map((p) => p[0]), xFieldWidth)
  const statsY = computeAxisStats(pairs.map((p) => p[1]), yFieldWidth)

  // grid already adapts (exact cells for few values, binned for many), so auto -> grid
  const effectiveMode: 'grid' | 'blur' = mode === 'auto' ? 'grid' : mode

  const target = effectiveMode === 'blur' ? BLUR_TARGET : GRID_MAX_PERAX

  const binsX = buildBins(statsX, target, 'linear', density)
  const binsY = buildBins(statsY, target, 'linear', density)

  const cellCounts = new Map<string, number>()
  for (const [x, y] of pairs) {
    const xi = binsX.indexOf(x)
    const yi = binsY.indexOf(y)
    if (xi < 0 || yi < 0) continue
    cellCounts.set(xi + ',' + yi, (cellCounts.get(xi + ',' + yi) ?? 0) + 1)
  }

  let maxCount = 0
  const rawCells: Array<[number, number, number]> = []
  cellCounts.forEach((c, key) => {
    const [xi, yi] = key.split(',').map(Number)
    rawCells.push([xi, yi, c])
    if (c > maxCount) maxCount = c
  })

  const cappedMax = Math.max(1, percentileCap(rawCells.map((d) => d[2]), cap))
  const isCapped = cappedMax < maxCount
  // log color so low counts are visible and distinct from empty (0) cells
  const logMaxColor = Math.log1p(cappedMax)
  // heatData carries log(count) for colour; real count recovered via expm1 in formatters
  const heatData = rawCells.map(([xi, yi, c]) => [xi, yi, Math.log1p(c)])

  // limit overlay only when both axes are uniformly mapped (so a value axis aligns to the grid)
  const canOverlayLimit = showLimit && binsX.uniform && binsY.uniform && rawCells.length > 0
  const limitSeries = canOverlayLimit
    ? FORMATS.map((f) => ({
        name: f.label,
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: limitCurve(f.bytes, binsX.lo, binsX.hi, binsY.lo, binsY.hi, 'linear'),
        showSymbol: false,
        smooth: false,
        clip: true,
        silent: true,
        lineStyle: { color: f.color, width: 1.5, type: 'dashed' },
        z: 5,
      }))
    : []

  // value-domain for the blurred (heatmap.js) coordinate mapping
  const loX = binsX.lo
  const hiX = Math.max(binsX.hi, loX + 1)
  const loY = binsY.lo
  const hiY = Math.max(binsY.hi, loY + 1)

  const toFrac = (v: number, lo: number, hi: number) => (v - lo) / (hi - lo)

  // ---- heatmap.js blob (blur mode only) ----
  useEffect(() => {
    if (effectiveMode !== 'blur') return
    if (typeof h337 === 'undefined') return
    const container = hmContainerRef.current
    if (!container || rawCells.length === 0) return
    const W = container.offsetWidth
    const H = container.offsetHeight
    if (W === 0 || H === 0) return

    const xCells = binsX.labels.length
    const yCells = binsY.labels.length
    const xSpacing = xCells > 1 ? W / (xCells - 1) : W
    const ySpacing = yCells > 1 ? H / (yCells - 1) : H
    // overlapping kernels -> smooth KDE field; percentile cap keeps colour from washing out
    const radius = Math.max(8, Math.min(Math.max(xSpacing, ySpacing) * 1.2, Math.min(W, H) * 0.08))

    container.innerHTML = ''
    // minOpacity > 0 so sparse density stays visible and distinguishable from empty
    const hm = h337.create({ container, maxOpacity: 0.92, minOpacity: 0.08, blur: 0.7, radius })
    hm.setData({
      max: logMaxColor,
      data: rawCells.map(([xi, yi, c]) => ({
        x: Math.round(toFrac(binsX.labels[xi], loX, hiX) * W),
        y: Math.round(H - toFrac(binsY.labels[yi], loY, hiY) * H),
        value: Math.log1p(c),
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
      <div className="group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
          {t('results.dualRegister.showNumbers')}
        </label>
        <div className="inline-toggle" style={{ opacity: showNumbers ? 1 : 0.4 }}>
          <button disabled={!showNumbers} onClick={() => setCountFont((v) => clampFont(v - 1))}>−</button>
          <input
            type="number"
            min={COUNT_FONT_MIN}
            max={COUNT_FONT_MAX}
            value={countFont}
            disabled={!showNumbers}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (e.target.value !== '' && Number.isFinite(n)) setCountFont(clampFont(n))
            }}
            style={{ width: 44, textAlign: 'center', padding: '5px 4px', border: 'none', borderLeft: '1px solid var(--border-strong)', borderRight: '1px solid var(--border-strong)' }}
          />
          <button disabled={!showNumbers} onClick={() => setCountFont((v) => clampFont(v + 1))}>＋</button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>px</span>
      </div>
      <div className="group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={showLimit} onChange={(e) => setShowLimit(e.target.checked)} />
          {t('results.dualRegister.resourceLimit')}
        </label>
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

  const pxPerRow = effectiveMode === 'grid' ? 24 : 14
  const height = Math.max(480, Math.min(860, binsY.labels.length * pxPerRow + 220))

  // ---- blurred (heatmap.js) branch: invisible value-axis scatter + h337 overlay ----
  if (effectiveMode === 'blur') {
    const scatterData = rawCells.map(([xi, yi, c]) => [binsX.labels[xi], binsY.labels[yi], c])
    const axisType = 'value'
    const blurLimit = showLimit
      ? FORMATS.map((f) => ({
          name: f.label,
          type: 'line',
          data: limitCurve(f.bytes, loX, hiX, loY, hiY, 'linear'),
          showSymbol: false,
          clip: true,
          silent: true,
          lineStyle: { color: f.color, width: 1.5, type: 'dashed' },
          z: 5,
        }))
      : []
    const blurOption = {
      legend: showLimit ? { data: FORMATS.map((f) => f.label), top: 4, left: 'center', itemWidth: 18, itemHeight: 8, textStyle: { fontSize: 10, color: '#6b7280' } } : undefined,
      tooltip: {
        trigger: 'item',
        position: 'top',
        formatter: (params: any) => {
          if (params.seriesType !== 'scatter') return ''
          const [x, y, c] = params.value as [number, number, number]
          const pct = ((c / total) * 100).toFixed(1)
          return `<div style="${TIP_STYLE}">
            <div><b>X (${xFieldName}) = ${x}</b></div>
            <div>Y (${yFieldName}) = ${y}</div>
            <div>Count: ${c} (${pct}%)</div>
          </div>`
        },
      },
      grid: { ...GRID, top: showLimit ? 40 : GRID.top },
      xAxis: { type: axisType, min: loX, max: hiX, name: xFieldName, nameLocation: 'middle', nameGap: 55, nameTextStyle: { color: '#374151', fontSize: 12 }, axisLabel: { rotate: 45, fontSize: AXIS_FONT_PX, color: '#4b5563' }, axisTick: { show: false } },
      yAxis: { type: axisType, min: loY, max: hiY, name: yFieldName, nameLocation: 'middle', nameGap: 85, nameTextStyle: { color: '#374151', fontSize: 12 }, axisLabel: { fontSize: AXIS_FONT_PX, color: '#4b5563' }, axisTick: { show: false } },
      series: [{ type: 'scatter', data: scatterData, symbolSize: 8, itemStyle: { opacity: 0 }, emphasis: { disabled: true }, z: 2 }, ...blurLimit],
    }

    return (
      <div>
        {renderControls()}
        <div style={{ position: 'relative' }}>
          <ReactECharts key={`blur-${showLimit}`} option={blurOption} style={{ height, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />
          <div style={{ position: 'absolute', left: GRID.left, top: showLimit ? 40 : GRID.top, right: GRID.right, bottom: GRID.bottom, pointerEvents: 'none', overflow: 'hidden' }}>
            <div ref={hmContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{
            position: 'absolute', right: 5, top: showLimit ? 40 : GRID.top, bottom: GRID.bottom, width: 14,
            background: 'linear-gradient(to top, #1f3a8a, #2563eb 25%, #22d3ee 45%, #34d399 60%, #fde047 78%, #ef4444 100%)',
            borderRadius: 2, pointerEvents: 'none',
          }}>
            <span style={{ position: 'absolute', top: -14, left: 0, fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap' }}>{cappedMax}{isCapped ? '+' : ''}</span>
            <span style={{ position: 'absolute', bottom: -14, left: 0, fontSize: 9, color: '#6b7280' }}>0</span>
          </div>
        </div>
      </div>
    )
  }

  // ---- ECharts native heatmap branch (grid / fine) ----
  const showLabels = showNumbers && effectiveMode === 'grid' && rawCells.length <= LABEL_CELL_MAX
  const xLabels = binsX.labels.map(String)
  const yLabels = binsY.labels.map(String)
  const secAxisType = 'value'

  const xAxisDef: any[] = [
    {
      type: 'category', data: xLabels, name: xFieldName, nameLocation: 'middle', nameGap: 55,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { rotate: 45, fontSize: AXIS_FONT_PX, color: '#4b5563', interval: xLabels.length > 30 ? Math.ceil(xLabels.length / 30) : 0 },
      axisTick: { show: false }, splitArea: { show: false },
    },
  ]
  const yAxisDef: any[] = [
    {
      type: 'category', data: yLabels, name: yFieldName, nameLocation: 'middle', nameGap: 85,
      nameTextStyle: { color: '#374151', fontSize: 12 },
      axisLabel: { fontSize: AXIS_FONT_PX, color: '#4b5563', interval: yLabels.length > 40 ? Math.ceil(yLabels.length / 40) : 0 },
      axisTick: { show: false }, splitArea: { show: false },
    },
  ]
  if (canOverlayLimit) {
    xAxisDef.push({ type: secAxisType, min: loX, max: hiX, show: false, axisPointer: { show: false } })
    yAxisDef.push({ type: secAxisType, min: loY, max: hiY, show: false, axisPointer: { show: false } })
  }

  const option = {
    animation: false,
    legend: canOverlayLimit ? { data: FORMATS.map((f) => f.label), top: 4, left: 'center', itemWidth: 18, itemHeight: 8, textStyle: { fontSize: 10, color: '#6b7280' } } : undefined,
    tooltip: {
      trigger: 'item',
      position: 'top',
      formatter: (params: any) => {
        if (params.seriesType !== 'heatmap') return ''
        const [xi, yi, lc] = params.value as [number, number, number]
        const c = Math.round(Math.expm1(lc))
        const pct = ((c / total) * 100).toFixed(1)
        return `<div style="${TIP_STYLE}">
          <div><b>X (${xFieldName}) = ${binRange(binsX, xi)}</b></div>
          <div>Y (${yFieldName}) = ${binRange(binsY, yi)}</div>
          <div>Count: ${c} (${pct}%)</div>
        </div>`
      },
    },
    grid: { ...GRID, top: canOverlayLimit ? 40 : GRID.top },
    xAxis: xAxisDef,
    yAxis: yAxisDef,
    visualMap: {
      type: 'continuous', show: true, min: 0, max: logMaxColor, calculable: true,
      orient: 'vertical', right: 8, top: canOverlayLimit ? 40 : GRID.top, itemHeight: 140,
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
        label: { show: showLabels, fontSize: countFont, color: '#111827', formatter: (p: any) => String(Math.round(Math.expm1((p.value as any[])[2]))) },
        itemStyle: { borderWidth: 0 },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' } },
      },
      ...limitSeries,
    ],
  }

  return (
    <div>
      {renderControls()}
      <ReactECharts
        key={`${effectiveMode}-${cap}-${density}-${showLimit}-${countFont}-${showLabels}-${xLabels.length}x${yLabels.length}`}
        option={option}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
