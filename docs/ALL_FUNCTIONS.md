# All functions in the application

This document lists functions discovered in the repository with short inferred descriptions and links to their source locations. It was generated automatically; please refine descriptions where needed.

## Top-level files

- **`app.js`**: [src/app.js](src/app.js#L39)
  - `seedStarterChores(choreService)`: Initialize starter chores when app starts.
  - `isRole(value)`: Validate whether a value is a known role.
  - `resolveInitialRole(storedRole, configuredDefaultRole)`: Decide initial role from storage/config.
  - `calculateDaysLeft(endDate)`: Compute days-left label for a date.
  - `authErrorMessage(error, fallback)`: Map auth errors to user-friendly messages.
  - `resolveInitialAuthPage()`: Choose initial auth page to render.
  - `delay(ms)`: Simple Promise-based delay.
  - `moveToAuthScreen(root, message)`: Navigate UI to auth screen.
  - `startAuthFlow(root, initialPage, message)`: Begin authentication flow.
  - `render(page, feedbackMessage)`: Render auth-related pages (inner function).
  - `readField(formData, key, trim)`: Read form field values (inner arrow fn).
  - `bindSubmit(form, handler)`: Bind submit to form (inner arrow fn).
  - `init()`: App initialization entrypoint.
  - `createSyncStateSnapshot(syncState)`: Create snapshot of sync state for persistence.
  - `reconcileRemoteSnapshot(supabaseData)`: Reconcile remote data with local state.
  - `clearEditState()`: Clear any chore edit state.
  - `beginEdit(chore)`: Begin editing a chore.
  - `persistActiveRole()`: Persist currently active role to storage.
  - `refresh(message)`: Refresh UI and optionally show a message.
  - `handleCollabAction(action, collabId)`: Handle collaboration actions.
  - `signOutAndReturnToAuth(message)`: Sign out then return to auth screen.

## Config

- **`appConfig.js`**: [src/config/appConfig.js](src/config/appConfig.js#L53)
  - `resolveAppConfig(runtimeConfig)`: Resolve app configuration from runtime globals.

- **`supabaseConfig.js`**: [src/config/supabaseConfig.js](src/config/supabaseConfig.js#L44)
  - `getPublishableKey()`: Return Supabase publishable key used in the app.
  - `isSupabaseConfigured()`: Check if Supabase config is present.

## Services

- **`choreService.js`**: [src/services/choreService.js](src/services/choreService.js#L29)
  - `normalizeName(name)`: Normalize chore names.
  - `sanitizeAssignedTo(assignedTo, fallbackAssignedTo)`: Clean assignee lists.
  - `sortByCompletedAtDescending(records)`: Sort completed records.
  - `hasOverlap(records, options)`: Check overlapping periods/records.
  - `buildViewState(data, options)`: Build UI view state from raw data.
  - `asResult(ok, message, state)`: Helper to create result objects.
  - `getChoreRecords(data, choreId)`: Retrieve records for a chore.
  - `isRoleAllowed(role, allowedRoles)`: Role permission check.
  - `isKidRole(role)`: Check if role corresponds to a kid.
  - `createChoreService(opts)`: Factory producing the chore service API; includes methods:
    - `getState(...)`, `addChore(...)`, `updateChore(...)`, `completeChore(...)`, `undoChore(...)`, `deleteChore(...)`, `proposeCollaboration(...)`, `acceptCollaboration(...)`, `declineCollaboration(...)` (inner service methods).

- **`corruptionRecoveryService.js`**: [src/services/corruptionRecoveryService.js](src/services/corruptionRecoveryService.js#L9)
  - `createCorruptionRecoveryService()`: Factory to validate and repair corrupted storage data.
  - `validateStoredData(raw, storageKey)`: Validate data for a given storage key (inner fn).

- **`feedbackService.js`**: [src/services/feedbackService.js](src/services/feedbackService.js#L40)
  - `createFeedbackService(opts)`: Factory for handling user feedback import/export and storage.

- **`checklistService.js`**: [src/services/checklistService.js](src/services/checklistService.js#L28)
  - `createChecklistService(opts)`: Factory for date-scoped checklist CRUD, ordering, offline completion toggles, telemetry, and recent completions.
  - `getChecklist(...)`, `createChecklist(...)`, `updateChecklist(...)`, `addItem(...)`, `updateItem(...)`, `removeItem(...)`, `deleteChecklist(...)`, `reorderItems(...)`, `toggleComplete(...)`, `getRecentCompletions(...)`.

- **`orphanedRecordService.js`**: [src/services/orphanedRecordService.js](src/services/orphanedRecordService.js#L10)
  - `createOrphanedRecordService()`: Factory to find and recover orphaned records.

Other services (briefly discovered) may include: `periodService`, `remoteSyncService`, `storageService`, `supabaseService`, `syncQueueService` in `src/services/` — each file typically exports a `createXService()` factory; see their files for method lists.

## Shared utilities

- **`dateTime.js`**: [src/shared/dateTime.js](src/shared/dateTime.js#L9)
  - `nowIsoTimestamp()`: Return current time in ISO format.
  - `parseIsoToDate(value)`: Parse ISO timestamp to Date.
  - `isValidIsoTimestamp(value)`: Validate ISO timestamp string.
  - `toDateTimeLabel(value)`: Format a human-friendly label for a date/time.
  - `isOnOrAfter(leftIso, rightIso)`: Compare ISO timestamps.
  - `isSameLocalDay(leftIso, rightDate)`: Check if timestamp is same local day.

- **`choreMarker.js`**: [src/shared/choreMarker.js](src/shared/choreMarker.js#L46)
  - `normalizeText(value)`: Normalize marker text.
  - `findRule(normalizedName)`: Find matching marker rule.
  - `getChoreVisual(choreName, choreId)`: Return visual marker for a chore.

- **`emojiMoodRegistry.js`**: [src/shared/emojiMoodRegistry.js](src/shared/emojiMoodRegistry.js#L31)
  - `getTodayString()`: Get today's seed string.
  - `seededIndex(seed, length)`: Deterministic index for seed.
  - `getDailyMoodIcon(categoryKey, choreId)`: Choose a daily mood icon.
  - `getDailyMoodIconForChore(categoryKey, choreName, choreId)`: Icon selection helper.

- **`checklistModel.js`**: [src/shared/checklistModel.js](src/shared/checklistModel.js#L1)
  - `canKidToggleItem(...)`, `reorderChecklistItems(...)`, `mergeChecklists(...)`, and checklist normalization/validation helpers.

- **`helperCast.js`**: [src/shared/helperCast.js](src/shared/helperCast.js#L107)
  - `getHelperByTrigger(trigger)`: Return helper configuration for a trigger.
  - `pickPhrase(helper)`: Pick a phrase from helper lines.

- **`iconRegistry.js`**: [src/shared/iconRegistry.js](src/shared/iconRegistry.js#L101)
  - `emojiImgMarkup(codepoint)`: Create markup for emoji images (inner fn).
  - `escapeHtml(value)`: Escape HTML (inner fn).
  - `getIconSvgMarkup(key)`: Return SVG markup for an icon.
  - `renderIcon(key, options)`: Render an icon element.
  - `renderIconText(key, text, options)`: Render icon with text label.

## UI

- **`choreView.js`**: [src/ui/choreView.js](src/ui/choreView.js#L29)
  - `getNextMascotIcon(role)`: Choose next mascot icon for role.
  - `formatMoney(value)`: Format a currency value.
  - `formatFeedbackCategory(category)`: Format feedback categories for display.
  - `asMoneyValue(value)`: Normalize numeric monetary inputs.
  - `escapeAttribute(value)`: Escape HTML attribute values.
  - `escapeHtml(value)`: Escape HTML content.
  - `renderEmptyChoreItem(text)`: Render placeholder chore item markup.
  - `renderCollabDecisionButtons(collabId, acceptText, declineText)`: Render collaboration buttons.
  - `renderEditAssigneeCheckboxes(choreId, selectedKids)`: Render assignee checkboxes.
  - `renderParentEditFields(chore, draft)`: Render parent edit fields for a chore.
  - `renderChoreMarker(choreName, choreId)`: Render visual marker for a chore.
  - `renderMoneySliders(viewRefs, activeRole, periodUi)`: Render money adjustment UI.
  - `renderChoreList(chores, activeRole, pendingCollaborations, editState, pagination)`: Render list of chores.
  - `renderRecentCompletions(items, options)`: Render recent completion list.
  - `renderRoleSwitch(viewRefs, activeRole)`: Render role switch UI.
  - `renderCollabInbox(viewRefs, pendingCollaborations, activeRole, chores)`: Render collaboration inbox (exported).
  - `prefersReducedMotion()`: Detect reduced-motion preference.
  - `fireConfetti(options)`: Trigger confetti animation.
  - `fireEmojiRain(iconKeys, count)`: Trigger emoji rain animation.
  - `attachEmojiTrail(itemEl, iconKey)`: Attach emoji trail to element.
  - `clearMascotTimers()`: Clear mascot animation timers.

## PWA

- **`installPrompt.js`**: [src/pwa/installPrompt.js](src/pwa/installPrompt.js#L1)
  - `isStandaloneMode(options)`: Detect if app runs in standalone PWA mode.
  - `applyDisplayMode(options)`: Apply display mode to the document.
  - `createInstallPromptManager(options)`: Factory to manage install prompt lifecycle.
  - `bindInstallPromptUi({ manager, section, button, status, hint })`: Wire install prompt UI elements.

## Supabase functions and helpers

- **`supabase/functions/_shared/cors.ts`**: [supabase/functions/_shared/cors.ts](supabase/functions/_shared/cors.ts#L8)
  - `withCors(response)`: Attach CORS headers to a Response.
  - `jsonResponse(payload, init)`: Create a JSON response.
  - `optionsResponse()`: Create an OPTIONS response for CORS preflight.

## Notes & next steps

- This file was created by scanning the codebase for function definitions and inferring responsibilities from names. It may miss private helpers or functions defined in tests, vendor bundles, or generated files. To complete the documentation precisely:
  - Manually review each file and expand descriptions.
  - Add parameter and return value details for each function.
  - Mark deprecated or internal functions.

If you want, I can now expand each function entry to include signatures, parameters, and inferred return types, and include short examples. Tell me how much detail you'd like.
