# JetGame — Project Context

## What this project is
Browser-based 3D aerial combat game. Solo missions + real-time multiplayer via Firebase.
Read `AGENTS.md` (project root) then `AGENT.md` (detailed technical reference) before any task.

## Stack (exact versions)
- TypeScript 6.0 · React 19 · Babylon.js 9.20 · Firebase SDK 12.17 · Vite 8.2 · oxlint · npm

## Always-on constraints
1. `npx tsc -b` must produce **0 errors** before any task is considered done.
2. `FlightPhysics.ts` must never receive Babylon.js imports — it is pure math.
3. Firebase SDK must never appear outside `src/firebase/`.
4. `initializeApp()` must never be called outside `src/firebase/firebaseApp.ts`.
5. HUD state updates are throttled to 10 Hz — do not increase.
6. RTDB broadcast is capped at 20 Hz — do not increase.
7. All frequently-spawned meshes (bullets, missiles, explosions) must use the existing object pools.
8. React components must never call Babylon.js APIs directly.
9. Game systems (`src/game/**`) must never import React.
10. `globalEventBus.clear()` must only be called from `GameEngine.dispose()`.

## When working on this project
- Read `AGENTS.md` first for current project state.
- Read `AGENT.md` for deep technical reference (37 sections).
- Use `import type` for type-only imports.
- Use deep Babylon.js imports (`@babylonjs/core/Meshes/mesh`, not `@babylonjs/core`).
- Every class that registers EventBus listeners must unregister them in `dispose()`.
- `deltaTime` in GameSystem.update() is always in **seconds**.
- The solo save system (localStorage) and multiplayer profile (Firestore) are intentionally separate — never merge them.
