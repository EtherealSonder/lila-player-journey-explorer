# LILA Dataset Audit

Phase 1 establishes the raw-data contract used by the Player Journey Explorer before normalization or visualization.

## 1. Dataset Inventory

- Telemetry files: 1243
- Telemetry rows: 89104
- Unique user IDs: 339
- Unique match IDs: 796
- Reconstructed matches: 796

### Files by date

- February_10: 437
- February_11: 293
- February_12: 268
- February_13: 166
- February_14: 79

## 2. Raw Telemetry Schema

| Column | Type | Meaning |
| --- | --- | --- |
| user_id | String | Participant identifier |
| match_id | String | Match identifier |
| map_id | String | Map identifier |
| x | Float32 | World X coordinate |
| y | Float32 | Elevation |
| z | Float32 | World Z coordinate |
| ts | timestamp[ms] | Raw telemetry timestamp |
| event | Binary | UTF-8 encoded event name |

## 3. Participant Classification

Movement telemetry is the authoritative classification signal.

- `Position` identifies a human-style participant journey.
- `BotPosition` identifies a bot participant journey.
- Numeric user IDs are not sufficient for classification.

Observed file classifications:

- human: 799
- bot: 444

Numeric user ID behaviour:

- bot: 444
- human: 17

## 4. Event Vocabulary

| Event | Count |
| --- | ---: |
| BotKill | 2415 |
| BotKilled | 700 |
| BotPosition | 21712 |
| Kill | 3 |
| Killed | 3 |
| KilledByStorm | 39 |
| Loot | 12885 |
| Position | 51347 |

Unknown event types observed: 0

## 5. Match Reconstruction

Reconstructed 796 matches by grouping participant files using normalized match IDs.

- Participants per match: min 1, median 1.0, mean 1.56, max 16.
- Inferred duration: min 13 sec, median 382.0 sec, mean 408.42 sec, max 890 sec.

### Matches by map

- AmbroseValley: 566
- GrandRift: 59
- Lockdown: 171

## 6. Timestamp Interpretation

The raw `ts` field is physically represented as a `timestamp[ms]`, but treating it as a normal wall-clock datetime does not align with the supplied February 2026 dataset dates.

Observed timestamp deltas produce plausible match durations when one stored millisecond of delta is interpreted as approximately one gameplay second.

The normalized telemetry model will therefore use relative gameplay time from the earliest timestamp in each match. It will not expose the raw value as a calendar datetime.

## 7. Data Quality and Anomalies

- Empty telemetry files: 0
- Timestamp ordering failures: 3
- Mixed participant files: 0
- Unknown participant files: 0
- Exact duplicate content groups: 1
- Cross-date match groups: 1

Match anomaly counts:

- duplicate_participant_in_match: 1
- exact_duplicate_content: 1
- multiple_dates: 1
- timestamp_order_failure: 3

### Duplicate policy

Raw source files remain untouched. Exact duplicate content is reported by the audit. During normalization, one deterministic canonical copy will be retained and the redundant copy will be excluded from application data.

## 8. Minimap Assets

The supplied image dimensions differ from the README's nominal 1024 x 1024 coordinate example.

| Map | Format | Dimensions | Alpha |
| --- | --- | --- | --- |
| AmbroseValley | PNG | 4320 x 4320 | Yes |
| GrandRift | PNG | 2160 x 2158 | Yes |
| Lockdown | JPEG | 9000 x 9000 | No |

Projection must therefore use normalized UV coordinates and the full supplied texture dimensions rather than hardcoded 1024-pixel coordinates.

Non-black content bounds are retained only as audit metadata. They are not automatic crop bounds.

## 9. Normalization Decisions

- **Raw file meaning**: One .nakama-0 Parquet file represents one participant journey within one match. Status: `confirmed`.
- **Match reconstruction**: Participant files are grouped using the normalized match ID after removing the .nakama-0 suffix. Status: `confirmed`.
- **Human and bot classification**: Use Position versus BotPosition telemetry semantics as the authoritative participant classification signal. Do not use numeric versus UUID user ID shape as the sole classification rule. Status: `confirmed_from_dataset`.
- **Event decoding**: Decode the binary event column as UTF-8 text before normalization. Status: `confirmed`.
- **2D coordinates**: Use world x and z for minimap projection. Treat y as elevation rather than the minimap vertical axis. Status: `documented_by_dataset_readme`.
- **Timestamp semantics**: Do not expose ts as a wall-clock datetime. Build playback from relative timestamp deltas. Observed duration evidence indicates that one stored millisecond delta behaves as approximately one gameplay second. Status: `dataset_inference`.
- **Timestamp ordering**: Sort telemetry rows by ts during normalization because three raw participant files contain non-monotonic row ordering. Status: `confirmed_from_dataset`.
- **Exact duplicate**: Preserve raw source files, report exact duplicates, and exclude the redundant duplicate copy from normalized application output. Status: `normalization_policy`.
- **Minimap projection**: Project world coordinates into normalized UV space. Do not hardcode the README's nominal 1024 x 1024 pixel dimensions. Status: `architecture_decision`.
- **Minimap cropping**: Use the complete supplied minimap texture. Non-black bounding boxes are audit heuristics only and must not be used as automatic crop bounds. Status: `architecture_decision`.

## 10. Phase 2 Adapter Contract

The visualization layer must consume normalized telemetry rather than raw LILA Parquet records.

Required LILA adapter transformations:

- Decode binary event values
- Remove .nakama-0 from match IDs
- Classify participant from movement event semantics
- Sort participant telemetry by ts
- Convert timestamps to relative gameplay seconds
- Exclude redundant exact duplicate from normalized output
- Preserve world x, y, z coordinates
- Project x and z through map-specific projection metadata

This keeps dataset-specific parsing and cleanup inside the adapter while the React and PixiJS application depends on a stable dataset-independent telemetry model.
