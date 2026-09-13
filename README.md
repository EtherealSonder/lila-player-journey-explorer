# Player Journey Visualizer

A desktop telemetry exploration tool built for the LILA Games Product
Engineer assignment. It lets Level Designers inspect multiplayer player
journeys directly on game minimaps, replay match movement over time,
filter humans, bots, and gameplay events, and compare spatial traffic,
kill, and death heatmaps.

Raw Parquet telemetry is audited and normalized with Python, exported as
static per-match JSON, then explored through a React and PixiJS
frontend.

![Player Journey Visualizer showing trajectories and event
inspection](docs/screenshots/player-journey-visualizer-lockdown.png)

## Features

-   Filter telemetry by **Map → Date → Match**.
-   Visualize human and bot trajectories independently.
-   Inspect **kill, death, loot, and storm-death** event markers and
    hover them for details.
-   Replay matches with **play, pause, seek, and 0.5× / 1× / 2× / 4×
    speeds**.
-   Follow interpolated participant positions and progressively revealed
    trails/events.
-   Toggle **Traffic, Kills, and Deaths** heatmaps.
-   Pan and zoom the minimap from **1× to 6×**.
-   Load detailed telemetry per match on demand and cache loaded
    matches.
-   Explore all supplied maps: **Ambrose Valley, Grand Rift, and
    Lockdown**.

### Heatmap view

![Traffic heatmap on Grand
Rift](docs/screenshots/player-journey-visualizer-heatmap.png)

### Match playback

![Player journeys on Ambrose
Valley](docs/screenshots/player-journey-visualizer-ambrose.png)

## Technology

  -----------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- -----------------------------------
  **Python 3 + Polars + PyArrow**     Audit, parse, validate, and
                                      normalize Parquet telemetry

  **React 19 + TypeScript**           Application UI, filters, visibility
                                      state, and playback control

  **PixiJS 8**                        Minimap, trajectories, markers,
                                      events, heatmaps, and camera
                                      rendering

  **Vite 8**                          Development server and production
                                      build

  **pytest + Vitest**                 Python pipeline and frontend
                                      validation
  -----------------------------------------------------------------------

Python preprocessing is intentionally separated from the frontend. The
browser consumes a stable normalized JSON contract and does not need to
understand the original LILA Parquet schema.

## Data Flow

``` text
Raw LILA Parquet telemetry
          |
          v
Dataset audit + LilaTelemetryAdapter
          |
          v
Normalized MatchData
(participants + tracks + events)
          |
          v
Static browser export
manifest.json + maps.json + matches/<id>.json + minimaps
          |
          v
React application state
          |
          v
PixiJS visualization
```

`manifest.json` supplies lightweight browsing metadata. Detailed
telemetry is partitioned into one JSON file per match and loaded only
when selected. There is no runtime application backend or database
because the supplied dataset is fixed and read-only.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full architecture,
assumptions, coordinate decisions, and tradeoffs.

## Coordinate Mapping

Raw movement uses world-space `x`, `y`, and `z`. The 2D minimap uses `x`
and `z`, while `y` remains elevation metadata.

Preprocessing converts world coordinates into normalized map
coordinates:

``` text
map_u = (world_x - origin_x) / scale
map_v = (world_z - origin_z) / scale
```

The browser projects those coordinates into the actual rendered minimap
rectangle:

``` text
screen_x = map_u * rendered_width
screen_y = (1 - map_v) * rendered_height
```

The vertical flip was selected after testing both orientations against
real trajectories and events. Projection uses the contained map
dimensions rather than the full viewport, so it remains correct across
different minimap resolutions and window sizes.

## Repository Structure

``` text
.
├── reports/                  # Dataset investigation and audit outputs
├── scripts/
│   ├── adapters/             # Adapter boundary and LILA adapter
│   ├── audit/                # Dataset/schema/minimap investigation
│   ├── models/               # Normalized Python telemetry model
│   ├── preprocessing/        # Static browser-data export
│   └── validation/           # Export and contract validation
├── src/
│   ├── components/           # Header, sidebar, playback bar, legend
│   ├── map/                  # Pixi viewport, geometry, projection
│   ├── playback/             # Playback and participant lifecycle
│   ├── telemetry/            # Browser data contract and loading
│   └── visualization/        # Camera, heatmaps, layers, markers, trails
├── tests/
│   ├── frontend/
│   └── python/
├── ARCHITECTURE.md
├── INSIGHTS.md
├── package.json
└── requirements.txt
```

Generated browser data is expected under:

``` text
public/
├── assets/maps/
└── data/
    ├── manifest.json
    ├── maps.json
    └── matches/<match-id>.json
```

## Setup

### Prerequisites

-   Node.js compatible with Vite 8
-   npm
-   Python 3
-   The supplied LILA raw dataset if `public/` has not already been
    generated

The proprietary raw dataset is excluded from Git through `.gitignore`.

### 1. Install frontend dependencies

``` bash
npm install
```

### 2. Create the Python environment

Windows PowerShell:

``` powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

macOS/Linux:

``` bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Generate browser data

The exporter defaults to:

``` text
raw-data/extracted/player_data/
```

and writes to `public/`.

``` bash
python -m scripts.preprocessing.export_dataset
```

For custom paths:

``` bash
python -m scripts.preprocessing.export_dataset --dataset-root <path-to-player-data> --output-root public
```

The export reconstructs participant journey files into one normalized
`MatchData` per match and creates the manifest, map registry, match JSON
files, and minimap assets.

### 4. Validate the export

``` bash
python -m scripts.validation.validate_contract --public-root public
python -m scripts.validation.validate_export --public-root public
```

### 5. Run the application

``` bash
npm run dev
```

Open the local URL printed by Vite.

## Using the Tool

Select a **Map**, **Date**, and **Match** from the header. The left
sidebar controls human/bot visibility, event categories, and the active
heatmap.

The playback bar supports play/pause, seeking, and four playback speeds.
Participant markers move along their recorded tracks while trails and
events are progressively revealed.

Use the map controls to zoom, pan, or reset the camera. Hover an event
marker to inspect its normalized telemetry details.

## Heatmap Semantics

  Mode          Source
  ------------- ----------------------------------------------------
  **Traffic**   Every valid trajectory sample
  **Kills**     `kill` events where `owner_role = killer`
  **Deaths**    Regular `death` events where `owner_role = victim`

Storm deaths are excluded from the Deaths heatmap. Intensity is
normalized within the selected match and mode. Heatmap aggregation
depends on match identity and mode, not playback time or camera
movement.

## Testing and Quality Checks

``` bash
pytest tests/python
npx vitest run
npm run lint
npm run build
```

The tests cover preprocessing, normalized-data contracts, projection,
playback, participant lifecycle, event visibility, heatmaps, layer
ordering, camera behavior, renderer reuse, and visualization
regressions.

## Dataset Summary

The supplied telemetry contains:

-   **1,243 raw journey files**
-   **89,104 raw telemetry rows**
-   **796 unique matches**
-   **3 maps**
-   **1,242 canonical participant journeys**
-   **72,996 trajectory points**
-   **16,020 normalized gameplay events**
-   **89,016 canonical records** after excluding one exact duplicate
    journey contribution

Normalized events are kills, deaths, storm deaths, and loot. Participant
categories are human, bot, or unknown.

## Design Notes

React owns application state such as selection, filters, playback, and
heatmap mode. PixiJS owns map-space presentation with an explicit layer
order:

``` text
Minimap
  ↓
Heatmap
  ↓
Trajectories
  ↓
Participant markers
  ↓
Event markers
  ↓
Interaction
```

Playback updates retained visualization objects instead of rebuilding
the Pixi scene every frame. Camera transforms operate on the shared
world container rather than modifying telemetry coordinates.

Lockdown uses a 9000 × 9000 JPEG minimap. PixiJS is configured to use
the browser image-element decode path for reliable loading of this large
texture.

## Level Design Insights

[`INSIGHTS.md`](INSIGHTS.md) documents three telemetry-backed findings:

1.  Combat is more spatially concentrated than general movement,
    particularly on Grand Rift.
2.  Human and bot movement distributions diverge most on Ambrose Valley.
3.  Loot activity is disproportionately concentrated in specific
    hotspots relative to traffic.

Each finding separates measured telemetry evidence from design
hypotheses and proposes metrics and follow-up actions.

## Additional Documentation

-   [`ARCHITECTURE.md`](ARCHITECTURE.md) covers architecture, data flow,
    coordinate mapping, assumptions, and tradeoffs.
-   [`INSIGHTS.md`](INSIGHTS.md) contains the three Level Design
    insights.
-   [`reports/`](reports/) contains the dataset investigation and audit
    outputs.

## Assignment Scope

This repository was created as a **Player Journey Explorer /
Visualizer** for the supplied LILA Games telemetry assignment. It is
designed as an internal Level Design analysis tool rather than a
player-facing game interface.
