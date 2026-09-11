import {
    Application,
    Assets,
    Sprite,
    type Texture,
} from 'pixi.js'
import { useEffect, useRef, useState } from 'react'

import type { GameMap } from '../telemetry/types'

export type MapViewportStatusKind =
    | 'loading'
    | 'error'
    | 'empty'
    | 'ready'

export interface MapViewportStatus {
    kind: MapViewportStatusKind
    title: string
    message: string
}

interface MapViewportProps {
    selectedMap: GameMap | null
    status: MapViewportStatus
}

type RendererState = 'initializing' | 'ready' | 'error'

interface MapLayout {
    x: number
    y: number
    width: number
    height: number
}

interface MapSourceSize {
    width: number
    height: number
}

function MapViewport({
    selectedMap,
    status,
}: MapViewportProps) {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const appRef = useRef<Application | null>(null)
    const mapSpriteRef = useRef<Sprite | null>(null)
    const mapSourceSizeRef = useRef<MapSourceSize | null>(null)
    const [rendererState, setRendererState] =
        useState<RendererState>('initializing')

    useEffect(() => {
        const hostElement = hostRef.current

        if (!hostElement) {
            return
        }

        let disposed = false
        let resizeObserver: ResizeObserver | null = null

        function layoutCurrentMap(
            viewportWidth: number,
            viewportHeight: number,
        ): void {
            const sprite = mapSpriteRef.current
            const sourceSize = mapSourceSizeRef.current

            if (!sprite || !sourceSize) {
                return
            }

            const layout = calculateContainedMapLayout(
                viewportWidth,
                viewportHeight,
                sourceSize.width,
                sourceSize.height,
            )

            sprite.position.set(layout.x, layout.y)
            sprite.width = layout.width
            sprite.height = layout.height
        }

        async function initializeRenderer(
            host: HTMLDivElement,
        ): Promise<void> {
            try {
                const app = new Application()

                await app.init({
                    resizeTo: host,
                    backgroundAlpha: 0,
                    antialias: true,
                    autoDensity: true,
                    resolution: window.devicePixelRatio || 1,
                })

                if (disposed) {
                    app.destroy(true)
                    return
                }

                appRef.current = app
                host.appendChild(app.canvas)

                resizeObserver = new ResizeObserver((entries) => {
                    const entry = entries[0]

                    if (!entry) {
                        return
                    }

                    layoutCurrentMap(
                        entry.contentRect.width,
                        entry.contentRect.height,
                    )
                })

                resizeObserver.observe(host)
                setRendererState('ready')
            } catch (error) {
                console.error(
                    'Failed to initialize PixiJS viewport.',
                    error,
                )

                if (!disposed) {
                    setRendererState('error')
                }
            }
        }

        void initializeRenderer(hostElement)

        return () => {
            disposed = true
            resizeObserver?.disconnect()

            mapSpriteRef.current = null
            mapSourceSizeRef.current = null

            if (appRef.current) {
                appRef.current.destroy(true)
                appRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        const app = appRef.current

        if (!app || rendererState !== 'ready') {
            return
        }

        let cancelled = false

        const previousSprite = mapSpriteRef.current

        if (previousSprite) {
            app.stage.removeChild(previousSprite)
            previousSprite.destroy()
            mapSpriteRef.current = null
            mapSourceSizeRef.current = null
        }

        if (!selectedMap) {
            return
        }

        const imagePath = selectedMap.image_path
        const displayName = selectedMap.display_name
        const configuredWidth = selectedMap.texture_width
        const configuredHeight = selectedMap.texture_height

        async function loadSelectedMap(): Promise<void> {
            try {
                const texture =
                    await Assets.load<Texture>(imagePath)

                if (cancelled) {
                    return
                }

                const currentApp = appRef.current
                const host = hostRef.current

                if (!currentApp || !host) {
                    return
                }

                const sourceWidth =
                    configuredWidth ?? texture.width
                const sourceHeight =
                    configuredHeight ?? texture.height

                const sprite = new Sprite(texture)

                mapSpriteRef.current = sprite
                mapSourceSizeRef.current = {
                    width: sourceWidth,
                    height: sourceHeight,
                }

                currentApp.stage.addChild(sprite)

                const layout = calculateContainedMapLayout(
                    host.clientWidth,
                    host.clientHeight,
                    sourceWidth,
                    sourceHeight,
                )

                sprite.position.set(layout.x, layout.y)
                sprite.width = layout.width
                sprite.height = layout.height
            } catch (error) {
                console.error(
                    `Failed to load minimap "${displayName}".`,
                    error,
                )
            }
        }

        void loadSelectedMap()

        return () => {
            cancelled = true
        }
    }, [rendererState, selectedMap])

    const visibleStatus =
        rendererState === 'error'
            ? {
                kind: 'error' as const,
                title: 'Renderer unavailable',
                message:
                    'The PixiJS map renderer could not be initialized.',
            }
            : rendererState === 'initializing'
                ? {
                    kind: 'loading' as const,
                    title: 'Preparing map view',
                    message: 'Initializing renderer.',
                }
                : status

    return (
        <div className="map-viewport-frame">
            <div
                ref={hostRef}
                className="map-viewport-host"
                data-renderer-state={rendererState}
                aria-label="PixiJS map viewport"
            />

            {visibleStatus.kind !== 'ready' && (
                <div
                    className={`map-viewport-state map-viewport-state-${visibleStatus.kind}`}
                    role={
                        visibleStatus.kind === 'error'
                            ? 'alert'
                            : 'status'
                    }
                >
                    <span className="map-viewport-state-indicator" />

                    <div>
                        <strong>{visibleStatus.title}</strong>
                        <p>{visibleStatus.message}</p>
                    </div>
                </div>
            )}

            {visibleStatus.kind === 'ready' && (
                <div className="map-viewport-ready" aria-live="polite">
                    <strong>{visibleStatus.title}</strong>
                    <span>{visibleStatus.message}</span>
                </div>
            )}
        </div>
    )
}

function calculateContainedMapLayout(
    viewportWidth: number,
    viewportHeight: number,
    sourceWidth: number,
    sourceHeight: number,
): MapLayout {
    if (
        viewportWidth <= 0 ||
        viewportHeight <= 0 ||
        sourceWidth <= 0 ||
        sourceHeight <= 0
    ) {
        return {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        }
    }

    const scale = Math.min(
        viewportWidth / sourceWidth,
        viewportHeight / sourceHeight,
    )

    const width = sourceWidth * scale
    const height = sourceHeight * scale

    return {
        x: (viewportWidth - width) / 2,
        y: (viewportHeight - height) / 2,
        width,
        height,
    }
}

export default MapViewport
