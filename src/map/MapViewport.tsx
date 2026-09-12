import {
    Application,
    Assets,
    Sprite,
    type Texture,
} from 'pixi.js'
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'

import {
    fitMapToViewport,
    type MapRenderRect,
} from './mapGeometry'
import {
    CAMERA_ZOOM_STEP,
    clampCameraTransform,
    panCamera,
    resetCameraTransform,
    zoomCameraAtPoint,
    type CameraTransform,
} from '../visualization/camera/cameraMath'
import type {
    GameMap,
    MatchData,
    MatchSummary,
} from '../telemetry/types'
import { VisualizationLayers } from '../visualization/layers/VisualizationLayers'
import { TrajectoryRenderer } from '../visualization/trajectories/TrajectoryRenderer'
import { ParticipantMarkerRenderer } from '../visualization/participants/ParticipantMarkerRenderer'
import {
    EventMarkerRenderer,
    type EventMarkerHover,
} from '../visualization/events/EventMarkerRenderer'
import { buildEventTooltipModel } from '../visualization/events/eventTooltip'
import { isEventVisibleAtTime } from '../playback/eventPlayback'
import VisualizationLegend from '../components/VisualizationLegend'
import {
    formatMatchDuration,
    getTotalEventCount,
} from '../telemetry/matchSummary'
import type { VisualizationVisibility } from '../visualization/visibility'

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
    selectedMatchId: string
    matchData: MatchData | null
    matchSummary: MatchSummary | null
    visibility: VisualizationVisibility
    status: MapViewportStatus
    currentTimeSeconds: number
}

type RendererState = 'initializing' | 'ready' | 'error'

interface MapSourceSize {
    width: number
    height: number
}

function MapViewport({
    selectedMap,
    selectedMatchId,
    matchData,
    matchSummary,
    visibility,
    status,
    currentTimeSeconds,
}: MapViewportProps) {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const appRef = useRef<Application | null>(null)
    const layersRef = useRef<VisualizationLayers | null>(null)
    const trajectoryRendererRef =
        useRef<TrajectoryRenderer | null>(null)
    const participantMarkerRendererRef =
        useRef<ParticipantMarkerRenderer | null>(null)
    const eventMarkerRendererRef =
        useRef<EventMarkerRenderer | null>(null)
    const mapSpriteRef = useRef<Sprite | null>(null)
    const mapSourceSizeRef = useRef<MapSourceSize | null>(null)
    const mapRectRef = useRef<MapRenderRect | null>(null)
    const matchDataRef = useRef<MatchData | null>(null)
    const visibilityRef =
        useRef<VisualizationVisibility>(visibility)
    const currentTimeRef =
        useRef(currentTimeSeconds)
    const cameraRef =
        useRef<CameraTransform>(resetCameraTransform())
    const dragPointerIdRef = useRef<number | null>(null)
    const lastPointerPositionRef = useRef<{
        x: number
        y: number
    } | null>(null)

    const [rendererState, setRendererState] =
        useState<RendererState>('initializing')
    const [eventHover, setEventHover] =
        useState<EventMarkerHover | null>(null)
    const [legendOpen, setLegendOpen] = useState(false)
    const [summaryOpen, setSummaryOpen] = useState(false)
    const [cameraScale, setCameraScale] = useState(1)
    const [isPanning, setIsPanning] = useState(false)

    useEffect(() => {
        currentTimeRef.current =
            currentTimeSeconds
    }, [currentTimeSeconds])

    function applyCameraTransform(
        transform: CameraTransform,
    ): void {
        const layers = layersRef.current

        if (!layers) {
            return
        }

        cameraRef.current = transform
        layers.root.scale.set(
            transform.scale,
            transform.scale,
        )
        layers.root.position.set(
            transform.x,
            transform.y,
        )
        setCameraScale(transform.scale)
    }

    function resetCamera(): void {
        applyCameraTransform(
            resetCameraTransform(),
        )
    }

    useEffect(() => {
        const hostElement = hostRef.current

        if (!hostElement) {
            return
        }

        let disposed = false
        let resizeObserver: ResizeObserver | null = null

        function layoutCurrentVisualization(
            viewportWidth: number,
            viewportHeight: number,
        ): void {
            const sprite = mapSpriteRef.current
            const sourceSize = mapSourceSizeRef.current

            if (!sprite || !sourceSize) {
                return
            }

            const mapRect = fitMapToViewport(
                sourceSize,
                {
                    width: viewportWidth,
                    height: viewportHeight,
                },
            )

            mapRectRef.current = mapRect

            sprite.position.set(mapRect.x, mapRect.y)
            sprite.width = mapRect.width
            sprite.height = mapRect.height

            const nextCamera = clampCameraTransform(
                cameraRef.current,
                mapRect,
                {
                    width: viewportWidth,
                    height: viewportHeight,
                },
            )
            applyCameraTransform(nextCamera)

            const currentMatchData =
                matchDataRef.current
            const trajectoryRenderer =
                trajectoryRendererRef.current
            const participantMarkerRenderer =
                participantMarkerRendererRef.current
            const eventMarkerRenderer =
                eventMarkerRendererRef.current

            if (currentMatchData) {
                trajectoryRenderer?.render(
                    currentMatchData,
                    mapRect,
                    visibilityRef.current,
                    currentTimeRef.current,
                )

                participantMarkerRenderer?.render(
                    currentMatchData,
                    mapRect,
                    visibilityRef.current,
                    currentTimeRef.current,
                )

                eventMarkerRenderer?.render(
                    currentMatchData,
                    mapRect,
                    visibilityRef.current,
                    currentTimeRef.current,
                )
            }
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
                    resolution:
                        window.devicePixelRatio || 1,
                })

                if (disposed) {
                    app.destroy(true)
                    return
                }

                const layers =
                    new VisualizationLayers()

                app.stage.addChild(layers.root)

                appRef.current = app
                layersRef.current = layers
                trajectoryRendererRef.current =
                    new TrajectoryRenderer(
                        layers.trajectories,
                    )
                participantMarkerRendererRef.current =
                    new ParticipantMarkerRenderer(
                        layers.participantMarkers,
                    )
                eventMarkerRendererRef.current =
                    new EventMarkerRenderer(
                        layers.eventMarkers,
                        setEventHover,
                    )

                host.appendChild(app.canvas)

                resizeObserver =
                    new ResizeObserver(
                        (entries) => {
                            const entry =
                                entries[0]

                            if (!entry) {
                                return
                            }

                            layoutCurrentVisualization(
                                entry
                                    .contentRect
                                    .width,
                                entry
                                    .contentRect
                                    .height,
                            )
                        },
                    )

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

            matchDataRef.current = null
            mapRectRef.current = null
            mapSpriteRef.current = null
            mapSourceSizeRef.current = null

            trajectoryRendererRef.current = null
            participantMarkerRendererRef.current =
                null
            eventMarkerRendererRef.current = null

            if (layersRef.current) {
                layersRef.current.destroy()
                layersRef.current = null
            }

            if (appRef.current) {
                appRef.current.destroy(true)
                appRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        const hostElement = hostRef.current

        if (
            !hostElement ||
            rendererState !== 'ready'
        ) {
            return
        }

        const host = hostElement

        function getViewportSize() {
            return {
                width: host.clientWidth,
                height: host.clientHeight,
            }
        }

        function getLocalPointer(
            clientX: number,
            clientY: number,
        ) {
            const bounds =
                host.getBoundingClientRect()

            return {
                x: clientX - bounds.left,
                y: clientY - bounds.top,
            }
        }

        function handleWheel(
            event: WheelEvent,
        ): void {
            const mapRect =
                mapRectRef.current

            if (!mapRect) {
                return
            }

            event.preventDefault()

            const pointer = getLocalPointer(
                event.clientX,
                event.clientY,
            )
            const factor =
                event.deltaY < 0
                    ? CAMERA_ZOOM_STEP
                    : 1 /
                    CAMERA_ZOOM_STEP

            applyCameraTransform(
                zoomCameraAtPoint(
                    cameraRef.current,
                    cameraRef.current.scale *
                    factor,
                    pointer,
                    mapRect,
                    getViewportSize(),
                ),
            )
        }

        function handlePointerDown(
            event: PointerEvent,
        ): void {
            if (event.button !== 0) {
                return
            }

            dragPointerIdRef.current =
                event.pointerId
            lastPointerPositionRef.current = {
                x: event.clientX,
                y: event.clientY,
            }

            host.setPointerCapture(
                event.pointerId,
            )
            setIsPanning(true)
        }

        function handlePointerMove(
            event: PointerEvent,
        ): void {
            if (
                dragPointerIdRef.current !==
                event.pointerId ||
                !lastPointerPositionRef.current
            ) {
                return
            }

            const mapRect =
                mapRectRef.current

            if (!mapRect) {
                return
            }

            const previous =
                lastPointerPositionRef.current
            const deltaX =
                event.clientX - previous.x
            const deltaY =
                event.clientY - previous.y

            lastPointerPositionRef.current = {
                x: event.clientX,
                y: event.clientY,
            }

            applyCameraTransform(
                panCamera(
                    cameraRef.current,
                    deltaX,
                    deltaY,
                    mapRect,
                    getViewportSize(),
                ),
            )
        }

        function stopPanning(
            event: PointerEvent,
        ): void {
            if (
                dragPointerIdRef.current !==
                event.pointerId
            ) {
                return
            }

            dragPointerIdRef.current = null
            lastPointerPositionRef.current =
                null

            if (
                host.hasPointerCapture(
                    event.pointerId,
                )
            ) {
                host.releasePointerCapture(
                    event.pointerId,
                )
            }

            setIsPanning(false)
        }

        host.addEventListener(
            'wheel',
            handleWheel,
            { passive: false },
        )
        host.addEventListener(
            'pointerdown',
            handlePointerDown,
        )
        host.addEventListener(
            'pointermove',
            handlePointerMove,
        )
        host.addEventListener(
            'pointerup',
            stopPanning,
        )
        host.addEventListener(
            'pointercancel',
            stopPanning,
        )

        return () => {
            host.removeEventListener(
                'wheel',
                handleWheel,
            )
            host.removeEventListener(
                'pointerdown',
                handlePointerDown,
            )
            host.removeEventListener(
                'pointermove',
                handlePointerMove,
            )
            host.removeEventListener(
                'pointerup',
                stopPanning,
            )
            host.removeEventListener(
                'pointercancel',
                stopPanning,
            )
        }
    }, [rendererState])

    useEffect(() => {
        if (rendererState !== 'ready') {
            return
        }

        matchDataRef.current = null
        trajectoryRendererRef.current?.clear()
        participantMarkerRendererRef.current?.clear()
        eventMarkerRendererRef.current?.clear()
    }, [rendererState, selectedMatchId])

    useEffect(() => {
        const trajectoryRenderer =
            trajectoryRendererRef.current
        const participantMarkerRenderer =
            participantMarkerRendererRef.current
        const eventMarkerRenderer =
            eventMarkerRendererRef.current

        if (rendererState !== 'ready') {
            return
        }

        if (
            !matchData ||
            matchData.match_id !==
            selectedMatchId
        ) {
            matchDataRef.current = null
            trajectoryRenderer?.clear()
            participantMarkerRenderer?.clear()
            eventMarkerRenderer?.clear()
            return
        }

        matchDataRef.current = matchData

        const mapRect = mapRectRef.current

        if (!mapRect) {
            return
        }

        trajectoryRenderer?.render(
            matchData,
            mapRect,
            visibilityRef.current,
            currentTimeRef.current,
        )

        participantMarkerRenderer?.render(
            matchData,
            mapRect,
            visibilityRef.current,
            currentTimeRef.current,
        )

        eventMarkerRenderer?.render(
            matchData,
            mapRect,
            visibilityRef.current,
            currentTimeRef.current,
        )
    }, [
        matchData,
        rendererState,
        selectedMatchId,
    ])

    useEffect(() => {
        visibilityRef.current = visibility

        if (rendererState !== 'ready') {
            return
        }

        const currentMatchData =
            matchDataRef.current
        const mapRect = mapRectRef.current

        if (
            !currentMatchData ||
            !mapRect
        ) {
            return
        }

        trajectoryRendererRef.current?.render(
            currentMatchData,
            mapRect,
            visibility,
            currentTimeRef.current,
        )
        participantMarkerRendererRef.current?.render(
            currentMatchData,
            mapRect,
            visibility,
            currentTimeRef.current,
        )
        eventMarkerRendererRef.current?.render(
            currentMatchData,
            mapRect,
            visibility,
            currentTimeRef.current,
        )
    }, [rendererState, visibility])

    useEffect(() => {
        if (rendererState !== 'ready') {
            return
        }

        const currentMatchData =
            matchDataRef.current
        const mapRect =
            mapRectRef.current

        if (
            !currentMatchData ||
            !mapRect
        ) {
            return
        }

        trajectoryRendererRef.current?.render(
            currentMatchData,
            mapRect,
            visibilityRef.current,
            currentTimeSeconds,
        )
        participantMarkerRendererRef.current?.render(
            currentMatchData,
            mapRect,
            visibilityRef.current,
            currentTimeSeconds,
        )
        eventMarkerRendererRef.current?.render(
            currentMatchData,
            mapRect,
            visibilityRef.current,
            currentTimeSeconds,
        )
    }, [
        currentTimeSeconds,
        rendererState,
    ])

    useEffect(() => {
        const layers = layersRef.current

        if (
            !layers ||
            rendererState !== 'ready'
        ) {
            return
        }

        let cancelled = false

        const previousSprite =
            mapSpriteRef.current

        if (previousSprite) {
            layers.minimap.removeChild(
                previousSprite,
            )
            previousSprite.destroy()
            mapSpriteRef.current = null
            mapSourceSizeRef.current = null
            mapRectRef.current = null
        }

        if (!selectedMap) {
            return
        }

        const imagePath =
            selectedMap.image_path
        const displayName =
            selectedMap.display_name
        const configuredWidth =
            selectedMap.texture_width
        const configuredHeight =
            selectedMap.texture_height

        async function loadSelectedMap(): Promise<void> {
            try {
                const texture =
                    await Assets.load<Texture>(
                        imagePath,
                    )

                if (cancelled) {
                    return
                }

                const currentLayers =
                    layersRef.current
                const host =
                    hostRef.current

                if (
                    !currentLayers ||
                    !host
                ) {
                    return
                }

                const sourceWidth =
                    configuredWidth ??
                    texture.width
                const sourceHeight =
                    configuredHeight ??
                    texture.height

                const sprite =
                    new Sprite(texture)

                mapSpriteRef.current = sprite
                mapSourceSizeRef.current = {
                    width: sourceWidth,
                    height: sourceHeight,
                }

                currentLayers.minimap.addChild(
                    sprite,
                )

                const mapRect =
                    fitMapToViewport(
                        {
                            width:
                                sourceWidth,
                            height:
                                sourceHeight,
                        },
                        {
                            width:
                                host.clientWidth,
                            height:
                                host.clientHeight,
                        },
                    )

                mapRectRef.current = mapRect

                applyCameraTransform(
                    resetCameraTransform(),
                )

                sprite.position.set(
                    mapRect.x,
                    mapRect.y,
                )
                sprite.width = mapRect.width
                sprite.height = mapRect.height

                const currentMatchData =
                    matchDataRef.current
                const trajectoryRenderer =
                    trajectoryRendererRef.current
                const participantMarkerRenderer =
                    participantMarkerRendererRef.current
                const eventMarkerRenderer =
                    eventMarkerRendererRef.current

                if (currentMatchData) {
                    trajectoryRenderer?.render(
                        currentMatchData,
                        mapRect,
                        visibilityRef.current,
                        currentTimeRef.current,
                    )

                    participantMarkerRenderer?.render(
                        currentMatchData,
                        mapRect,
                        visibilityRef.current,
                        currentTimeRef.current,
                    )

                    eventMarkerRenderer?.render(
                        currentMatchData,
                        mapRect,
                        visibilityRef.current,
                        currentTimeRef.current,
                    )
                }
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

    const eventTooltip = useMemo(() => {
        if (
            !eventHover ||
            eventHover.matchId !==
            selectedMatchId
        ) {
            return null
        }

        const eventType =
            eventHover.event.type
        const isVisible =
            eventType === 'kill'
                ? visibility.kills
                : eventType ===
                    'death'
                    ? visibility.deaths
                    : eventType ===
                        'loot'
                        ? visibility.loot
                        : visibility.stormDeaths

        if (
            !isVisible ||
            !isEventVisibleAtTime(
                eventHover.event,
                currentTimeSeconds,
            )
        ) {
            return null
        }

        return {
            x: eventHover.x,
            y: eventHover.y,
            model:
                buildEventTooltipModel(
                    eventHover.event,
                ),
        }
    }, [
        currentTimeSeconds,
        eventHover,
        selectedMatchId,
        visibility,
    ])

    const visibleStatus =
        rendererState === 'error'
            ? {
                kind: 'error' as const,
                title:
                    'Renderer unavailable',
                message:
                    'The PixiJS map renderer could not be initialized.',
            }
            : rendererState ===
                'initializing'
                ? {
                    kind:
                        'loading' as const,
                    title:
                        'Preparing map view',
                    message:
                        'Initializing renderer.',
                }
                : status

    return (
        <div className="map-viewport-frame">
            <div
                ref={hostRef}
                className={
                    isPanning
                        ? 'map-viewport-host is-panning'
                        : 'map-viewport-host'
                }
                data-renderer-state={
                    rendererState
                }
                data-playback-time={
                    currentTimeSeconds
                }
                aria-label="PixiJS map viewport"
            />

            <div className="map-legend-control">
                <button
                    type="button"
                    className="map-legend-toggle"
                    aria-expanded={
                        legendOpen
                    }
                    aria-controls="map-legend-panel"
                    onClick={() =>
                        setLegendOpen(
                            (current) =>
                                !current,
                        )
                    }
                >
                    <span
                        className="map-legend-toggle-icon"
                        aria-hidden="true"
                    >
                        ≡
                    </span>
                    Legend
                </button>

                {legendOpen && (
                    <div
                        id="map-legend-panel"
                        className="map-legend-panel"
                    >
                        <div className="map-legend-panel-heading">
                            <strong>
                                Legend
                            </strong>
                            <button
                                type="button"
                                className="map-legend-close"
                                aria-label="Close legend"
                                onClick={() =>
                                    setLegendOpen(
                                        false,
                                    )
                                }
                            >
                                ×
                            </button>
                        </div>

                        <VisualizationLegend />
                    </div>
                )}
            </div>

            {visibleStatus.kind !==
                'ready' && (
                    <div
                        className={`map-viewport-state map-viewport-state-${visibleStatus.kind}`}
                        role={
                            visibleStatus.kind ===
                                'error'
                                ? 'alert'
                                : 'status'
                        }
                    >
                        <span className="map-viewport-state-indicator" />

                        <div>
                            <strong>
                                {
                                    visibleStatus.title
                                }
                            </strong>
                            <p>
                                {
                                    visibleStatus.message
                                }
                            </p>
                        </div>
                    </div>
                )}

            {visibleStatus.kind ===
                'ready' &&
                matchData && (
                    <div
                        className="map-context-summary"
                        aria-live="polite"
                    >
                        <strong>
                            {
                                visibleStatus.title
                            }
                        </strong>
                        <span>
                            {
                                matchData
                                    .participants
                                    .length
                            }{' '}
                            participants
                        </span>
                        <span>
                            {
                                matchData
                                    .tracks
                                    .length
                            }{' '}
                            tracks
                        </span>
                        <span>
                            {
                                matchData
                                    .events
                                    .length
                            }{' '}
                            events
                        </span>
                    </div>
                )}

            {visibleStatus.kind ===
                'ready' && (
                    <div className="map-camera-controls">
                        <button
                            type="button"
                            aria-label="Zoom out"
                            onClick={() => {
                                const mapRect =
                                    mapRectRef.current
                                const host =
                                    hostRef.current

                                if (
                                    !mapRect ||
                                    !host
                                ) {
                                    return
                                }

                                applyCameraTransform(
                                    zoomCameraAtPoint(
                                        cameraRef.current,
                                        cameraRef
                                            .current
                                            .scale /
                                        CAMERA_ZOOM_STEP,
                                        {
                                            x:
                                                host.clientWidth /
                                                2,
                                            y:
                                                host.clientHeight /
                                                2,
                                        },
                                        mapRect,
                                        {
                                            width:
                                                host.clientWidth,
                                            height:
                                                host.clientHeight,
                                        },
                                    ),
                                )
                            }}
                        >
                            −
                        </button>

                        <span className="map-camera-scale">
                            {cameraScale.toFixed(
                                1,
                            )}
                            x
                        </span>

                        <button
                            type="button"
                            aria-label="Zoom in"
                            onClick={() => {
                                const mapRect =
                                    mapRectRef.current
                                const host =
                                    hostRef.current

                                if (
                                    !mapRect ||
                                    !host
                                ) {
                                    return
                                }

                                applyCameraTransform(
                                    zoomCameraAtPoint(
                                        cameraRef.current,
                                        cameraRef
                                            .current
                                            .scale *
                                        CAMERA_ZOOM_STEP,
                                        {
                                            x:
                                                host.clientWidth /
                                                2,
                                            y:
                                                host.clientHeight /
                                                2,
                                        },
                                        mapRect,
                                        {
                                            width:
                                                host.clientWidth,
                                            height:
                                                host.clientHeight,
                                        },
                                    ),
                                )
                            }}
                        >
                            +
                        </button>

                        <button
                            type="button"
                            className="map-camera-reset"
                            onClick={
                                resetCamera
                            }
                        >
                            Reset
                        </button>
                    </div>
                )}

            {visibleStatus.kind ===
                'ready' &&
                matchSummary && (
                    <div className="map-summary-control">
                        <button
                            type="button"
                            className="map-summary-toggle"
                            aria-expanded={
                                summaryOpen
                            }
                            aria-controls="map-summary-panel"
                            onClick={() =>
                                setSummaryOpen(
                                    (
                                        current,
                                    ) =>
                                        !current,
                                )
                            }
                        >
                            <span
                                className="map-summary-toggle-icon"
                                aria-hidden="true"
                            >
                                ≡
                            </span>
                            Match Summary
                        </button>

                        {summaryOpen && (
                            <div
                                id="map-summary-panel"
                                className="map-summary-panel"
                            >
                                <div className="map-summary-panel-heading">
                                    <strong>
                                        Match
                                        Summary
                                    </strong>
                                    <button
                                        type="button"
                                        className="map-summary-close"
                                        aria-label="Close match summary"
                                        onClick={() =>
                                            setSummaryOpen(
                                                false,
                                            )
                                        }
                                    >
                                        ×
                                    </button>
                                </div>

                                <dl className="map-summary-list">
                                    <div>
                                        <dt>
                                            Duration
                                        </dt>
                                        <dd>
                                            {formatMatchDuration(
                                                matchSummary.duration_seconds,
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            Participants
                                        </dt>
                                        <dd>
                                            {
                                                matchSummary.participant_count
                                            }
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            Humans
                                        </dt>
                                        <dd>
                                            {
                                                matchSummary.human_count
                                            }
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            Bots
                                        </dt>
                                        <dd>
                                            {
                                                matchSummary.bot_count
                                            }
                                        </dd>
                                    </div>

                                    <div
                                        className="map-summary-divider"
                                        aria-hidden="true"
                                    />

                                    <div>
                                        <dt>
                                            Events
                                        </dt>
                                        <dd>
                                            {getTotalEventCount(
                                                matchSummary.event_counts,
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            Kills
                                        </dt>
                                        <dd>
                                            {
                                                matchSummary
                                                    .event_counts
                                                    .kill
                                            }
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            Deaths
                                        </dt>
                                        <dd>
                                            {
                                                matchSummary
                                                    .event_counts
                                                    .death
                                            }
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            Loot
                                        </dt>
                                        <dd>
                                            {
                                                matchSummary
                                                    .event_counts
                                                    .loot
                                            }
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            Storm
                                            deaths
                                        </dt>
                                        <dd>
                                            {
                                                matchSummary
                                                    .event_counts
                                                    .storm_death
                                            }
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        )}
                    </div>
                )}

            {eventTooltip && (
                <div
                    className="event-tooltip"
                    style={{
                        left:
                            eventTooltip.x +
                            12,
                        top:
                            eventTooltip.y +
                            12,
                    }}
                    role="tooltip"
                >
                    <div className="event-tooltip-heading">
                        <strong>
                            {
                                eventTooltip
                                    .model
                                    .title
                            }
                        </strong>
                        <span>
                            {
                                eventTooltip
                                    .model
                                    .elapsedTime
                            }
                        </span>
                    </div>

                    <dl className="event-tooltip-details">
                        <div>
                            <dt>
                                Participant
                            </dt>
                            <dd>
                                {
                                    eventTooltip
                                        .model
                                        .participantId
                                }
                            </dd>
                        </div>
                        <div>
                            <dt>
                                Category
                            </dt>
                            <dd>
                                {
                                    eventTooltip
                                        .model
                                        .participantCategory
                                }
                            </dd>
                        </div>
                        <div>
                            <dt>
                                Role
                            </dt>
                            <dd>
                                {
                                    eventTooltip
                                        .model
                                        .ownerRole
                                }
                            </dd>
                        </div>

                        {eventTooltip.model
                            .sourceCategory && (
                                <div>
                                    <dt>
                                        Source
                                    </dt>
                                    <dd>
                                        {
                                            eventTooltip
                                                .model
                                                .sourceCategory
                                        }
                                    </dd>
                                </div>
                            )}

                        {eventTooltip.model
                            .targetCategory && (
                                <div>
                                    <dt>
                                        Target
                                    </dt>
                                    <dd>
                                        {
                                            eventTooltip
                                                .model
                                                .targetCategory
                                        }
                                    </dd>
                                </div>
                            )}

                        {eventTooltip.model.metadata.map(
                            (item) => (
                                <div
                                    key={
                                        item.key
                                    }
                                >
                                    <dt>
                                        {
                                            item.key
                                        }
                                    </dt>
                                    <dd>
                                        {
                                            item.value
                                        }
                                    </dd>
                                </div>
                            ),
                        )}
                    </dl>
                </div>
            )}
        </div>
    )
}

export default MapViewport
