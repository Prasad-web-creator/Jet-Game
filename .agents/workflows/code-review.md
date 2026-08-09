# Workflow: Code Review

Use this workflow when reviewing a change, pull request, or block of generated code.

---

## Review checklist

### Correctness
- [ ] Does the change do what was requested?
- [ ] Does it handle edge cases (null aircraft, unauthenticated user, empty mission, network fail)?
- [ ] Are failure states handled gracefully (try/catch on Firebase, fallback on missing data)?
- [ ] Are EventBus listeners registered with named methods (not anonymous lambdas)?

### Architecture boundaries
- [ ] Does React call Babylon.js directly? (must not)
- [ ] Does a GameSystem import React? (must not)
- [ ] Is Firebase SDK used outside `src/firebase/`? (must not)
- [ ] Does `FlightPhysics.ts` have new Babylon.js imports? (must not)
- [ ] Is `initializeApp()` called anywhere other than `firebaseApp.ts`? (must not)
- [ ] Is `globalEventBus.clear()` called anywhere other than `GameEngine.dispose()`? (must not)

### TypeScript
- [ ] `npx tsc -b` produces 0 errors?
- [ ] Are `import type` used for type-only imports?
- [ ] Are Babylon.js imports deep (not `from '@babylonjs/core'`)?
- [ ] Are unused parameters prefixed with `_`?
- [ ] No `@ts-ignore` without an explanatory comment?

### Memory & resources
- [ ] Does every new class that registers EventBus listeners have a `dispose()`?
- [ ] Does `dispose()` call `globalEventBus.off()` for each registered event?
- [ ] Are Firebase `onSnapshot`/`onValue` unsubscribers stored and called on cleanup?
- [ ] Are object pools used for frequently-spawned meshes (bullets, explosions)?
- [ ] Are `setInterval`/`setTimeout` cleared in `useEffect` cleanup?

### Performance
- [ ] Is `setState` called inside the Babylon render loop? (must not — 60 Hz thrash)
- [ ] Does any new React component cause re-renders on every game frame?
- [ ] Are any new Babylon meshes created per-frame outside pools?
- [ ] Are RTDB writes inside the render loop capped at 20 Hz?
- [ ] Are HUD state updates capped at 10 Hz?

### Security
- [ ] Are any secrets, keys, or tokens hardcoded?
- [ ] Are Firebase security rules weakened to make something work?
- [ ] Is any `players/{uid}` write allowed from a different uid?

### Documentation
- [ ] Did this change add a new screen, Firebase collection, EventBus event, or GameSystem?
- [ ] If yes, was `AGENTS.md` updated with the relevant section?
- [ ] Does `AGENTS.md` still accurately describe the project after this change?
- [ ] Is there any outdated information in `AGENTS.md` that this change makes stale?

### Code quality
- [ ] Are barrel `index.ts` files updated for new exports?
- [ ] Is there any dead code introduced (unused imports, variables)?
- [ ] Are naming conventions followed (see `.agents/rules/01-coding-standards.md`)?
- [ ] Are temporary debug `console.log` statements removed?

---

## Review report format

```
## Code Review: [feature/fix name]

### Correctness: PASS / FAIL / CONCERN
[notes]

### Architecture Boundaries: PASS / FAIL / CONCERN
[notes]

### TypeScript: PASS / FAIL — npx tsc -b: [0 errors / N errors]

### Memory & Resources: PASS / FAIL / CONCERN
[notes]

### Performance: PASS / FAIL / CONCERN
[notes]

### Security: PASS / FAIL / CONCERN
[notes]

### Documentation Impact Analysis
Project knowledge changed: YES / NO
AGENTS.md updated: YES / NO
[notes]

### Overall: APPROVED / CHANGES REQUESTED
[summary of required changes if any]
```
