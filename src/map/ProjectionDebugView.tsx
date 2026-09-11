import { useEffect, useMemo, useRef, useState } from 'react'
import { fitMapToViewport, type MapRenderRect } from './mapGeometry'
import { mapUvToViewportPixels } from './mapOverlay'
import {
    PROJECTION_VALIDATION_CASES,
    validateProjectionCaseData,
    type ProjectionValidationCase,
} from './projectionValidationCases'
import type {
    GameMap,
    ManifestPayload,
    MapsPayload,
    MatchData,
    MatchSummary,
    ParticipantTrack,
} from '../telemetry/types'

interface LoadState {
    maps: GameMap[]
    matches: MatchSummary[]
}

interface ViewportSize {
    width: number
    height: number
}

const EMPTY_LOAD_STATE: LoadState = {
    maps: [],
    matches: [],
}

function ProjectionDebugView() {
    const [data, setData] = useState<LoadState>(EMPTY_LOAD_STATE)
    const [selectedMapId, setSelectedMapId] = useState('')
    const [selectedMatchId, setSelectedMatchId] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [matchData, setMatchData] = useState<MatchData | null>(null)
    const [isMatchLoading, setIsMatchLoading] = useState(false)
    const [matchLoadError, setMatchLoadError] = useState<string | null>(null)
    const [viewportSize, setViewportSize] = useState<ViewportSize | null>(null)

    const minimapFrameRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        let cancelled = false

        async function loadDebugData() {
            try {
                setIsLoading(true)
                setLoadError(null)

                const [mapsResponse, manifestResponse] = await Promise.all([
                    fetch('/data/maps.json'),
                    fetch('/data/manifest.json'),
                ])

                if (!mapsResponse.ok) {
                    throw new Error(
                        `Failed to load /data/maps.json (${mapsResponse.status})`,
                    )
                }

                if (!manifestResponse.ok) {
                    throw new Error(
                        `Failed to load /data/manifest.json (${manifestResponse.status})`,
                    )
                }

                const mapsPayload = (await mapsResponse.json()) as MapsPayload
                const manifestPayload =
                    (await manifestResponse.json()) as ManifestPayload

                if (cancelled) {
                    return
                }

                setData({
                    maps: mapsPayload.maps,
                    matches: manifestPayload.matches,
                })

                const firstValidationCase = PROJECTION_VALIDATION_CASES[0]
                setSelectedMapId(firstValidationCase.mapId)
                setSelectedMatchId(firstValidationCase.matchId)
            } catch (error) {
                if (cancelled) {
                    return
                }

                setLoadError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to load projection debug data.',
                )
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                }
            }
        }

        void loadDebugData()

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!selectedMatchId) {
            return
        }

        let cancelled = false

        async function loadSelectedMatch() {
            try {
                setIsMatchLoading(true)
                setMatchLoadError(null)
                setMatchData(null)

                const response = await fetch(
                    `/data/matches/${selectedMatchId}.json`,
                )

                if (!response.ok) {
                    throw new Error(
                        `Failed to load selected match (${response.status})`,
                    )
                }

                const loadedMatch = (await response.json()) as MatchData

                if (cancelled) {
                    return
                }

                if (loadedMatch.match_id !== selectedMatchId) {
                    throw new Error(
                        'Selected match payload does not match the requested match ID.',
                    )
                }

                if (loadedMatch.map_id !== selectedMapId) {
                    throw new Error(
                        'Selected match payload does not belong to the selected map.',
                    )
                }

                setMatchData(loadedMatch)
            } catch (error) {
                if (cancelled) {
                    return
                }

                setMatchLoadError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to load selected match.',
                )
            } finally {
                if (!cancelled) {
                    setIsMatchLoading(false)
                }
            }
        }

        void loadSelectedMatch()

        return () => {
            cancelled = true
        }
    }, [selectedMapId, selectedMatchId])

    useEffect(() => {
        const frame = minimapFrameRef.current

        if (!frame) {
            return
        }

        const updateViewportSize = () => {
            const rect = frame.getBoundingClientRect()

            setViewportSize({
                width: rect.width,
                height: rect.height,
            })
        }

        updateViewportSize()

        const resizeObserver = new ResizeObserver(updateViewportSize)
        resizeObserver.observe(frame)

        return () => {
            resizeObserver.disconnect()
        }
    }, [selectedMapId, isLoading, loadError])

    const selectedMap = useMemo(
        () => data.maps.find((map) => map.id === selectedMapId) ?? null,
        [data.maps, selectedMapId],
    )

    const matchesForSelectedMap = useMemo(
        () =>
            data.matches.filter(
                (match) => match.map_id === selectedMapId,
            ),
        [data.matches, selectedMapId],
    )

    const selectedMatch = useMemo(
        () =>
            matchesForSelectedMap.find(
                (match) => match.match_id === selectedMatchId,
            ) ?? null,
        [matchesForSelectedMap, selectedMatchId],
    )

    const selectedValidationCase = useMemo(
        () =>
            PROJECTION_VALIDATION_CASES.find(
                (validationCase) =>
                    validationCase.matchId === selectedMatchId,
            ) ?? null,
        [selectedMatchId],
    )

    const selectedValidationResult = useMemo(() => {
        if (!selectedValidationCase || !matchData) {
            return null
        }

        return validateProjectionCaseData(
            selectedValidationCase,
            matchData,
        )
    }, [selectedValidationCase, matchData])

    const mapRenderRect = useMemo<MapRenderRect | null>(() => {
        if (
            !selectedMap ||
            !viewportSize ||
            selectedMap.texture_width === null ||
            selectedMap.texture_height === null ||
            viewportSize.width <= 0 ||
            viewportSize.height <= 0
        ) {
            return null
        }

        return fitMapToViewport(
            {
                width: selectedMap.texture_width,
                height: selectedMap.texture_height,
            },
            viewportSize,
        )
    }, [selectedMap, viewportSize])

    function handleMapChange(mapId: string) {
        const firstMatchId =
            data.matches.find((match) => match.map_id === mapId)?.match_id ?? ''

        setSelectedMapId(mapId)
        setSelectedMatchId(firstMatchId)
    }

    function loadValidationCase(
        validationCase: ProjectionValidationCase,
    ) {
        setSelectedMapId(validationCase.mapId)
        setSelectedMatchId(validationCase.matchId)
    }

    function formatDimension(value: number): string {
        return Math.round(value).toString()
    }

    return (
        <main className="projection-debug-page">
            <header className="projection-debug-header">
                <div>
                    <p className="projection-debug-eyebrow">
                        Player Journey Explorer
                    </p>
                    <h1>Projection Debug</h1>
                    <p className="projection-debug-description">
                        Phase 3F final regression view. The renderer now uses
                        the single validated vertical transform.
                    </p>
                </div>
            </header>

            <section className="validation-matrix">
                <div className="validation-matrix-header">
                    <div>
                        <h2>Representative validation cases</h2>
                        <p>
                            Final regression pass using the locked renderer
                            transform.
                        </p>
                    </div>
                </div>

                <div className="validation-case-grid">
                    {PROJECTION_VALIDATION_CASES.map((validationCase) => {
                        const isSelected =
                            validationCase.matchId === selectedMatchId

                        return (
                            <button
                                key={validationCase.id}
                                type="button"
                                className={`validation-case-button${isSelected
                                        ? ' validation-case-button-selected'
                                        : ''
                                    }`}
                                onClick={() =>
                                    loadValidationCase(validationCase)
                                }
                            >
                                <span className="validation-case-map">
                                    {validationCase.mapId}
                                </span>
                                <strong>{validationCase.label}</strong>
                                <span>{validationCase.reason}</span>
                            </button>
                        )
                    })}
                </div>
            </section>

            <section
                className="projection-debug-controls"
                aria-label="Projection debug controls"
            >
                <label className="debug-control">
                    <span>Map</span>
                    <select
                        value={selectedMapId}
                        onChange={(event) =>
                            handleMapChange(event.target.value)
                        }
                        disabled={isLoading || data.maps.length === 0}
                    >
                        {data.maps.map((map) => (
                            <option key={map.id} value={map.id}>
                                {map.display_name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="debug-control debug-control-match">
                    <span>Match</span>
                    <select
                        value={selectedMatchId}
                        onChange={(event) =>
                            setSelectedMatchId(event.target.value)
                        }
                        disabled={
                            isLoading || matchesForSelectedMap.length === 0
                        }
                    >
                        {matchesForSelectedMap.map((match) => (
                            <option
                                key={match.match_id}
                                value={match.match_id}
                            >
                                {match.match_id}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="locked-orientation">
                    <span>Renderer orientation</span>
                    <strong>Flip Y. Locked</strong>
                </div>
            </section>

            {isLoading && (
                <section className="debug-status">
                    Loading generated map metadata...
                </section>
            )}

            {loadError && (
                <section className="debug-status debug-status-error">
                    <strong>Could not load generated frontend data.</strong>
                    <span>{loadError}</span>
                </section>
            )}

            {matchLoadError && (
                <section className="debug-status debug-status-error">
                    <strong>Could not load selected match.</strong>
                    <span>{matchLoadError}</span>
                </section>
            )}

            {selectedValidationResult && (
                <section
                    className={`debug-status ${selectedValidationResult.passed
                            ? 'debug-status-pass'
                            : 'debug-status-error'
                        }`}
                >
                    <strong>
                        Representative data check:{' '}
                        {selectedValidationResult.passed
                            ? 'PASS'
                            : 'FAIL'}
                    </strong>

                    {selectedValidationResult.errors.map((error) => (
                        <span key={error}>{error}</span>
                    ))}
                </section>
            )}

            {!isLoading && !loadError && selectedMap && (
                <>
                    <section className="projection-debug-viewport">
                        <div
                            ref={minimapFrameRef}
                            className="minimap-frame"
                            style={{
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            {mapRenderRect && (
                                <>
                                    <img
                                        className="minimap-image"
                                        src={selectedMap.image_path}
                                        alt={`${selectedMap.display_name} minimap`}
                                        style={{
                                            position: 'absolute',
                                            left: mapRenderRect.x,
                                            top: mapRenderRect.y,
                                            width: mapRenderRect.width,
                                            height: mapRenderRect.height,
                                            maxWidth: 'none',
                                            maxHeight: 'none',
                                        }}
                                    />

                                    {matchData && (
                                        <TrajectoryOverlay
                                            tracks={matchData.tracks}
                                            mapRect={mapRenderRect}
                                            viewportSize={viewportSize}
                                        />
                                    )}
                                </>
                            )}

                            {isMatchLoading && (
                                <div className="trajectory-loading">
                                    Loading selected match trajectories...
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="projection-debug-info">
                        <div>
                            <span className="debug-info-label">Map ID</span>
                            <strong>{selectedMap.id}</strong>
                        </div>

                        <div>
                            <span className="debug-info-label">
                                Source texture
                            </span>
                            <strong>
                                {selectedMap.texture_width ?? 'unknown'} x{' '}
                                {selectedMap.texture_height ?? 'unknown'}
                            </strong>
                        </div>

                        <div>
                            <span className="debug-info-label">
                                Map rectangle
                            </span>
                            <strong>
                                {mapRenderRect
                                    ? `${formatDimension(mapRenderRect.width)} x ${formatDimension(mapRenderRect.height)}`
                                    : 'waiting for layout'}
                            </strong>
                        </div>

                        <div>
                            <span className="debug-info-label">
                                Vertical mode
                            </span>
                            <strong>Flip Y. Locked</strong>
                        </div>

                        <div>
                            <span className="debug-info-label">
                                Selected match
                            </span>
                            <strong>
                                {selectedMatch
                                    ? `${selectedMatch.participant_count} participants`
                                    : 'none'}
                            </strong>
                        </div>

                        <div>
                            <span className="debug-info-label">
                                Trajectory points
                            </span>
                            <strong>
                                {matchData
                                    ? matchData.tracks
                                        .reduce(
                                            (total, track) =>
                                                total + track.points.length,
                                            0,
                                        )
                                        .toLocaleString()
                                    : isMatchLoading
                                        ? 'loading'
                                        : 'none'}
                            </strong>
                        </div>
                    </section>
                </>
            )}
        </main>
    )
}

interface TrajectoryOverlayProps {
    tracks: ParticipantTrack[]
    mapRect: MapRenderRect
    viewportSize: ViewportSize | null
}

function TrajectoryOverlay({
    tracks,
    mapRect,
    viewportSize,
}: TrajectoryOverlayProps) {
    if (!viewportSize) {
        return null
    }

    return (
        <svg
            className="trajectory-overlay"
            width={viewportSize.width}
            height={viewportSize.height}
            viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
            aria-label="Telemetry trajectory debug overlay"
        >
            {tracks.map((track) => {
                if (track.points.length === 0) {
                    return null
                }

                const points = track.points
                    .map((point) =>
                        mapUvToViewportPixels(
                            {
                                mapU: point.map_u,
                                mapV: point.map_v,
                            },
                            mapRect,
                        ),
                    )
                    .map((point) => `${point.x},${point.y}`)
                    .join(' ')

                return (
                    <polyline
                        key={track.participant_id}
                        points={points}
                        className="trajectory-debug-line"
                    />
                )
            })}
        </svg>
    )
}

export default ProjectionDebugView
