import { useEffect, useMemo, useState } from 'react'

import './App.css'
import AppHeader from './components/AppHeader'
import ControlSidebar from './components/ControlSidebar'
import PlaybackBar from './components/PlaybackBar'
import MapViewport, {
    type MapViewportStatus,
} from './map/MapViewport'
import { usePlaybackController } from './playback/usePlaybackController'
import {
    loadManifest,
    loadMaps,
    loadMatch,
} from './telemetry/dataLoader'
import {
    getAvailableDatesForMap,
    getAvailableMapIds,
    getAvailableMatches,
    getInitialFilterSelection,
    updateDateSelection,
    updateMapSelection,
    updateMatchSelection,
    type FilterSelection,
} from './telemetry/filtering'
import type {
    ManifestPayload,
    MapsPayload,
    MatchData,
} from './telemetry/types'
import {
    DEFAULT_VISUALIZATION_VISIBILITY,
    type VisualizationVisibility,
} from './visualization/visibility'
import {
    buildHeatmapGridForMatch,
} from './visualization/heatmap/heatmapPipeline'
import type {
    HeatmapMode,
} from './visualization/heatmap/heatmapTypes'

type LoadState = 'loading' | 'ready' | 'error'

function App() {
    const [manifest, setManifest] =
        useState<ManifestPayload | null>(null)
    const [mapsPayload, setMapsPayload] =
        useState<MapsPayload | null>(null)
    const [selection, setSelection] =
        useState<FilterSelection>({
            mapId: '',
            date: '',
            matchId: '',
        })
    const [matchData, setMatchData] =
        useState<MatchData | null>(null)
    const [bootstrapState, setBootstrapState] =
        useState<LoadState>('loading')
    const [matchState, setMatchState] =
        useState<LoadState>('ready')
    const [bootstrapError, setBootstrapError] =
        useState<string>('')
    const [matchError, setMatchError] =
        useState<string>('')
    const [visibility, setVisibility] =
        useState<VisualizationVisibility>(
            DEFAULT_VISUALIZATION_VISIBILITY,
        )
    const [heatmapMode, setHeatmapMode] =
        useState<HeatmapMode>('none')

    useEffect(() => {
        let cancelled = false

        async function bootstrap(): Promise<void> {
            setBootstrapState('loading')
            setBootstrapError('')

            try {
                const [nextManifest, nextMaps] =
                    await Promise.all([
                        loadManifest(),
                        loadMaps(),
                    ])

                if (cancelled) {
                    return
                }

                setManifest(nextManifest)
                setMapsPayload(nextMaps)
                setSelection(
                    getInitialFilterSelection(
                        nextManifest.matches,
                    ),
                )
                setBootstrapState('ready')
            } catch (error) {
                if (cancelled) {
                    return
                }

                setBootstrapState('error')
                setBootstrapError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to load application data.',
                )
            }
        }

        void bootstrap()

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!selection.matchId) {
            return
        }

        let cancelled = false
        const requestedMatchId = selection.matchId

        async function loadSelectedMatch(): Promise<void> {
            setMatchState('loading')
            setMatchError('')

            try {
                const nextMatchData =
                    await loadMatch(requestedMatchId)

                if (cancelled) {
                    return
                }

                setMatchData(nextMatchData)
                setMatchState('ready')
            } catch (error) {
                if (cancelled) {
                    return
                }

                setMatchState('error')
                setMatchError(
                    error instanceof Error
                        ? error.message
                        : 'Failed to load selected match.',
                )
            }
        }

        void loadSelectedMatch()

        return () => {
            cancelled = true
        }
    }, [selection.matchId])

    const matchSummaries = useMemo(
        () => manifest?.matches ?? [],
        [manifest],
    )

    const availableMapIds = useMemo(
        () => getAvailableMapIds(matchSummaries),
        [matchSummaries],
    )

    const availableDates = useMemo(
        () =>
            getAvailableDatesForMap(
                matchSummaries,
                selection.mapId,
            ),
        [matchSummaries, selection.mapId],
    )

    const availableMatches = useMemo(
        () =>
            getAvailableMatches(
                matchSummaries,
                selection.mapId,
                selection.date,
            ),
        [
            matchSummaries,
            selection.mapId,
            selection.date,
        ],
    )

    const selectedMatchSummary = useMemo(
        () =>
            availableMatches.find(
                (match) =>
                    match.match_id ===
                    selection.matchId,
            ) ?? null,
        [availableMatches, selection.matchId],
    )

    const selectedMap = useMemo(
        () =>
            mapsPayload?.maps.find(
                (map) =>
                    map.id === selection.mapId,
            ) ?? null,
        [mapsPayload, selection.mapId],
    )

    const playback = usePlaybackController(
        selection.matchId,
        selectedMatchSummary?.duration_seconds ?? 0,
    )

    const selectedMatchIsLoaded =
        matchData?.match_id === selection.matchId

    
    const heatmapGrid = useMemo(
        () => {
            if (
                !selectedMatchIsLoaded ||
                !matchData
            ) {
                return null
            }

            return buildHeatmapGridForMatch(
                matchData,
                heatmapMode,
            )
        },
        [
            heatmapMode,
            matchData,
            selectedMatchIsLoaded,
        ],
    )

    const viewportStatus =
        useMemo<MapViewportStatus>(() => {
            if (bootstrapState === 'loading') {
                return {
                    kind: 'loading',
                    title: 'Loading dataset',
                    message:
                        'Reading map and match indexes.',
                }
            }

            if (bootstrapState === 'error') {
                return {
                    kind: 'error',
                    title: 'Dataset unavailable',
                    message:
                        bootstrapError ||
                        'The dataset index could not be loaded.',
                }
            }

            if (!selection.matchId || !selectedMap) {
                return {
                    kind: 'empty',
                    title: 'No match selected',
                    message:
                        matchSummaries.length === 0
                            ? 'No matches are available in the current dataset.'
                            : 'Choose a map, date, and match to continue.',
                }
            }

            if (matchState === 'error') {
                return {
                    kind: 'error',
                    title: 'Match unavailable',
                    message:
                        matchError ||
                        'The selected match could not be loaded.',
                }
            }

            if (
                matchState === 'loading' ||
                !selectedMatchIsLoaded
            ) {
                return {
                    kind: 'loading',
                    title: 'Loading match',
                    message: selectedMap.display_name,
                }
            }

            return {
                kind: 'ready',
                title: selectedMap.display_name,
                message: `${matchData.participants.length} participants, ${matchData.tracks.length} tracks, ${matchData.events.length} events`,
            }
        }, [
            bootstrapError,
            bootstrapState,
            matchData,
            matchError,
            matchState,
            matchSummaries.length,
            selectedMap,
            selectedMatchIsLoaded,
            selection.matchId,
        ])

    function replaceSelection(
        nextSelection: FilterSelection,
    ): void {
        if (
            nextSelection.matchId !==
            selection.matchId
        ) {
            
            setMatchData(null)
            setMatchError('')
            setMatchState(
                nextSelection.matchId
                    ? 'loading'
                    : 'ready',
            )
        }

        setSelection(nextSelection)
    }

    function handleMapChange(
        nextMapId: string,
    ): void {
        replaceSelection(
            updateMapSelection(
                matchSummaries,
                selection,
                nextMapId,
            ),
        )
    }

    function handleDateChange(
        nextDate: string,
    ): void {
        replaceSelection(
            updateDateSelection(
                matchSummaries,
                selection,
                nextDate,
            ),
        )
    }

    function handleMatchChange(
        nextMatchId: string,
    ): void {
        replaceSelection(
            updateMatchSelection(
                matchSummaries,
                selection,
                nextMatchId,
            ),
        )
    }

    function handleVisibilityChange(
        key: keyof VisualizationVisibility,
        visible: boolean,
    ): void {
        setVisibility((current) => ({
            ...current,
            [key]: visible,
        }))
    }

    return (
        <div className="app-shell">
            <AppHeader
                maps={mapsPayload?.maps ?? []}
                availableMapIds={availableMapIds}
                availableDates={availableDates}
                availableMatches={availableMatches}
                selection={selection}
                disabled={
                    bootstrapState !== 'ready'
                }
                onMapChange={handleMapChange}
                onDateChange={handleDateChange}
                onMatchChange={handleMatchChange}
            />

            <div className="app-main">
                <ControlSidebar
                    visibility={visibility}
                    heatmapMode={heatmapMode}
                    disabled={
                        bootstrapState !== 'ready'
                    }
                    onVisibilityChange={
                        handleVisibilityChange
                    }
                    onHeatmapModeChange={
                        setHeatmapMode
                    }
                />

                <main
                    className="map-workspace"
                    aria-label="Map workspace"
                >
                    <MapViewport
                        selectedMap={selectedMap}
                        selectedMatchId={
                            selection.matchId
                        }
                        matchData={
                            selectedMatchIsLoaded
                                ? matchData
                                : null
                        }
                        matchSummary={
                            selectedMatchSummary
                        }
                        visibility={visibility}
                        heatmapMode={heatmapMode}
                        heatmapGrid={heatmapGrid}
                        status={viewportStatus}
                        currentTimeSeconds={
                            playback.state.currentTime
                        }
                    />
                </main>
            </div>

            <PlaybackBar
                currentTimeSeconds={
                    playback.state.currentTime
                }
                durationSeconds={
                    playback.state.duration
                }
                isPlaying={
                    playback.state.isPlaying
                }
                playbackSpeed={
                    playback.state.playbackSpeed
                }
                disabled={
                    matchState !== 'ready' ||
                    !selectedMatchIsLoaded
                }
                onPlay={playback.play}
                onPause={playback.pause}
                onSeek={playback.seek}
                onSpeedChange={
                    playback.setSpeed
                }
            />
        </div>
    )
}

export default App
