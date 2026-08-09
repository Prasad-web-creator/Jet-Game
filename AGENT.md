# AGENT.md — JetGame: AI Coding Agent Manual

> **⚠️ MANDATORY: ALL AI AGENTS AND AI MODELS MUST READ AND FOLLOW THIS FILE BEFORE
> ANALYZING, MODIFYING, CREATING, DELETING, REFACTORING, DEBUGGING, OR DEPLOYING
> ANY CODE IN THIS PROJECT.**
>
> If the instructions here conflict with an AI model's default coding behavior,
> the project-specific instructions in this file take priority unless they
> conflict with an explicit higher-level system or developer instruction.

---

## Agent Workflow (required for every task)

```
1. READ this AGENT.md
2. UNDERSTAND the relevant architecture section
3. IDENTIFY the affected files and modules
4. ANALYZE dependencies and side effects
5. PLAN the smallest safe change
6. IMPLEMENT the change
7. VALIDATE: npx tsc -b must produce 0 errors
8. CHECK for regressions in related systems
9. REPORT what was changed, what was tested, and any remaining risks
```

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Complete File Map](#3-complete-file-map)
4. [Directory Responsibilities](#4-directory-responsibilities)
5. [Code Identification — Where to Find What](#5-code-identification)
6. [Application Screen Flow](#6-application-screen-flow)
7. [Game Engine Architecture](#7-game-engine-architecture)
8. [System Initialization Order](#8-system-initialization-order)
9. [GameState — Single Source of Truth](#9-gamestate--single-source-of-truth)
10. [EventBus — Decoupled Communication](#10-eventbus--decoupled-communication)
11. [Firebase Architecture](#11-firebase-architecture)
12. [Firebase Data Model](#12-firebase-data-model)
13. [Multiplayer Network Architecture](#13-multiplayer-network-architecture)
14. [Solo Progression System](#14-solo-progression-system)
15. [Mission System](#15-mission-system)
16. [Flight Physics](#16-flight-physics)
17. [Weapon System](#17-weapon-system)
18. [Audio System](#18-audio-system)
19. [Effects System](#19-effects-system)
20. [Environment Configuration](#20-environment-configuration)
21. [TypeScript & Build Standards](#21-typescript--build-standards)
22. [Coding Standards](#22-coding-standards)
23. [AI Agent Rules](#23-ai-agent-rules)
24. [Safe vs Dangerous Commands](#24-safe-vs-dangerous-commands)
25. [Memory & Resource Management](#25-memory--resource-management)
26. [Performance Requirements](#26-performance-requirements)
27. [Security Rules](#27-security-rules)
28. [Error Handling Patterns](#28-error-handling-patterns)
29. [Common Failure Patterns](#29-common-failure-patterns)
30. [Debugging Procedure](#30-debugging-procedure)
31. [Testing & Validation](#31-testing--validation)
32. [Git Rules](#32-git-rules)
33. [Agent Quick-Reference Shortcuts](#33-agent-quick-reference-shortcuts)
34. [Change Impact Analysis](#34-change-impact-analysis)
35. [Agent Reporting Standard](#35-agent-reporting-standard)
36. [Self-Verification Checklist](#36-self-verification-checklist)
37. [Final Agent Rule](#37-final-agent-rule)

---

## 1. Project Overview

| Property | Value |
|----------|-------|
| **Project Name** | JetGame (package name: `jetgame`) |
| **Purpose** | Browser-based 3D aerial combat game with solo missions and real-time multiplayer |
| **Version** | 0.0.0 (active development) |
| **Language** | TypeScript 6.0 (strict mode, `noUnusedLocals`, `noUnusedParameters`) |
| **UI Framework** | React 19 |
| **3D Engine** | Babylon.js 9.20 (core, gui, loaders, materials) |
| **Backend** | Firebase 12.17 (Auth, Firestore, Realtime Database, Analytics) |
| **Build Tool** | Vite 8.2 + `@vitejs/plugin-react` |
| **Linter** | oxlint |
| **Package Manager** | npm |
| **Module System** | ESM (`"type": "module"`) |
| **Target** | `es2023`, `esnext` modules, bundler mode resolution |
| **Runtime** | Browser only — no server-side rendering, no Node.js runtime |
| **Deployment** | Not yet configured. Static build output via `npm run build` |

### Technology Stack Summary

```
Browser
  └─ React 19 (UI / state management for menus and HUD)
       └─ Babylon.js 9 (3D rendering, scene, physics, particles)
            └─ Firebase SDK 12 (Auth, Firestore, Realtime Database)
```

---

## 2. Architecture Diagram

```
User Input (keyboard / mouse / touch)
         │
         ▼
   InputManager  ──────────────────────────────┐
         │                                       │
         ▼                                       │
  FlightPhysics  (pure math, no Babylon)        │
         │                                       │
         ▼                                       │
AircraftController ──── AircraftMesh (Babylon)  │
         │                                       │
         ▼                                       │
    GameLoop.update() ────── all GameSystems ───┘
         │
         │  10 Hz push via setStateUpdater()
         ▼
     GameState  (plain TS object — single source of truth)
         │
         │  React setState (throttled, not every frame)
         ▼
      React HUD / Overlays (read-only consumers)
         │
         │
         ▼
   Firebase (Auth / Firestore / RTDB)
         │
     multiplayer: NetworkManager pushes at 20 Hz to RTDB
```

### Key Architectural Boundaries

| Boundary | Rule |
|----------|------|
| React ↔ Babylon | React never directly touches Babylon objects. Communication is via `GameState` callbacks and `GameEngine` method calls only. |
| GameSystem ↔ React | GameSystems must not import React. They push data via `setStateUpdater` or `globalEventBus`. |
| Firebase ↔ Game | Firebase services (`src/firebase/`) are isolated from game systems. Only `NetworkManager` and React components import Firebase. |
| Physics | `FlightPhysics.ts` has zero Babylon.js imports. It is pure math and can run in any JS environment. |

---

## 3. Complete File Map

```
JetGame/
├── index.html                        ← Single-page app entry point
├── vite.config.ts                    ← Vite build config (minimal — react plugin only)
├── tsconfig.json                     ← Root tsconfig (references app + node)
├── tsconfig.app.json                 ← App compiler options (strict, noUnused*)
├── tsconfig.node.json                ← Vite config compiler options
├── package.json                      ← Scripts, deps, devDeps
├── .oxlintrc.json                    ← Linter config
├── .gitignore
├── public/                           ← Static assets served directly (currently empty)
└── src/
    ├── main.tsx                      ← React root (ReactDOM.createRoot)
    ├── index.css                     ← Global CSS resets + body defaults
    │
    ├── app/
    │   └── App.tsx                   ← ROOT: screen state machine (auth→menu→game)
    │
    ├── components/
    │   ├── GameCanvas.tsx            ← Babylon.js canvas mount/unmount + ResizeObserver
    │   └── index.ts
    │
    ├── types/
    │   ├── game.types.ts             ← ALL shared game types and interfaces
    │   └── index.ts                  ← re-exports game.types.ts
    │
    ├── utils/
    │   ├── index.ts                  ← clamp, lerp, degToRad, radToDeg, generateId, formatNumber
    │   └── platformDetect.ts        ← isMobile(), getHardwareScaling()
    │
    ├── pages/
    │   ├── GamePage.tsx              ← Solo game page (canvas + HUD + overlays)
    │   └── MultiplayerGamePage.tsx  ← Multiplayer game page (NetworkManager integrated)
    │
    ├── firebase/
    │   ├── firebaseApp.ts            ← Firebase init (ONE init point — do not init elsewhere)
    │   ├── auth/
    │   │   └── AuthService.ts        ← signIn, signUp, signInAsGuest, signOut, onAuthChanged
    │   ├── profile/
    │   │   └── PlayerProfileService.ts ← Firestore player profile CRUD
    │   ├── lobby/
    │   │   └── LobbyService.ts       ← Lobby create/join/leave/ready/start
    │   ├── matchmaking/
    │   │   └── MatchmakingService.ts ← Client-side queue + host-election matching
    │   └── multiplayer/
    │       └── networkTypes.ts       ← All multiplayer network types
    │
    ├── game/
    │   ├── index.ts                  ← Barrel: exports all game system classes
    │   ├── core/
    │   │   ├── EventBus.ts           ← Typed pub/sub for decoupled game events
    │   │   ├── GameEngine.ts         ← Babylon.js Engine owner + game loop driver
    │   │   ├── GameLoop.ts           ← System update orchestrator (GameSystem interface)
    │   │   ├── SceneManager.ts       ← Scene creation + system initialization
    │   │   └── index.ts
    │   ├── aircraft/
    │   │   ├── AircraftController.ts ← Player aircraft façade (state updater, damage, health)
    │   │   ├── AircraftManager.ts    ← Aircraft entity registry
    │   │   ├── AircraftMesh.ts       ← Babylon.js mesh construction for aircraft
    │   │   ├── FlightCamera.ts       ← Camera attachment helper
    │   │   ├── FlightInput.ts        ← Input snapshot adapter
    │   │   ├── FlightPhysics.ts      ← Pure-math flight model (zero Babylon imports)
    │   │   ├── definitions/          ← Aircraft stat definitions (F-16 config)
    │   │   └── index.ts
    │   ├── audio/
    │   │   ├── AudioManager.ts       ← Babylon.js Sound management, object pool
    │   │   ├── AudioEvents.ts        ← EventBus → AudioManager bridge
    │   │   ├── SoundBank.ts          ← Sound asset registry and loading
    │   │   └── index.ts
    │   ├── camera/
    │   │   └── CameraManager.ts      ← Third-person chase camera
    │   ├── controls/
    │   │   └── InputManager.ts       ← Keyboard + mouse + touch input → InputSnapshot
    │   ├── defenses/
    │   │   └── GroundDefenseManager.ts ← Radar, SAM, AAA ground threat systems
    │   ├── effects/
    │   │   ├── EffectManager.ts      ← VFX orchestrator
    │   │   ├── BoostFlameSystem.ts   ← Afterburner particle effect
    │   │   ├── DamageEffectSystem.ts ← Smoke/fire on aircraft damage
    │   │   ├── ExplosionPool.ts      ← Object-pooled explosions
    │   │   ├── MissileTrailSystem.ts ← Missile smoke trail
    │   │   ├── ShockwavePool.ts      ← Shockwave ring effect
    │   │   ├── TracerPool.ts         ← Bullet tracer lines
    │   │   ├── MuzzleFlash.ts        ← Gun muzzle flash
    │   │   ├── HitEffectPool.ts      ← Hit spark effect
    │   │   └── index.ts
    │   ├── enemies/
    │   │   └── EnemyManager.ts       ← Enemy AI controller and spawning
    │   ├── missions/
    │   │   ├── MissionManager.ts     ← Mission lifecycle, objectives, rewards
    │   │   ├── AlliedAircraft.ts     ← Allied escort NPC
    │   │   ├── WaypointMesh.ts       ← Navigation ring mesh
    │   │   ├── types.ts              ← MissionDefinition, wave/spawn/waypoint configs
    │   │   ├── definitions/
    │   │   │   └── missionData.ts    ← Data for all 5 solo missions
    │   │   └── index.ts
    │   ├── network/                  ← Multiplayer network systems (GameSystems)
    │   │   ├── NetworkManager.ts     ← RTDB real-time sync (20 Hz), hit event handling
    │   │   ├── StateInterpolator.ts  ← Ring-buffer interpolation for remote aircraft
    │   │   ├── RemotePlayerManager.ts ← Babylon.js meshes for remote players
    │   │   ├── WeaponEventBroadcaster.ts ← Routes local hits → RTDB
    │   │   └── MatchScoreManager.ts  ← Live scoreboard + match timer + finalization
    │   ├── physics/
    │   │   └── PhysicsManager.ts     ← Babylon.js physics plugin wrapper
    │   ├── systems/
    │   │   └── DamageSystem.ts       ← Damage processing / hit resolution
    │   ├── targets/
    │   │   └── TargetManager.ts      ← Target registry, lock-on, distance tracking
    │   └── world/
    │       └── WorldManager.ts       ← Terrain, ocean, island, environment
    │
    ├── services/
    │   ├── index.ts
    │   ├── progression/
    │   │   ├── ProgressionService.ts ← XP, levels, unlock calculations
    │   │   └── UpgradeService.ts     ← Aircraft upgrade stat application
    │   └── storage/
    │       ├── ISaveStorageProvider.ts ← Save/load abstraction interface
    │       ├── LocalStorageSaveProvider.ts ← localStorage implementation
    │       └── SaveGameService.ts    ← Singleton save game facade (swappable provider)
    │
    └── ui/
        ├── hud/
        │   ├── HUD.tsx               ← In-game HUD (speed, alt, health, lock, weapons, threats)
        │   └── HUD.css
        ├── menus/
        │   ├── MainMenu.tsx / .css   ← Main menu with PLAY, MISSIONS, MULTIPLAYER, etc.
        │   ├── MissionSelectModal.tsx / .css ← Mission browser
        │   ├── AircraftSelectModal.tsx / .css ← Aircraft picker
        │   ├── UpgradeScreenModal.tsx / .css ← Upgrade shop
        │   ├── ProfileModal.tsx / .css ← Player profile view
        │   ├── SettingsModal.tsx / .css ← Audio/graphics settings
        │   ├── PauseOverlay.tsx / .css ← In-game pause
        │   ├── GameOverOverlay.tsx / .css ← Death screen
        │   ├── VictoryOverlay.tsx / .css ← Mission win screen
        │   └── index.ts
        ├── mobile/
        │   └── TouchControls         ← On-screen joystick + buttons for mobile
        └── screens/
            ├── AuthScreen.tsx / .css ← Login / register / guest
            ├── MultiplayerMenuScreen.tsx / .css ← Quick match / lobby create-join
            ├── LobbyScreen.tsx / .css ← Real-time lobby room
            └── MatchResultsScreen.tsx / .css ← Post-match K/D/XP results
```

---

## 4. Directory Responsibilities

### `src/app/`
**Purpose**: Application root and screen router.
- **What belongs**: Only `App.tsx`. Screen state machine. Firebase auth listener.
- **What must NOT be here**: Game logic, Babylon.js imports, business logic.
- **Key file**: `App.tsx` — `AppScreen` union type drives all navigation.

### `src/types/`
**Purpose**: Shared TypeScript types for the entire application.
- **What belongs**: Interfaces, enums (as `const` objects), type aliases that are used across multiple modules.
- **What must NOT be here**: Classes, implementation logic, Babylon.js imports.
- **Key rule**: This is imported by both game code and React code — keep it pure.

### `src/game/core/`
**Purpose**: The engine foundation. Babylon.js lifecycle, game loop, event system.
- `GameEngine.ts` — creates/disposes Babylon engine, drives render loop, holds `GameState`.
- `GameLoop.ts` — calls `update(dt, state)` on all registered `GameSystem` instances.
- `SceneManager.ts` — initializes all game systems in the correct order (see §8).
- `EventBus.ts` — typed pub/sub singleton. **All cross-system communication uses this.**

### `src/game/aircraft/`
**Purpose**: Player aircraft — input, physics, mesh, state.
- `FlightPhysics.ts` — **zero Babylon.js dependencies**. Pure math. Can be reused server-side.
- `AircraftController.ts` — orchestrates physics + mesh + damage + state reporting.
- `AircraftMesh.ts` — constructs the Babylon.js F-16 mesh procedurally.

### `src/game/network/`
**Purpose**: Real-time multiplayer systems. All are `GameSystem` implementors or pure utilities.
- Should only be instantiated from `MultiplayerGamePage.tsx`.
- Must not be imported by solo game systems.

### `src/firebase/`
**Purpose**: All Firebase SDK usage lives here.
- `firebaseApp.ts` is the **only file** that calls `initializeApp()`. Do not call it elsewhere.
- Each subdirectory wraps one Firebase feature area.
- Services are plain async functions — no classes unless necessary.

### `src/services/`
**Purpose**: Business logic that operates independently of the game engine.
- `storage/` — save game abstraction. **`ISaveStorageProvider` allows swapping backends.**
- `progression/` — XP, level, and upgrade calculations.
- Must not import Babylon.js. Must not import Firebase SDK directly.

### `src/ui/`
**Purpose**: All React UI components (menus, HUD, screens, mobile controls).
- HUD is a **read-only consumer** of `GameState`. It does not modify game state directly.
- Screens in `ui/screens/` are full-page views managed by `App.tsx`.
- Menus in `ui/menus/` are modals layered over the game or main menu.

### `src/components/`
**Purpose**: Reusable React components that have no business logic.
- `GameCanvas.tsx` — mounts the Babylon canvas, owns `GameEngine` lifecycle within a React `useEffect`, uses `ResizeObserver`.

### `src/utils/`
**Purpose**: Pure math and platform utilities with no side effects.

---

## 5. Code Identification

Use this as a quick lookup before modifying anything:

```
Need to modify UI screens (auth, lobby, results, matchmaking)?
→ src/ui/screens/

Need to modify menus (main menu, pause, mission select, upgrades)?
→ src/ui/menus/

Need to modify the HUD (speed, altitude, health, lock, threats)?
→ src/ui/hud/HUD.tsx

Need to modify the app's top-level navigation/routing?
→ src/app/App.tsx

Need to modify flight physics (speed, turning, boost)?
→ src/game/aircraft/FlightPhysics.ts

Need to modify the player aircraft mesh or visual?
→ src/game/aircraft/AircraftMesh.ts

Need to modify keyboard/mouse/touch input?
→ src/game/controls/InputManager.ts

Need to modify weapons (bullets, missiles, lock-on)?
→ src/game/weapons/WeaponManager.ts, MissilePool.ts, MachineGun.ts

Need to modify missions (objectives, flow, rewards)?
→ src/game/missions/MissionManager.ts

Need to modify mission data (what missions exist)?
→ src/game/missions/definitions/missionData.ts (data-driven — never hardcode in MissionManager)

Need to modify enemies (AI behavior, spawning)?
→ src/game/enemies/EnemyManager.ts

Need to modify audio (sounds, volume, triggers)?
→ src/game/audio/AudioManager.ts + AudioEvents.ts

Need to modify visual effects (explosions, trails, smoke)?
→ src/game/effects/EffectManager.ts + relevant Pool files

Need to modify Firebase authentication?
→ src/firebase/auth/AuthService.ts

Need to modify player profiles (XP, level, credits)?
→ src/firebase/profile/PlayerProfileService.ts

Need to modify lobby system?
→ src/firebase/lobby/LobbyService.ts

Need to modify matchmaking?
→ src/firebase/matchmaking/MatchmakingService.ts

Need to modify multiplayer sync (positions, hits, score)?
→ src/game/network/NetworkManager.ts

Need to modify shared game types/interfaces?
→ src/types/game.types.ts

Need to modify multiplayer-specific types?
→ src/firebase/multiplayer/networkTypes.ts

Need to modify save game / persistence?
→ src/services/storage/SaveGameService.ts + ISaveStorageProvider.ts

Need to modify the Babylon.js scene setup or lighting?
→ src/game/core/SceneManager.ts

Need to modify the game loop or system order?
→ src/game/core/GameLoop.ts + SceneManager.registerSystems()

Need to add a new cross-system event?
→ src/game/core/EventBus.ts — add to GameEventMap

Need to modify cross-platform detection (mobile/desktop)?
→ src/utils/platformDetect.ts
```

---

## 6. Application Screen Flow

```
Browser Load
    └─ src/main.tsx → ReactDOM.createRoot → <App />
           │
           ▼
    Firebase Auth listener (onAuthChanged)
           │
    ┌──────┴──────┐
    │ Not signed in│  ──→  screen='auth'  →  AuthScreen
    │   Signed in  │  ──→  screen='main_menu'  →  MainMenu
    └─────────────┘
           │
    MainMenu provides:
    ├─ PLAY (Quick Sortie)      → screen='solo_game' (no missionId)
    ├─ MISSIONS                 → MissionSelectModal → screen='solo_game' (with missionId)
    ├─ AIRCRAFT                 → AircraftSelectModal (modal, stays on main_menu)
    ├─ UPGRADES                 → UpgradeScreenModal (modal)
    ├─ PROFILE                  → ProfileModal (modal)
    ├─ SETTINGS                 → SettingsModal (modal)
    └─ ⚡ MULTIPLAYER           → screen='multiplayer_menu'
           │
    MultiplayerMenuScreen:
    ├─ QUICK MATCH              → enqueue → matchId found → screen='multi_game'
    ├─ CREATE LOBBY             → lobbyId set → screen='lobby'
    └─ JOIN WITH CODE           → lobbyId set → screen='lobby'
           │
    LobbyScreen (real-time Firestore):
    └─ HOST clicks START MATCH  → matchId set → screen='multi_game'
           │
    MultiplayerGamePage:
    └─ Match ends / Player exits → screen='main_menu'

    solo_game / multi_game escape key:
    └─ GamePhase.Playing → Paused (PauseOverlay)
    └─ GamePhase.Paused  → Playing
```

### AppScreen Values

| Value | Component Shown | Requirements |
|-------|----------------|--------------|
| `'auth'` | `AuthScreen` | Always available |
| `'main_menu'` | `MainMenu` | Firebase user authenticated |
| `'solo_game'` | `GamePage` | Authenticated |
| `'multiplayer_menu'` | `MultiplayerMenuScreen` | `profile !== null` |
| `'lobby'` | `LobbyScreen` | `lobbyId !== null` + `profile !== null` |
| `'multi_game'` | `MultiplayerGamePage` | `matchId !== null` + `profile !== null` |

---

## 7. Game Engine Architecture

### GameEngine (`src/game/core/GameEngine.ts`)

The engine is the **owner** of all Babylon.js resources.

**Lifecycle:**
```
GameCanvas.tsx: useEffect mounts
  → new GameEngine()
  → engine.initialize(canvas)
  → engine.start()
  → Render loop: GameLoop.update(dt) + scene.render() per frame
  → (on unmount) engine.dispose()
```

**Key methods:**
| Method | Purpose |
|--------|---------|
| `initialize(canvas)` | Creates Babylon Engine + Scene + all systems via SceneManager |
| `start()` | Starts Babylon render loop |
| `stop()` | Stops render loop (no disposal) |
| `dispose()` | Full cleanup: stop → dispose all systems → clear EventBus |
| `updateState(partial)` | Merges partial GameState + notifies React subscribers |
| `onStateChange(cb)` | Subscribe to GameState changes, returns unsubscribe fn |
| `registerAdditionalSystem(system)` | Inject a GameSystem after init (used by multiplayer) |
| `getAircraftController()` | Returns player AircraftController (used by NetworkManager) |
| `getInputManager()` | Returns InputManager (used by TouchControls) |

> **Critical**: `GameEngine.dispose()` calls `globalEventBus.clear()`. This ensures no stale listeners survive session resets. Every game system must remove its own listeners in `dispose()` first (called by SceneManager.dispose() before EventBus.clear()).

### GameLoop (`src/game/core/GameLoop.ts`)

**Interface (GameSystem):**
```typescript
interface GameSystem {
  readonly name: string;
  update(deltaTime: number, state: GameState): void;
  dispose(): void;
}
```

All game systems implement this interface. `deltaTime` is in **seconds**.

**Update order (from SceneManager.registerSystems()):**
1. InputManager
2. WorldManager
3. AircraftController
4. TargetManager
5. GroundDefenseManager
6. MissionManager
7. WeaponManager
8. CameraManager
9. EffectManager

> **Rule**: Never change this order without understanding all cross-system data dependencies. InputManager must be first (snapshot capture). AircraftController must precede TargetManager (position update).

---

## 8. System Initialization Order

`SceneManager.createScene()` initializes systems in this strict order. Dependencies flow downward:

```
1. WorldManager        (terrain, water, island — no dependencies)
2. InputManager        (attaches keyboard/mouse/touch listeners)
3. AircraftController  (needs InputManager for flight input)
4. CameraManager       (needs AircraftController for follow target)
5. TargetManager       (needs AircraftController + InputManager for locking)
6. WeaponManager       (needs InputManager + AircraftController + CameraManager + TargetManager)
7. EffectManager       (needs CameraManager for camera shake)
8. GroundDefenseManager (needs AircraftController + TargetManager)
9. MissionManager      (needs AircraftController + TargetManager)
10. AudioManager       (initialize last — needs scene + first user gesture for AudioContext)
11. AudioEvents.bind() (bridges EventBus → AudioManager)
```

> **Rule**: New game systems must be initialized in the correct position. A system that needs AircraftController data must be initialized after step 3.

---

## 9. GameState — Single Source of Truth

**Defined in**: `src/types/game.types.ts`

`GameState` is a plain TypeScript object. It is:
- Created by `createDefaultGameState()`
- Owned by `GameEngine._gameState`
- Updated via `GameEngine.updateState(partial)` only
- Read by React components via `onStateChange()` subscription
- Read by game systems via the `state` param in `update(dt, state)`

**Key fields:**

| Field | Type | Updated by | Read by |
|-------|------|-----------|---------|
| `phase` | `GamePhase` | GamePage, PauseOverlay, MissionManager | HUD, overlays, App.tsx |
| `playerAircraft` | `Aircraft \| null` | AircraftController (setStateUpdater) | HUD |
| `weaponState` | `ActiveWeaponState` | WeaponManager | HUD |
| `lockState` | `TargetLockTelemetry` | WeaponManager / TargetManager | HUD |
| `threatState` | `ThreatState` | GroundDefenseManager | HUD |
| `currentMission` | `Mission \| null` | MissionManager | HUD objectives panel |
| `score` | `number` | MissionManager | HUD |

**GamePhase values:**
```
Loading → (engine init) → Playing
Playing → (Escape)      → Paused
Paused  → (Escape)      → Playing
Playing → (player dies) → GameOver  (after 3s delay)
Playing → (mission done)→ Victory
```

> **Rule**: React HUD components are **read-only consumers** of GameState. They must never directly call Babylon.js APIs or modify `_gameState`. All mutations go through `GameEngine.updateState()`.

> **Rule**: AircraftController pushes flight state to React at **10 Hz** via `setStateUpdater()`. Do not increase this rate — it will cause excessive React re-renders and degrade performance.

---

## 10. EventBus — Decoupled Communication

**File**: `src/game/core/EventBus.ts`
**Singleton**: `globalEventBus` (exported constant)

The `GameEventMap` defines all typed events. Adding a new cross-system event requires only adding a new key to this map.

**Complete event list:**

| Event | Payload | Publisher | Subscribers |
|-------|---------|-----------|-------------|
| `PLAYER_TOOK_DAMAGE` | `{amount, sourceId, position}` | DamageSystem | AudioEvents, EffectManager |
| `PLAYER_CRITICAL_HEALTH` | `{health}` | AircraftController | HUD (warning) |
| `PLAYER_DESTROYED` | `{position}` | AircraftController | AudioEvents, GameEngine |
| `PLAYER_DAMAGE_STATE_CHANGED` | `{health, maxHealth, pct}` | AircraftController | HUD |
| `PLAYER_BOOST_STARTED` | `{}` | AircraftController | AudioEvents |
| `PLAYER_BOOST_STOPPED` | `{}` | AircraftController | AudioEvents |
| `MACHINE_GUN_FIRED` | `{origin, direction}` | WeaponManager | AudioEvents, EffectManager |
| `MISSILE_LAUNCHED` | `{origin, targetId}` | WeaponManager | AudioEvents, NetworkManager |
| `MISSILE_HIT` | `{position, targetId, damage}` | MissilePool | AudioEvents, EffectManager, NetworkManager |
| `TARGET_DESTROYED` | `{targetId, targetName, position}` | TargetManager | AudioEvents, MissionManager, NetworkManager |
| `RADAR_DETECTION_CHANGED` | `{detected, radarId}` | GroundDefenseManager | GameEngine (ThreatState) |
| `SAM_LOCK_STATE_CHANGED` | `{state, samId}` | GroundDefenseManager | AudioEvents |
| `GROUND_DEFENSE_DESTROYED` | `{id, name, position}` | GroundDefenseManager | AudioEvents |
| `MISSION_STARTED` | `{missionId, name}` | MissionManager | AudioEvents |
| `OBJECTIVE_UPDATED` | `{objectiveId, isCompleted, description}` | MissionManager | HUD |
| `MISSION_COMPLETED` | `{missionId, name, rewards}` | MissionManager | AudioEvents, GamePage |
| `MISSION_FAILED` | `{missionId, name, reason}` | MissionManager | AudioEvents, GamePage |

**Rules:**
- Always unregister listeners in `dispose()` — use named arrow methods, not anonymous lambdas.
- Never `globalEventBus.clear()` from a game system — only `GameEngine.dispose()` calls this.
- `EventBus.emit()` wraps callbacks in try/catch — a failing listener will not crash others.

---

## 11. Firebase Architecture

**Init file**: `src/firebase/firebaseApp.ts` — **the only file that calls `initializeApp()`**.

**Exports:**
```typescript
export const auth  = getAuth(app);        // Firebase Authentication
export const db    = getFirestore(app);   // Cloud Firestore
export const rtdb  = getDatabase(app);   // Realtime Database
```

**Firebase Project**: `jetgame-8609c`
- **Auth Domain**: `jetgame-8609c.firebaseapp.com`
- **Firestore**: Standard (us-central1)
- **RTDB URL**: `https://jetgame-8609c-default-rtdb.firebaseio.com`
- **Analytics**: Enabled (non-blocking, `isSupported()` check)

**Authentication providers in use:**
- Email/Password (must be enabled in Firebase Console)
- Anonymous (must be enabled in Firebase Console)

**Auth flow:**
```
App.tsx: useEffect → onAuthChanged(listener)
  ├─ user null     → screen='auth' → AuthScreen
  └─ user present  → getProfile(uid) or createProfile(uid)
                   → setProfile(profile) → screen='main_menu'
```

---

## 12. Firebase Data Model

### Firestore Collections

#### `players/{uid}`
```typescript
{
  uid:                 string;     // Firebase UID
  displayName:         string;     // Same as callsign
  callsign:            string;     // Uppercase, min 3 chars
  level:               number;     // 1 + floor(xp / 1000)
  xp:                  number;
  credits:             number;     // Starts at 1500
  totalKills:          number;
  totalDeaths:         number;
  totalWins:           number;
  missionsCompleted:   number;
  currentAircraftId:   string;     // e.g. 'f16_player'
  unlockedAircraftIds: string[];
  createdAt:           Timestamp;
  lastSeenAt:          Timestamp;
  isAnonymous:         boolean;
}
```

#### `lobbies/{lobbyId}`
```typescript
{
  hostUid:    string;
  name:       string;
  code:       string;              // 6-char join code e.g. 'ALPHA7'
  mode:       'deathmatch' | 'team_deathmatch';
  maxPlayers: number;              // 2–8
  status:     'waiting' | 'starting' | 'in_game' | 'ended';
  matchId:    string | null;
  createdAt:  Timestamp;
}
// Subcollection: lobbies/{lobbyId}/players/{uid}
{
  uid:        string;
  callsign:   string;
  aircraftId: string;
  isReady:    boolean;
  isHost:     boolean;
  joinedAt:   Timestamp;
}
```

#### `matchmaking_queue/{uid}`
```typescript
{
  uid:        string;
  callsign:   string;
  aircraftId: string;
  mode:       'deathmatch';
  level:      number;
  matchId:    string | null;  // written when match is found
  enqueuedAt: Timestamp;
}
```

#### `matches/{matchId}`
```typescript
{
  lobbyId:         string;
  mode:            string;
  status:          'starting' | 'active' | 'ended';
  startedAt:       Timestamp | number;
  endedAt:         Timestamp | null;
  durationSeconds: number;
  players:         Array<{ uid, callsign, aircraftId }>;
  results:         Array<{
    uid, callsign, kills, deaths, score, placement, xpEarned, creditsEarned
  }>;
}
```

### Realtime Database Structure

```
matches/{matchId}/
  meta/
    status:           'starting' | 'active' | 'ended'
    startedAt:        number (unix ms)
    hostUid:          string
    mode:             string
    scoreLimit:       number   (default 20)
    timeLimitSeconds: number   (default 600)
  players/{uid}/            ← Written at 20 Hz by each client
    x, y, z:         number
    pitch, yaw, roll: number
    speed:            number
    health:           number
    boostFuel:        number
    isBoosting:       boolean
    gunFiring:        boolean
    missileFiring:    boolean
    missileTargetUid: string | null
    t:                number (unix ms timestamp)
  events/{pushId}/          ← Hit events (pushed by shooting client)
    type:             'bullet_hit' | 'missile_hit' | 'kill'
    ts:               number
    sourceUid:        string
    targetUid:        string
    damage:           number
    pos:              { x, y, z }
    confirmed:        boolean
  scoreboard/{uid}/
    uid:              string
    callsign:         string
    kills:            number
    deaths:           number
```

---

## 13. Multiplayer Network Architecture

**Authority model**: Client-authoritative movement, server-reported damage.
- Each player runs their own `FlightPhysics` locally and pushes state to RTDB.
- Remote players are rendered with 100ms interpolation lag to absorb jitter.
- Damage is reported by the shooter; kills are reflected in the RTDB scoreboard.

**Broadcast rate**: 20 Hz (every 50ms). Controlled by `NetworkManager`.

**Interpolation**: `StateInterpolator.ts` uses a ring buffer of 32 snapshots per remote player. Renders 100ms behind latest snapshot. Extrapolates up to 200ms before hiding the remote player.

**NetworkManager lifecycle:**
```
MultiplayerGamePage.handleEngineReady()
  → new NetworkManager(matchId, localUid, callsign)
  → nm.setAircraftController(ac)
  → engine.registerAdditionalSystem(nm)  ← joins GameLoop update cycle
  → nm.initialize(scene)                 ← connects RTDB listeners
  → ... per frame: nm.update(dt, state)  ← broadcasts at 20 Hz
  → (on unmount): nm.dispose()           ← removes RTDB listeners, deletes own RTDB entry
```

**Matchmaking** (client-side, no Cloud Functions required):
1. Client calls `enqueue(entry)` → writes to `matchmaking_queue/{uid}`
2. All clients in queue poll for 2+ players every 3 seconds
3. Client with **oldest** `enqueuedAt` becomes host and creates the match
4. Host writes `matchId` to all queue docs
5. All clients detect `matchId` → transition to game

---

## 14. Solo Progression System

### Save Data (`src/services/storage/`)

`SaveGameService` is a **singleton** with a swappable `ISaveStorageProvider`.

Current provider: `LocalStorageSaveProvider` (key: `jetgame_save`).

**Save schema** (`PlayerSaveData`):
```typescript
{
  player: PlayerProfileData;   // callsign, level, xp, credits, kills, aircraft
  upgrades: Record<aircraftId, Record<statId, level>>;
  settings: SettingsData;      // volume, invertPitch, sensitivity, graphics
  unlockedMissionIds: string[];
}
```

**Default save values:**
- Callsign: `PHOENIX-1`, Level 1, 1500 credits, aircraft: `f16_player`
- Unlocked missions: `['m1_training']`

**Upgrade stats** (per aircraft):
`speed | acceleration | armor | handling | missileCapacity | missileDamage | gunDamage | lockSpeed | boostCapacity`

Each stat has levels 0–5. Applied by `UpgradeService.ts`.

> **Important**: The solo save system (`SaveGameService`) is **completely separate** from the Firebase `players/{uid}` profile. They are not synced. Solo progress stays in `localStorage`; multiplayer profile is in Firestore.

---

## 15. Mission System

**Data-driven** — all mission content is in `src/game/missions/definitions/missionData.ts`.

### 5 Solo Missions

| ID | Name | Type | Key Objective |
|----|------|------|---------------|
| `m1_training` | Training Flight | Navigation | 4 waypoints |
| `m2_air_interception` | Air Interception | Combat | Destroy 3 enemy waves |
| `m3_military_base` | Military Base Attack | Destroy Base | Ground structures + defenses |
| `m4_escort` | Escort Mission | Protect Aircraft | Allied aircraft survives |
| `m5_boss_battle` | Boss Battle | Boss Kill | Ace enemy with high health |

### MissionDefinition Schema
```typescript
{
  mission: Mission;                  // id, name, objectives, rewards, timeLimit
  spawnPoint?: { position, rotation };
  waypoints?: WaypointConfig[];     // navigation rings
  enemyWaves?: EnemyWaveConfig[];   // timed enemy spawns
  alliedAssets?: AlliedAssetConfig[]; // escorts
  targetStructureIds?: string[];    // ground structures to destroy
  failureConditions?: {
    playerDestroyed?, alliedAssetDestroyed?, timeExpired?
  };
}
```

### Mission Lifecycle
```
NOT_STARTED
  → ACTIVE (MissionManager.startMission() called from GamePage/SceneManager)
  → COMPLETED (all objectives met → emit MISSION_COMPLETED → VictoryOverlay)
  → FAILED (failure condition met → emit MISSION_FAILED → GameOverOverlay)
```

> **Rule**: To add a mission, add a new entry to `MISSION_DEFINITIONS` array in `missionData.ts`. Never hardcode mission logic in `MissionManager.ts`. `MissionManager` processes definitions, it does not define them.

---

## 16. Flight Physics

**File**: `src/game/aircraft/FlightPhysics.ts`
**Critical rule**: This file has **zero Babylon.js imports**. It must remain pure math. This enables server-side physics validation in future architectures.

### Physical Constants
| Constant | Value | Unit |
|----------|-------|------|
| MIN_SPEED | 60 | m/s (~117 kts) — stall speed |
| MAX_SPEED | 360 | m/s (~700 kts) — military power |
| BOOST_SPEED | 520 | m/s (~1011 kts) — afterburner |
| PITCH_RATE | 1.20 | rad/s |
| ROLL_RATE | 1.80 | rad/s |

### FlightState Interface
```typescript
{ x, y, z, pitch, yaw, roll, speed, throttle, isBoosting, isBraking,
  boostFuel, altitude, heading, speedKnots }
```

### Input → Physics → Mesh pipeline
```
InputManager (keyboard/mouse/touch)
  → InputSnapshot (throttle, pitch, roll, yaw, boost, brake, gun, missile)
  → FlightPhysics.update(dt, input)
  → FlightState
  → AircraftController syncs FlightState to Babylon mesh position/rotation
  → CameraManager follows mesh
```

---

## 17. Weapon System

**Files**: `src/game/weapons/`

**Weapons available:**
- `MachineGun` — fires `ProjectilePool` tracer rounds at high rate
- `MissileWeapon` — fires from `MissilePool` with homing guidance

**WeaponManager** update cycle per frame:
1. Check fire input from `InputSnapshot`
2. Machine gun: spawn projectile from pool, emit `MACHINE_GUN_FIRED`
3. Missile: check lock state from TargetManager, launch from MissilePool, emit `MISSILE_LAUNCHED`
4. Projectile collision: emit `MISSILE_HIT` with damage and position

**Object pools used** (do not allocate on every fire):
- `ProjectilePool` — bullet meshes
- `MissilePool` — missile meshes + homing logic
- `HitEffectPool` — hit sparks
- `TracerPool` — tracer lines
- `ExplosionPool` — explosion particles
- `ShockwavePool` — shockwave ring

> **Rule**: All frequently spawned objects must use object pools. Do not call `new Mesh()` in weapon fire paths.

---

## 18. Audio System

**Files**: `src/game/audio/`

**Pattern**: `AudioEvents.ts` bridges `globalEventBus` → `AudioManager`.
- Audio system listens to game events — it is never called directly from weapon/physics code.
- `AudioManager` manages a sound pool via `SoundBank.ts`.
- All listeners are **named arrow methods** and unregistered in `dispose()`.

**Supported sound events** (from AudioEvents.ts):
`machine_gun | missile_launch | explosion | hit | mission_complete | mission_failed | boost | missile_warning (loop) | engine (loop)`

> **Rule**: Do not call `audioManager.play*()` from any system other than `AudioEvents`. Route all audio triggers through `globalEventBus.emit()`.

---

## 19. Effects System

**Files**: `src/game/effects/`

**EffectManager** listens to EventBus events and triggers pooled VFX.

Effects using object pools (recycle, never create per-event):
- `ExplosionPool` — particle explosion on kill/hit
- `ShockwavePool` — expanding ring
- `TracerPool` — bullet tracer lines
- `MissileTrailSystem` — attached to active missiles
- `BoostFlameSystem` — attached to player aircraft (boost mode)
- `DamageEffectSystem` — smoke/fire on aircraft damage levels

> **Rule**: Effects must not retain references to destroyed targets. All pools implement proper recycle logic. Do not expand pools unnecessarily — use `MAX_POOL_SIZE` constants already established per pool.

---

## 20. Environment Configuration

### No `.env` file currently exists in this project.

All configuration is in source code. Sensitive values (Firebase API key, etc.) are embedded in `src/firebase/firebaseApp.ts`.

> **Security Note**: The Firebase config in `firebaseApp.ts` is an API key, not a secret. Firebase is secured via security rules, not by hiding the config. However, do NOT add private keys, service account credentials, or any other secrets to the codebase.

### Firebase Config (public — safe in client bundle)
| Field | Value |
|-------|-------|
| apiKey | `AIzaSyD7byzesMXgzal7WzKcfgYxGK0M3IBvDlo` |
| authDomain | `jetgame-8609c.firebaseapp.com` |
| projectId | `jetgame-8609c` |
| storageBucket | `jetgame-8609c.firebasestorage.app` |
| messagingSenderId | `120703870300` |
| appId | `1:120703870300:web:86f20cc877fef1f9a08d99` |
| measurementId | `G-XS9KN25KD4` |
| databaseURL | `https://jetgame-8609c-default-rtdb.firebaseio.com` |

### npm Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (HMR) |
| `npm run build` | `tsc -b && vite build` — type-check then bundle |
| `npm run lint` | `oxlint` static analysis |
| `npm run preview` | Preview production build locally |

---

## 21. TypeScript & Build Standards

**Compiler options enforced:**
- `noUnusedLocals: true` — unused variables are errors
- `noUnusedParameters: true` — unused parameters are errors (prefix with `_` to suppress)
- `noFallthroughCasesInSwitch: true`
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `erasableSyntaxOnly: true`
- Target: `es2023`, Module: `esnext`, Resolution: `bundler`

**Validation command**: `npx tsc -b` must produce **zero errors** before any PR or task is considered complete.

**Import style:**
```typescript
// Type-only imports MUST use 'import type'
import type { GameState } from '../../types';
import type { AircraftController } from '../aircraft/AircraftController';

// Value imports (classes, functions, constants)
import { globalEventBus } from '../core/EventBus';
import { clamp } from '../../utils';
```

**Babylon.js imports** — use deep imports to optimize bundle size:
```typescript
// CORRECT — tree-shakeable deep import
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// WRONG — imports entire Babylon bundle
import { Mesh, Vector3 } from '@babylonjs/core';
```

---

## 22. Coding Standards

### Naming Conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| Files | PascalCase.ts | `AircraftController.ts` |
| CSS files | PascalCase.css | `AuthScreen.css` |
| Interfaces | PascalCase | `FlightState`, `GameSystem` |
| Types | PascalCase | `AppScreen`, `GamePhase` |
| Classes | PascalCase | `NetworkManager`, `EventBus` |
| Constants (const obj) | PascalCase | `GamePhase`, `DamageType` |
| Functions | camelCase | `createDefaultGameState()` |
| Private class fields | `_camelCase` | `_matchId`, `_broadcastTimer` |
| Private arrow methods | `_camelCase =` | `_onGunFired = (): void =>` |
| React components | PascalCase | `AuthScreen`, `HUD` |
| CSS classes | kebab-case | `.auth-panel`, `.lobby-player-slot` |
| Event bus event names | SCREAMING_SNAKE_CASE | `MACHINE_GUN_FIRED` |
| Firebase collection names | snake_case | `matchmaking_queue`, `players` |
| RTDB paths | camelCase segments | `matches/{id}/scoreboard/{uid}` |

### File Organization Rules
- Each file has **one primary export** (class or set of related functions).
- Barrel `index.ts` files re-export from each directory — update them when adding new files.
- CSS is colocated with its component (e.g., `AuthScreen.tsx` + `AuthScreen.css`).
- Large components are split into `Component.tsx` + `Component.css` only — no sub-component files unless reused.

### Function/Method Standards
- Async operations: always `try/catch` with specific error handling.
- Event listeners: always store as named arrow methods for correct `this` binding and removability.
- Dispose/cleanup: every class that registers listeners must implement `dispose()`.
- `deltaTime` in GameSystem.update is always in **seconds**.

### Comments
- Only comment non-obvious decisions, not what the code does.
- Bug fixes are documented with `// BUG-N FIX:` prefix and explanation.
- Section dividers use `// ─── Section Name ───` style.

---

## 23. AI Agent Rules

### Agents SHOULD:
- Read the relevant architecture section before touching any system.
- Reuse existing utilities from `src/utils/index.ts`.
- Reuse existing EventBus events before adding new ones.
- Use object pools for frequently created objects.
- Keep `FlightPhysics.ts` free of Babylon.js imports.
- Use named arrow methods for event listener registration.
- Keep Firebase operations in `src/firebase/` only.
- Run `npx tsc -b` after any change and fix all errors before finishing.
- Follow the existing `_camelCase` prefix for private fields.
- Prefix intentionally unused parameters with `_`.
- Update barrel `index.ts` files when adding new exported classes.

### Agents MUST NOT:
- Call `initializeApp()` anywhere except `src/firebase/firebaseApp.ts`.
- Import Firebase SDK directly in game system files (`src/game/`).
- Import Babylon.js in `src/firebase/`, `src/services/`, or `src/types/`.
- Add Babylon.js imports to `FlightPhysics.ts`.
- Call `globalEventBus.clear()` from any file other than `GameEngine.dispose()`.
- Increase the HUD state update rate beyond 10 Hz (causes React render thrash).
- Increase the RTDB broadcast rate above 20 Hz without justification.
- Create new Babylon.js meshes in weapon fire paths (use pools).
- Register anonymous lambda listeners on EventBus (cannot be removed in dispose()).
- Add new Firestore collections without documenting them here.
- Remove `noUnusedLocals` or `noUnusedParameters` TypeScript settings.
- Suppress TypeScript errors with `@ts-ignore` without an explanation comment.
- Merge `PlayerSaveData` (localStorage solo) with `PlayerProfile` (Firebase multiplayer) — they are intentionally separate.
- Call `SaveGameService.getInstance()` from game systems — only from React components.
- Add new NPM dependencies without checking if existing packages solve the problem.
- Remove try/catch from Firebase operations.
- Weaken Firebase security rules to make functionality work.
- Hardcode strings that belong in data files (mission names, aircraft IDs).
- Push partial/broken TypeScript to production.

---

## 24. Safe vs Dangerous Commands

### ✅ Safe — Normal Development

```bash
npm run dev              # Start dev server with HMR
npx tsc -b               # Type-check (read-only)
npm run lint             # Lint check (read-only)
```

### ⚠️ Review Required — May Modify Files

```bash
npm install <package>    # Adds dependency — check necessity first
npm run build            # Compiles + bundles — verify output
npm update               # Updates dependencies — check breaking changes
```

### 🚫 Dangerous — Require Explicit User Confirmation

```bash
npm run build            # Only if deploying to production
npm ci                   # Reinstalls all packages from lock file

# Firebase CLI (if installed)
firebase deploy          # Deploys to production — NEVER without confirmation
firebase firestore:delete # Deletes Firestore data — IRREVERSIBLE
firebase database:remove  # Deletes RTDB data — IRREVERSIBLE
firebase use <project>   # Switches active Firebase project

# Git
git push --force         # NEVER without explicit user permission
git reset --hard         # Discards uncommitted changes
git clean -fd            # Deletes untracked files
```

---

## 25. Memory & Resource Management

### Critical Disposal Pattern
Every class that registers listeners or creates Babylon.js resources must:
1. Implement `dispose()`.
2. Call `globalEventBus.off(event, namedMethod)` for every `on()` registered.
3. Call `.dispose()` on all owned Babylon.js objects (Mesh, Material, Texture, ParticleSystem, Sound).
4. Null all references after disposal.

### Known Subscription Patterns
- `GamePage.tsx`: stores engine state subscription in `unsubRef.current` and calls it in `useEffect` cleanup.
- `MultiplayerGamePage.tsx`: stores `unsubRef`, calls `weaponBroadRef.current?.dispose()` and `networkRef.current?.dispose()` on unmount.
- `AudioEvents.ts`: all listeners are named methods, `dispose()` calls `off()` for each.
- Firebase `onSnapshot()` and `onValue()` return unsubscribe functions — always store and call them.
- `NetworkManager.dispose()` calls RTDB `off()` and removes the local player's RTDB entry.

### Object Pools
The following systems use pooling — do not bypass:
| Pool | Location | Used For |
|------|----------|----------|
| `ProjectilePool` | `weapons/` | Bullet meshes |
| `MissilePool` | `weapons/` | Missile meshes |
| `HitEffectPool` | `weapons/` | Hit sparks |
| `ExplosionPool` | `effects/` | Explosion particles |
| `ShockwavePool` | `effects/` | Shockwave rings |
| `TracerPool` | `effects/` | Bullet tracer lines |

### React Memory Rules
- Use `useRef` for values that should not trigger re-renders (engine instance, subscriptions).
- Use `useCallback` for handlers passed to child components.
- FPS polling uses `setInterval` — always cleared in `useEffect` cleanup.
- Escape key listener uses `useRef` for gameState to avoid stale closure re-registration.

---

## 26. Performance Requirements

### Targets
| Platform | Target FPS |
|----------|-----------|
| Desktop | 60 FPS |
| Mobile | 30–60 FPS |

### Babylon.js Performance Settings (applied in SceneManager)
```typescript
scene.skipPointerMovePicking = true;      // No raycast on mouse move
scene.blockMaterialDirtyMechanism = true; // No material dirty checks per frame
scene.autoClearDepthAndStencil = false;   // Skip unnecessary stencil clears
```

### React Performance Rules
- HUD state updates: max **10 Hz** (throttled by AircraftController).
- FPS display: polled at **2 Hz** (500ms interval in GamePage/MultiplayerGamePage).
- Do not call `setState` in the Babylon render loop — bridge via `setStateUpdater`.

### Babylon Import Rule
Always use deep imports to keep bundle size minimal:
```typescript
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
// NOT: import { MeshBuilder } from '@babylonjs/core';
```

### Mobile Considerations
- `isMobile()` in `platformDetect.ts` detects mobile — used by GameEngine for AA and hardware scaling.
- `getHardwareScaling()` returns a scaling factor for mobile retina screens (renders at ~67% native res).
- Particle counts in effects should be reduced on mobile (check `isMobile()` in effect constructors).

---

## 27. Security Rules

### Firebase Security (Recommended — apply in Firebase Console)

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /lobbies/{lobbyId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null;
      match /players/{uid} {
        allow read: if request.auth != null;
        allow write: if request.auth.uid == uid ||
          request.auth.uid == get(/databases/$(database)/documents/lobbies/$(lobbyId)).data.hostUid;
      }
    }
    match /matchmaking_queue/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /matches/{matchId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**RTDB Rules:**
```json
{
  "rules": {
    "matches": {
      "$matchId": {
        ".read":  "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

### AI Agent Security Rules
- **NEVER weaken Firebase rules to make functionality work.** Identify the root cause instead.
- **NEVER embed service account keys, private keys, or admin SDK credentials** in client code.
- **NEVER trust client-side validation as the only security boundary.** Firebase rules are the enforcement point.
- **NEVER expose user UIDs or other PII in logs or error messages.**
- All damage validation is currently client-reported. A Cloud Function validator is the intended future improvement — do not work around this with loose RTDB rules.

---

## 28. Error Handling Patterns

### Firebase Operations
```typescript
// Always wrap Firebase calls in try/catch
try {
  await setDoc(ref, data);
} catch (err) {
  console.error('[ServiceName] Operation failed:', err);
  // Show user error or fallback — never silently swallow
}

// Non-critical fire-and-forget operations
rtdbSet(ref, value).catch(() => {}); // Only for high-frequency state that is OK to lose
```

### Game System Errors
- EventBus wraps listeners in try/catch — a crashing listener will not crash the game.
- Babylon.js initialization failure: caught in `GameEngine.initialize()` → sets status to `'error'`.
- `GameCanvas.tsx` handles engine error status to show a fallback message.

### Auth Errors
- `formatAuthError(code)` in `AuthService.ts` maps Firebase error codes to user-friendly messages.
- Always display auth errors to the user in `AuthScreen` — do not silently fail auth.

### Mission Failures
- Mission failure is communicated via `globalEventBus.emit('MISSION_FAILED', ...)`.
- `GamePage` listens for this and transitions `phase` to `GameOver`.
- Do not call `GameEngine.updateState()` directly from `MissionManager`.

---

## 29. Common Failure Patterns

Based on bugs fixed during development (documented in code with `BUG-N FIX` comments):

| Pattern | Risk | Mitigation |
|---------|------|-----------|
| Anonymous EventBus listeners | Cannot be removed; accumulate across sessions causing duplicate audio, ghost objectives, memory leaks | Use named arrow methods; unregister in `dispose()` |
| Storing `unsub` function and never calling it | React setState called on unmounted component | Store in `useRef`, call in `useEffect` cleanup |
| Re-registering event listeners every React render | Listener multiplied on every re-render | Use `useEffect` with correct dependency array or no deps |
| `onAuthChanged` + `getProfile` race condition | Profile missing on fast navigation | Use the auth listener as the gating mechanism; do not navigate until profile is loaded |
| `MissionManager.setHudCallback` overwritten | Only the last registered callback receives HUD updates | Use EventBus instead of direct callbacks for multi-subscriber scenarios |
| `globalEventBus.clear()` called too early | Systems still running receive no more events | Only call from `GameEngine.dispose()` after all systems are disposed |
| `new Mesh()` in weapon fire path | Allocation per bullet creates GC pressure | Use the pool classes already provided |
| Babylon.js import in `FlightPhysics.ts` | Breaks server-side reusability, increases bundle | Never add Babylon imports to this file |
| Firebase `onSnapshot` listener not unsubscribed | Real-time listeners accumulate; costs Firestore reads | Always call the returned unsubscribe function in component cleanup |
| Setting React state from Babylon render loop | 60 calls/sec → React re-render thrash | Only call `setStateUpdater` from AircraftController at 10 Hz max |
| Deep-merging `SaveGameService` data incorrectly | Upgrades reset or corrupted across save/load cycles | The fixed `deepMerge` logic in `SaveGameService` handles this — do not modify without testing |

---

## 30. Debugging Procedure

When debugging any issue, follow this structure:

```
1. REPRODUCE: Understand the exact steps to trigger the issue
2. LOCATE: Identify the route/screen/component/system involved
3. TRACE DATA FLOW: Input → processing → output → state
4. TRACE EVENTS: What EventBus events fire? Are listeners registered?
5. TRACE FIREBASE: Check Firestore/RTDB console for data state
6. IDENTIFY ROOT CAUSE: Do not fix symptoms
7. CHECK RELATED CODE: What else uses the same data/system?
8. IMPLEMENT MINIMAL FIX
9. VALIDATE: npx tsc -b → 0 errors
10. TEST: Verify the original issue is gone and regressions are absent
```

### Debug Report Format
```
Problem:         [Description of observed behavior]
Expected:        [What should happen]
Root Cause:      [The actual source of the issue]
Affected Files:  [List of files modified]
Fix:             [What changed and why]
Validation:      [What was tested]
Remaining Risks: [Any residual concerns]
```

### Common Debug Entry Points
| Symptom | Start Here |
|---------|-----------|
| Audio plays multiple times | `AudioEvents.ts` — check for duplicate `bind()` calls |
| HUD not updating | `AircraftController.setStateUpdater()` wiring, check 10 Hz update |
| Mission objective not progressing | `MissionManager` — check EventBus listener for `TARGET_DESTROYED` |
| Remote player not appearing | `NetworkManager` RTDB connection, check `getRemoteUids()` |
| React state after unmount error | Check `unsubRef.current?.()` cleanup in `GamePage.tsx` |
| Lobby players not syncing | `onLobbyPlayersChanged()` in `LobbyScreen.tsx` |
| Auth loop on reload | `onAuthChanged` listener not cleaning up, or Firestore profile creation failing |

---

## 31. Testing & Validation

### No automated test suite currently exists.

All validation is performed via:
1. **TypeScript compiler**: `npx tsc -b` — must produce 0 errors.
2. **Linter**: `npm run lint` — check for linting violations.
3. **Manual browser testing** (see procedures below).

### Manual Test Procedures

**Solo Game:**
1. `npm run dev` → app loads → AuthScreen appears
2. Register or sign in → MainMenu appears with callsign
3. Click PLAY → Babylon canvas loads → HUD appears → controls work
4. Press Escape → PauseOverlay appears → Resume works
5. Click MISSIONS → mission list shows → select mission → game starts with objectives

**Multiplayer:**
1. Open two browser tabs (or two browser profiles)
2. Tab A: Multiplayer → Create Lobby → copy code
3. Tab B: Multiplayer → Join with code
4. Both tabs show lobby with 2 players
5. Tab B: Ready Up → Tab A: Start Match
6. Both tabs enter game → remote aircraft visible
7. Hold Tab in game → scoreboard overlay shows

**TypeScript Validation:**
```bash
npx tsc -b
# Expected: (no output, exit code 0)
```

**After every change**, confirm:
- `npx tsc -b` → 0 errors
- The changed feature works in browser
- No console errors on page load
- No stale listeners (open game, exit to menu, re-enter — audio/mission should reset)

---

## 32. Git Rules

No `.git` config is documented in this codebase. Apply these defaults:

- **Do not force-push** without explicit user authorization.
- **Do not discard uncommitted user changes** (`git reset --hard`, `git clean -fd`).
- **Inspect** `git status` before making large changes.
- **Commit messages**: use imperative tense, e.g. `Add NetworkManager 20Hz broadcast`.
- **Branch naming** (recommended): `feature/mission-system`, `fix/audio-listener-leak`, `chore/update-deps`.
- **Never commit** `node_modules/`, `.env` files, or Firebase service account keys.
- **The `.gitignore`** covers `node_modules` and Vite output (`dist/`).

---

## 33. Agent Quick-Reference Shortcuts

```
UI Screen broken?
→ src/ui/screens/ or src/ui/menus/
→ Check: state passed from App.tsx, CSS class names, conditional rendering

HUD not showing correct values?
→ src/ui/hud/HUD.tsx (check which GameState fields it reads)
→ src/game/aircraft/AircraftController.ts (check setStateUpdater rate)

Physics feel wrong?
→ src/game/aircraft/FlightPhysics.ts (check constants at top of file)
→ Do NOT touch Babylon.js in this file

Weapon not firing / incorrect behavior?
→ src/game/weapons/WeaponManager.ts → check InputSnapshot.gun/missile flags
→ src/game/weapons/MissilePool.ts or MachineGun.ts

Mission objective not completing?
→ src/game/missions/MissionManager.ts → check EventBus listeners
→ src/game/missions/definitions/missionData.ts → check objective IDs match events

Audio not playing or plays multiple times?
→ src/game/audio/AudioEvents.ts → check bind()/dispose() lifecycle
→ globalEventBus listeners must use named methods

Firebase auth error?
→ src/firebase/auth/AuthService.ts → formatAuthError(code)
→ Firebase Console → Authentication → check providers are enabled

Lobby/matchmaking not working?
→ src/firebase/lobby/LobbyService.ts → check Firestore rules
→ src/firebase/matchmaking/MatchmakingService.ts → check queue / host election

Remote aircraft not visible in multiplayer?
→ src/game/network/NetworkManager.ts → check RTDB connection
→ src/game/network/RemotePlayerManager.ts → check spawnRemote()
→ Firebase Console → RTDB → check matches/{matchId}/players

TypeScript errors after change?
→ npx tsc -b → read every error
→ Remove unused imports (noUnusedLocals is an error)
→ Use import type for type-only imports
→ Prefix unused parameters with _

Performance regression?
→ Check for new setState calls in render loop
→ Check for new Mesh() outside pools
→ Check for unremoved onSnapshot/onValue listeners

Save data missing?
→ src/services/storage/SaveGameService.ts → check localStorage key 'jetgame_save'
→ Open DevTools → Application → Local Storage
```

---

## 34. Change Impact Analysis

Before modifying any shared code, trace this dependency chain:

```
CHANGED FILE
  ↓
What imports this file?
  ↓
Do any GameSystems depend on it? (check SceneManager + GameLoop order)
  ↓
Does it emit/receive EventBus events?
  ↓
Does it affect GameState? (check setStateUpdater and updateState calls)
  ↓
Does it affect Firebase data? (Firestore structure, RTDB paths)
  ↓
Does it affect React components? (check props, state subscriptions)
  ↓
What could regress? (list affected screens, game phases, events)
  ↓
What manual tests cover this area?
```

### High-Impact Files (change with maximum care)
| File | Impact |
|------|--------|
| `src/types/game.types.ts` | Changes affect every system and all React components |
| `src/game/core/EventBus.ts` (GameEventMap) | Changes require updating all publishers and subscribers |
| `src/game/core/SceneManager.ts` | System init order changes can cascade silently |
| `src/game/core/GameEngine.ts` | Lifecycle changes affect every GamePage |
| `src/firebase/firebaseApp.ts` | Changes affect all Firebase services |
| `src/services/storage/ISaveStorageProvider.ts` | Changes require updating both implementations |
| `src/game/aircraft/FlightPhysics.ts` | Physics changes affect gameplay feel globally |

---

## 35. Agent Reporting Standard

After completing any task, report:

```markdown
## Summary
What was changed and why?

## Root Cause (if bug fix)
What was the underlying problem?

## Files Modified
- src/... (what changed in each file)

## Logic Changes
What behavior changed? What stayed the same?

## Validation
- npx tsc -b: [0 errors / N errors]
- Manual test: [describe what was tested]

## Risks
Any remaining concerns or incomplete areas?

## Notes for Next Agent
Anything the next agent should know before continuing?
```

For significant changes, also report:
- **Architecture Impact**: Does this change the system boundaries or data flow?
- **Performance Impact**: Any new allocations, render loop changes?
- **Security Impact**: Any Firebase rule changes or auth logic changes?
- **Breaking Changes**: Does this require changes to other files?

---

## 36. Self-Verification Checklist

Before declaring any task complete:

- [ ] Read the relevant sections of this AGENT.md
- [ ] Understood the affected architecture layer
- [ ] Identified all files that needed to change
- [ ] Checked if existing utilities could solve the problem
- [ ] Avoided modifying unrelated files
- [ ] Used named arrow methods for any event listeners added
- [ ] Called dispose() cleanup for any listeners registered
- [ ] Kept Firebase operations in `src/firebase/` only
- [ ] Kept `FlightPhysics.ts` free of Babylon.js imports
- [ ] Used deep Babylon.js imports for tree-shaking
- [ ] Used `import type` for type-only imports
- [ ] Ran `npx tsc -b` and resolved all errors
- [ ] Prefixed unused parameters with `_`
- [ ] Removed all temporary debugging code
- [ ] Updated barrel `index.ts` if a new export was added
- [ ] Verified the change works in a browser
- [ ] Checked that `globalEventBus.clear()` is NOT called outside `GameEngine.dispose()`
- [ ] Verified Firebase security rules were not weakened
- [ ] Documented changes honestly in the report

---

## 37. Final Agent Rule

> **Before making any change, understand first.**
> **Before deleting anything, verify first.**
> **Before changing architecture, justify first.**
> **Before claiming success, validate first.**
>
> **Prefer the smallest safe change over a large rewrite.**
>
> **Preserve existing behavior unless the requested change explicitly requires changing it.**
>
> **Reuse existing architecture before introducing new architecture.**
>
> **Never trade security, data integrity, or stability for convenience.**
>
> **When uncertain, inspect the codebase and existing patterns before making assumptions.**
>
> **Run `npx tsc -b` after every change. Zero errors is not optional — it is the minimum bar.**

---

*Last updated: Generated from repository analysis of JetGame (jetgame-8609c). Update this file whenever architectural rules, Firestore schema, EventBus events, system initialization order, or screen routing changes.*
