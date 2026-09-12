import type { MapRenderRect } from '../../map/mapGeometry'

export interface CameraTransform {
    scale: number
    x: number
    y: number
}

export interface CameraViewportSize {
    width: number
    height: number
}

export interface CameraPoint {
    x: number
    y: number
}

export const CAMERA_MIN_SCALE = 1
export const CAMERA_MAX_SCALE = 6
export const CAMERA_ZOOM_STEP = 1.25

export function resetCameraTransform(): CameraTransform {
    return {
        scale: 1,
        x: 0,
        y: 0,
    }
}

export function zoomCameraAtPoint(
    current: CameraTransform,
    requestedScale: number,
    anchor: CameraPoint,
    mapRect: MapRenderRect,
    viewport: CameraViewportSize,
): CameraTransform {
    const nextScale = clampScale(requestedScale)

    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        return clampCameraTransform(
            {
                ...current,
                scale: nextScale,
            },
            mapRect,
            viewport,
        )
    }

    const safeCurrentScale = clampScale(current.scale)
    const worldX =
        (anchor.x - current.x) /
        safeCurrentScale
    const worldY =
        (anchor.y - current.y) /
        safeCurrentScale

    return clampCameraTransform(
        {
            scale: nextScale,
            x:
                anchor.x -
                worldX * nextScale,
            y:
                anchor.y -
                worldY * nextScale,
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
    viewport: CameraViewportSize,
): CameraTransform {
    return clampCameraTransform(
        {
            scale: current.scale,
            x:
                current.x +
                (Number.isFinite(deltaX)
                    ? deltaX
                    : 0),
            y:
                current.y +
                (Number.isFinite(deltaY)
                    ? deltaY
                    : 0),
        },
        mapRect,
        viewport,
    )
}

export function clampCameraTransform(
    transform: CameraTransform,
    mapRect: MapRenderRect,
    viewport: CameraViewportSize,
): CameraTransform {
    const scale = clampScale(transform.scale)

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

function clampScale(scale: number): number {
    const safeScale = Number.isFinite(scale)
        ? scale
        : CAMERA_MIN_SCALE

    return Math.max(
        CAMERA_MIN_SCALE,
        Math.min(
            CAMERA_MAX_SCALE,
            safeScale,
        ),
    )
}

function clampAxis(
    translation: number,
    mapStart: number,
    mapSize: number,
    viewportSize: number,
    scale: number,
): number {
    const safeTranslation =
        Number.isFinite(translation)
            ? translation
            : 0

    const scaledMapSize =
        mapSize * scale

    if (scaledMapSize <= viewportSize) {
        return (
            viewportSize / 2 -
            (
                mapStart +
                mapSize / 2
            ) * scale
        )
    }

    const minimumTranslation =
        viewportSize -
        (mapStart + mapSize) * scale
    const maximumTranslation =
        -mapStart * scale

    return Math.max(
        minimumTranslation,
        Math.min(
            maximumTranslation,
            safeTranslation,
        ),
    )
}
