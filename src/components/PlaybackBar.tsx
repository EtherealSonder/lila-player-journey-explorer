interface PlaybackBarProps {
    durationSeconds: number
}

function PlaybackBar({
    durationSeconds,
}: PlaybackBarProps) {
    return (
        <footer className="playback-bar" aria-label="Playback controls">
            <button type="button" className="playback-button" disabled>
                Play
            </button>

            <span className="playback-time">00:00</span>

            <div className="playback-track" aria-hidden="true">
                <div className="playback-track-fill" />
                <div className="playback-track-handle" />
            </div>

            <span className="playback-time">
                {formatDuration(durationSeconds)}
            </span>

            <button type="button" className="playback-speed" disabled>
                1x
            </button>
        </footer>
    )
}

function formatDuration(durationSeconds: number): string {
    const totalSeconds = Math.max(
        0,
        Math.round(durationSeconds),
    )
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default PlaybackBar
