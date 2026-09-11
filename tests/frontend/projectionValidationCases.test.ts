import { describe, expect, it } from 'vitest'

import type { MatchData } from '../../src/telemetry/types'
import {
    PROJECTION_VALIDATION_CASES,
    validateProjectionCaseData,
} from '../../src/map/projectionValidationCases'

function makeMatchData(overrides: Partial<MatchData> = {}): MatchData {
    return {
        match_id: 'test-match',
        date: '2026-02-10',
        map_id: 'AmbroseValley',
        duration_seconds: 100,
        participants: [],
        tracks: [],
        events: [],
        ...overrides,
    }
}

describe('PROJECTION_VALIDATION_CASES', () => {
    it('covers all three supplied maps', () => {
        const mapIds = new Set(
            PROJECTION_VALIDATION_CASES.map((validationCase) => validationCase.mapId),
        )

        expect(mapIds).toEqual(
            new Set(['AmbroseValley', 'GrandRift', 'Lockdown']),
        )
    })

    it('contains the five locked representative validation cases', () => {
        expect(PROJECTION_VALIDATION_CASES).toHaveLength(5)

        expect(
            PROJECTION_VALIDATION_CASES.map(
                (validationCase) => validationCase.matchId,
            ),
        ).toEqual([
            'fbbc5d02-dd79-42fb-bba5-d768023891c8',
            'de5aa1ae-6246-4cfb-9941-adf5996ef678',
            'ac049b28-8116-4ff1-9e60-4be0537b8cc9',
            'd19d188e-a608-4a22-a198-da1a63b43de4',
            'd0a38c30-d476-4305-857d-ece9e65f72e6',
        ])
    })
})

describe('validateProjectionCaseData', () => {
    it('passes when map, match, participants, and point count match', () => {
        const validationCase = PROJECTION_VALIDATION_CASES[3]

        const matchData = makeMatchData({
            match_id: validationCase.matchId,
            map_id: validationCase.mapId,
            participants: Array.from(
                { length: validationCase.expectedParticipantCount },
                (_, index) => ({
                    id: `participant-${index}`,
                    category: index === 0 ? 'human' : 'bot',
                }),
            ),
            tracks: [
                {
                    participant_id: 'participant-0',
                    points: Array.from(
                        {
                            length:
                                validationCase.expectedTrajectoryPointCount ?? 0,
                        },
                        (_, index) => ({
                            time_seconds: index,
                            world_x: 0,
                            world_y: 0,
                            world_z: 0,
                            map_u: 0.5,
                            map_v: 0.5,
                        }),
                    ),
                },
            ],
        })

        expect(
            validateProjectionCaseData(validationCase, matchData),
        ).toEqual({
            passed: true,
            errors: [],
            trajectoryPointCount:
                validationCase.expectedTrajectoryPointCount,
        })
    })

    it('reports mismatched representative data', () => {
        const validationCase = PROJECTION_VALIDATION_CASES[4]

        const result = validateProjectionCaseData(
            validationCase,
            makeMatchData({
                match_id: 'wrong-match',
                map_id: 'AmbroseValley',
                participants: [],
                tracks: [],
            }),
        )

        expect(result.passed).toBe(false)
        expect(result.errors).toHaveLength(4)
    })

    it('allows a case without a locked trajectory-point total', () => {
        const validationCase = PROJECTION_VALIDATION_CASES[1]

        const result = validateProjectionCaseData(
            validationCase,
            makeMatchData({
                match_id: validationCase.matchId,
                map_id: validationCase.mapId,
                participants: Array.from(
                    { length: validationCase.expectedParticipantCount },
                    (_, index) => ({
                        id: `participant-${index}`,
                        category: index === 0 ? 'human' : 'bot',
                    }),
                ),
                tracks: [
                    {
                        participant_id: 'participant-0',
                        points: [],
                    },
                ],
            }),
        )

        expect(result.passed).toBe(true)
    })
})
