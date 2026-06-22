// Pure data helpers for the adaptive 2D heatmap and the scatter resource lines.
// No React here so the binning / auto-adaptation logic stays testable and shared.

export type Density = 'auto' | 'fine' | 'coarse' | 'coarser'
export type AxisScale = 'linear' | 'log'

export interface AxisStats {
  distinct: number
  min: number
  max: number
  sortedDistinct: number[]
  bitMax: number | null
  dropped: number
}

export interface AxisBins {
  labels: number[]            // category representative value (bin lower edge / distinct value)
  edges: number[] | null      // length labels.length+1 for binned; null for distinct
  indexOf: (v: number) => number
  kind: 'distinct' | 'binned'
  uniform: boolean            // evenly mapped (linear or log bins) -> a value axis can be aligned to it
  lo: number                  // value at the grid's left/bottom edge
  hi: number                  // value at the grid's right/top edge
  logScale: boolean
}

// --- thresholds ---
export const DISTINCT_DIRECT_MAX = 50 // distinct count at/below which an axis is kept raw (1 value = 1 bin)
export const GRID_MAX_PERAX = 50      // per-axis category cap for auto -> precise grid
export const GRID_MAX_CELLS = 2500    // total cell cap for auto -> precise grid
export const LABEL_CELL_MAX = 200     // total cells at/below which grid mode prints the count in each cell
export const SMOOTH_TARGET = 40       // target bins/axis for fine-smooth
export const BLUR_TARGET = 50         // target bins/axis for blurred

// --- resource budget: W * H * bytesPerPixel < RESOURCE_LIMIT (0.5 MB) ---
export const RESOURCE_LIMIT = 500000
export const FORMATS = [
  { label: '8-bit', bytes: 1, color: '#16a34a' },
  { label: '16-bit', bytes: 2, color: '#f59e0b' },
  { label: '32-bit', bytes: 4, color: '#dc2626' },
]

// nice-number sequence {1,2,5}x10^k, ascending
const NICE_SEQUENCE: number[] = (() => {
  const arr: number[] = []
  for (let k = 0; k < 9; k++) {
    const mag = Math.pow(10, k)
    arr.push(1 * mag, 2 * mag, 5 * mag)
  }
  return arr
})()

export function computeAxisStats(values: number[], width?: number): AxisStats {
  const set = new Set<number>()
  let dropped = 0
  for (const raw of values) {
    if (raw == null || !Number.isFinite(raw) || raw < 0) {
      dropped++
      continue
    }
    set.add(raw)
  }
  const sortedDistinct = [...set].sort((a, b) => a - b)
  const distinct = sortedDistinct.length
  const bitMax = width == null ? null : width >= 32 ? 0xffffffff : (1 << width) - 1
  return {
    distinct,
    min: distinct ? sortedDistinct[0] : 0,
    max: distinct ? sortedDistinct[distinct - 1] : 0,
    sortedDistinct,
    bitMax,
    dropped,
  }
}

// smallest nice step that yields about targetBins bins across [min,max]; never below 1
export function niceStep(min: number, max: number, targetBins: number): number {
  const span = Math.max(max - min, 1)
  const rawStep = span / Math.max(targetBins, 1)
  for (const n of NICE_SEQUENCE) {
    if (n >= rawStep) return n
  }
  return NICE_SEQUENCE[NICE_SEQUENCE.length - 1]
}

function densityFactor(d: Density): number {
  return d === 'fine' ? 1.7 : d === 'coarse' ? 0.6 : d === 'coarser' ? 0.4 : 1
}

// Build the bin layout for one axis given the chosen scale and density.
// Low-cardinality axes keep each value as its own category (fixes small mode fields);
// high-cardinality axes are quantized either linearly (nice step) or logarithmically.
export function buildBins(stats: AxisStats, baseTarget: number, scale: AxisScale, density: Density): AxisBins {
  const sd = stats.sortedDistinct
  if (sd.length === 0) {
    return { labels: [], edges: null, indexOf: () => -1, kind: 'distinct', uniform: false, lo: 0, hi: 1, logScale: scale === 'log' }
  }
  if (stats.distinct <= DISTINCT_DIRECT_MAX) {
    const pos = new Map(sd.map((v, i) => [v, i]))
    return {
      labels: sd, edges: null, indexOf: (v) => pos.get(v) ?? -1,
      kind: 'distinct', uniform: false, lo: sd[0], hi: sd[sd.length - 1], logScale: scale === 'log',
    }
  }
  const target = Math.max(4, Math.min(200, Math.round(baseTarget * densityFactor(density))))

  if (scale === 'log') {
    const lo = Math.max(1, stats.min)
    const hi = Math.max(lo + 1, stats.max)
    const ratio = Math.pow(hi / lo, 1 / target)
    const logRatio = Math.log(ratio)
    const labels: number[] = []
    const edges: number[] = []
    for (let i = 0; i < target; i++) labels.push(Math.round(lo * Math.pow(ratio, i)))
    for (let i = 0; i <= target; i++) edges.push(Math.round(lo * Math.pow(ratio, i)))
    const indexOf = (v: number) => {
      const vc = v < lo ? lo : v > hi ? hi : v
      let idx = Math.floor(Math.log(vc / lo) / logRatio)
      if (idx < 0) idx = 0
      if (idx >= target) idx = target - 1
      return idx
    }
    return { labels, edges, indexOf, kind: 'binned', uniform: true, lo, hi: edges[edges.length - 1], logScale: true }
  }

  const min = stats.min
  const max = stats.max
  const step = niceStep(min, max, target)
  const n = Math.max(1, Math.floor((max - min) / step) + 1)
  const labels: number[] = []
  const edges: number[] = []
  for (let i = 0; i < n; i++) labels.push(min + i * step)
  for (let i = 0; i <= n; i++) edges.push(min + i * step)
  const indexOf = (v: number) => {
    let idx = Math.floor((v - min) / step)
    if (idx < 0) idx = 0
    if (idx >= n) idx = n - 1
    return idx
  }
  return { labels, edges, indexOf, kind: 'binned', uniform: true, lo: min, hi: edges[edges.length - 1], logScale: false }
}

// tooltip label for a bin index (range for binned, single value for distinct)
export function binRange(bins: AxisBins, i: number): string {
  if (!bins.edges) return String(bins.labels[i])
  const lo = bins.edges[i]
  const hi = bins.edges[i + 1] - 1
  return hi > lo ? `${lo}-${hi}` : `${lo}`
}

// auto pick precise-grid vs fine-smooth from the raw distinct counts
export function decideMode(distinctX: number, distinctY: number): 'grid' | 'fine' {
  if (distinctX <= GRID_MAX_PERAX && distinctY <= GRID_MAX_PERAX && distinctX * distinctY <= GRID_MAX_CELLS) {
    return 'grid'
  }
  return 'fine'
}

// nearest-rank percentile over populated cell counts; used as the color-scale max
export function percentileCap(counts: number[], p: number): number {
  const n = counts.length
  if (n === 0) return 1
  if (p >= 100) {
    let m = 1
    for (const c of counts) if (c > m) m = c
    return m
  }
  const sorted = [...counts].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * n)
  const idx = Math.min(n - 1, Math.max(0, rank - 1))
  const cap = sorted[idx]
  return cap > 0 ? cap : Math.max(1, sorted[n - 1])
}

// points of the resource-limit boundary W*H*bytes = RESOURCE_LIMIT, clipped to the box.
// On a log-log axis this renders as a straight line; on linear it is a hyperbola.
export function limitCurve(
  bytes: number,
  loX: number, hiX: number,
  loY: number, hiY: number,
  scale: AxisScale,
  samples = 80,
): Array<[number, number]> {
  const cap = RESOURCE_LIMIT / bytes
  const x0 = Math.max(scale === 'log' ? 1 : 0.000001, loX)
  const x1 = Math.max(x0 + 1e-9, hiX)
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= samples; i++) {
    const w = scale === 'log' ? x0 * Math.pow(x1 / x0, i / samples) : x0 + ((x1 - x0) * i) / samples
    if (w <= 0) continue
    const h = cap / w
    if (h >= loY && h <= hiY) pts.push([w, h])
  }
  return pts
}
