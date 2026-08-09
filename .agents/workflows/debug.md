# Workflow: Debug Investigation

Use this workflow to investigate unexpected behavior, crashes, or unclear issues in JetGame.

---

## Investigation steps

### 1. Gather information
- [ ] What is the exact behavior observed?
- [ ] What is the expected behavior?
- [ ] When does it occur? (which screen, which GamePhase, which action)
- [ ] Is it reproducible? Every time? Intermittently?
- [ ] Does it occur in dev only, or build too?
- [ ] Does it occur on desktop only, mobile, or both?

### 2. Locate entry point
Use the Code Navigation table in `AGENTS.md`:
```
Screen issue?    → src/ui/screens/ or src/ui/menus/ or src/app/App.tsx
HUD issue?       → src/ui/hud/HUD.tsx + AircraftController setStateUpdater
Physics issue?   → src/game/aircraft/FlightPhysics.ts
Audio issue?     → src/game/audio/AudioEvents.ts (check bind/dispose)
Mission issue?   → src/game/missions/MissionManager.ts + missionData.ts
Firebase issue?  → src/firebase/ + Firebase Console
Multiplayer issue? → src/game/network/ + RTDB console
TypeScript error? → npx tsc -b and read every error
```

### 3. Trace data flow

For game issues:
```
User Input (InputManager → InputSnapshot)
    → FlightPhysics (pure math)
    → AircraftController (mesh + state)
    → GameLoop.update() → systems
    → GameState → React HUD
```

For Firebase issues:
```
onAuthChanged → getProfile/createProfile → setProfile → setScreen
→ FirebaseService → Firestore/RTDB → onSnapshot/onValue
→ React state update → UI
```

For EventBus issues:
```
Publisher: globalEventBus.emit('EVENT_NAME', payload)
    → EventBus tries each listener in try/catch
    → Named listener method in subscriber class
    → Check: was bind() called? was dispose() called already?
```

### 4. Check known failure patterns

From `AGENT.md §29`:
| Pattern | Check |
|---------|-------|
| Audio doubling | Anonymous lambda on EventBus? bind() called twice? |
| Stale setState | unsubRef.current?.() called in useEffect cleanup? |
| Mission stuck | EventBus listener registered? target ID matches objective? |
| Remote invisible | RTDB entry exists? NetworkManager initialized? |
| Auth loop | getProfile() throwing silently? Firestore rules blocking? |
| TypeScript noise | Check noUnusedLocals, import type, deep Babylon imports |

### 5. Inspect state

- Open DevTools → Console → look for `[GameEngine]`, `[NetworkManager]`, `[AudioEvents]` etc.
- Open DevTools → Application → Local Storage → check `jetgame_save`
- Open Firebase Console → RTDB → check `matches/{matchId}/players`
- Open Firebase Console → Firestore → check `players/{uid}`

### 6. Formulate hypothesis
State the hypothesized root cause before making any code change.
Verify hypothesis by reading the relevant source — do not guess-and-patch.

### 7. Fix (if cause found)
Follow the `bug-fix.md` workflow from step 6 onward.

### 8. If cause not found — report

```
## Debug Report
## Observed behavior: [description]
## Expected behavior: [description]
## Investigation performed: [files read, state checked, logs reviewed]
## Hypothesis: [best current guess]
## Information needed: [what would help narrow it down]
## Code unchanged: AGENTS.md was not modified (no architecture change identified)
```
