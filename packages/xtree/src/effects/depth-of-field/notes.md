### Cost

Each pixel gathers samples along a golden-angle spiral out to its own blur radius, so the cost grows with the square of `maxBlur` and halves with each step down in `quality`. In-focus pixels stop early. For a cheaper look that ignores depth, see [tilt-shift](./tilt-shift).
