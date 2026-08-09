# JetGame — Documentation Synchronization Rule

## AGENTS.md is the living source of truth for this project.

`AGENTS.md` describes **what the project IS** — not what the AI did, not a history of changes.

---

## Required sequence for every task

```
1.  READ AGENTS.md before making any changes.
2.  READ AGENT.md for relevant technical details.
3.  INSPECT the relevant source code — do not rely on docs alone.
4.  Make the required code changes.
5.  Run npx tsc -b — must produce 0 errors before continuing.
6.  Review the complete set of changes made.
7.  Perform Documentation Impact Analysis (see below).
8.  Determine whether project knowledge changed.
9.  If YES → update AGENTS.md (targeted section update only).
10. If NO  → leave AGENTS.md unchanged.
11. Never use AGENTS.md as a task changelog.
12. Never expose secrets in AGENTS.md.
13. Verify: code ↔ architecture ↔ AGENTS.md are consistent.
14. Report whether AGENTS.md was updated and why.
```

---

## Documentation Impact Analysis

Ask these questions after every task:

### Architecture changed?
- Added / removed a system, layer, or architectural boundary?
- Changed the dependency direction between modules?
- Changed the data flow (React ↔ Babylon, Babylon ↔ Firebase)?

### Project structure changed?
- Added a new important directory or module?
- Moved a module with different responsibilities?
- Removed a module?

### Business logic changed?
- Added or removed a business rule?
- Changed a workflow (auth, matchmaking, mission flow, save)?
- Changed validation logic that future agents must know about?

### Routes / navigation changed?
- Added / removed a screen or AppScreen value?
- Changed authentication requirements for a screen?
- Changed redirect behavior?

### Firebase changed?
- Added / removed a Firestore collection or document field?
- Added / removed a RTDB path?
- Changed Firebase Auth providers?
- Changed security rules?

### GameState changed?
- Added / removed a field in `GameState`?
- Changed who owns a field or at what rate it updates?

### EventBus changed?
- Added / removed an event in `GameEventMap`?
- Changed publisher or subscriber of a key event?

### System init order changed?
- Reordered systems in `SceneManager.createScene()`?
- Added a new system to `GameLoop`?

### Coding conventions changed?
- Introduced a new required pattern?
- Changed an existing naming convention?
- Changed import rules?

### Environment / config changed?
- Added a required environment variable?
- Changed Firebase project config?
- Added a build flag?

### Dependencies changed?
- Added / removed an npm package?
- Upgraded a major version with behavioral changes?

### Commands changed?
- Added a new npm script?
- Changed the validation command?

---

## Decision

```
Any answer above = YES?
    ↓
Update AGENTS.md — targeted section edit only
    ↓
Remove outdated content from that section
    ↓
Verify it matches the actual implementation

All answers = NO?
    ↓
Leave AGENTS.md unchanged
    ↓
Report: "AGENTS.md was not modified because this task did not change project knowledge."
```

---

## What counts as a targeted update (not a rewrite)

**Targeted update (correct):**
> Changed the Firebase schema section to add the new `totalWins` field to the `players/{uid}` document.

**Full rewrite (incorrect unless architecture substantially changed):**
> Rewrote all 500 lines of AGENTS.md.

Prefer: change one section → verify one section → done.

---

## Things that do NOT warrant updating AGENTS.md

- CSS margin/padding values
- Button labels or icons
- Local variable names
- Private function signatures (not exported)
- Null checks and guard clauses
- Log message wording
- Comment wording
- Pool size constant tweaks
- Unit test assertions
- Formatting changes

---

## Consistency verification (before reporting done)

```
Actual code in src/
       ↓  must match
Current architecture in AGENTS.md
       ↓  must match
Deep technical reference in AGENT.md
```

If the code and AGENTS.md disagree because of the current task, fix AGENTS.md.  
Never knowingly leave documentation that contradicts the current implementation.
