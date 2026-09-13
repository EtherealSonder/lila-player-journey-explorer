import {
    BlurFilter,
    Container,
    Graphics,
} from 'pixi.js'

import type { MapRenderRect } from '../../map/mapGeometry'
import {
    projectHeatmapCell,
} from './heatmapGeometry'
import type {
    HeatmapGrid,
    HeatmapMode,
} from './heatmapTypes'

export const HEATMAP_MIN_ALPHA = 0.1
export const HEATMAP_MAX_ALPHA = 0.72
export const HEATMAP_RADIUS_MULTIPLIER = 1.35
export const HEATMAP_BLUR_STRENGTH = 10

interface HeatmapModePalette {
    low: number
    high: number
}


const HEATMAP_MODE_PALETTES: Record<
    Exclude<HeatmapMode, 'none'>,
    HeatmapModePalette
> = {
    traffic: {
        low: 0x93c5fd,
        high: 0x2563eb,
    },
    kills: {
        low: 0xfca5a5,
        high: 0xdc2626,
    },
    deaths: {
        low: 0xc4b5fd,
        high: 0x6d5aa8,
    },
}


export class HeatmapRenderer {
    private readonly graphics =
        new Graphics()

    private readonly blurFilter =
        new BlurFilter({
            strength:
                HEATMAP_BLUR_STRENGTH,
            quality: 3,
        })

    constructor(
        container: Container,
    ) {
        this.graphics.label =
            'heatmap-overlay'
        this.graphics.eventMode =
            'none'
        this.graphics.visible =
            false
        this.graphics.filters = [
            this.blurFilter,
        ]

        container.addChild(
            this.graphics,
        )
    }

    render(
        grid: HeatmapGrid,
        mapRect: MapRenderRect,
        mode: HeatmapMode,
    ): void {
        this.graphics.clear()

        if (
            mode === 'none' ||
            grid.cells.length === 0 ||
            grid.maxCount <= 0
        ) {
            this.graphics.visible =
                false
            return
        }

        for (const cell of grid.cells) {
            if (
                cell.count <= 0 ||
                cell.intensity <= 0
            ) {
                continue
            }

            const rect =
                projectHeatmapCell(
                    cell,
                    grid,
                    mapRect,
                )

            const centerX =
                rect.x +
                rect.width / 2
            const centerY =
                rect.y +
                rect.height / 2
            const radius =
                getHeatmapCellRadius(
                    rect.width,
                    rect.height,
                )

            this.graphics
                .circle(
                    centerX,
                    centerY,
                    radius,
                )
                .fill({
                    color:
                        getHeatmapColor(
                            mode,
                            cell.intensity,
                        ),
                    alpha:
                        getHeatmapCellAlpha(
                            cell.intensity,
                        ),
                })
        }

        this.graphics.visible = true
    }

    clear(): void {
        this.graphics.clear()
        this.graphics.visible = false
    }
}

export function getHeatmapColor(
    mode: Exclude<
        HeatmapMode,
        'none'
    >,
    intensity: number,
): number {
    const palette =
        HEATMAP_MODE_PALETTES[mode]

    return interpolateRgb(
        palette.low,
        palette.high,
        clamp01(intensity),
    )
}

export function getHeatmapCellAlpha(
    intensity: number,
): number {
    const normalized =
        clamp01(intensity)

    return (
        HEATMAP_MIN_ALPHA +
        normalized *
        (
            HEATMAP_MAX_ALPHA -
            HEATMAP_MIN_ALPHA
        )
    )
}

export function getHeatmapCellRadius(
    width: number,
    height: number,
): number {
    return (
        Math.max(width, height) *
        HEATMAP_RADIUS_MULTIPLIER
    )
}

function interpolateRgb(
    from: number,
    to: number,
    t: number,
): number {
    const normalizedT =
        clamp01(t)

    const fromRed =
        (from >> 16) & 0xff
    const fromGreen =
        (from >> 8) & 0xff
    const fromBlue =
        from & 0xff

    const toRed =
        (to >> 16) & 0xff
    const toGreen =
        (to >> 8) & 0xff
    const toBlue =
        to & 0xff

    const red =
        Math.round(
            fromRed +
            (
                toRed -
                fromRed
            ) *
            normalizedT,
        )
    const green =
        Math.round(
            fromGreen +
            (
                toGreen -
                fromGreen
            ) *
            normalizedT,
        )
    const blue =
        Math.round(
            fromBlue +
            (
                toBlue -
                fromBlue
            ) *
            normalizedT,
        )

    return (
        (red << 16) |
        (green << 8) |
        blue
    )
}

function clamp01(
    value: number,
): number {
    return Math.max(
        0,
        Math.min(
            1,
            value,
        ),
    )
}
