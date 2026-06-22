// Pure data helpers for the adaptive 2D heatmap.
// No React here so the binning / auto-adaptation logic stays testable and shared
// across the precise-grid, fine-smooth and blurred render modes.

export type Density = 'auto' | 'fine' | 'coarse' | 'coarser'

export interface AxisStats {
  distinct: number
  min: number
  max: number
  sortedDistinct: number[]
  bitMax: number | null
  dropped: number
}

export type AxisPlan =
  | { kind: 'distinct'; categories: number[] }
  | { kind: 'binned'; step: number; min: number; max: number }

export interface AxisBins {
  values: number[]                 // category representative values, ascending
  indexOf: (v: number) => number   // -1 if value maps outside the categories
  step: number                     // 0 for distinct mode, else bin width
  kind: 'distinct' | 'binned'
}

// --- thresholds (see plan §5) ---
export const DISTINCT_DIRECT_MAX = 50 // distinct count at/below which an axis is kept raw (1 value = 1 bin)
export const GRID_MAX_PERAX = 50      // per-axis category cap for auto -> precise grid
export const GRID_MAX_CELLS = 2500    // total cell cap for auto -> precise grid
export const LABEL_CELL_MAX = 200     // total cells at/below which grid mode prints the count in each cell
export const SMOOTH_TARGET = 40       // target bins/axis for fine-smooth
export const BLUR_TARGET = 30         // target bins/axis for blurred

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

export function planAxis(stats: AxisStats, targetBins: number): AxisPlan {
  // low cardinality (e.g. a 3-bit mode field, values 0..7) stays raw -> every value its own bin.
  // this is the fix for the old QUANT_STEP=5 collapse.
  if (stats.distinct <= DISTINCT_DIRECT_MAX) {
    return { kind: 'distinct', categories: stats.sortedDistinct }
  }
  return { kind: 'binned', step: niceStep(stats.min, stats.max, targetBins), min: stats.min, max: stats.max }
}

// move one/two notches along the nice sequence relative to a base step
export function applyDensity(baseStep: number, density: Density): number {
  if (density === 'auto') return baseStep
  let i = NICE_SEQUENCE.findIndex((n) => n >= baseStep)
  if (i < 0) i = NICE_SEQUENCE.length - 1
  let target = i
  if (density === 'fine') target = Math.max(0, i - 1)
  else if (density === 'coarse') target = Math.min(NICE_SEQUENCE.length - 1, i + 1)
  else if (density === 'coarser') target = Math.min(NICE_SEQUENCE.length - 1, i + 2)
  return NICE_SEQUENCE[target]
}

// plan an axis, applying a manual density override (the "adjust interval" control)
export function planAxisWithDensity(stats: AxisStats, targetBins: number, density: Density): AxisPlan {
  const base = planAxis(stats, targetBins)
  if (density === 'auto') return base
  const baseStep = base.kind === 'binned' ? base.step : 1
  const step = applyDensity(baseStep, density)
  // a finer-or-equal step on an already-raw axis keeps observed-only categories
  if (step <= 1 && base.kind === 'distinct') return base
  return { kind: 'binned', step, min: stats.min, max: stats.max }
}

export function buildAxisBins(plan: AxisPlan): AxisBins {
  if (plan.kind === 'distinct') {
    const values = plan.categories
    const pos = new Map(values.map((v, i) => [v, i]))
    return { values, indexOf: (v) => pos.get(v) ?? -1, step: 0, kind: 'distinct' }
  }
  const { step, min, max } = plan
  const nBins = Math.max(1, Math.floor((max - min) / step) + 1)
  const values: number[] = []
  for (let i = 0; i < nBins; i++) values.push(min + i * step)
  return {
    values,
    indexOf: (v) => {
      const idx = Math.floor((v - min) / step)
      return idx < 0 ? -1 : idx >= nBins ? nBins - 1 : idx
    },
    step,
    kind: 'binned',
  }
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
