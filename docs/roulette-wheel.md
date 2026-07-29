# Opgaveroulette

`roulette` is a first-class local snapshot section with a wheel configuration and recent spin history. A segment has an `id`, `label`, positive `weight`, optional `iconKey`, `color`, and role metadata, plus its allowed `assignedTo` kids.

Use `createRouletteService({ storageService, choreService })`. Its factory API returns `{ ok, message, state }` for wheel reads, parent-only configuration changes, and kid-only spins. Active, incomplete chores are materialized as wheel segments; a child sees only their eligible chores. A `both` spin prefers chores assigned to both children and otherwise returns a `sharedSuggestion` for parent confirmation.

`pickSegmentByWeight`, `computeTargetAngleForSegment`, `spinPhysicsStep`, and roulette merge helpers are exported from `src/shared/rouletteModel.js` for deterministic tests. `spinWheel` accepts a seed and returns `animationParams`; `rouletteView.js` uses these with `requestAnimationFrame`, a final settle, keyboard activation, and a reduced-motion fallback.

The snapshot section participates in local journaling, recovery, section timestamps, and remote snapshot reconciliation. Configuration and spin records remain usable offline and merge segment fields by newest timestamp while deduplicating history by id.
