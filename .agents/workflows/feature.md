# Workflow: Feature Development

Use this workflow when adding new functionality to JetGame.

---

## Steps

### 1. Read
- [ ] Read `AGENTS.md` (current project state)
- [ ] Read relevant sections of `AGENT.md` (technical reference)
- [ ] Identify where this feature belongs in the architecture

### 2. Understand
- [ ] What problem does this feature solve?
- [ ] Does a similar or related feature already exist?
- [ ] Can it reuse existing services, pools, EventBus events, or components?
- [ ] Which layer does it belong to (UI, GameSystem, Firebase service, service)?
- [ ] What screens / AppScreen values are affected?

### 3. Inspect
- [ ] Read the files that will need to change
- [ ] Understand all dependencies of those files
- [ ] Check if similar patterns exist elsewhere in the codebase
- [ ] Check `src/game/core/SceneManager.ts` if adding a new GameSystem
- [ ] Check `src/app/App.tsx` if adding a new screen

### 4. Analyze impact
- [ ] What breaks if this is implemented incorrectly?
- [ ] What GameState fields are affected?
- [ ] What EventBus events does this publish or subscribe to?
- [ ] Does this touch Firebase? Which collection or RTDB path?
- [ ] Does this require a new npm dependency? (check existing packages first)

### 5. Plan
- [ ] List every file that will be created or modified
- [ ] Identify if a new screen value is needed in `AppScreen`
- [ ] Identify if a new GameSystem needs registering in SceneManager
- [ ] Identify if a new EventBus event is needed in `GameEventMap`
- [ ] Decide if barrel `index.ts` files need updating

### 6. Implement
- [ ] Create new files in the correct directory
- [ ] Follow naming conventions from `.agents/rules/01-coding-standards.md`
- [ ] Use `import type` for type-only imports
- [ ] Use deep Babylon.js imports if Babylon is involved
- [ ] Use named arrow methods for all EventBus listener registrations
- [ ] Implement `dispose()` on any class that registers listeners or owns Babylon resources
- [ ] Update barrel `index.ts` for new exports
- [ ] Add new screen to `App.tsx` AppScreen type if needed
- [ ] Register new GameSystem in `SceneManager.registerSystems()` if needed

### 7. Validate
- [ ] `npx tsc -b` → must produce **0 errors**
- [ ] `npm run lint` → no new errors
- [ ] Open in browser via `npm run dev` → feature works
- [ ] Test edge cases (missing auth, network fail, rapid navigation)
- [ ] Verify no console errors on load or during feature use
- [ ] Exit game and re-enter → no stale listeners (audio / missions reset cleanly)

### 8. Documentation Impact Analysis
- [ ] Does this add a new screen / route? → Update AGENTS.md screen state machine
- [ ] Does this add a new Firebase collection or field? → Update Firebase schema section
- [ ] Does this add a new EventBus event? → Update EventBus events section
- [ ] Does this add a new GameSystem or change init order? → Update init order section
- [ ] Does this introduce a new coding convention? → Update coding standards section
- [ ] Does this add a new npm dependency? → Update project overview section

### 9. Update AGENTS.md if required
Targeted section edits only. Remove outdated content. Do not rewrite the whole file.

### 10. Final verification
- [ ] Code matches what AGENTS.md now describes
- [ ] No secrets exposed
- [ ] No unrelated files accidentally modified

### 11. Report
Use the standard report format from `AGENTS.md`.
