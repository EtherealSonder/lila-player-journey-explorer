import type { MapRenderRect } from '../../map/mapGeometry'

export interface CameraTransform {
    scale: number
    x: number
    y: number
}

export interface ViewportSize {
    width: number
    height: number
}

export interface CameraPoint {
    x: number
    y: number
}

export const MIN_CAMERA_SCALE = 1
export const MAX_CAMERA_SCALE = 4
export const CAMERA_ZOOM_STEP = 1.2

export function resetCameraTransform(): CameraTransform {
    return {
        scale: MIN_CAMERA_SCALE,
        x: 0,
        y: 0,
    }
}

export function zoomCameraAtPoint(
    current: CameraTransform,
    requestedScale: number,
    pointer: CameraPoint,
    mapRect: MapRenderRect,
    viewport: ViewportSize,
): CameraTransform {
    const scale = clamp(
        requestedScale,
        MIN_CAMERA_SCALE,
        MAX_CAMERA_SCALE,
    )

    const localX =
        (pointer.x - current.x) / current.scale
    const localY =
        (pointer.y - current.y) / current.scale

    return clampCameraTransform(
        {
            scale,
            x: pointer.x - localX * scale,
            y: pointer.y - localY * scale,
        },
        mapRect,
        viewport,
    )
}

export function panCamera(
    current: CameraTransform,
    deltaX: number,
    deltaY: number,
    mapRect: MapRenderRect,
    viewport: ViewportSize,
): CameraTransform {
    return clampCameraTransform(
        {
            ...current,
            x: current.x + deltaX,
            y: current.y + deltaY,
        },
        mapRect,
        viewport,
    )
}

export function clampCameraTransform(
    transform: CameraTransform,
    mapRect: MapRenderRect,
    viewport: ViewportSize,
): CameraTransform {
    const scale = clamp(
        transform.scale,
        MIN_CAMERA_SCALE,
        MAX_CAMERA_SCALE,
    )

    return {
        scale,
        x: clampAxis(
            transform.x,
            mapRect.x,
            mapRect.width,
            viewport.width,
            scale,
        ),
        y: clampAxis(
            transform.y,
            mapRect.y,
            mapRect.height,
            viewport.height,
            scale,
        ),
    }
}

function clampAxis(
    position: number,
    mapOffset: number,
    mapSize: number,
    viewportSize: number,
    scale: number,
): number {
    const scaledMapSize = mapSize * scale

    if (scaledMapSize <= viewportSize) {
        return (
            (viewportSize - scaledMapSize) / 2 -
            mapOffset * scale
        )
    }

    const minimum =
        viewportSize -
        (mapOffset + mapSize) * scale
    const maximum = -mapOffset * scale

    return clamp(position, minimum, maximum)
}

function clamp(
    value: number,
    minimum: number,
    maximum: number,
): number {
    return Math.min(
        maximum,
        Math.max(minimum, value),
    )
}
