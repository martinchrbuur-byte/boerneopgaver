# Daily checklist

A checklist is stored in `data.checklists` as one record per `dateIso` (`YYYY-MM-DD`). Each item has an `id`, non-empty `title`, optional `description`, optional `requiredRole`, `assignedTo`, nullable `completedAt`, optional `completedBy`, and numeric `orderIndex`.

Use `createChecklistService({ storageService, nowProvider, telemetry })` from `src/services/checklistService.js`. Every operation returns `{ ok, message, state }`; `state` contains the selected `checklist`, all `checklists`, and recent completions.

Parents may create, edit, delete, reorder, assign, and change role restrictions. Kids may only toggle an item assigned to their actor id, or an unrestricted item. Mutations update the normal storage snapshot and enqueue the `checklists` sync section, so toggles work offline.

`src/shared/checklistModel.js` contains pure validation, permission, ordering, normalization, and item-id merge helpers. Remote reconciliation uses `mergeChecklists`; the latest completion timestamp wins and conflicting completion timestamps are retained in `checklist.conflicts` for parent recovery UI.

`src/ui/checklistView.js` provides small parent and family renderers. `src/app.js` mounts today’s checklist in the chores tab. A Supabase deployment needs the `checklists` table migration and RLS policies; older deployments gracefully remain local-only until the table exists.
