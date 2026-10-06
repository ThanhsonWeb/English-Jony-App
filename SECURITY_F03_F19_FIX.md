# StudyJony security remediation — F03 and F19

Date: 2026-10-06. Scope: F03 and F19 only. No production access, real email delivery, dependency changes, migrations, or proxy configuration changes.

## 1. Confirmed root causes

### F03 — Request-controlled password-reset origin

`server/controllers/authController.js` previously constructed recovery URLs from `req.protocol` and `req.get("host")`. A caller-controlled Host, or protocol derived from forwarded headers, could influence the emailed reset destination.

The frontend route inventory contains login, signup and the Google callback, but **no reset-password page/form**. The existing recovery email instructs the recipient to make a `PATCH /api/v1/users/resetPassword/:token`. The client forwards `/api/v1/:path*` through `client/next.config.js`, and `client/proxy.js` excludes API paths from locale middleware. This batch preserves that existing API contract and does not invent a new frontend recovery route.

### F19 — Unconditional sensitive debug logging

- The user router logged `req.originalUrl`, including the raw reset token in the URL path.
- Reset handling logged the stored-token comparison hash.
- Vocabulary updates logged the entire request body and returned vocabulary document, exposing words, Vietnamese meanings, examples and ownership metadata.

## 2. Trusted-origin policy and implementation

`server/utils/passwordResetOrigin.js` validates the existing server-side **`FRONTEND_URL`** configuration:

- A single absolute HTTP(S) origin is required. Production (`NODE_ENV=production`) requires **HTTPS**. HTTP remains available for development/test setups.
- Credentials, non-root paths, query strings, fragments, whitespace, backslashes and malformed URLs are rejected. Only trailing root slashes are allowed; URL-origin serialization removes them safely.
- No request headers, request protocol, forwarded headers or alternate environment-variable fallback are consulted.
- Missing/invalid configuration produces a controlled **500** with a fixed user-facing recovery-unavailable message. The configured value/parser error is not exposed.
- Validation happens before creating/saving a reset credential. A configuration failure sends no email and preserves any existing reset token/expiry.

The recovery URL is now:

```text
<validated FRONTEND_URL origin>/api/v1/users/resetPassword/<raw token>
```

Random 32-byte token generation, hexadecimal token format, SHA-256 database storage, 20-minute expiry, bcrypt hashing, successful token consumption and password session-version/timestamp invalidation are unchanged. The existing email subject/message and API route/method are unchanged.

## 3. Logging changes

Removed the user-route debug logger, reset-hash `console.log`, and both vocabulary-update debug dumps. Vocabulary creation already had no body/document logger and remains unchanged. No replacement credential, URL, user-ID, email or learning-content log was added. Google OAuth's existing minimal failure metadata is unchanged.

Captured application console output during recovery/reset, failed delivery, vocabulary creation/update, rejected updates and unauthenticated creation contains no tested raw reset token, token-bearing URL, reset hash, private vocabulary fields, user ID or email. Existing Mongoose deprecation warnings are non-sensitive and were not changed.

## 4. Files changed in this batch

| File | Change |
| --- | --- |
| `server/controllers/authController.js` | Validate trusted origin before issuing reset credentials; use it for the existing reset URL; remove hash logging. Earlier F02 identity/linking changes remain intact. |
| `server/utils/passwordResetOrigin.js` | New narrow configuration validator; no request dependency. |
| `server/routes/userRoutes.js` | Remove full-URL debug logging. Routes and middleware ordering otherwise unchanged. |
| `server/controllers/vocabController.js` | Remove request/document debug dumps; CRUD and ownership logic unchanged. |
| `server/tests/passwordRecoverySecurity.test.js` | New isolated security, recovery, session, expiry and logging regression tests. |
| `SECURITY_F03_F19_FIX.md` | This report. |

No frontend, model, package/lockfile, email-transport, error-handler, environment or deployment configuration files changed. A pre-edit hash snapshot confirms all previously modified/untracked project files remained unchanged except the intentionally edited authentication controller.

## 5. Tests and results

### New focused tests — 11/11 passed

Command, from `server`:

```powershell
node --test tests/passwordRecoverySecurity.test.js
```

Tests use MongoMemoryServer's disposable local database, loopback HTTP only, synthetic accounts and mocked Nodemailer transport. No SMTP connection or real mail is sent.

Coverage:

- Correct configured HTTPS origin and trailing-slash normalization.
- Raw HTTP forged `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`/`Forwarded`, and combined spoofing cases. Raw HTTP avoids fetch silently replacing Host.
- Missing configuration and 18 invalid production-origin cases: no email or reset-token replacement; safe fixed error.
- Emailed token works with the existing PATCH route; SHA-256 storage; 20-minute schedule; successful reset consumes the token; reuse fails.
- Old session rejected and replacement session accepted, including a reset within the same JWT second. Old password fails, new password succeeds; `/users/me` and logout still behave correctly.
- Token fails at the exact expiry boundary and afterward; password/current session remain unchanged on expiry failure.
- Mock mail failure clears the new reset credential and does not leak its token-bearing transport error into logs or responses.
- Vocabulary create, successful update, validation failure, missing-document update and unauthenticated create: private word/meaning/example/pronunciation/document values absent from logs; ordinary CRUD responses remain correct.

### Full server regression suite — 194/194 passed

```powershell
npm test
```

Includes the new 11 tests plus all existing 183 tests: F02 Google identity/collision policies, verified claims, OAuth VI/EN redirects, password/session timing protections, normal/Google-only login, valid/expired/malformed JWT handling, ownership/CRUD, SRS scheduling, themes/profile, Dialogue/Story progress, XP and study activity.

### Relevant client regression suites — 83/83 passed

Command, from `client`:

```powershell
node --test scripts/auth-session-guard.test.mjs scripts/session-restore.test.mjs scripts/password-login.test.mjs scripts/vocabulary-events.test.mjs scripts/vocabulary-selection.test.mjs scripts/wordlist-filter.test.mjs scripts/wordlist-review-localization.test.mjs scripts/learner-ui-localization.test.mjs scripts/dependency-runtime.test.cjs
```

Includes account-generation protections, logout/account switching, OAuth/session-restore race handling, login errors, vocabulary synchronization/filter semantics, VI/EN localization, locked Next/native image versions and actual local Next API-proxy behavior. The proxy test uses the existing compiled route manifest and a mock backend; it is not a new production build or deployed end-to-end recovery test.

### Static checks

- `node --check` passed for all five changed/new JavaScript files.
- `git -c core.safecrlf=false diff --check -- ':!server/node_modules'` passed.
- Earlier package/lockfile versions and existing regression/F02 test files remain unchanged.
- No frontend code changes; no new build or browser viewport/theme run was required or performed for this server-only batch.

### Known F20 remains unchanged

All five successful full-app forgot-password spoofing cases still produce an after-response **`ERR_HTTP_HEADERS_SENT`** after their 200/email generation. A test-only error observer after the unchanged app error handler records the error and `headersSent=true`; it prevents expected error noise from obscuring the security assertions. This demonstrates the existing F20 path still executes. No production response-lifecycle/error-handler fix was made here. The full suite passing is not a claim that F20 has been resolved.

## 6. Configuration/deployment and compatibility

- Set backend `NODE_ENV=production` and server-side `FRONTEND_URL` to the trusted public frontend HTTPS origin, for example `https://studyjony.com`. Use a bare origin in deployment; reset-link generation also tolerates trailing slashes, but other existing consumers of this variable are unchanged.
- Do not set a URL with a locale/path suffix, credentials, query or fragment. A missing/invalid value intentionally disables recovery safely for an existing account.
- Ensure the deployed frontend's existing `/api/v1/:path*` rewrite reaches the intended backend. No locale prefix is added to the reset API route.
- Deploy/restart the backend to apply the changes. No Nginx, `trust proxy`, SMTP configuration, database migration or existing-account reconciliation is part of this batch.
- Existing valid stored reset tokens continue working through the unchanged reset endpoint. Old already-sent emails are not rewritten. Previously exposed logs are not erased by this change; review historical exposure/retention separately.
- Removal affects debug-log visibility only; no vocabulary data, audio, progress, XP, localization or authentication ownership policy changes.

## 7. Live/manual verification still required

- Verify deployed `FRONTEND_URL`, HTTPS, frontend API rewrite and actual recovery email delivery with an authorized test account/mailbox after deployment. This checkout currently has no user-facing reset form; adding one is outside this batch.
- Verify production transport/provider behavior and that operational log collectors show no reset credentials or private learning content for these flows.
- Repository console tests do not certify Nginx/Vercel/PM2/SMTP-provider access logs, tracing, request-body capture or historical logs. Independently review external logging/redaction; reverse-proxy configuration is deliberately untouched here.
- Real Google OAuth was not exercised; the existing isolated Google/session regression suites passed. No production users/services were accessed.

**Stopped after F03 and F19. Other findings, including F20, remain outside this batch.**
