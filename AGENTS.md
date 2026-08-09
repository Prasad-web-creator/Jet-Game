# AGENTS.md — JetGame: Living Source of Truth

> **GOLDEN RULE: Every task → Documentation Impact Analysis → update `AGENTS.md` only when project knowledge has changed.**
>
> **`AGENTS.md` describes what the project IS, not what the AI DID.**
>
> **ALL AI AGENTS MUST READ `AGENTS.md` AND `AGENT.md` BEFORE TOUCHING ANY CODE.**

---

## Documentation Impact Analysis — Required After Every Task

After completing code changes, run this decision tree:

```
CODE CHANGES COMPLETE
        ↓
Did this task change:
  Architecture? Routes? Firebase schema? Business logic?
  Coding conventions? Environment config? Dependencies?
  Security rules? Performance strategy? Error handling?
        ↓
       NO ─────────────────────────────────→ Leave AGENTS.md unchanged
        │
       YES
        ↓
  Identify the exact section(s) affected
        ↓
  Update ONLY those sections (targeted edit, not rewrite)
        ↓
  Remove any outdated information
        ↓
  Verify: Code ↔ Architecture ↔ AGENTS.md are consistent
        ↓
  Report what was updated and why
```

### What counts as project knowledge?

Update AGENTS.md: New service/module, new Firestore collection, new Firebase Auth provider, new screen/route, system init order changed, EventBus event added/removed, new env var, GameState field changed, new coding convention, new npm dependency, architecture layer changed.

Do NOT update AGENTS.md: CSS value changed, button icon, local variable renamed, private function refactored, null check fixed, comment reworded, unused import removed, log message changed.

Never write: 'August 8: Changed the login button.' — that is a changelog, not documentation.

---

## Agent Task Lifecycle (mandatory)

```
READ AGENTS.md + AGENT.md → INSPECT source code → ANALYZE affected files
  → PLAN smallest safe change → IMPLEMENT → VALIDATE (npx tsc -b = 0 errors)
  → DOCUMENTATION IMPACT ANALYSIS → UPDATE AGENTS.md if needed
  → VERIFY consistency → REPORT
```

---

## Project Overview

- Name: JetGame (jetgame)
- Purpose: Browser-based 3D aerial combat — solo missions + real-time multiplayer
- Language: TypeScript 6.0 (strict, noUnusedLocals, noUnusedParameters are ERRORS)
- UI: React 19
- 3D Engine: Babylon.js 9.20
- Backend: Firebase 12.17 (Auth, Firestore, Realtime Database, Analytics)
- Build: Vite 8.2 + @vitejs/plugin-react | Linter: oxlint | Package manager: npm
- Module: ESM | Target: Browser only (no SSR, no Node.js)
- Deployment: Not yet configured — npm run build produces static output
- Deep reference: AGENT.md (37 sections, 1600+ lines)

---

## Architecture Boundaries (non-negotiable)

| Rule | Reason |
|------|--------|
| React never calls Babylon.js directly | Boundary between render engine and UI |
| GameSystems never import React | Systems are pure game logic |
| Firebase SDK only in src/firebase/ | All Firebase access centralized |
| FlightPhysics.ts has zero Babylon imports | Enables future server-side validation |
| initializeApp() only in firebaseApp.ts | Single Firebase init point |
| HUD high-freq state (Event-Driven) 60 Hz | Smooth UI tracking (crosshair/pitch) via globalEventBus |
| HUD low-freq state (GameState) max 10 Hz | Prevents React root re-render thrash |
| RTDB broadcast max 20 Hz | Keeps bandwidth reasonable |
| Weapon mesh creation uses pools only | No GC pressure per bullet |
| HUD_TELEMETRY_UPDATE / HUD_TARGET_UPDATE payloads are mutable reused structs | Zero per-frame heap allocation in hot path |

---

## Application Screen State Machine

```
App.tsx AppScreen type drives all navigation:
auth ─(Firebase auth success)─→ main_menu
main_menu ─(PLAY)──────────→ solo_game
main_menu ─(MISSIONS)──────→ solo_game (with missionId)
main_menu ─(MULTIPLAYER)───→ multiplayer_menu
multiplayer_menu ─(create)─→ lobby
multiplayer_menu ─(join)───→ lobby
multiplayer_menu ─(quick)──→ multi_game
lobby ─(host starts)───────→ multi_game
multi_game / solo_game ────→ main_menu (on exit)
```

Screen → Component: auth=AuthScreen | main_menu=MainMenu | solo_game=GamePage | multiplayer_menu=MultiplayerMenuScreen | lobby=LobbyScreen | multi_game=MultiplayerGamePage

---

## Firebase Schema (current)

Firestore:
- players/{uid}: uid, callsign, level, xp, credits, totalKills, totalDeaths, totalWins
- lobbies/{id}: hostUid, code, mode, maxPlayers, status, matchId
- lobbies/{id}/players/{uid}: uid, callsign, isReady, isHost
- matchmaking_queue/{uid}: uid, callsign, mode, level, matchId, enqueuedAt
- matches/{id}: lobbyId, mode, status, players[], results[]

RTDB: matches/{matchId}/meta | players/{uid} (20Hz: x,y,z,pitch,yaw,roll,speed,health,boostFuel,isBoosting,gunFiring,missileFiring,t) | presence/matches/{matchId}/{uid} (connected, lastSeen) | events/{id} (hits) | scoreboard/{uid} (kills,deaths)

---

## System Init Order (SceneManager — do not change without analysis)

1 WorldManager → 2 InputManager → 3 AircraftController → 4 CameraManager →
5 TargetManager → 6 WeaponManager → 7 EffectManager → 8 GroundDefenseManager →
9 MissionManager → 10 EnemyManager → 11 AudioManager → 12 AudioEvents.bind()

GameLoop update: InputManager → WorldManager → AircraftController → **CameraManager** → TargetManager → GroundDefenseManager → MissionManager → EnemyManager → WeaponManager → EffectManager

Critical ordering rule: CameraManager MUST run before TargetManager. Target screen-space projection (_computeScreenPos) uses the scene's transform matrix which is driven by the camera. If TargetManager runs first, projection uses last frame's camera state, causing a 1-frame reticle lag during rapid camera movement.

---

## EventBus Events

Combat: PLAYER_TOOK_DAMAGE, PLAYER_CRITICAL_HEALTH, PLAYER_DESTROYED, PLAYER_DAMAGE_STATE_CHANGED, PLAYER_BOOST_STARTED, PLAYER_BOOST_STOPPED
Weapons: MACHINE_GUN_FIRED, MISSILE_LAUNCHED, MISSILE_HIT
Targets: TARGET_DESTROYED, RADAR_DETECTION_CHANGED, SAM_LOCK_STATE_CHANGED, GROUND_DEFENSE_DESTROYED
Missions: MISSION_STARTED, OBJECTIVE_UPDATED, MISSION_COMPLETED, MISSION_FAILED
UI Telemetry (60 Hz): HUD_TELEMETRY_UPDATE, HUD_TARGET_UPDATE

Rules: Named arrow methods only. Always unregister in dispose(). Only GameEngine.dispose() calls globalEventBus.clear().

---

## Code Navigation

```
Screen/UI broken?             → src/ui/screens/ or src/ui/menus/
HUD not updating?             → src/ui/hud/HUD.tsx (Event-Driven 60 Hz) + AircraftController/TargetManager
App routing wrong?            → src/app/App.tsx (AppScreen state machine)
Physics / flight feel wrong?  → src/game/aircraft/FlightPhysics.ts
Weapon not firing?            → src/game/weapons/WeaponManager.ts
Missile / lock issue?         → src/game/weapons/MissilePool.ts + TargetManager.ts
Mission objective stuck?      → src/game/missions/MissionManager.ts
Mission data wrong?           → src/game/missions/definitions/missionData.ts
Enemy AI wrong?               → src/game/enemies/EnemyManager.ts
Audio doubled / silent?       → src/game/audio/AudioEvents.ts (bind/dispose lifecycle)
Effects not spawning?         → src/game/effects/EffectManager.ts
Firebase auth error?          → src/firebase/auth/AuthService.ts
Lobby not syncing?            → src/firebase/lobby/LobbyService.ts
Remote player invisible?      → src/game/network/NetworkManager.ts + RemotePlayerManager.ts
TypeScript errors?            → npx tsc -b (read every error)
Save data missing?            → src/services/storage/SaveGameService.ts
```

---

## Save System (intentionally separate, never merge)

Solo: localStorage key 'jetgame_save' via SaveGameService / ISaveStorageProvider
Multiplayer: Firestore players/{uid} via PlayerProfileService

---

## Coding Standards

- noUnusedLocals + noUnusedParameters = ERRORS (prefix unused params with _)
- import type for type-only imports
- Deep Babylon imports: '@babylonjs/core/Meshes/mesh' NOT '@babylonjs/core'
- Private fields: _camelCase | Private arrow methods: _name = () =>
- EventBus events: SCREAMING_SNAKE_CASE | CSS classes: kebab-case
- Firestore collections: snake_case
- Every dispose() calls globalEventBus.off() for each registered listener
- deltaTime in GameSystem.update is always SECONDS

---

## npm Commands

- npm run dev → dev server (HMR)
- npx tsc -b → type-check (required after every change, must = 0 errors)
- npm run lint → oxlint
- npm run build → tsc -b && vite build
- npm run preview → preview production

Dangerous (require explicit confirmation): firebase deploy, firebase firestore:delete, git push --force, git reset --hard

---

## Standard Report Format

```
## Task / ## Analysis / ## Changes Made / ## Files Modified
## Validation: npx tsc -b result + manual test
## Documentation Impact Analysis: Project knowledge changed YES/NO
## AGENTS.md: Updated YES/NO
  [If NO]: AGENTS.md was not modified because this task did not change project knowledge.
  [If YES]: Updated sections: [list]
## Security Impact / ## Performance Impact / ## Regression Risk / ## Remaining Issues
```

---

*This file describes current project state. Update only when architecture, Firebase schema, routing, EventBus events, system init order, or coding conventions change. For full technical reference see AGENT.md.*
