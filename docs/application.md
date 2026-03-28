# Chore Champions — Application Documentation

## Purpose
Chore Champions is a lightweight, kid-friendly chore tracking MVP.

It allows:
- Children to view chores and mark them complete.
- Children to undo a completion.
- Parents to add chores and review recent completion activity.
- Users to switch between separate Parent and Kid views.

## MVP Features
- Chore list display.
- Role switcher (Parent View / Kid View).
- Complete / Undo actions per chore (Kid view only).
- Add chore form (Parent view only).
- Recent completions feed.
- Daily status summary (`Today: X of Y chores done`).
- Local persistence via `localStorage`.

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

Do not duplicate date logic in services or UI.

### 6) Config Layer
`src/config/appConfig.js` resolves runtime app config.

Current provider:
- `localStorage`

Designed to allow future provider expansion (e.g., Supabase) with minimal orchestration changes.

## Domain Invariants
The app enforces these rules:
- A chore cannot be completed twice without undo/reset.
- For each chore, at most one active completion exists (`undoneAt === null`).
- Undo timestamp must be on or after completion timestamp.
- Completion intervals for the same chore cannot overlap.
- Persisted record shape remains compatible with storage guards.
- Parent role is required for adding chores.
- Kid role is required for complete/undo actions.

## Data Model (MVP)
### Chore
- `id: string`
- `name: string`
- `createdAt: ISO timestamp`

### Completion Record
- `id: string`
- `choreId: string`
- `completedAt: ISO timestamp`
- `undoneAt: ISO timestamp | null`

### Persisted Payload
```json
{
  "chores": [],
   "records": [],
   "ui": {
      "activeRole": "parent"
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
   - New completion record is stored.
   - UI updates status + history.

4. **Undo chore (child action)**
   - Kid view is active.
   - Service validates active completion exists.
   - Active record receives `undoneAt` timestamp.
   - UI updates status + history.

5. **Switch role view**
   - User toggles between Parent and Kid mode in-app.
   - Selected role is persisted in local storage for reload continuity.
   - Future Supabase versions can map this UI state to profile/session storage.

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
- Double-complete prevention.
- Undo timestamp validation.
- Overlap prevention for intervals.
- Storage record shape compatibility.

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
5. Avoid direct `localStorage` access outside storage service.
