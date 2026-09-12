import type {
    VisualizationVisibility,
} from '../visualization/visibility'
import {
    HEATMAP_DEFINITIONS,
    HEATMAP_MODES,
} from '../visualization/heatmap/heatmapDefinitions'
import type {
    HeatmapMode,
} from '../visualization/heatmap/heatmapTypes'
import VisualizationSymbol from './VisualizationSymbol'

interface ControlSidebarProps {
    visibility: VisualizationVisibility
    heatmapMode: HeatmapMode
    disabled: boolean
    onVisibilityChange: (
        key: keyof VisualizationVisibility,
        visible: boolean,
    ) => void
    onHeatmapModeChange: (
        mode: HeatmapMode,
    ) => void
}

function ControlSidebar({
    visibility,
    heatmapMode,
    disabled,
    onVisibilityChange,
    onHeatmapModeChange,
}: ControlSidebarProps) {
    return (
        <aside
            className="control-sidebar"
            aria-label="Visualization controls"
        >
            <section className="sidebar-section">
                <div className="sidebar-section-heading">
                    <h2>Participants</h2>
                </div>

                <label className="sidebar-check-row">
                    <span>
                        <VisualizationSymbol kind="human" />
                        Humans
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.humans}
                        disabled={disabled}
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
                        <VisualizationSymbol kind="bot" />
                        Bots
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.bots}
                        disabled={disabled}
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
                        <VisualizationSymbol kind="kill" />
                        Kills
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.kills}
                        disabled={disabled}
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
                        <VisualizationSymbol kind="death" />
                        Deaths
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.deaths}
                        disabled={disabled}
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
                        <VisualizationSymbol kind="loot" />
                        Loot
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.loot}
                        disabled={disabled}
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
                        <VisualizationSymbol kind="storm" />
                        Storm deaths
                    </span>
                    <input
                        type="checkbox"
                        checked={visibility.stormDeaths}
                        disabled={disabled}
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

                <div
                    className="sidebar-radio-group"
                    role="radiogroup"
                    aria-label="Heatmap mode"
                >
                    {HEATMAP_MODES.map((mode) => {
                        const definition =
                            HEATMAP_DEFINITIONS[mode]

                        return (
                            <label key={mode}>
                                <input
                                    type="radio"
                                    name="heatmap"
                                    value={mode}
                                    checked={
                                        heatmapMode ===
                                        mode
                                    }
                                    disabled={disabled}
                                    onChange={() =>
                                        onHeatmapModeChange(
                                            mode,
                                        )
                                    }
                                />
                                {definition.label}
                            </label>
                        )
                    })}
                </div>
            </section>
        </aside>
    )
}

export default ControlSidebar
