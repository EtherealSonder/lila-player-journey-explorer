import {
    Container,
    Graphics,
} from 'pixi.js'

import type { MapRenderRect } from '../../map/mapGeometry'
import { getParticipantLifecycleAtTime } from '../../playback/participantLifecycle'
import type {
    MatchData,
    ParticipantCategory,
    ParticipantTrack,
    TelemetryEvent,
} from '../../telemetry/types'
import {
    isParticipantCategoryVisible,
    type VisualizationVisibility,
} from '../visibility'
import { projectTelemetryPoint } from '../trajectories/trajectoryGeometry'
import { getCameraAwareMarkerLocalScale } from '../camera/markerScale'

interface ParticipantMarkerStyle {
    fillColor: number
    innerStrokeColor: number
    outerColor: number
    size: number
    outerPadding: number
    innerStrokeWidth: number
    shape: 'circle' | 'diamond' | 'triangle'
}

interface ParticipantMarkerEntry {
    track: ParticipantTrack
    category: ParticipantCategory
    lifecycleEvents: TelemetryEvent[]
    marker: Container
}

const HUMAN_STYLE: ParticipantMarkerStyle = {
    fillColor: 0x6f8cff,
    innerStrokeColor: 0xffffff,
    outerColor: 0x171b22,
    size: 5.8,
    outerPadding: 1.9,
    innerStrokeWidth: 1.5,
    shape: 'circle',
}

const BOT_STYLE: ParticipantMarkerStyle = {
    fillColor: 0xd8dde5,
    innerStrokeColor: 0xf8fafc,
    outerColor: 0x171b22,
    size: 6.2,
    outerPadding: 1.8,
    innerStrokeWidth: 1.2,
    shape: 'diamond',
}

const UNKNOWN_STYLE: ParticipantMarkerStyle = {
    fillColor: 0xe2a94a,
    innerStrokeColor: 0xfff6dc,
    outerColor: 0x171b22,
    size: 6,
    outerPadding: 1.8,
    innerStrokeWidth: 1.2,
    shape: 'triangle',
}

/**
 * Playback-aware participant marker renderer.
 *
 * Marker display objects are retained for the active match. Playback only
 * updates their world-projected position and visible flag.
 */
export class ParticipantMarkerRenderer {
    private matchData: MatchData | null = null
    private entries: ParticipantMarkerEntry[] = []
    private cameraScale = 1
    private readonly container: Container

    constructor(
        container: Container,
    ) {
        this.container = container
    }

    setCameraScale(
        cameraScale: number,
    ): void {
        this.cameraScale =
            Number.isFinite(cameraScale) &&
                cameraScale > 0
                ? cameraScale
                : 1

        const markerScale =
            getCameraAwareMarkerLocalScale(
                this.cameraScale,
            )

        for (const entry of this.entries) {
            entry.marker.scale.set(
                markerScale,
                markerScale,
            )
        }
    }

    render(
        matchData: MatchData,
        mapRect: MapRenderRect,
        visibility: VisualizationVisibility,
        currentTimeSeconds: number,
    ): void {
        this.ensureMatch(matchData)

        for (const entry of this.entries) {
            if (
                !isParticipantCategoryVisible(
                    entry.category,
                    visibility,
                )
            ) {
                entry.marker.visible = false
                continue
            }

            const snapshot =
                getParticipantLifecycleAtTime(
                    entry.track,
                    entry.lifecycleEvents,
                    currentTimeSeconds,
                )

            if (
                !snapshot.visible ||
                !snapshot.position
            ) {
                entry.marker.visible = false
                continue
            }

            const projected =
                projectTelemetryPoint(
                    snapshot.position,
                    mapRect,
                )

            entry.marker.position.set(
                projected.x,
                projected.y,
            )
            entry.marker.visible = true
        }
    }

    clear(): void {
        this.matchData = null
        this.entries = []

        const children = this.container.removeChildren()

        for (const child of children) {
            child.destroy({
                children: true,
            })
        }
    }

    private ensureMatch(
        matchData: MatchData,
    ): void {
        if (this.matchData === matchData) {
            return
        }

        this.clear()
        this.matchData = matchData

        const participantCategories = new Map(
            matchData.participants.map((participant) => [
                participant.id,
                participant.category,
            ]),
        )

        const lifecycleEventsByParticipant =
            buildLifecycleEventIndex(
                matchData.events,
            )

        for (const track of matchData.tracks) {
            const category =
                participantCategories.get(
                    track.participant_id,
                ) ?? 'unknown'

            const marker =
                createMarkerContainer(category)

            marker.label =
                `participant-marker:${category}:${track.participant_id}`
            marker.visible = false

            const markerScale =
                getCameraAwareMarkerLocalScale(
                    this.cameraScale,
                )
            marker.scale.set(
                markerScale,
                markerScale,
            )

            const entry: ParticipantMarkerEntry = {
                track,
                category,
                lifecycleEvents:
                    lifecycleEventsByParticipant.get(
                        track.participant_id,
                    ) ?? [],
                marker,
            }

            this.entries.push(entry)
            this.container.addChild(marker)
        }
    }
}

/**
 * Keeps only the earliest lifecycle-ending event per participant.
 *
 * The pure lifecycle helper remains authoritative for the death rule, while
 * the renderer avoids scanning the full match event list for every participant
 * on every playback update.
 */
function buildLifecycleEventIndex(
    events: readonly TelemetryEvent[],
): Map<string, TelemetryEvent[]> {
    const earliest = new Map<
        string,
        TelemetryEvent
    >()

    for (const event of events) {
        if (
            event.owner_role !== 'victim' ||
            (
                event.type !== 'death' &&
                event.type !== 'storm_death'
            )
        ) {
            continue
        }

        const current =
            earliest.get(event.participant_id)

        if (
            !current ||
            event.time_seconds <
            current.time_seconds
        ) {
            earliest.set(
                event.participant_id,
                event,
            )
        }
    }

    return new Map(
        Array.from(
            earliest.entries(),
            ([participantId, event]) => [
                participantId,
                [event],
            ],
        ),
    )
}

function createMarkerContainer(
    category: ParticipantCategory,
): Container {
    const style =
        getParticipantMarkerStyle(category)
    const marker = new Container()

    const outer = new Graphics()
    drawMarkerShape(
        outer,
        style.shape,
        style.size + style.outerPadding,
    )
    outer.fill({
        color: style.outerColor,
        alpha: 0.9,
    })

    const inner = new Graphics()
    drawMarkerShape(
        inner,
        style.shape,
        style.size,
    )
    inner.fill({
        color: style.fillColor,
        alpha: 1,
    })
    inner.stroke({
        color: style.innerStrokeColor,
        width: style.innerStrokeWidth,
        alpha: 0.98,
        join: 'round',
    })

    marker.addChild(
        outer,
        inner,
    )

    return marker
}

function drawMarkerShape(
    graphics: Graphics,
    shape: ParticipantMarkerStyle['shape'],
    size: number,
): void {
    if (shape === 'circle') {
        graphics.circle(0, 0, size)
        return
    }

    if (shape === 'diamond') {
        graphics.poly([
            0,
            -size,
            size,
            0,
            0,
            size,
            -size,
            0,
        ])
        return
    }

    graphics.poly([
        0,
        -size,
        size,
        size,
        -size,
        size,
    ])
}

function getParticipantMarkerStyle(
    category: ParticipantCategory,
): ParticipantMarkerStyle {
    if (category === 'human') {
        return HUMAN_STYLE
    }

    if (category === 'bot') {
        return BOT_STYLE
    }

    return UNKNOWN_STYLE
}
