# AI Coding Guide — Token-Efficient Workflow

## Objective
Produce correct, maintainable code with minimal token usage while preserving architecture boundaries and test reliability.

## Core Principles
1. **Change only what is required**
   - Scope edits narrowly to the user request.
   - Do not refactor unrelated modules.

2. **Respect module ownership**
   - Business rules in `service` modules only.
   - Persistence logic in storage layer only.
   - Rendering in view layer only.
   - Orchestration in app entry only.

3. **Prefer reusable helpers over repeated inline logic**
   - Extract shared checks once.
   - Reuse date and validation helpers.

4. **Minimize round trips**
   - Gather context in focused reads.
   - Batch related edits into fewer patches.
   - Run targeted tests first, broader tests second.

5. **Keep outputs concise and structured**
   - Summarize deltas, not entire files.
   - Report only relevant test results.

## Token-Efficient Development Process
### Step 1: Fast scope check
- Identify exact modules impacted by requirement.
- Avoid opening files outside that scope.

### Step 2: Small plan (3–6 steps)
- Track only meaningful steps.
- Keep one active step at a time.

### Step 3: Implement by ownership
- Place logic in correct layer first.
- Keep orchestration thin.
- Reuse existing naming and patterns.

### Step 4: Validate surgically
- Run the smallest relevant test set.
- Expand only if needed.

### Step 5: Report compactly
- What changed.
- Where changed.
- Validation result.
- Optional next action.

## Coding Rules for Low Token Cost
- Avoid duplicate date/time code outside `src/shared/dateTime.js`.
- Reuse constants/message maps instead of repeated literals.
- Prefer pure functions where possible.
- Keep function signatures stable unless required.
- Avoid long explanatory comments unless requested.
- Do not rewrite files for formatting-only changes.

## Editing Heuristics
- Edit only touched functions; avoid broad rewrites.
- Preserve existing naming conventions.
- Add one helper if it removes repeated logic in 2+ places.
- If uncertain, choose the simplest valid interpretation of requirements.

## Testing Heuristics
- Start with closest regression/unit test to modified logic.
- Do not attempt to fix unrelated failing tests.
- If no tests exist for new rule, add a focused regression test.
- For every new feature, add or update automated tests before marking work done.
- Keep fixtures minimal and deterministic.

## Communication Heuristics
- Use short progress updates during tool work.
- Avoid repeating unchanged plan details.
- In handoff, list only high-signal facts.
- Ask one clear next-step question when useful.

## Anti-Patterns to Avoid
- Duplicating business logic in `app.js` and services.
- Accessing `localStorage` outside storage service.
- Duplicating timestamp parsing/comparison in multiple files.
- Editing docs/tests/modules unrelated to the requested change.
- Running full-suite commands repeatedly when a targeted test is enough.

## Definition of Done (Token-Efficient)
A task is done when:
- Requested behavior works.
- Boundaries and invariants remain intact.
- Relevant tests pass.
- Documentation is updated only where necessary.
- Final summary is concise and actionable.
