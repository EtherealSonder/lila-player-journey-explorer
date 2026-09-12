import type { ChangeEvent } from 'react'

import './PlaybackBar.css'
import {
    PLAYBACK_SPEEDS,
    type PlaybackSpeed,
} from '../playback/playbackState'
import { formatPlaybackTime } from '../playback/playbackFormatting'

interface PlaybackBarProps {
    currentTimeSeconds: number
    durationSeconds: number
    isPlaying: boolean
    playbackSpeed: PlaybackSpeed
    disabled?: boolean
    onPlay: () => void
    onPause: () => void
    onSeek: (time: number) => void
    onSpeedChange: (speed: PlaybackSpeed) => void
}

function PlaybackBar({
    currentTimeSeconds,
    durationSeconds,
    isPlaying,
    playbackSpeed,
    disabled = false,
    onPlay,
    onPause,
    onSeek,
    onSpeedChange,
}: PlaybackBarProps) {
    const hasDuration = durationSeconds > 0
    const controlsDisabled = disabled || !hasDuration
    const playDisabled =
        controlsDisabled ||
        (!isPlaying &&
            currentTimeSeconds >= durationSeconds)

    function handleSeek(
        event: ChangeEvent<HTMLInputElement>,
    ): void {
        onSeek(Number(event.target.value))
    }

    function handlePlayPause(): void {
        if (isPlaying) {
            onPause()
            return
        }

        onPlay()
    }

    return (
        <footer
            className="playback-bar"
            aria-label="Match playback controls"
        >
            <button
                type="button"
                className="playback-primary-button"
                onClick={handlePlayPause}
                disabled={playDisabled}
                aria-label={
                    isPlaying
                        ? 'Pause match playback'
                        : 'Play match playback'
                }
            >
                <span
                    className="playback-primary-icon"
                    aria-hidden="true"
                >
                    {isPlaying ? 'Ⅱ' : '▶'}
                </span>
                <span>
                    {isPlaying ? 'Pause' : 'Play'}
                </span>
            </button>

            <output
                className="playback-time playback-time-current"
                aria-label="Current playback time"
            >
                {formatPlaybackTime(
                    currentTimeSeconds,
                )}
            </output>

            <div className="playback-scrubber-wrap">
                <input
                    className="playback-scrubber"
                    type="range"
                    min={0}
                    max={Math.max(
                        0,
                        durationSeconds,
                    )}
                    step={0.01}
                    value={Math.min(
                        Math.max(
                            currentTimeSeconds,
                            0,
                        ),
                        Math.max(
                            durationSeconds,
                            0,
                        ),
                    )}
                    onChange={handleSeek}
                    disabled={controlsDisabled}
                    aria-label="Match playback position"
                    aria-valuetext={`${formatPlaybackTime(
                        currentTimeSeconds,
                    )} of ${formatPlaybackTime(
                        durationSeconds,
                    )}`}
                />
            </div>

            <output
                className="playback-time playback-time-duration"
                aria-label="Total match duration"
            >
                {formatPlaybackTime(
                    durationSeconds,
                )}
            </output>

            <fieldset
                className="playback-speed-control"
                disabled={controlsDisabled}
            >
                <legend className="sr-only">
                    Playback speed
                </legend>

                {PLAYBACK_SPEEDS.map((speed) => {
                    const selected =
                        playbackSpeed === speed

                    return (
                        <button
                            key={speed}
                            type="button"
                            className={
                                selected
                                    ? 'playback-speed-button is-active'
                                    : 'playback-speed-button'
                            }
                            aria-pressed={
                                selected
                            }
                            onClick={() =>
                                onSpeedChange(
                                    speed,
                                )
                            }
                        >
                            {speed}x
                        </button>
                    )
                })}
            </fieldset>
        </footer>
    )
}

export default PlaybackBar
