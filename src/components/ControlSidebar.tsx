import type {
    GameMap,
    MatchSummary,
} from '../telemetry/types'
import type { FilterSelection } from '../telemetry/filtering'
import type { VisualizationVisibility } from '../visualization/visibility'

interface ControlSidebarProps {
    maps: GameMap[]
    availableMapIds: string[]
    availableDates: string[]
    availableMatches: MatchSummary[]
    selection: FilterSelection
    visibility: VisualizationVisibility
    disabled: boolean
    onMapChange: (mapId: string) => void
    onDateChange: (date: string) => void
    onMatchChange: (matchId: string) => void
    onVisibilityChange: (
        key: keyof VisualizationVisibility,
        visible: boolean,
    ) => void
}

function ControlSidebar({
    maps,
    availableMapIds,
    availableDates,
    availableMatches,
    selection,
    visibility,
    disabled,
    onMapChange,
    onDateChange,
    onMatchChange,
    onVisibilityChange,
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
                    <input
                        type="checkbox"
                        checked={visibility.humans}
                        onChange={(event) =>
                            onVisibilityChange(
                                'humans',
                                event.target.checked,
                            )
                        }
                    />
                </label>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-bot" />
                        Bots
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.bots}
                        onChange={(event) =>
                            onVisibilityChange(
                                'bots',
                                event.target.checked,
                            )
                        }
                    />
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
                    <input
                        type="checkbox"
                        checked={visibility.kills}
                        onChange={(event) =>
                            onVisibilityChange(
                                'kills',
                                event.target.checked,
                            )
                        }
                    />
                </label>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-death" />
                        Deaths
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.deaths}
                        onChange={(event) =>
                            onVisibilityChange(
                                'deaths',
                                event.target.checked,
                            )
                        }
                    />
                </label>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-loot" />
                        Loot
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.loot}
                        onChange={(event) =>
                            onVisibilityChange(
                                'loot',
                                event.target.checked,
                            )
                        }
                    />
                </label>

                <label className="sidebar-check-row">
                    <span>
                        <i className="semantic-dot semantic-dot-storm" />
                        Storm deaths
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.stormDeaths}
                        onChange={(event) =>
                            onVisibilityChange(
                                'stormDeaths',
                                event.target.checked,
                            )
                        }
                    />
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


        </aside>
    )
}

export default ControlSidebar
