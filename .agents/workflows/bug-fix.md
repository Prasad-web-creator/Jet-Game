# Workflow: Bug Fix

Use this workflow when fixing a defect in JetGame.

---

## Steps

### 1. Read
- [ ] Read `AGENTS.md` and the relevant `AGENT.md` section
- [ ] Do NOT immediately write code — understand the bug first

### 2. Reproduce
- [ ] Identify exact steps to trigger the bug
- [ ] Confirm what the **current** behavior is
- [ ] Confirm what the **expected** behavior is
- [ ] Identify which screen, game phase, or GameSystem is involved

### 3. Locate
- [ ] Find the relevant file(s) using the Code Navigation table in `AGENTS.md`
- [ ] Trace the data flow: input → state → service → UI
- [ ] Trace EventBus events: what fires, what listens?
- [ ] Trace Firebase operations if relevant (collection, RTDB path)

### 4. Root cause analysis
- [ ] Read the BUG-N FIX comments in existing code — may be related to a known pattern
- [ ] Check `AGENT.md §29 Common Failure Patterns` for matching patterns
- [ ] Identify the **root cause** (not a symptom)

### Common root causes in this project
| Symptom | Common cause |
|---------|-------------|
| Audio plays multiple times | Anonymous EventBus listener not removed; `AudioEvents.bind()` called twice |
| React setState on unmounted component | `unsubRef.current` not called in useEffect cleanup |
| Mission objective stuck | EventBus listener for `TARGET_DESTROYED` missing or wrong ID |
| Remote player invisible | RTDB path wrong, or NetworkManager not initialized |
| Auth loop | `getProfile()` failing silently; `onAuthChanged` not cleaning up |
| HUD not updating | AircraftController `setStateUpdater` not wired; state update > 10 Hz throttle |

### 5. Analyze impact
- [ ] What else uses the same code path?
- [ ] Could fixing this break another feature?
- [ ] Does the fix affect GameState, Firebase, or EventBus?

### 6. Plan
- [ ] Smallest change that fixes the root cause (not a workaround)
- [ ] Document the fix with a `// BUG-N FIX:` comment if fixing a non-obvious issue
- [ ] Identify if `dispose()` is missing — add it if so

### 7. Implement
- [ ] Make the minimal targeted fix
- [ ] Add `// BUG-N FIX: <explanation>` comment on the fix (use next available N)
- [ ] Do NOT introduce new features while fixing a bug
- [ ] Do NOT suppress TypeScript errors (`@ts-ignore`) without a comment explaining why

### 8. Validate
- [ ] `npx tsc -b` → 0 errors
- [ ] Manually reproduce the original bug steps — confirm it is fixed
- [ ] Test related paths — confirm no regressions
- [ ] If audio bug: exit game, re-enter, verify audio resets
- [ ] If memory bug: enter game, exit to menu, re-enter — check for ghost behavior

### 9. Documentation Impact Analysis
- [ ] Did the fix reveal that the documented architecture was wrong? → Update AGENTS.md
- [ ] Did the fix change a business rule or system behavior? → Update relevant section
- [ ] Was it a pure implementation fix? → Do NOT update AGENTS.md

### 10. Update AGENTS.md if required
If a common failure pattern was discovered that is not yet in AGENT.md §29, note it for a future AGENT.md update.

### 11. Report
```
## Task: Fix [description of bug]
## Root Cause: [the actual cause]
## Fix: [what changed and why]
## Files Modified: [list]
## Validation: [what was tested]
## Documentation Impact Analysis: [YES/NO and what changed]
## AGENTS.md: Updated YES/NO
## Regression Risk: [level]
```
