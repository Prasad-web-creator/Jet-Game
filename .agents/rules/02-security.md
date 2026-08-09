# JetGame — Security Rules

## Firebase Security

### Client-side config is safe — security comes from rules
The Firebase `apiKey`, `projectId`, `appId` in `src/firebase/firebaseApp.ts` are safe to commit.
They are public identifiers, not secrets. Security is enforced by Firestore and RTDB rules.

### What is NEVER allowed
- Service account private keys in any committed file.
- Admin SDK credentials in client-side code.
- Secret API tokens hardcoded anywhere in source.
- Actual passwords, tokens, or private keys in `AGENTS.md`, `AGENT.md`, or any doc.
- Environment variable values in documentation (document names and purposes only).

### Firebase SDK access
- Firebase SDK imports belong **only** in `src/firebase/`.
- `initializeApp()` is called **only** in `src/firebase/firebaseApp.ts`.
- Game systems (`src/game/**`) must never import Firebase SDK.
- React pages that need Firebase data must call a service in `src/firebase/`, not the SDK directly.

### Firebase Security Rules (currently recommended — apply in Firebase Console)

**Firestore:** Players read/write own profile only. Lobbies readable by authenticated users, writable by participants. Matchmaking queue writable by own entry. Matches read/write for authenticated users.

**RTDB:** `matches/{matchId}` read/write for authenticated users only.

### Never weaken rules to make functionality work
If something fails due to Firebase rules:
1. Identify the root cause (auth missing, wrong path, wrong field).
2. Fix the application code so it authenticates correctly.
3. If the rule must change, narrow the change to the minimum necessary.
4. Document the security trade-off clearly.
5. Never add `".read": true` or `".write": true` at root level.

## Application Security

### Input validation
- Client-side validation is a UX aid, not a security boundary.
- Firebase rules are the actual enforcement point.
- Never trust data coming from RTDB events as validated damage — it is client-reported.
- Cloud Function damage validation is the planned future improvement (not yet implemented).

### Auth gates
- Every multiplayer screen requires `profile !== null` (set by Firebase `onAuthChanged`).
- Never navigate to `multiplayer_menu`, `lobby`, or `multi_game` without a confirmed profile.
- Anonymous users (`isAnonymous: true`) are allowed — they get a generated callsign.

## Secrets Audit Checklist
Before committing any file, verify:
- [ ] No private keys, tokens, or passwords present.
- [ ] No `.env` files with actual secret values committed.
- [ ] No service account JSON files present.
- [ ] `AGENTS.md` and `AGENT.md` contain only variable names, not values.
- [ ] Firebase client config is the only Firebase credential in source (safe).
