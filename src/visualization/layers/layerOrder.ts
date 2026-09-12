export const VISUALIZATION_LAYER_ORDER = [
    'minimap',
    'heatmap',
    'trajectories',
    'participantMarkers',
    'eventMarkers',
    'interaction',
] as const

export type VisualizationLayerName =
    (typeof VISUALIZATION_LAYER_ORDER)[number]
