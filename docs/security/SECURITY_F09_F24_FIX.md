# StudyJony — F09 / F24 remediation report

Date: 2026-10-07. Scope: F09 and F24 only. No deployment, production database access, real email delivery, or real Google authentication.

## Result

- **F09 implemented:** one server-side origin check protects every API mutation, including simple/bodyless study-activity and logout POSTs. CORS is not used as the authorization decision.
- **F24 blocked by unverified production topology:** authentication cookie scope is deliberately unchanged. The supplied URLs identify localhost development, not the production Google callback host. Parent-domain exposure remains unresolved.
- Earlier authentication, identity, ownership, scheduling and regression fixes are preserved. No account/data migration was run.

## F09: root cause and policy

Production authentication cookies use `SameSite=None`; the previous app accepted cookie-bearing mutations without checking their source. CORS could prevent an attacker from reading a response without preventing the server action itself.

`server/middleware/csrfProtection.js` now checks all non-GET/HEAD/OPTIONS requests under `/api/v1` before CORS, body parsing and controller side effects. It uses only the existing configured `FRONTEND_URL`; request Host, forwarded host/protocol and apparent proxy destination are never trusted as the frontend identity.

| Request/configuration | Decision |
| --- | --- |
| Origin exactly matches the configured frontend origin | Allow through to normal authentication/validation |
| Untrusted, misleading, malformed, empty or literal `null` Origin | 403; no fallback to another header |
| No Origin, but a valid Referer from the configured frontend | Allow through to normal authentication/validation |
| No Origin and untrusted/malformed Referer | 403 |
| No Origin/Referer, with cookies | 403, even with a Bearer header or `Sec-Fetch-Site: same-origin` |
| No Origin/Referer, no cookies, explicit Bearer header and no `Sec-Fetch-Site` | Permit non-browser API use; protected routes still verify the JWT normally |
| No source headers and no qualifying explicit Bearer request | 403 |
| Missing/invalid FRONTEND_URL, credentials/path/query/fragment in it, or HTTP production origin | Controlled 500 before mutations; no header-based fallback |
| GET, HEAD, OPTIONS | Existing behavior unchanged; authentication and CORS still apply independently |

The configured URL must be an HTTP(S) origin with optional trailing slashes; production requires HTTPS. Trailing slashes are normalized, including the existing CORS allowed-origin setting. Only the canonical configured origin is allowed; other subdomains, schemes and ports are not implicitly trusted.

This source-origin policy follows the Origin-first, Referer-fallback approach described by [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Missing source information fails closed for cookie authentication. No new CSRF preference, frontend token storage or authentication bypass was introduced.

### Endpoint inventory

All 21 current mutation patterns were inspected and tested for rejection before side effects:

| Router | Mutations covered |
| --- | --- |
| Auth | POST login, signup, logout, credentials/login, credentials/signup, credentials/discard |
| Users | POST forgotPassword; PATCH resetPassword/:token, updatePassword, updateMe, theme, avatar |
| Topics | POST /; PATCH /:id; DELETE /:id |
| Vocabulary | POST /; PATCH /:id; DELETE /:id; POST /:id/review |
| Study activity | POST / |
| Dialogue/Story progress | PATCH /:lessonId/:dialogueId/tasks/:taskId |

The middleware also rejects unsafe methods on future API routes without requiring individual controller changes. Public guest/catalogue/dictionary reads remain available. Google state creation and callback remain GET routes with their existing state/identity verification; no blanket mutation exemption for OAuth was added.

### Session protections retained

- F06 credential responses still write only their own attempt-specific HttpOnly JWT cookie. The current attempt selects the session; old responses cannot activate it.
- Logout, account replacement, session restoration, OAuth restoration and profile response generation guards are unchanged.
- F02 subject-based Google identity checks and email-collision rejection remain unchanged.
- The CSRF check runs before logout cookie clearing and before credentials/discard cleanup, so rejected submissions cannot clear or replace sessions.

## F24: cookie scope and blocker

### Actual repository topology

- Browser API calls use relative `/api/v1` URLs. `client/next.config.js` rewrites them to the configured backend `NEXT_PUBLIC_API_URL`.
- Google state cookies are already host-only, HttpOnly, SameSite=Lax, and restricted to `/api/v1/auth/google`.
- The Google provider callback goes to `GOOGLE_REDIRECT_URI`. The backend callback issues the authentication cookies and redirects to the locale-specific frontend callback.
- Production JWT/candidate cookies and public session-selection/intent cookies currently use `.studyjony.com`. Both backend cookie options and the F06 client selector writer participate in this scope.
- The repository does not establish the deployed Vercel/proxy/Google Console callback configuration. No production infrastructure was queried.

The user confirmed the canonical frontend is `https://studyjony.com`, but supplied `FRONTEND_URL=http://localhost:3000` and `GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback`. Those development values do not establish whether production Google callbacks enter through `studyjony.com` or directly through an API subdomain.

If all auth issuance, OAuth state creation and callbacks enter through the canonical frontend rewrite, host-only frontend cookies are practical. If a callback instead issues cookies on `api.studyjony.com`, host-only cookies there would not authenticate frontend-host rewrite requests; existing host-only OAuth state delivery also needs matching hosts. Narrowing cookies without verifying that topology could break login.

### Before → after

| Cookie | Before | After this batch |
| --- | --- | --- |
| Production `jwt` | Domain=.studyjony.com; HttpOnly; Secure; SameSite=None; Path=/ | **Unchanged** |
| Production `sj_auth_<attempt>` | Same production JWT options | **Unchanged** |
| Production `sj_auth_session`, `sj_auth_intent` | Domain=.studyjony.com; Secure; SameSite=None; Path=/; public selectors, not credentials | **Unchanged** |
| OAuth state/locale | Host-only; HttpOnly; SameSite=Lax; restricted path; Secure in production | **Unchanged** |
| Development auth cookies | Host-only; existing localhost behavior | **Unchanged** |

No old/new cookie namespace transition was implemented, so this batch creates no new duplicate-cookie ambiguity. Existing parent-domain/subdomain risk has **not** been eliminated.

### Required evidence and future transition

Before finishing F24, verify:

1. Production backend `FRONTEND_URL=https://studyjony.com` and the exact production `GOOGLE_REDIRECT_URI`, including its Google Console registration.
2. Whether the provider callback reaches `https://studyjony.com/api/v1/auth/google/callback` through the frontend rewrite, and whether that rewrite preserves all OAuth/authentication Set-Cookie headers.
3. Canonical-host redirects, including www, and any direct API-host authentication consumers.
4. Proxy preservation of Origin/Referer and authentication cookies; production HTTPS behavior in real browsers.

If the canonical-host topology is verified, use a coordinated new host-only cookie namespace (prefer `__Host-` cookies where applicable), update issuance, client selection, activation, cleanup and logout together, and reject legacy duplicate-name ambiguity. `__Host-` cookies require Secure, Path=/ and no Domain in supporting browsers; omitting Domain scopes a cookie to its issuing host. See [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

Plan explicit expiry/retirement of parent-domain cookies without letting a delayed credential/logout response clear a newer selected session. Test old/new cookie mixtures, subdomains, tabs and all F06 races before rollout. A coordinated transition may require users to sign in again; no learning data migration is expected. This plan was **not run or implemented** here.

## Files changed in this batch

| File | Change |
| --- | --- |
| `server/app.js` | Install shared API mutation guard; normalize CORS configured trailing slashes |
| `server/middleware/csrfProtection.js` | New origin/referrer/non-browser request policy |
| `server/tests/csrfProtection.test.js` | Full-app, disposable-DB mutation, session, CRUD, scheduling, progress and OAuth coverage |
| `server/tests/passwordRecoverySecurity.test.js` | Send legitimate test Origin; preserve separate recovery-origin validation assertions behind the new earlier guard |
| `server/tests/userTheme.test.js` | Supply trusted frontend config/Origin for existing full-app theme/account tests |
| `client/scripts/tests/browser/test-csrf-browser.cjs` | New local browser/full-app tests with actual HttpOnly auth cookies |
| `client/scripts/tests/browser/test-credential-race-browser.cjs` | Run the existing real-cookie F06 browser harness through the new guard |
| `client/scripts/tests/browser/test-topic-vocabulary-security-browser.cjs` | Run the existing F07/F08/Wordlist browser harness through the new guard |
| `client/scripts/tests/integration/dependency-runtime.test.cjs` | Verify Next API proxy forwards Origin/Referer with cookies/method/body/response headers |
| `SECURITY_F09_F24_FIX.md` | This report |

Previously dirty Logo, Topic/Vocabulary controller, F07/F08 test and report files were preserved; only the existing F07/F08 browser harness was deliberately updated for guard integration. Frontend application UI, auth controllers, cookie helpers, models, dependencies and lockfiles were not changed for this batch.

## Verification results

| Check | Result |
| --- | --- |
| Full server suite, `node --test --test-concurrency=1 tests/*.test.js` | **244/244 passed** |
| Focused full-app CSRF + recovery/logging suites | **25/25 passed**; includes startup CORS trailing-slash normalization |
| Relevant client auth/session/login/localization/vocabulary suites | **114/114 passed** |
| Local browser CSRF/full Express app | **8/8 passed** at 375/1280px, VI/EN, light/dark |
| F06 real-cookie/disposable-backend browser suite | **160/160 passed** at 320/375/430/1280px, VI/EN, light/dark |
| Wordlist/Add Word/Dictionary/Dialogue useful-word browser suite with guard | **32/32 passed** at 375/1280px, VI/EN, light/dark |
| OAuth/session-restoration browser suite, mocked API/provider | **80/80 passed** at 320/375/430/768/1280px, VI/EN, light/dark |
| Installed image/native dependency + compiled Next API proxy tests | **2/2 passed**, including Origin/Referer/Set-Cookie forwarding |
| Production `npm run build`, Next 16.3.8 | **Passed**; 613 catalogue tasks verified, all application routes compiled |
| Focused ESLint for changed/new client test runners | **Passed** |
| Node syntax checks and `git diff --check` | **Passed** |

The server suite includes F02 verified-subject/collision security, credential-session selection, password-change/reset invalidation, valid/expired/malformed JWT handling, ownership/CRUD, review/SRS, XP, study activity and Dialogue/Story progress. Trusted full-app progress replays still award zero extra XP.

Browser tests prove that simple cross-origin POSTs carrying an actual HttpOnly JWT cookie are rejected without activity writes, cookie clearing or session replacement. An opaque `data:` form supplies literal `Origin: null` and is rejected. Server tests additionally cover `null` Origin with a valid cookie, absence/malformed headers, forged Host/forwarded headers, non-browser Bearer auth, and all current mutation endpoints.

F06 browser tests verify `/users/me` after stale A responses, B login, logout, Google replacement, navigation cancellation, rapid attempts, late failures, signup, retries and cross-tab replacement. These use real local cookie handling and disposable data with mocked Google verification, not production Google services. The additional OAuth client matrix covers direct callback loading, refresh, failure/cancellation, both response orders, expired previous sessions, logout/account switching and old profile responses. UI harnesses check horizontal overflow and unexpected hydration/runtime errors in their exercised flows.

An initial unrestricted parallel server/browser run hit disposable MongoDB startup failures; limiting database concurrency produced the clean full-server result above. Two existing full-app theme test fixtures initially lacked trusted frontend configuration/Origin and were updated to represent legitimate requests; their original behavior assertions remain intact. Browser test navigation waits were corrected while developing the new harness.

The entire client suite was **not** rerun or claimed fully green. The earlier `SECURITY_F06_FIX.md` records three unrelated dictionary expectation/reproducibility failures; dictionary content/code was untouched. Relevant client suites and the production build were rerun here.

The existing F20 forgot-password after-response `ERR_HTTP_HEADERS_SENT` behavior remains asserted in the recovery suite and was **not fixed**. Existing Mongoose deprecation and catalogue VM-module warnings were not changed. Temporary browser fixture routes are removed by the OAuth runner; previously dirty non-test files are checked against their starting hashes.

## Deployment and browser compatibility

- Production must configure `FRONTEND_URL=https://studyjony.com`. Keeping the supplied localhost HTTP value under NODE_ENV=production causes mutations to fail safely. Development may continue using `http://localhost:3000`.
- Keep Origin/Referer headers intact through Vercel/Next and backend proxies. Never replace them with a backend Host-derived frontend identity.
- Public credential/recovery clients outside the frontend must supply the configured trusted Origin. Cookie-authenticated scripts must supply trusted Origin/Referer; cookie-less non-browser Bearer clients may use the documented exception.
- Normal browser fetch mutations supply Origin. Browsers that omit it can use a trusted Referer; if a privacy policy strips both, cookie mutations return 403. This is intentional and needs browser/deployment verification.
- Only the canonical frontend is trusted. Preview/www deployments are not automatically admitted. Any additional legitimate origins require a separately reviewed explicit policy.
- Local Chrome tests cannot prove deployed HTTPS/SameSite=None, Safari/Firefox privacy behavior, Vercel Set-Cookie forwarding, or Google Console configuration. Real Google login, deployed callback/session restoration, multiple HTTPS subdomains and cookie migration need live verification after configuration is confirmed.
- F24 remains open. No speculative proxy/cookie changes or deployment were made. Other audit findings were not fixed.
