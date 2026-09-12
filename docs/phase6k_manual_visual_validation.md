# Phase 6K. Manual Visual Validation

This phase does not change application runtime code. It validates the completed Phase 6 playback system in the browser.

## Recommended matches

Known high-value matches from the Phase 2 audit:

- Dense Ambrose Valley:
  `fbbc5d02-dd79-42fb-bba5-d768023891c8`
  16 participants, 995 trajectory points.

- Grand Rift:
  `d19d188e-a608-4a22-a198-da1a63b43de4`
  12 participants, 454 trajectory points.

- Long-duration + storm death:
  `06c40127-7c45-4c90-af5d-f1f880774d06`
  890 seconds, one human, 137 points, storm death near the end.

- Event-heavy Ambrose Valley:
  `d3a3297e-2cdf-4a49-8450-09119b91a779`
  14 participants, 1,007 points, 90 events.

For the strongest late-start case in the current generated dataset, run:

```powershell
python -m scripts.validation.select_phase6k_matches
```

The helper scans `public/data/matches/*.json` and reports a candidate whose participant starts latest on the shared match timeline.

---

## Validation procedure

### A. Baseline from zero

1. Load a selected match.
2. Confirm playback starts at `0:00`.
3. Confirm playback is paused.
4. Confirm speed is `1x`.
5. Confirm future events are hidden.
6. Confirm participants whose first sample is later than zero are hidden.
7. Press Play.

PASS if:
- time begins increasing,
- progressive trajectories grow,
- markers move with trajectory tips,
- no complete future trajectories appear immediately.

### B. Pause midway

1. Pause while participants are moving.
2. Watch the current time for several seconds.

PASS if:
- time remains fixed,
- markers stop,
- trajectories stop growing,
- no new events appear.

### C. Seek forward

1. Drag the scrubber forward substantially.
2. Release while paused.

PASS if:
- time jumps immediately,
- trajectories lengthen immediately,
- markers move to the corresponding interpolated positions,
- events up to the new time appear,
- playback remains paused.

### D. Seek backward

1. Drag the scrubber backward.

PASS if:
- trajectories shorten,
- markers move backward,
- future events disappear,
- participants that had not yet started disappear,
- participants whose death is now in the future reappear.

### E. Resume after seeking

1. Resume playback after a backward seek.

PASS if:
- playback continues from the new scrubber position,
- there is no jump back to the previous time,
- markers and trajectories continue from the reconstructed state.

### F. Playback speed

Test:

- 0.5x
- 1x
- 2x
- 4x

PASS if:
- the active speed button changes correctly,
- timeline progression visibly changes,
- no trajectory or event timing desynchronization appears.

### G. End of match

1. Seek close to the end.
2. Resume at 4x.
3. Let playback reach the end.

PASS if:
- current time reaches the exact displayed duration,
- it never exceeds duration,
- playback stops,
- Play/Pause state becomes stopped/paused.

Then drag backward.

PASS if:
- seeking backward works immediately,
- reconstructed trajectories, markers, and events return to the earlier state,
- playback remains paused.

### H. Match change while actively playing

1. Start one match.
2. Set 4x.
3. Move well into the match.
4. Change to another match without pausing first.

PASS if the new match immediately resets to:

- `0:00`
- paused
- `1x`

Also verify:
- old trajectories disappear,
- old participant markers disappear,
- old events disappear,
- the old match never visibly continues animating during loading.

### I. Participant filters during playback

Use the dense Ambrose Valley match.

While playing:

1. Toggle Humans off/on.
2. Toggle Bots off/on.

PASS if:
- corresponding markers disappear/reappear,
- corresponding trajectories disappear/reappear,
- playback time continues uninterrupted,
- no marker objects duplicate after repeated toggling.

### J. Event filters during playback

Toggle:

- Kills
- Deaths
- Loot
- Storm deaths

PASS if:
- only the corresponding event markers change,
- reached events reappear when re-enabled,
- future events remain hidden even if their category is enabled.

### K. Dense Ambrose Valley stress check

Use:
`fbbc5d02-dd79-42fb-bba5-d768023891c8`

PASS if:
- multiple moving participants remain smooth,
- trajectory growth remains stable,
- human and bot marker shapes remain distinct,
- no stale/dead participant marker persists incorrectly,
- no obvious display-object accumulation appears.

### L. Grand Rift projection check

Use:
`d19d188e-a608-4a22-a198-da1a63b43de4`

Grand Rift is intentionally important because the texture is 2160 x 2158 rather than perfectly square.

PASS if:
- moving markers remain on the same paths as their trajectories,
- trajectories remain aligned to the map,
- seeking does not alter spatial alignment,
- resizing does not introduce distortion or offset.

### M. Long-duration and storm-death check

Use:
`06c40127-7c45-4c90-af5d-f1f880774d06`

PASS if:
- scrubber covers the full 890-second range,
- seeking to far timestamps works,
- 4x playback remains stable,
- the storm-death event appears when its timestamp is reached,
- the victim marker disappears according to the lifecycle rule,
- historical trajectory remains visible.

### N. Late-start participant check

Run the selection helper and use its `Sparse / late-start case`.

Identify a participant with a non-zero first sample.

PASS if:
- marker is absent before its first sample,
- marker appears at the first sample,
- trajectory begins at that point,
- no position is extrapolated backward.

### O. Pan and zoom during playback

While playback is active:

1. Zoom in.
2. Zoom out.
3. Pan.
4. Continue playback.

PASS if:
- playback does not stop or reset,
- markers, trajectories, events, and minimap move under the same camera transform,
- marker/trajectory alignment remains intact.

### P. Resize during playback

Resize the browser while playback is active.

PASS if:
- minimap refits correctly,
- dynamic telemetry reprojects correctly,
- marker/trajectory alignment remains intact,
- playback time continues,
- no duplicated Pixi objects appear.

---

## Phase 6K exit gate

Phase 6K passes only if all of the following are visually correct:

- play
- pause
- seek forward
- reverse seek
- speed change
- end-of-match behavior
- backward seek after end
- match-switch reset
- late participant lifecycle
- death/storm-death lifecycle
- event time gating
- human/bot filtering
- event filtering
- camera pan/zoom during playback
- resize during playback
- Grand Rift projection stability
- retained renderer behavior without visible duplication

Record any failure with:

- match ID
- current playback time
- playback speed
- active visibility filters
- exact visual symptom
- whether it reproduces after reload
