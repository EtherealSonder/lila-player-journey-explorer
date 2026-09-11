import type { MatchData } from '../telemetry/types'

export interface ProjectionValidationCase {
    id: string
    label: string
    mapId: string
    matchId: string
    reason: string
    expectedParticipantCount: number
    expectedTrajectoryPointCount?: number
}

export const PROJECTION_VALIDATION_CASES: readonly ProjectionValidationCase[] = [
    {
        id: 'ambrose-largest',
        label: 'Ambrose. Largest participant match',
        mapId: 'AmbroseValley',
        matchId: 'fbbc5d02-dd79-42fb-bba5-d768023891c8',
        reason: '16 participants. Dense Ambrose Valley coverage.',
        expectedParticipantCount: 16,
        expectedTrajectoryPointCount: 995,
    },
    {
        id: 'ambrose-large-second',
        label: 'Ambrose. Second large match',
        mapId: 'AmbroseValley',
        matchId: 'de5aa1ae-6246-4cfb-9941-adf5996ef678',
        reason: '15 participants. Additional dense Ambrose Valley stress case.',
        expectedParticipantCount: 15,
    },
    {
        id: 'ambrose-duplicate',
        label: 'Ambrose. Duplicate regression',
        mapId: 'AmbroseValley',
        matchId: 'ac049b28-8116-4ff1-9e60-4be0537b8cc9',
        reason: 'Known duplicate reconstruction case. Canonical output must contain 7 participants.',
        expectedParticipantCount: 7,
        expectedTrajectoryPointCount: 240,
    },
    {
        id: 'grandrift-representative',
        label: 'Grand Rift. Representative dense match',
        mapId: 'GrandRift',
        matchId: 'd19d188e-a608-4a22-a198-da1a63b43de4',
        reason: '12 participants. Representative non-square Grand Rift validation case.',
        expectedParticipantCount: 12,
        expectedTrajectoryPointCount: 454,
    },
    {
        id: 'lockdown-stress',
        label: 'Lockdown. Stress match',
        mapId: 'Lockdown',
        matchId: 'd0a38c30-d476-4305-857d-ece9e65f72e6',
        reason: '15 participants and 1,174 trajectory points. Largest browser payload stress case.',
        expectedParticipantCount: 15,
        expectedTrajectoryPointCount: 1174,
    },
]

export interface ProjectionValidationResult {
    passed: boolean
    errors: string[]
    trajectoryPointCount: number
}

export function validateProjectionCaseData(
    validationCase: ProjectionValidationCase,
    matchData: MatchData,
): ProjectionValidationResult {
    const errors: string[] = []
    const trajectoryPointCount = matchData.tracks.reduce(
        (total, track) => total + track.points.length,
        0,
    )

    if (matchData.match_id !== validationCase.matchId) {
        errors.push(
            `Expected match ${validationCase.matchId}, received ${matchData.match_id}.`,
        )
    }

    if (matchData.map_id !== validationCase.mapId) {
        errors.push(
            `Expected map ${validationCase.mapId}, received ${matchData.map_id}.`,
        )
    }

    if (
        matchData.participants.length !==
        validationCase.expectedParticipantCount
    ) {
        errors.push(
            `Expected ${validationCase.expectedParticipantCount} participants, received ${matchData.participants.length}.`,
        )
    }

    if (
        validationCase.expectedTrajectoryPointCount !== undefined &&
        trajectoryPointCount !== validationCase.expectedTrajectoryPointCount
    ) {
        errors.push(
            `Expected ${validationCase.expectedTrajectoryPointCount} trajectory points, received ${trajectoryPointCount}.`,
        )
    }

    return {
        passed: errors.length === 0,
        errors,
        trajectoryPointCount,
    }
}
