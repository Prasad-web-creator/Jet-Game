# Workflow: Security Audit

Use this workflow to review and improve security in JetGame.

---

## Scope of this audit

JetGame is a browser-only application with:
- Firebase Auth (Email/Password + Anonymous)
- Firestore (player profiles, lobbies, matchmaking, matches)
- Realtime Database (live game state sync)
- Client-authoritative game physics
- No server-side game validation currently (Cloud Functions are planned)

---

## Checklist

### Secrets and credentials
- [ ] Run: `grep -r "private_key\|serviceAccount\|secret\|password" src/` — must return nothing sensitive
- [ ] Confirm `src/firebase/firebaseApp.ts` contains only the public Firebase client config (safe to commit)
- [ ] Confirm no `.env` files are committed (check `.gitignore`)
- [ ] Confirm `AGENTS.md` and `AGENT.md` contain no secrets — variable names only
- [ ] Confirm no npm package contains a secret loader that reads from source

### Firebase Authentication
- [ ] `onAuthChanged` is the only auth state source — no other auth checks bypass it
- [ ] All multiplayer screens guard on `profile !== null` before rendering
- [ ] Anonymous users are allowed and handled — they receive generated callsigns
- [ ] `signOut` in `AuthService.ts` cleans up profile state in `App.tsx`
- [ ] Firebase Console: Email/Password and Anonymous providers are enabled

### Firestore rules
Current recommended rules (verify in Firebase Console):
```
players/{uid}: read=auth, write=auth.uid==uid
lobbies/{id}: read=auth, create/update=auth
lobbies/{id}/players/{uid}: read=auth, write=auth.uid==uid OR auth.uid==hostUid
matchmaking_queue/{uid}: read/write=auth
matches/{id}: read/write=auth
```
- [ ] No rule allows `".write": true` without auth check
- [ ] Players can only write to their own profile (`auth.uid == uid`)
- [ ] Host cannot overwrite other players' lobby entries without being host

### RTDB rules
Current recommended:
```json
{ "rules": { "matches": { "$matchId": { ".read": "auth != null", ".write": "auth != null" }}}}
```
- [ ] Root `.read`/`.write` is NOT set to true
- [ ] All RTDB paths require `auth != null`

### Client-side trust
- [ ] Damage values in RTDB events are client-reported — this is a known limitation
- [ ] Kill counts in RTDB scoreboard are written by the claiming client — known limitation
- [ ] Cloud Function validation is the planned mitigation — do not implement workarounds that weaken rules
- [ ] Do not add server-side trust based on client claims without validation

### Input handling
- [ ] Callsign input: validated for minimum length (3 chars) in `AuthScreen`
- [ ] Lobby join code: validated before sending to Firestore
- [ ] No user-provided string is injected directly into Babylon.js material names, mesh names, or RTDB paths without sanitization

### Firebase SDK isolation
- [ ] `src/game/**` contains no Firebase SDK imports
- [ ] `src/ui/**` calls Firebase only through `src/firebase/` services (not SDK directly)
- [ ] `src/services/**` does not import Firebase SDK (uses SaveGameService/localStorage)

---

## Actions if an issue is found

1. **Exposed secret**: Immediately rotate the credential. Remove from git history with `git filter-branch` or BFG. Then document the remediation.
2. **Weak Firebase rule**: Fix the rule in Firebase Console. Do not bypass by loosening further. Document the change.
3. **Trust violation**: Add validation at the Firebase rule level or plan a Cloud Function. Document the gap.
4. **Client XSS vector**: Sanitize the input. Never use `dangerouslySetInnerHTML` with user-provided content.

---

## Report format

```
## Security Audit

### Secrets: PASS / FAIL
[findings]

### Firebase Auth: PASS / FAIL
[findings]

### Firestore Rules: PASS / FAIL
[findings]

### RTDB Rules: PASS / FAIL
[findings]

### Client Trust: PASS / CONCERN (known gaps documented)
[findings]

### SDK Isolation: PASS / FAIL
[findings]

### Documentation Impact Analysis
Project knowledge changed: YES / NO
AGENTS.md updated: YES / NO
[If rules changed, update AGENTS.md Firebase schema section]

### Issues Found
[list or None]

### Actions Taken
[list or None]

### Remaining Risk
[description or None]
```
