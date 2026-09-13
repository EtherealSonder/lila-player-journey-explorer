# Architecture

## Stack and Why

| Technology | Use | Why |
| --- | --- | --- |
| Python + Polars | Audit and preprocess Parquet telemetry | The source data is Parquet and needs validation, cleanup, match reconstruction, and normalization before visualization. |
| Static JSON | Browser data contract | The supplied dataset is fixed and read-only, so the browser does not need a runtime backend or Parquet parser. |
| React + TypeScript | Application state and UI | React manages Map/Date/Match selection, filters, playback state, loading states, and controls. TypeScript keeps the normalized telemetry contract explicit. |
| PixiJS | Minimap visualization | PixiJS renders trajectories, participants, events, heatmaps, and camera transforms efficiently on one canvas. |
| Vitest + pytest | Validation | Frontend and preprocessing rules can be tested independently. |

## Data Flow

```text
LILA Parquet files
        |
        v
Python / Polars
        |
        v
LilaTelemetryAdapter
  parse + validate + normalize
        |
        v
Normalized MatchData
  participants + tracks + events
        |
        v
Static export
  manifest.json + maps.json + matches/<id>.json
        |
        v
React
  selection + filters + playback + heatmap mode
        |
        v
PixiJS
  minimap + heatmap + trajectories + markers + events
        |
        v
Screen
```

Source-specific rules stay inside `LilaTelemetryAdapter`. The frontend only reads the normalized JSON model. `manifest.json` provides lightweight match metadata, while the full JSON for a match is loaded only when that match is selected.

## Coordinate Mapping

The raw telemetry stores world position as `x`, `y`, and `z`. For the 2D minimap, `x` and `z` are used. `y` is retained as elevation.

Each map has an origin and scale supplied with the dataset. During preprocessing, world coordinates are converted into normalized map coordinates:

```text
map_u = (world_x - origin_x) / scale
map_v = (world_z - origin_z) / scale
```

This keeps map position independent from image resolution. The supplied minimaps are not all the same size: Ambrose Valley is 4320 × 4320, Grand Rift is 2160 × 2158, and Lockdown is 9000 × 9000.

In the browser, the minimap is fitted to the available viewport while preserving its aspect ratio. Normalized coordinates are then projected into the actual rendered map rectangle:

```text
screen_x = map_u * rendered_width
screen_y = (1 - map_v) * rendered_height
```

The vertical flip was not assumed. Both orientations were tested against real trajectories and known events on all three maps. The flipped form aligned with the supplied minimaps, so the same projection is used by trajectories, participant markers, event markers, playback, and heatmaps.

```text
World (x, z)
     |
     v
Normalized (u, v)
     |
     v
Rendered minimap rectangle
     |
     v
Shared PixiJS camera transform
     |
     v
Screen
```

## Data Assumptions and Ambiguities

| Issue | Decision |
| --- | --- |
| Numeric IDs did not always identify bots correctly | Participant type is derived from movement semantics: `Position` = human and `BotPosition` = bot. |
| Raw timestamps did not align cleanly with the supplied folder dates | Rows are sorted by timestamp and playback uses elapsed match time from the earliest participant timestamp in the match. |
| Three files contained out-of-order timestamps | Rows are sorted before trajectories are built. |
| One participant journey was an exact duplicate | Raw input is left unchanged. The redundant copy is removed during normalization. |
| Minimap Y orientation was ambiguous | Both orientations were tested visually. `screen_y = (1 - map_v) * height` was the validated mapping. |
| Minimap dimensions differed from the nominal example | Projection uses normalized coordinates and the real rendered width and height instead of fixed pixel dimensions. |

## Major Tradeoffs

| Decision | Alternative considered | Reason |
| --- | --- | --- |
| Preprocess to static JSON | Parse Parquet in the browser or add a backend | The dataset is fixed and read-only. Preprocessing keeps source cleanup out of the frontend. |
| Adapter + normalized model | Let frontend code understand the LILA schema | Keeps dataset-specific parsing separate from visualization code and allows another adapter to target the same frontend contract. |
| React for state, PixiJS for map rendering | Use one system for the complete UI | React fits controls and application state. PixiJS fits dense, camera-controlled 2D graphics. |
| Manifest-first match loading | Load every detailed match at startup | The UI needs lightweight metadata first. Only the selected match needs full telemetry. |
| Normalized UV coordinates | Store minimap pixel positions | Normalized coordinates work across different map resolutions and viewport sizes. |
| Retained PixiJS render objects | Recreate visualization objects every playback frame | Playback mainly changes position, visibility, and visible trail length, so existing render objects can be updated. |
| Match-local heatmap normalization | Dataset-wide intensity scale | Each selected match remains readable even when event or traffic counts differ greatly between matches. |
