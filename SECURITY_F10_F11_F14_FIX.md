# StudyJony — F10 / F11 / F14 remediation

Date: 2026-10-07. Local, isolated verification only. No deployment, production access, real email, or real Google authentication.

## Scope and confirmed causes

| Finding | Confirmed cause | Implementation |
| --- | --- | --- |
| F10 | Reset lookup and `save()` were separate; concurrent requests could both load the same valid token. | Conditional document save atomically updates the password, session version and token fields together. |
| F11 | Unknown recovery emails returned 401, known ones returned 200, SMTP failure returned 500, and duplicate signup exposed the email. Recovery had no email cooldown. | Uniform accepted recovery response, processing outside the response path, MongoDB email cooldown, additional transport-peer budget, and generic duplicate-signup feedback. |
| F14 | Logout only cleared cookies; a copied JWT remained valid. | An expiring MongoDB JWT-fingerprint denylist, distinct new JWTs and exact session-cookie targeting. |

F02 Google subject/linking policy, F03 trusted reset origin, F19 sensitive-log removal, F06 auth generations, F09 Origin checks, ownership protections and learning limits are preserved. Proxy trust/bind and production cookie scope are unchanged; F17/F24 remain deployment-dependent.

## F10 — atomic reset design

1. Hash the submitted token with SHA-256 and load an unexpired matching user.
2. Add a Mongoose document `$where` save predicate requiring the same stored token hash and `passwordResetExpires > $$NOW` at the actual MongoDB update.
3. Run normal validation and `save()` hooks, including bcrypt and the existing password/session-version update.
4. One atomic user-document update writes the new password and version and removes the reset hash/expiry. There is no separate token claim that could commit without the password.
5. A competing or expired-at-write request has no matching document and receives controlled 400 with no new session cookie. Invalid input or a failed database write leaves the persisted password/token intact.

The document `$where` property supplies additional save conditions; it does **not** enable MongoDB JavaScript `$where` queries. This uses the documented [Mongoose conditional-save API](https://mongoosejs.com/docs/api/document.html#Document.prototype.$where), tested against the installed Mongoose and disposable MongoDB 7.0.14.

Token generation remains 32 random bytes, SHA-256 storage and 20-minute expiry. The existing `/api/v1/users/resetPassword/:token` PATCH contract and trusted configured reset-link origin are unchanged. No transaction/replica-set requirement was added.

## F11 — recovery privacy and abuse policy

- Requests with valid configuration return the same **200**, `status: success` and generic inbox message for known/unknown email, invalid email, email cooldown and SMTP failure. No cookie is issued.
- Normalize recovery email using `trim().toLowerCase()` before lookup and cooldown keying. No Gmail/provider-specific alias rewriting is introduced.
- Acquire a **five-minute email cooldown** using an atomic, unique SHA-256-keyed MongoDB upsert. Concurrent requests and different PM2 workers share this cooldown. Unknown email addresses also acquire the same cooldown, so account existence does not control its behavior.
- Only after sending the public response perform account lookup/token generation/delivery. A slow lookup or SMTP cannot change the public result or account-dependent response latency. Recovery acceptance does not promise delivery.
- Preserve an existing **unexpired reset link**; repeated eligible requests do not rotate it. The learner should check earlier inbox/spam messages. A new link can be issued after expiry, or after a failed-delivery cleanup and the cooldown.
- SMTP failure conditionally removes only the hash associated with that failed delivery. A later/different reset credential cannot be erased. Operational logs contain only fixed event names, never addresses, IDs, tokens, URLs, hashes or transport errors.
- Additional recovery budget: **300 requests per transport-peer IP per hour**. It uses the socket address, not unverified forwarding headers. Behind Nginx this is a generous aggregate peer budget, not a claimed end-user IP. Existing broader `/users` API limits remain.
- This extra IP limiter and existing general limiters use an in-memory store **per worker**. The email cooldown is database-shared. A shared IP store is still necessary for one global budget across PM2 processes/hosts; no infrastructure assumption or dependency was added here.
- Missing/invalid trusted origin and database failures before acceptance still fail closed, independently of account existence. F09 still rejects untrusted mutation origins.

This follows the uniform-response, single-use-token and recovery-abuse principles in the [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

### Explicit duplicate-signup policy

Normal successful signup still returns 201 and signs the learner in. Duplicate email returns controlled 400 with `code: signupUnavailable` and a generic message suggesting sign-in/account recovery. It does not expose the email, database index details, an `email exists` claim, or an authentication cookie. Both credential and legacy signup paths use this policy; VI/EN render the localized message and allow retry.

**Residual privacy trade-off:** successful automatic signup and failed signup remain distinguishable. This removes explicit duplicate-email disclosure but does not claim complete signup enumeration resistance. Fully indistinguishable registration would require an email-verification/pending-signup product flow; that was not silently introduced. Password login's uniform invalid-credential behavior is unchanged.

### Recovery delivery limitation

Delivery runs in the long-lived backend process, not a durable job queue. A process crash between acceptance and delivery can lose an email task; a persisted unsent token may remain until its 20-minute expiry. Retry/cooldown and conditional failure cleanup handle normal errors, but do not promise crash-proof email delivery. A durable delivery queue is a separate infrastructure decision.

The old forgot-password `next()` after its completed response is necessarily removed as part of the uniform response lifecycle. The full-app recovery tests no longer reproduce that specific `ERR_HTTP_HEADERS_SENT` path. No general error-handler/F20 refactor was made.

## F14 — logout guarantee and session policy

**Guarantee:** after a confirmed successful logout of an active credential, subsequent cookie or Bearer use of that same JWT is rejected with 401. Distinct active credentials on another device remain valid. Already-authorized requests that started before revocation may finish; logout does not cancel in-flight application transactions.

- All newly issued JWTs include a cryptographically random **32-byte `jti`**. Independent logins in the same JWT second now have different credentials.
- Store only SHA-256 JWT fingerprints and their signed expiry in `revokedsessions`; no raw JWT/user/email is stored. The unique `_id` makes revocation idempotent. `protect` checks the denylist for both Cookie and Bearer sessions, in addition to existing signature/expiry/user/password-version checks.
- Newly issued Google, reset, password-change and legacy API sessions reuse F06's random, attempt-specific HttpOnly cookie format. Non-credential API responses also retain the compatibility `jwt` cookie. Their public selector identifies the isolated authoritative cookie; it is not an authentication credential.
- Credential login/signup responses still never overwrite the shared selector, intent or compatibility JWT. Only a current frontend auth attempt can activate them.
- The client captures its selector, suppresses automatic cookie discard for that logout, immediately invalidates local auth/attempt generations and sends `X-StudyJony-Logout-Session`. The server verifies/revokes that exact credential before clearing its isolated cookie.
- Delayed logout only clears its exact isolated cookie. It does not write selection/intent cookies or clear the shared compatibility JWT, which could erase a newer Google/account session. The remaining compatibility JWT is revoked and expires normally; keeping its cookie does not keep authentication valid.
- A missing captured credential or a pre-upgrade legacy logout targeting a newer isolated session returns 409 rather than falsely reporting revocation or revoking the newer account. Database revocation failures remain failures and can be retried; no successful logout is reported.
- Unselected-cookie discard and abandoned-cookie cleanup revoke verified credentials **before** clearing them. This preserves security for the previous frontend's discard-before-logout order, and invalidates discarded stale candidate tokens. Selected/current pending cookies remain protected by F06's existing checks.
- Previous frontend requests without the new header remain supported. Its selector-`none` fallback revokes credentials presented in that browser request; this compatibility path can revoke multiple abandoned credentials from that same browser, but never all user sessions/devices.
- Password change/reset still invalidates all prior password versions through the unchanged User hooks. Per-session logout does not change the user's password version.
- Expiring pre-upgrade JWTs remain supported without a `jti`. Non-expiring manually signed JWTs are rejected because they cannot support a bounded revocation lifetime; StudyJony's normal issuer already uses `JWT_EXPIRES_IN`.

### Expiry and cleanup

`revokedsessions.expiresAt` and `recoverycooldowns.expiresAt` have MongoDB TTL indexes with `expireAfterSeconds: 0`. These models explicitly enable index creation and operations await initialization. Cleanup is asynchronous; correctness does not depend on exact deletion timing. JWT verification rejects expired tokens, and cooldown eligibility compares its stored expiry explicitly.

## Files changed

Application:

- `server/controllers/authController.js` — conditional reset, generic signup rejection, uniform recovery dispatch, JWT/session-cookie issuance, logout revocation, protect/discard/cleanup integration.
- `server/routes/userRoutes.js` — recovery IP limiter before forgot-password handling.
- `server/middleware/recoveryRateLimit.js` — response/policy, IP budget and atomic email cooldown.
- `server/models/recoveryCooldownModel.js` — expiring hashed email cooldown records.
- `server/models/revokedSessionModel.js` — expiring credential fingerprint records.
- `server/utils/passwordRecovery.js` — conditional reset issuance, preserve active links, mocked-testable email delivery and privacy-safe failure handling.
- `server/utils/sessionRevocation.js` — fingerprint lookup/idempotent revocation.
- `client/app/_contexts/AuthContext.js` — exact logout selector capture; preserve generation/navigation guards.
- `client/app/_lib/credentialAttempt.mjs` — selector capture and optional suppression of early cookie discard.
- `client/app/_lib/credentialSubmission.mjs`, `client/app/_lib/authErrorMessage.js` — carry/map generic signup rejection code.
- `client/messages/en.json`, `client/messages/vi.json` — localized generic signup feedback.

Tests:

- `server/tests/recoverySessionSecurity.test.js` — new focused F10/F11/F14 tests.
- `server/tests/passwordRecoverySecurity.test.js` — asynchronous uniform-response expectations; preserve Host/configuration/reset/logging security checks.
- `server/tests/passwordSessions.test.js`, `server/tests/authenticationFailures.test.js`, `server/tests/googleIdentity.test.js`, `server/tests/userTheme.test.js` — expect server revocation instead of unsafe shared-cookie clearing.
- `server/tests/credentialSessions.test.js` — isolated authoritative cookie expectations for new non-credential sessions; retain F06 scenarios.
- `server/tests/profileName.test.js` — expiring fixture JWTs matching the real issuer.
- `client/scripts/credential-attempt.test.mjs` — VI/EN generic signup rejection and code propagation.
- `client/scripts/test-credential-race-browser.cjs` — real-cookie copied-JWT/logout/independent-device/multiple-tab and duplicate-signup retry cases added to the existing harness.
- `SECURITY_F10_F11_F14_FIX.md` — this report.

## Tests and results

| Check | Result |
| --- | --- |
| Full server suite (`node --test --test-concurrency=1 tests/*.test.js`) | **281/281 passed**, including all 23 new F10/F11/F14 cases and earlier auth, F02/F06/F07/F08/F09, SRS, Wordlist ownership/CRUD, Dialogue/Story XP and streak/heatmap coverage. |
| Focused client auth/session/password/credential suites | **92/92 passed**. |
| Full client unit suite | **300/303 passed**; three unrelated dictionary failures remain, listed below. |
| Real-cookie browser matrix | **192/192 passed**, 320/375/430/1280px, VI/EN, light/dark. Includes account replacement, logout, Google, navigation cancellation, rapid requests, stale failures/signup, retries, cross-tab intents, copied JWT revocation, independent device sessions and duplicate-signup retry. |
| Browser checks after the final discard/cleanup update | **64/64 passed**: reran logout, Google replacement, cross-tab attempts and navigation cancellation at 320/375/430/1280px in VI/EN and light/dark against the final backend. |
| OAuth restore/profile browser suite | **80/80 passed**, 320/375/430/768/1280px, VI/EN, light/dark. Direct callback, failure/cancellation, slow/fast response orders, expired previous session, refresh, logout and account/profile generation guards. |
| Production Next.js 16.3.8 build | **Passed**, including prebuild verification of all 613 catalogue tasks. No temporary test route was present during the build. |
| Focused client ESLint, server ESLint (`no-undef`/`no-unused-vars`), Node syntax and diff checks | **Passed**. Existing unused handler argument names are excluded from the server unused-argument rule; no unrelated handlers were refactored. |

Browser tests used local Next, headless Chromium, mocked Google/API responses as appropriate and disposable real MongoDB/Express for the cookie matrix. No hydration/runtime/unexpected console errors or horizontal overflow were observed in these runs. Browser suites were run sequentially to keep their fixtures isolated, and the temporary OAuth fixture was removed afterward.

The full client suite's three unchanged dictionary failures are:

1. `client/app/_lib/dictionary/resolveMeaning.test.mjs` — “runtime lookup uses v3 words, preserves phrases and keeps lemma metadata”.
2. `client/scripts/build-dictionary-v3.test.mjs` — “the build is read-only and reproduces dictionary-v3.json”.
3. `client/scripts/extract-dictionary-v2.test.mjs` — “source files stay unchanged and the generated JSON is reproducible”.

Dictionary data/generator files were unchanged. These failures were not fixed in this security batch; the full client suite is **not** reported as clean. Non-blocking existing Node VM-module and Mongoose deprecation warnings also remain.

Focused security coverage includes: two simultaneous reset saves, consumed/expired/replaced tokens, failed validation/database writes, old/new password versions, known/unknown/malformed recovery email, normalized cooldown/concurrency/boundary/retry, slow lookup/SMTP, no active-link rotation, generic duplicate signup without login, copied-JWT logout, distinct devices, password/Google-only/dual accounts, provider identity after reset, delayed logout/account switch, missing credentials, old frontend discard order, cleanup preserving selected/pending cookies, TTL index inspection, revocation failure/retry and F09 rejection.

## Compatibility, data and deployment verification

- No user/learning data migration, reconciliation, destructive cleanup or forced global logout is required. New collections/indexes are created through normal Mongoose initialization. Existing F02 account-identity reconciliation guidance is unchanged.
- Pre-upgrade JWTs that were byte-identical represent the same credential and cannot be separated after issuance: revoking one rejects identical copies even across devices. New random `jti` values eliminate this ambiguity for newly issued sessions.
- Deploy the backend and updated frontend together and refresh cached open auth pages. Legacy APIs remain available; response fields/status for successful signup/login are preserved. Signup duplicate errors and accepted recovery outcomes intentionally change as documented above.
- Verify Atlas permissions to create the two collections/indexes, inspect TTL indexes and observe cleanup. Do not disable their expiry indexes. Denylist and cooldown operations fail closed on database/index initialization errors.
  - Read-only checks: `db.revokedsessions.getIndexes()` and `db.recoverycooldowns.getIndexes()` must include `{ expiresAt: 1 }` with `expireAfterSeconds: 0`.
- Verify shared MongoDB use across PM2 workers; verify recovery behavior on different workers. IP-memory-store limits remain per process. F17 proxy/firewall verification remains separate.
- Production `HttpOnly`, `Secure`, `SameSite=None`, `.studyjony.com` scope, cookie paths and OAuth state cookies are unchanged. F24 remains blocked; this batch does not assert that production cookie topology is safe.
- Real Google provider redirect/cookie handling, Vercel → backend forwarding of multiple Set-Cookie headers and `X-StudyJony-Logout-Session`, deployed `/users/me`, multiple real devices, Safari/Firefox and real SMTP delivery still require live verification. Local tests use Chromium, mocks and disposable MongoDB only.

Stopped after F10/F11/F14.
