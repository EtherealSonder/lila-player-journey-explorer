export interface HeatmapBasemapPresentation {
    muted: boolean
    alpha: number
}

export const DEFAULT_MAP_ALPHA = 1
export const HEATMAP_MAP_ALPHA = 0.82

export function getHeatmapBasemapPresentation(
    heatmapActive: boolean,
): HeatmapBasemapPresentation {
    if (!heatmapActive) {
        return {
            muted: false,
            alpha: DEFAULT_MAP_ALPHA,
        }
    }

    return {
        muted: true,
        alpha: HEATMAP_MAP_ALPHA,
    }
}
