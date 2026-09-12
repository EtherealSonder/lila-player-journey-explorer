import { describe, expect, it } from 'vitest'

import {
    DEFAULT_VISUALIZATION_VISIBILITY,
    isEventTypeVisible,
    isParticipantCategoryVisible,
} from '../../src/visualization/visibility'

describe('visualization visibility', () => {
    it('shows all required categories by default', () => {
        expect(DEFAULT_VISUALIZATION_VISIBILITY).toEqual({
            humans: true,
            bots: true,
            kills: true,
            deaths: true,
            loot: true,
            stormDeaths: true,
        })
    })

    it('controls human and bot participant categories independently', () => {
        const visibility = {
            ...DEFAULT_VISUALIZATION_VISIBILITY,
            humans: false,
        }

        expect(
            isParticipantCategoryVisible(
                'human',
                visibility,
            ),
        ).toBe(false)
        expect(
            isParticipantCategoryVisible(
                'bot',
                visibility,
            ),
        ).toBe(true)
    })

    it('controls every normalized event type independently', () => {
        const visibility = {
            ...DEFAULT_VISUALIZATION_VISIBILITY,
            kills: false,
            loot: false,
        }

        expect(isEventTypeVisible('kill', visibility)).toBe(false)
        expect(isEventTypeVisible('death', visibility)).toBe(true)
        expect(isEventTypeVisible('loot', visibility)).toBe(false)
        expect(
            isEventTypeVisible('storm_death', visibility),
        ).toBe(true)
    })

    it('keeps unknown participants visible while either participant group is enabled', () => {
        expect(
            isParticipantCategoryVisible(
                'unknown',
                {
                    ...DEFAULT_VISUALIZATION_VISIBILITY,
                    humans: false,
                    bots: true,
                },
            ),
        ).toBe(true)

        expect(
            isParticipantCategoryVisible(
                'unknown',
                {
                    ...DEFAULT_VISUALIZATION_VISIBILITY,
                    humans: false,
                    bots: false,
                },
            ),
        ).toBe(false)
    })
})
