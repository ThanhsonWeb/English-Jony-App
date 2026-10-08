# StudyJony security remediation — F06

Date: 2026-10-06. Scope: stale password-login/signup responses only. No production services, real accounts, real Google OAuth, dependency changes or migrations.

## 1. Confirmed root cause

Login and signup previously called `setUser` and navigated after any successful response. `setUser` intentionally starts a new auth generation, so it could not distinguish a late obsolete response from an intentional new login. Neither form cancelled its submission on unmount.

The backend also wrote the same HttpOnly `jwt` cookie for every successful credential response. An ignored JavaScript response could therefore still replace the browser's active cookie. Cancellation or a UI generation check alone was insufficient.

## 2. Session/attempt policy

- Each credential submission receives a fresh random 128-bit attempt ID and captures the auth session generation.
- A public `sj_auth_intent` cookie records the current attempt across browser documents. Another tab's newer login, logout or Google action also makes an older response stale. Separate React providers cannot authorize an obsolete attempt just because their local generation has not changed.
- Starting a newer attempt synchronously invalidates/aborts the older attempt and advances the generation.
- An attempt may select its cookie, publish its user and navigate only while both its attempt identity and captured session are current.
- Form close/unmount cancels only that form's attempt; it cannot cancel a newer form's submission.
- Logout invalidates pending credentials before awaiting the API. Its delayed result cannot navigate over a newer session.
- Starting Google sign-in and OAuth restoration invalidate pending credentials. Existing OAuth read deduplication and generation checks remain intact.
- Existing account replacement through `setUser` invalidates pending credentials. Profile mutation guards remain in place.
- Ordinary session restoration is suppressed while a credential attempt is pending. Cancelling/failing a current form restores the unchanged browser session; it does not sign in from the cancelled response.

The policy applies to login and signup using the same shared primitive. Signup's immediate duplicate-submission lock remains intact.

## 3. Cookie/session implementation

### Credential responses are isolated

The updated UI uses additive routes:

```text
POST /api/v1/auth/credentials/login
POST /api/v1/auth/credentials/signup
```

Both require a valid `X-StudyJony-Auth-Attempt` header. Invalid/missing IDs are rejected before signup creates a user. The existing login/signup handlers and validation still authenticate/create the user.

A successful response writes only an HttpOnly cookie named:

```text
sj_auth_<attempt ID>
```

It never writes the shared `jwt`, selection or intent cookie. Its signed JWT includes the attempt ID and retains the existing password-change timestamp/session version and expiry. The JSON response echoes the public attempt ID, never the JWT.

### Only a current response can activate its cookie

After validating the response identity, session generation and shared intent, the client synchronously selects the attempt through `sj_auth_session`. The readable selector and intent cookies contain only public IDs/markers; they are not authentication credentials. JWTs remain HttpOnly and are not put into localStorage/sessionStorage. Google and other legacy session issuance rotate the shared intent as well.

The selector persists beyond the selected JWT's lifetime so expiry cannot silently revive an older legacy account. Persisting the selector does not extend JWT validity. Browser limits on cookie lifetime still apply.

`protect` uses only the selected cookie, verifies its JWT signature/expiry and matching signed attempt claim, reloads the user and applies the existing password session-version/timestamp checks. Explicit invalid, logged-out, missing-candidate, expired or mismatched selection fails with 401; it never falls back to another account's `jwt`.

### Late Set-Cookie responses are neutralized

A late A response may still store an **unselected** A cookie when a transport ignores cancellation. It cannot overwrite B's differently named cookie or change B's selection. After logout, `none` remains selected. After Google success, `legacy` selects Google's existing JWT. The late A response is not allowed to change client state or navigate in any of these cases.

Obsolete attempt cookies are discarded by `POST /api/v1/auth/credentials/discard`, which will not delete the selected attempt. Previously selected candidate cookies are discarded after replacement. Abandoned cookies are also cleaned through a header on the existing `/users/me` restore request, without adding an extra startup request. Cleanup preserves the current shared-intent candidate so another document's restoration cannot remove a legitimate pending login. Logout clears all known candidate cookies and the existing `jwt` cookie. Cleanup responses target individual cookie names rather than writing shared selection/intent.

### Existing session behavior

- The original `/auth/login` and `/auth/signup` APIs remain compatible for existing API consumers. They continue issuing the legacy JWT; the new UI always uses the isolated credential routes.
- Existing JWT sessions without a selector remain accepted.
- Google, password update and password reset keep issuing their existing JWT and select the legacy session. Candidate sessions still invalidate correctly after password change/reset.
- Production token cookies retain HttpOnly, Secure, SameSite=None, Domain=.studyjony.com, Path=/ and JWT-derived expiry. The public selector uses matching production domain/Secure/SameSite settings. Development uses the existing local cookie behavior.
- No session database, account reconciliation, password migration or change to F02's Google subject/email policy is introduced.

## 4. Files changed in this batch

| File | Change |
| --- | --- |
| `client/app/[locale]/(auth)/login/page.js` | Guard credential success/errors/navigation; cancel on close/unmount; protect Google initiation; preserve localized errors/pending UI. |
| `client/app/[locale]/(auth)/signup/page.js` | Same shared attempt protocol; retain synchronous duplicate guard and validation/retry. |
| `client/app/_contexts/AuthContext.js` | Coordinate credentials, logout, restoration and account replacement through existing session generations. |
| `client/app/_components/Header.jsx` | Use guarded logout and navigate only if that logout is still current. |
| `client/app/_lib/credentialAttempt.mjs` | Shared attempt lifecycle, public cookie selection and obsolete-cookie discard. |
| `client/app/_lib/credentialSubmission.mjs` | Shared isolated request/response validation and localized failure handling. |
| `client/app/_lib/passwordLogin.mjs` | Delegate to the shared credential submission with a required attempt. |
| `server/controllers/authController.js` | Issue isolated attempt cookies, enforce selection/binding in `protect`, preserve legacy/Google/password flows and clean obsolete cookies. |
| `server/routes/authRoutes.js` | Add the isolated credential/discard routes. |
| `server/utils/credentialCookies.js` | Validate attempt IDs and define candidate cookie names. |
| `client/scripts/credential-attempt.test.mjs` | Focused generation, cancellation, selection, error and navigation tests. |
| `client/scripts/password-login.test.mjs` | Verify isolated route/header/signal/echo while retaining all localized error/retry coverage. |
| `server/tests/credentialSessions.test.js` | Real signed-cookie/disposable DB races, ownership, logout, expiry and password-change/reset compatibility. |
| `client/scripts/test-credential-race-browser.cjs` | Real local browser cookie timing with a disposable backend and mocked Google verification. |
| `SECURITY_F06_FIX.md` | This report. |

The previously completed Google callback, session-restore primitive, session guard, profile mutation code, F03 helper/tests, F19 logging changes, translations, models and package/lockfiles were not changed. The pre-edit snapshot confirms earlier changed files remain identical except the deliberately edited login page/authentication controller. Next dev's generated AGENTS addition and the OAuth test's temporary fixture were removed after verification.

## 5. Tests and results

### Full server — 212/212 passed

```powershell
# From server
npm test
```

Includes 18 new credential-session tests plus all 194 existing tests: F02 identity collisions/verified subjects, password-session timing, JWT authentication failures, recovery/log privacy, ownership/CRUD, profile, SRS, Dialogue/Story, XP and study activity.

New tests apply even obsolete response cookies to a cookie jar before checking authentication. They prove:

- Slow A login and slow A signup cannot replace newer B, logout, Google or navigation cancellation.
- A newer failed attempt still invalidates an older successful attempt.
- Normal login/signup/logout and selected-cookie cleanup work.
- Missing/invalid attempt IDs cannot create an account.
- Public selection without the matching verified JWT cannot authenticate.
- Expired/tampered credentials cannot fall back to a valid prior legacy account.
- A/B cookies coexisting still expose only B's vocabulary.
- Production candidate cookie security attributes are preserved.
- Password update and reset reject old candidate sessions and activate the new valid session.

### Focused client — 107/107 passed

```powershell
# From client
node --test scripts/credential-attempt.test.mjs scripts/auth-session-guard.test.mjs scripts/session-restore.test.mjs scripts/password-login.test.mjs scripts/vocabulary-events.test.mjs scripts/vocabulary-selection.test.mjs scripts/wordlist-filter.test.mjs scripts/wordlist-review-localization.test.mjs scripts/learner-ui-localization.test.mjs
```

Includes rapid attempts, stale errors, guarded cookie selection/navigation, cancellation mocks ignoring AbortSignal, separate-document auth guards, profile/account-generation preservation, OAuth restoration, malformed responses, VI/EN errors and retry.

### Full client — 296/299 passed; three existing failures

All 34 discovered test files under `scripts` and `app/_lib` were run. The same three dictionary failures recorded before this batch remain:

1. `app/_lib/dictionary/resolveMeaning.test.mjs`: existing v3 lookup expectation for `this`.
2. `scripts/build-dictionary-v3.test.mjs`: generated v3 artifact reproducibility.
3. `scripts/extract-dictionary-v2.test.mjs`: generated v2 artifact reproducibility.

The prior dependency report documents their reproduction against the pre-upgrade Git HEAD. Dictionary/content files were not changed. The full client suite is **not** reported as entirely green.

### New browser scenarios — 160 passed

The runner uses local Next and a loopback Express/MongoMemoryServer backend. Credential authentication, signed JWTs and browser HttpOnly cookies are real; only Google verification and unrelated learning API payloads are mocked. It deliberately removes credential fetch AbortSignal to deliver late Set-Cookie responses despite cancellation.

Matrix: **320, 375, 430 and 1280px × VI/EN × light/dark**.

- 128 scenarios: late A after B/logout/Google/navigation, two rapid logins, late failed A, stale signup and normal signup with triple-click submission protection.
- 16 additional scenarios: current wrong-password error, localized feedback, pending unlock and successful retry.
- 16 additional scenarios: pending A in one tab, successful B in another tab, then A's late response; B's visible/server session survives refresh and A never navigates. This case first reproduced the need for shared intent, then passed after the shared guard was added.
- Each case checks cookie-selected `/users/me`, visible user, stale navigation suppression, refresh, JWT invisibility to JavaScript, horizontal overflow and hydration/runtime/unexpected console errors.
- Signup triple submission sends one POST and creates one account in the disposable database.

```powershell
$env:STUDYJONY_TEST_URL='http://localhost:3016'
node scripts/test-credential-race-browser.cjs
```

Playwright was loaded from the existing local cache; no dependency was installed. The final run executes all ten scenarios across the complete matrix.

### Existing Google/OAuth browser regressions

- `test-google-identity-browser.cjs`: **60/60** collision, unknown-error and success scenarios.
- `test-sound-oauth-browser.cjs`: **80/80** existing cases covering direct callback load/refresh, failure/cancellation, both response orders, expired previous session, logout, account/profile guards and unchanged Profile settings.
- These existing suites include **768px tablet** as well as phone/desktop widths, VI/EN and light/dark.

### Build/static/dependency checks

- Production `npm run build`: **passed**, Next **16.3.8**, including the existing 613-task catalogue prebuild check.
- Post-build `scripts/dependency-runtime.test.cjs`: **2/2 passed**, locked Next/native image versions, real image encoding and compiled Next API-proxy behavior.
- Focused ESLint: **zero errors**, one existing Header `<img>` warning.
- JavaScript syntax and `git diff --check` passed.
- Local Next dev logged existing Google Fonts download/fallback warnings under restricted networking; the production build succeeded.
- Build used dummy public OAuth/API settings pointing to local/non-live services. No production build artifact was deployed.

## 6. Compatibility and deployment

- **No data migration or account reconciliation required.** Existing passwords, Google identities, learning data and valid legacy JWTs are preserved.
- Deploy the backend's additive routes/selection handling before the new frontend. An old backend returns failure for the new routes instead of silently issuing its shared login cookie.
- Refresh older open frontend tabs after rollout: the F06 protections are provided by the new frontend protocol; old cached frontend code and legacy API consumers retain their original caller-managed submission behavior.
- The internal `loginWithPassword` helper now requires an attempt; the current login page and tests were updated. External legacy login/signup API shapes remain supported.
- No new environment variable is required. Existing JWT settings and production cookie domain/HTTPS configuration must remain consistent between frontend and backend.
- The public selector can persist after logout/expiry; it contains no token and does not authenticate or extend JWT validity. Obsolete HttpOnly candidate cookies are cleaned by discard, logout and session restoration.
- Cancelling a signup cannot roll back an account the backend already created. It prevents session activation/navigation; the existing synchronous submission lock prevents multiple records from one action.
- F02, F01/F04/F15, F03/F19, existing OAuth/session/profile guards are preserved. Other security findings, including the known F20 response-lifecycle issue, were not fixed.

## 7. Live/manual verification still required

- Real Google OAuth and the deployed callback/domain flow were not used; all provider verification was mocked.
- Verify HTTPS `studyjony.com`/API-subdomain or frontend-rewrite cookie behavior after deployment: domain, Secure, SameSite, HttpOnly candidates and public selector alignment. Local Chrome tested real cookie ordering; production attributes were asserted server-side, not against a deployed HTTPS domain.
- Confirm the reverse proxy forwards the attempt/cleanup headers and all Set-Cookie headers. Proxy configuration was not changed.
- Test the race in deployed Chrome/Safari with throttling, reload, navigation and simultaneous tabs, including older cached tab rollover. Pending credential attempts share intent across documents; general background synchronization of every open tab's UI is outside this fix.
- No production accounts, mailboxes, MongoDB Atlas or production logs were accessed.

**Stopped after F06. No F05, F07+ or unrelated remediation.**
