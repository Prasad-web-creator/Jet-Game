# JetGame — Coding Standards

## TypeScript
- `noUnusedLocals` and `noUnusedParameters` are **compiler errors**. Remove unused code or prefix unused params with `_`.
- Use `import type` for type-only imports (enforced by `verbatimModuleSyntax`).
- Deep Babylon.js imports only: `from '@babylonjs/core/Meshes/mesh'` — never `from '@babylonjs/core'`.
- Run `npx tsc -b` after every change. Zero errors is mandatory.

## Naming
| Artifact | Convention | Example |
|----------|-----------|---------|
| Classes, Interfaces, Types | PascalCase | `NetworkManager`, `FlightState` |
| Private fields | `_camelCase` | `_matchId` |
| Private arrow methods | `_name = (): void =>` | `_onGunFired = (): void => {}` |
| React components | PascalCase | `AuthScreen`, `HUD` |
| EventBus events | SCREAMING_SNAKE_CASE | `MACHINE_GUN_FIRED` |
| CSS classes | kebab-case | `.auth-panel`, `.hud-speed` |
| Firestore collections | snake_case | `matchmaking_queue` |
| npm scripts / file paths | kebab-case | `mission-data.ts` |

## File Organization
- One primary export per file.
- CSS colocated with its component (`AuthScreen.tsx` + `AuthScreen.css`).
- Update barrel `index.ts` when adding a new exported class.
- New game systems go in `src/game/<system>/` with a matching directory `index.ts`.
- New Firebase features go in `src/firebase/<feature>/`.

## React Patterns
- Use `useRef` for values that must not trigger re-renders (engine, subscriptions, timers).
- Use `useCallback` for handlers passed as props.
- Store unsubscribe functions in `useRef` and call them in `useEffect` cleanup.
- FPS / interval polls → always `clearInterval` in `useEffect` cleanup.
- Never call `setState` from inside the Babylon.js render loop.

## Game System Patterns
- All cross-system events go through `globalEventBus` — not direct method calls.
- EventBus listeners: always use **named arrow methods** (not anonymous lambdas) so they can be removed in `dispose()`.
- `dispose()` must call `globalEventBus.off(event, this._namedMethod)` for every `on()` registered.
- `deltaTime` is always in **seconds** (GameEngine passes `getDeltaTime() / 1000`).
- Object pools: never call `new Mesh()` in weapon fire or effect spawn paths.

## Comments
- Comment non-obvious decisions, not what the code does.
- Bug fixes: `// BUG-N FIX: <explanation>` prefix.
- Section dividers: `// ─── Section Name ───────────`.
