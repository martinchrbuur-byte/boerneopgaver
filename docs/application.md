# Chore Champions — Application Documentation

## Purpose
Chore Champions is a chore and pocket-money tracker for a family with period-based payout.

It allows:
- Parents to add chores and set a value (`kr`) for each chore.
- Parents to configure repeat limits per period (`maxPerPeriod`) and unlimited-mode daily cap.
- Kids to complete and undo chores.
- Kids to propose/accept/decline collaboration on shared chores.
- Everyone (Parent, Andrea, Hans Jørgen) to see current period earnings.
- Parents to close a period and mark it as paid.
- Parents to review historic paid periods.

## Core Features
- Role switcher (Parent View / Kid View).
- Chore list with complete/undo (kids) and delete (parent).
- Per-chore value in DKK.
- Repeat chores with period-aware completion counts.
- Collaboration flow with split earnings.
- Periode tab with current totals per kid.
- Parent controls for period length and period close/payout.
- History tab (parent-only) showing prior paid periods.
- Recent completion feed.
- Dynamic chore markers (emoji) for instant visual recognition.
- Role-switch mascot walk animation (🦕 for Hans Jørgen, 🦄 for Andrea).
- Persistence via `localStorage` with optional Supabase sync.

## Tech Stack
- Vanilla JavaScript (ES modules)
- HTML + CSS
- Node built-in test runner (`node --test`)
- No framework

## Project Structure
- `index.html` — app entry page.
- `src/app.js` — orchestration only (events + UI/service coordination).
- `src/services/choreService.js` — business logic and invariants.
- `src/services/storageService.js` — persistence adapter for `localStorage`.
- `src/ui/mainView.js` — static markup and element refs.
- `src/ui/choreView.js` — state-to-DOM rendering only.
- `src/shared/dateTime.js` — date parsing/validation/formatting helpers.
- `src/shared/choreMarker.js` — deterministic chore-to-visual mapping helper.
- `src/config/appConfig.js` — runtime config for provider selection.
- `tests/regression/choreService.test.mjs` — service-level regression tests.

## Architectural Boundaries
### 1) Orchestration Layer
`src/app.js` coordinates flow only:
- Initializes views/services.
- Binds event listeners.
- Calls service methods.
- Triggers UI re-renders.

No domain rules should live here.

### 2) Business Logic Layer
`src/services/choreService.js` is the single source of truth for rules.

Responsibilities:
- Add chore.
- Complete chore.
- Undo chore.
- Build view state (chores, recent completions, done-today count).
- Emit user-facing messages for outcomes.

### 3) Storage Layer
`src/services/storageService.js` is the only module that touches `localStorage`.

Responsibilities:
- Define `STORAGE_KEY`.
- Validate persisted record shapes with guards (`isChoreRecord`).
- Load/save/update payload.
- Ensure payload compatibility.

### 4) UI Layer
- `src/ui/mainView.js`: markup + element references.
- `src/ui/choreView.js`: pure rendering of state and feedback messages.

No persistence rules in the UI layer.

### 5) Shared Utilities
`src/shared/dateTime.js` centralizes:
- ISO timestamp validation.
- Safe parsing.
- Formatting for display.
- Timestamp ordering checks.

`src/shared/choreMarker.js` centralizes:
- Dynamic chore emoji selection.
- Danish/English keyword-category matching.
- Deterministic hash fallback for unknown chore names.

Do not duplicate date logic in services or UI.
Do not duplicate marker logic in services or UI.

## Dynamic Chore Markers
The app assigns a visual marker automatically for each chore without storing extra marker fields.

Rule order:
1. Normalize chore text (trim, lowercase, diacritics-safe).
2. Try keyword/category match (Danish + English).
3. If no match: apply deterministic hash fallback into a fixed emoji pool.

This ensures:
- No manual mapping per chore is needed.
- Stable marker across reloads/devices for the same chore name.
- No storage schema migration is required.

Example mappings:
- Make the bed → 🛏️
- Børst tænder / Brush teeth → 🪥
- Feed the dog / Fodre hunden → 🐶
- Ryd op / Tidy room → 🧹
- Unknown task text → deterministic fallback (e.g., ⭐ / 🎯 / 🚀 ...)

Current marker render scope:
- Main chore list
- Recent completions
- Collaboration inbox

### 6) Config Layer
`src/config/appConfig.js` resolves runtime app config.

Current providers:
- `localStorage` (always)
- Supabase (when configured)

## Domain Invariants
The app enforces these rules:
- For single-completion chores (`maxPerPeriod <= 1`), a chore cannot be completed twice without undo/reset.
- For multi-repeat chores (`maxPerPeriod > 1`), multiple active records can exist up to period limit.
- Undo timestamp must be on or after completion timestamp.
- For single-completion chores, completion intervals for the same chore cannot overlap.
- Persisted record shape remains compatible with storage guards.
- Parent role is required for adding chores.
- Kid role is required for complete/undo actions.
- A child can only complete chores they are assigned to.
- Allowance is credited to the child who actually completed the chore.
- Collaboration splits one chore value across participants (sum equals chore value).
- Undo removes earnings from period totals.
- `isCompleted` in view state is scoped to the active period when `activePeriodId` is provided.
- History tab is parent-only.

## Data Model (MVP)
### Chore
- `id: string`
- `name: string`
- `createdAt: ISO timestamp`
- `assignedTo: string[]`
- `value: number` (kr per completion)
- `maxPerPeriod: number` (`0` = unlimited)
- `unlimitedDailyCap: number` (>= 1)

### Completion Record
- `id: string`
- `choreId: string`
- `completedAt: ISO timestamp`
- `undoneAt: ISO timestamp | null`
- `periodId: string | null`
- `completedBy?: string`
- `earnedValue?: number`

### Period
- `id: string`
- `startDate: YYYY-MM-DD`
- `endDate: YYYY-MM-DD`
- `status: 'active' | 'paid'`
- `paidAt: ISO timestamp | null`
- `createdAt: ISO timestamp`

### Settings
- `periodLengthDays: number`

### Persisted Payload
```json
{
  "chores": [],
   "records": [],
   "ui": {
      "activeRole": "parent"
   },
   "periods": [],
   "settings": {
      "periodLengthDays": 7
   }
}
```

Legacy payloads without `ui` are automatically normalized at load time.

## Main User Flows
1. **Initial load**
   - App bootstraps services and view.
   - Existing payload is loaded from storage.
   - UI renders chores, status, and recent completions.

2. **Add chore (parent action)**
   - Parent view is active.
   - Name is validated and trimmed.
   - Chore is persisted.
   - UI refreshes with success/error feedback.

3. **Complete chore (child action)**
   - Kid view is active.
   - Service validates no active completion exists for chore.
   - New completion record is stored and tied to active period.
   - UI updates status + history.

4. **Undo chore (child action)**
   - Kid view is active.
   - Service validates active completion exists.
   - Active record receives `undoneAt` timestamp.
   - Period earnings update (undone completions no longer count).

5. **Period close + payout (parent action)**
   - Parent clicks “Luk periode og marker som betalt”.
   - Active period is marked as `paid`.
   - A new active period is created automatically.
   - Closed period appears in Historik.

6. **Switch role view**
   - User toggles between Parent and Kid mode in-app.
   - Selected role is persisted in local storage for reload continuity.
   - History tab is only visible for parent role.
   - Switching to Hans Jørgen view triggers a giant 🦕 walk across screen.
   - Switching to Andrea view triggers a giant 🦄 walk across screen.

7. **Collaboration flow (kid action)**
   - A kid proposes collaboration on a shared chore.
   - The other kid can accept or decline.
   - On accept, one completion record per kid is created with split value.

## Running the App
Because this uses ES modules, use a local static server (recommended) instead of opening the HTML file directly.

Examples:
- `npx serve .`
- `python -m http.server 4173`

Then open the served URL in your browser.

## Testing
Commands:
- `npm test`
- `npm run test:regression`

Current coverage focus:
- Name normalization and add flow.
- Single-completion double-complete prevention.
- Repeat chore and unlimited-cap behavior.
- Undo timestamp validation.
- Overlap prevention for single-completion intervals.
- Storage record shape compatibility.
- Period-scoped `isCompleted` behavior.
- Dynamic chore marker behavior (keyword and deterministic fallback).
- Role-switch mascot walk animation for Hans Jørgen and Andrea.

## Naming Conventions
- Use `chore` for one item and `chores` for lists.
- Use `record` / `records` for completion history.
- Use boolean names as `is*`, `has*`, `should*`.
- Use `next*` prefixes for staged values before persistence.

## Extension Guidance
If adding new behavior:
1. Update `choreService.js` first.
2. Add regression tests in `tests/regression`.
3. Wire orchestration updates in `app.js`.
4. Keep date behavior in `shared/dateTime.js`.
5. Keep chore-marker behavior in `shared/choreMarker.js`.
6. Update documentation in `docs/` in the same change.
7. Avoid direct `localStorage` access outside storage service.
