interface HeatmapInstance {
  setData(data: { max: number; data: Array<{ x: number; y: number; value: number }> }): void
}
interface HeatmapStatic {
  create(config: {
    container: HTMLElement
    radius?: number
    maxOpacity?: number
    minOpacity?: number
    blur?: number
  }): HeatmapInstance
}
declare const h337: HeatmapStatic
