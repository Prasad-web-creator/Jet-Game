# Workflow: Performance Audit

Use this workflow to investigate and improve performance in JetGame.

---

## Targets
| Platform | Target FPS |
|----------|-----------|
| Desktop | 60 FPS |
| Mobile | 30–60 FPS |

---

## Investigation

### 1. Read current performance configuration
From `AGENT.md §26` and `SceneManager.ts` — these Babylon.js flags are already applied:
```typescript
scene.skipPointerMovePicking = true;       // No per-frame raycast on mousemove
scene.blockMaterialDirtyMechanism = true;  // No material dirty per frame
scene.autoClearDepthAndStencil = false;    // Skip unnecessary stencil clears
```
And hardware scaling is applied on mobile via `getHardwareScaling()` in `platformDetect.ts`.

### 2. Identify the bottleneck area

```
FPS dropping?
  ↓
Check: draw calls (too many meshes, not instanced?)
  ↓
Check: particle count (explosion/trail pools too large?)
  ↓
Check: React re-renders (setState called in render loop?)
  ↓
Check: GameSystem update loops (O(n²) enemy checks?)
  ↓
Check: Firebase reads (onSnapshot firing too often?)
  ↓
Check: RTDB writes (above 20 Hz?)
  ↓
Check: Memory growth (pools not recycling? listeners accumulating?)
```

### 3. React performance checks
- [ ] Is `setStateUpdater` called more than 10 Hz? (AircraftController throttle)
- [ ] Is FPS display polling faster than 2 Hz (500ms interval)?
- [ ] Are any new components rendering on every game frame?
- [ ] Are expensive calculations inside render functions (move to `useMemo`)?
- [ ] Are event handler props re-created every render (use `useCallback`)?

### 4. Babylon.js performance checks
- [ ] Are new meshes created per bullet/missile/explosion (use pools)?
- [ ] Are materials being recreated per-frame (should be cached)?
- [ ] Are any particle systems creating more instances than pool limits?
- [ ] Are LOD levels implemented for ground objects / distant targets?
- [ ] Are inactive meshes set to `isVisible = false` (not just moved off-screen)?

### 5. Memory checks
- [ ] Is `performance.memory.usedJSHeapSize` growing over time?
- [ ] Is any game system leaking EventBus listeners (verify dispose() paths)?
- [ ] Are Firebase onSnapshot subscriptions accumulating (verify cleanup)?
- [ ] Are RemotePlayerManager meshes properly disposed on player disconnect?

### 6. Network performance checks (multiplayer)
- [ ] Is RTDB write rate above 20 Hz? (NetworkManager `_broadcastTimer`)
- [ ] Is the interpolation ring buffer sized appropriately (32 snapshots)?
- [ ] Are RTDB events batched or debounced where possible?

---

## Optimization implementation rules
- Do not sacrifice gameplay correctness for FPS.
- Prefer reducing overdraw and draw calls over reducing game content.
- Mobile particle counts should use `isMobile()` from `platformDetect.ts` to scale down.
- Do not add LOD systems without testing the result on the actual hardware target.
- Do not change pool sizes without verifying the visual impact of the change.
- Test both desktop and mobile after every optimization.

---

## Report format

```
## Performance Audit

### Baseline
FPS (desktop): [measured]
FPS (mobile): [measured if available]
Draw calls: [approx]
Memory: [approx heap]

### Bottlenecks Found
1. [description] — [severity: critical/moderate/minor]

### Optimizations Applied
- [change] → [effect measured]

### Validation
FPS after: [desktop] / [mobile]

### Documentation Impact Analysis
Project knowledge changed: YES / NO
AGENTS.md updated: YES / NO

### Remaining Bottlenecks
[list or None]
```
