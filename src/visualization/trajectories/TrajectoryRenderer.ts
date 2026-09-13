import {
    Container,
    Graphics,
} from 'pixi.js'

import type { MapRenderRect } from '../../map/mapGeometry'
import { getVisibleTrackAtTime } from '../../playback/visibleTrack'
import type {
    MatchData,
    ParticipantCategory,
    ParticipantTrack,
} from '../../telemetry/types'
import {
    isParticipantCategoryVisible,
    type VisualizationVisibility,
} from '../visibility'
import {
    projectTelemetryPoint,
    type ViewportPoint,
} from './trajectoryGeometry'
import {
    getCameraAwareTrajectoryLocalScale,
} from '../camera/trajectoryScale'

interface TrajectoryStyle {
    outerColor: number
    outerWidth: number
    outerAlpha: number
    middleColor: number
    middleWidth: number
    middleAlpha: number
    innerColor: number
    innerWidth: number
    innerAlpha: number
}

interface TrackRenderEntry {
    track: ParticipantTrack
    category: ParticipantCategory
    container: Container
    outerStroke: Graphics
    middleStroke: Graphics
    innerStroke: Graphics
}

const HUMAN_STYLE: TrajectoryStyle = {
    outerColor: 0x10141a,
    outerWidth: 5.4,
    outerAlpha: 0.82,
    middleColor: 0xf4f7fb,
    middleWidth: 3.7,
    middleAlpha: 0.95,
    innerColor: 0x4f7dff,
    innerWidth: 2.4,
    innerAlpha: 1,
}

const BOT_STYLE: TrajectoryStyle = {
    outerColor: 0x10141a,
    outerWidth: 4.7,
    outerAlpha: 0.78,
    middleColor: 0xf7f9fc,
    middleWidth: 3.2,
    middleAlpha: 0.94,
    innerColor: 0xbfc7d3,
    innerWidth: 1.6,
    innerAlpha: 0.92,
}

const UNKNOWN_STYLE: TrajectoryStyle = {
    outerColor: 0x10141a,
    outerWidth: 4.7,
    outerAlpha: 0.78,
    middleColor: 0xf7f9fc,
    middleWidth: 3.2,
    middleAlpha: 0.94,
    innerColor: 0xe3ad47,
    innerWidth: 1.6,
    innerAlpha: 0.94,
}


export class TrajectoryRenderer {
    private readonly container: Container
    private matchData: MatchData | null = null
    private entries: TrackRenderEntry[] = []
    private cameraScale = 1

    constructor(
        container: Container,
    ) {
        this.container = container
    }

    setCameraScale(
        cameraScale: number,
    ): boolean {
        const nextScale =
            Number.isFinite(cameraScale) &&
                cameraScale > 0
                ? cameraScale
                : 1

        if (
            Math.abs(
                nextScale -
                this.cameraScale,
            ) < 0.0001
        ) {
            return false
        }

        this.cameraScale = nextScale
        return true
    }

    render(
        matchData: MatchData,
        mapRect: MapRenderRect,
        visibility: VisualizationVisibility,
        currentTimeSeconds: number,
    ): void {
        this.ensureMatch(matchData)

        for (const entry of this.entries) {
            const categoryVisible =
                isParticipantCategoryVisible(
                    entry.category,
                    visibility,
                )

            const visibleTrack =
                categoryVisible
                    ? getVisibleTrackAtTime(
                        entry.track,
                        currentTimeSeconds,
                    )
                    : []

            if (visibleTrack.length < 2) {
                entry.container.visible = false
                this.clearEntryGeometry(entry)
                continue
            }

            const projected = visibleTrack.map((point) =>
                projectTelemetryPoint(
                    point,
                    mapRect,
                ),
            )

            entry.container.visible = true
            this.drawEntry(entry, projected)
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

        for (const track of matchData.tracks) {
            const category =
                participantCategories.get(
                    track.participant_id,
                ) ?? 'unknown'

            const entry =
                createTrackRenderEntry(
                    track,
                    category,
                )

            entry.container.label =
                `trajectory:${category}:${track.participant_id}`

            entry.container.visible = false

            this.entries.push(entry)
            this.container.addChild(
                entry.container,
            )
        }
    }

    private clearEntryGeometry(
        entry: TrackRenderEntry,
    ): void {
        entry.outerStroke.clear()
        entry.middleStroke.clear()
        entry.innerStroke.clear()
    }

    private drawEntry(
        entry: TrackRenderEntry,
        points: readonly ViewportPoint[],
    ): void {
        const style =
            getTrajectoryStyle(entry.category)
        const widthScale =
            getCameraAwareTrajectoryLocalScale(
                this.cameraScale,
            )

        this.clearEntryGeometry(entry)

        drawContinuousPath(
            entry.outerStroke,
            points,
        )
        entry.outerStroke.stroke({
            color: style.outerColor,
            width: style.outerWidth * widthScale,
            alpha: style.outerAlpha,
            cap: 'round',
            join: 'round',
        })

        drawContinuousPath(
            entry.middleStroke,
            points,
        )
        entry.middleStroke.stroke({
            color: style.middleColor,
            width: style.middleWidth * widthScale,
            alpha: style.middleAlpha,
            cap: 'round',
            join: 'round',
        })

        drawContinuousPath(
            entry.innerStroke,
            points,
        )
        entry.innerStroke.stroke({
            color: style.innerColor,
            width: style.innerWidth * widthScale,
            alpha: style.innerAlpha,
            cap: 'round',
            join: 'round',
        })
    }
}

function createTrackRenderEntry(
    track: ParticipantTrack,
    category: ParticipantCategory,
): TrackRenderEntry {
    const container = new Container()
    const outerStroke = new Graphics()
    const middleStroke = new Graphics()
    const innerStroke = new Graphics()

    container.addChild(
        outerStroke,
        middleStroke,
        innerStroke,
    )

    return {
        track,
        category,
        container,
        outerStroke,
        middleStroke,
        innerStroke,
    }
}

function getTrajectoryStyle(
    category: ParticipantCategory,
): TrajectoryStyle {
    if (category === 'human') {
        return HUMAN_STYLE
    }

    if (category === 'bot') {
        return BOT_STYLE
    }

    return UNKNOWN_STYLE
}

function drawContinuousPath(
    graphics: Graphics,
    points: readonly ViewportPoint[],
): void {
    const first = points[0]

    if (!first) {
        return
    }

    graphics.moveTo(first.x, first.y)

    for (
        let index = 1;
        index < points.length;
        index += 1
    ) {
        const point = points[index]

        if (point) {
            graphics.lineTo(
                point.x,
                point.y,
            )
        }
    }
}
