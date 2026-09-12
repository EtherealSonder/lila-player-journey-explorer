import { describe, expect, it } from 'vitest'

import {
    DEFAULT_PLAYBACK_SPEED,
    PLAYBACK_SPEEDS,
    createPlaybackState,
    type PlaybackSpeed,
} from '../../src/playback/playbackState'
import {
    advancePlayback,
    clampPlaybackTime,
    pausePlayback,
    playPlayback,
    resetPlayback,
    seekPlayback,
    setPlaybackSpeed,
} from '../../src/playback/playbackMath'

describe('playback state and math', () => {
    it('creates a deterministic initial state', () => {
        expect(createPlaybackState(120)).toEqual({
            currentTime: 0,
            duration: 120,
            isPlaying: false,
            playbackSpeed: DEFAULT_PLAYBACK_SPEED,
        })
    })

    it('restricts the supported runtime speed list to 0.5x, 1x, 2x, and 4x', () => {
        expect(PLAYBACK_SPEEDS).toEqual([0.5, 1, 2, 4])
    })

    it('clamps negative seeks to zero', () => {
        const state = createPlaybackState(120)

        expect(seekPlayback(state, -15).currentTime).toBe(0)
        expect(clampPlaybackTime(-15, 120)).toBe(0)
    })

    it('clamps seeks beyond the duration to the duration', () => {
        const state = createPlaybackState(120)

        expect(seekPlayback(state, 999).currentTime).toBe(120)
        expect(clampPlaybackTime(999, 120)).toBe(120)
    })

    it.each([
        [0.5, 5],
        [1, 10],
        [2, 20],
        [4, 40],
    ] as const)(
        'advances correctly at %sx playback speed',
        (speed, expectedTime) => {
            let state = createPlaybackState(120)
            state = setPlaybackSpeed(
                state,
                speed as PlaybackSpeed,
            )
            state = playPlayback(state)
            state = advancePlayback(state, 10)

            expect(state.currentTime).toBe(expectedTime)
            expect(state.isPlaying).toBe(true)
        },
    )

    it('does not advance while paused', () => {
        const state = createPlaybackState(120)
        const advanced = advancePlayback(state, 10)

        expect(advanced).toBe(state)
        expect(advanced.currentTime).toBe(0)
    })

    it('can play and pause without changing the current time', () => {
        const initial = seekPlayback(
            createPlaybackState(120),
            25,
        )
        const playing = playPlayback(initial)
        const paused = pausePlayback(playing)

        expect(playing.isPlaying).toBe(true)
        expect(playing.currentTime).toBe(25)
        expect(paused.isPlaying).toBe(false)
        expect(paused.currentTime).toBe(25)
    })

    it('clamps at the end of the match and pauses', () => {
        let state = seekPlayback(
            createPlaybackState(120),
            115,
        )
        state = playPlayback(state)
        state = advancePlayback(state, 10)

        expect(state.currentTime).toBe(120)
        expect(state.isPlaying).toBe(false)
    })

    it('does not automatically rewind when play is requested at the end', () => {
        const atEnd = seekPlayback(
            createPlaybackState(120),
            120,
        )
        const result = playPlayback(atEnd)

        expect(result.currentTime).toBe(120)
        expect(result.isPlaying).toBe(false)
    })

    it('seeking to the end while playing pauses playback', () => {
        let state = playPlayback(createPlaybackState(120))
        state = seekPlayback(state, 120)

        expect(state.currentTime).toBe(120)
        expect(state.isPlaying).toBe(false)
    })

    it('a zero-duration match cannot play or advance', () => {
        let state = createPlaybackState(0)

        expect(state).toEqual({
            currentTime: 0,
            duration: 0,
            isPlaying: false,
            playbackSpeed: 1,
        })

        state = playPlayback(state)
        state = advancePlayback(state, 10)

        expect(state.currentTime).toBe(0)
        expect(state.isPlaying).toBe(false)
    })

    it('normalizes invalid and negative durations to zero', () => {
        expect(createPlaybackState(-10).duration).toBe(0)
        expect(createPlaybackState(Number.NaN).duration).toBe(0)
        expect(createPlaybackState(Number.POSITIVE_INFINITY).duration).toBe(0)
    })

    it('ignores invalid or non-positive real elapsed time', () => {
        const playing = playPlayback(createPlaybackState(120))

        expect(advancePlayback(playing, 0)).toBe(playing)
        expect(advancePlayback(playing, -1)).toBe(playing)
        expect(advancePlayback(playing, Number.NaN)).toBe(playing)
    })

    it('resets a new match deterministically', () => {
        let state = createPlaybackState(120)
        state = setPlaybackSpeed(state, 4)
        state = playPlayback(state)
        state = advancePlayback(state, 10)

        expect(state).toEqual({
            currentTime: 40,
            duration: 120,
            isPlaying: true,
            playbackSpeed: 4,
        })

        expect(resetPlayback(300)).toEqual({
            currentTime: 0,
            duration: 300,
            isPlaying: false,
            playbackSpeed: 1,
        })
    })
})
