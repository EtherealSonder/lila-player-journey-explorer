import { describe, expect, expectTypeOf, it } from 'vitest'

import type {
    GameMap,
    ManifestPayload,
    MatchData,
    MatchSummary,
    Participant,
    ParticipantCategory,
    TelemetryEvent,
    TelemetryEventType,
    TelemetryPoint,
} from '../../src/telemetry/types'

describe('production frontend telemetry contract', () => {
    it('accepts the normalized participant categories only', () => {
        expectTypeOf<ParticipantCategory>().toEqualTypeOf<
            'human' | 'bot' | 'unknown'
        >()

        const participant: Participant = {
            id: 'participant-1',
            category: 'human',
        }

        expect(participant.category).toBe('human')
    })

    it('accepts the normalized frontend event vocabulary only', () => {
        expectTypeOf<TelemetryEventType>().toEqualTypeOf<
            'kill' | 'death' | 'storm_death' | 'loot'
        >()

        const event: TelemetryEvent = {
            time_seconds: 42.5,
            type: 'kill',
            participant_id: 'participant-1',
            participant_category: 'human',
            owner_role: 'killer',
            world_x: 10,
            world_y: 2,
            world_z: 20,
            map_u: 0.25,
            map_v: 0.75,
            source_category: 'human',
            target_category: 'bot',
            metadata: {},
        }

        expect(event.type).toBe('kill')
    })

    it('keeps world coordinates and normalized map coordinates together', () => {
        const point: TelemetryPoint = {
            time_seconds: 10,
            world_x: 100,
            world_y: 5,
            world_z: 200,
            map_u: 0.4,
            map_v: 0.6,
        }

        expect(point.map_u).toBe(0.4)
        expect(point.world_z).toBe(200)
    })

    it('represents the manifest as lightweight match summaries', () => {
        const summary: MatchSummary = {
            match_id: 'match-1',
            date: '2026-02-12',
            map_id: 'AmbroseValley',
            duration_seconds: 511,
            participant_count: 8,
            human_count: 2,
            bot_count: 6,
            event_counts: {
                kill: 7,
                death: 4,
                storm_death: 1,
                loot: 23,
            },
        }

        const manifest: ManifestPayload = {
            schema_version: 1,
            match_count: 1,
            map_ids: ['AmbroseValley'],
            dates: ['2026-02-12'],
            matches: [summary],
        }

        expect(manifest.matches[0].match_id).toBe('match-1')
        expect(manifest.matches[0].event_counts.loot).toBe(23)
    })

    it('represents map registry entries without requiring square textures', () => {
        const map: GameMap = {
            id: 'GrandRift',
            display_name: 'Grand Rift',
            image_path: '/assets/maps/GrandRift_Minimap.png',
            projection: {
                origin_x: -290,
                origin_z: -290,
                scale: 581,
            },
            texture_width: 2160,
            texture_height: 2158,
        }

        expect(map.texture_width).toBe(2160)
        expect(map.texture_height).toBe(2158)
    })

    it('represents one selected detailed match independently from the manifest', () => {
        const match: MatchData = {
            match_id: 'match-1',
            date: '2026-02-12',
            map_id: 'AmbroseValley',
            duration_seconds: 100,
            participants: [
                {
                    id: 'participant-1',
                    category: 'human',
                },
            ],
            tracks: [
                {
                    participant_id: 'participant-1',
                    points: [
                        {
                            time_seconds: 0,
                            world_x: 0,
                            world_y: 0,
                            world_z: 0,
                            map_u: 0.5,
                            map_v: 0.5,
                        },
                    ],
                },
            ],
            events: [],
        }

        expect(match.participants).toHaveLength(1)
        expect(match.tracks[0].points).toHaveLength(1)
    })
})
