# JetGame — Workspace Rules for Antigravity

## Read before every task
1. Read `AGENTS.md` (project root) — current project state, architecture, Firebase schema, screen routing.
2. Read `AGENT.md` (project root) — deep technical reference (37 sections).
3. Read `.agents/rules/00-project-context.md` — always-on project constraints.

## Mandatory task lifecycle
```
READ docs → INSPECT source → ANALYZE impact → PLAN minimal change
  → IMPLEMENT → npx tsc -b (0 errors) → Documentation Impact Analysis
  → UPDATE AGENTS.md only if project knowledge changed → REPORT
```

## Non-negotiable rules (see rule files for details)
- `npx tsc -b` must produce **0 errors** before any task is done.
- `FlightPhysics.ts` must never receive Babylon.js imports.
- Firebase SDK (`initializeApp`, `getFirestore`, etc.) only in `src/firebase/`.
- React never calls Babylon.js APIs directly.
- Game systems (`src/game/**`) never import React.
- All EventBus listeners use named arrow methods and are removed in `dispose()`.
- `globalEventBus.clear()` only in `GameEngine.dispose()`.
- HUD state ≤ 10 Hz. RTDB broadcast ≤ 20 Hz.
- Never weaken Firebase security rules to make functionality work.
- Never expose secrets in any committed file.

## Documentation rule (see `.agents/rules/03-documentation-sync.md`)
> **`AGENTS.md` describes what the project IS — not what the AI DID.**

After every task, ask: did project knowledge change?  
YES → update the relevant AGENTS.md section.  
NO → leave AGENTS.md unchanged. State explicitly: "AGENTS.md was not modified because this task did not change project knowledge."

## Workflows
| Task type | Use workflow |
|-----------|-------------|
| New feature | `.agents/workflows/feature.md` |
| Bug fix | `.agents/workflows/bug-fix.md` |
| Investigation | `.agents/workflows/debug.md` |
| Review | `.agents/workflows/code-review.md` |
| Performance | `.agents/workflows/performance.md` |
| Security | `.agents/workflows/security-audit.md` |

## Standard report (required on every task completion)
```
## Task / ## Analysis / ## Changes Made / ## Files Modified
## Validation: npx tsc -b result + manual test
## Documentation Impact Analysis: YES / NO
## AGENTS.md: Updated YES / NO (and why)
## Security Impact / Performance Impact / Regression Risk / Remaining Issues
```
