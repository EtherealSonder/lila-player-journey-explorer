export type HeatmapMode =
    | 'none'
    | 'traffic'
    | 'kills'
    | 'deaths'

export interface HeatmapPoint {
    map_u: number
    map_v: number
}

export interface HeatmapCell {
    x: number
    y: number
    count: number
    intensity: number
}

export interface HeatmapGrid {
    columns: number
    rows: number
    maxCount: number
    cells: HeatmapCell[]
}

export interface HeatmapDefinition {
    mode: HeatmapMode
    label: string
    description: string
}
