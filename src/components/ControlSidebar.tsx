import type {
    GameMap,
    MatchSummary,
} from '../telemetry/types'
import type { FilterSelection } from '../telemetry/filtering'

interface ControlSidebarProps {
    maps: GameMap[]
    availableMapIds: string[]
    availableDates: string[]
    availableMatches: MatchSummary[]
    selection: FilterSelection
    selectedMatchSummary: MatchSummary | null
    disabled: boolean
    onMapChange: (mapId: string) => void
    onDateChange: (date: string) => void
    onMatchChange: (matchId: string) => void
}

function ControlSidebar({
    maps,
    availableMapIds,
    availableDates,
    availableMatches,
    selection,
    selectedMatchSummary,
    disabled,
    onMapChange,
    onDateChange,
    onMatchChange,
}: ControlSidebarProps) {
    const mapNames = new Map(
        maps.map((map) => [map.id, map.display_name]),
    )

    return (
        <aside className="control-sidebar" aria-label="Match controls">
            <section className="sidebar-section">
                <div className="sidebar-section-heading">
                    <h2>Match</h2>
                </div>

                <label className="sidebar-field">
                    <span>Map</span>
                    <select
                        value={selection.mapId}
                        disabled={disabled || availableMapIds.length === 0}
                        onChange={(event) =>
                            onMapChange(event.target.value)
                        }
                    >
                        {availableMapIds.length === 0 ? (
                            <option value="">No maps available</option>
                        ) : (
                            availableMapIds.map((mapId) => (
                                <option key={mapId} value={mapId}>
                                    {mapNames.get(mapId) ?? mapId}
                                </option>
                            ))
                        )}
                    </select>
                </label>

                <label className="sidebar-field">
                    <span>Date</span>
                    <select
                        value={selection.date}
                        disabled={disabled || availableDates.length === 0}
                        onChange={(event) =>
                            onDateChange(event.target.value)
                        }
                    >
                        {availableDates.length === 0 ? (
                            <option value="">No dates available</option>
                        ) : (
                            availableDates.map((date) => (
                                <option key={date} value={date}>
                                    {date}
                                </option>
                            ))
                        )}
                    </select>
                </label>

                <label className="sidebar-field">
                    <span>Match</span>
                    <select
                        value={selection.matchId}
                        disabled={disabled || availableMatches.length === 0}
                        onChange={(event) =>
                            onMatchChange(event.target.value)
                        }
                    >
                        {availableMatches.length === 0 ? (
                            <option value="">No matches available</option>
                        ) : (
                            availableMatches.map((match) => (
                                <option
                                    key={match.match_id}
                                    value={match.match_id}
                                >
                                    {match.match_id}
                                </option>
                            ))
                        )}
                    </select>
                </label>
            </section>

            <section className="sidebar-section">
                <div className="sidebar-section-heading">
                    <h2>Participants</h2>
                </div>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-human" />
                        Humans
                    </span>
                    <input type="checkbox" checked readOnly />
                </label>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-bot" />
                        Bots
                    </span>
                    <input type="checkbox" checked readOnly />
                </label>
            </section>

            <section className="sidebar-section">
                <div className="sidebar-section-heading">
                    <h2>Events</h2>
                </div>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-kill" />
                        Kills
                    </span>
                    <input type="checkbox" checked readOnly />
                </label>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-death" />
                        Deaths
                    </span>
                    <input type="checkbox" checked readOnly />
                </label>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-loot" />
                        Loot
                    </span>
                    <input type="checkbox" checked readOnly />
                </label>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-storm" />
                        Storm deaths
                    </span>
                    <input type="checkbox" checked readOnly />
                </label>
            </section>

            <section className="sidebar-section">
                <div className="sidebar-section-heading">
                    <h2>Heatmap</h2>
                </div>

                <div className="sidebar-radio-group" aria-label="Heatmap mode">
                    <label>
                        <input type="radio" name="heatmap" checked readOnly />
                        None
                    </label>
                    <label>
                        <input type="radio" name="heatmap" readOnly />
                        Traffic
                    </label>
                    <label>
                        <input type="radio" name="heatmap" readOnly />
                        Kills
                    </label>
                    <label>
                        <input type="radio" name="heatmap" readOnly />
                        Deaths
                    </label>
                </div>
            </section>

            <section className="sidebar-section sidebar-summary">
                <div className="sidebar-section-heading">
                    <h2>Match Summary</h2>
                </div>

                <dl className="summary-list">
                    <div>
                        <dt>Duration</dt>
                        <dd>
                            {selectedMatchSummary
                                ? formatDuration(
                                    selectedMatchSummary.duration_seconds,
                                )
                                : '--'}
                        </dd>
                    </div>
                    <div>
                        <dt>Participants</dt>
                        <dd>
                            {selectedMatchSummary?.participant_count ?? '--'}
                        </dd>
                    </div>
                    <div>
                        <dt>Humans</dt>
                        <dd>
                            {selectedMatchSummary?.human_count ?? '--'}
                        </dd>
                    </div>
                    <div>
                        <dt>Bots</dt>
                        <dd>
                            {selectedMatchSummary?.bot_count ?? '--'}
                        </dd>
                    </div>
                </dl>
            </section>
        </aside>
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

export default ControlSidebar
