# StudyJony — F20, F21, F22 and F23 remediation

## Scope

Only F20/F21/F22/F23 are implemented. No deployment, production database access, real Google login, live SMTP, paid-provider requests, dependency changes or account migrations were performed. F17/F18/F24 configuration is unchanged.

The three dictionary compatibility files already modified when this batch began remain byte-for-byte unchanged: `SECURITY_F12_F13_F16_FIX.md`, `server/services/dictionaryLookup.js`, and `server/tests/dictionarySecurity.test.js`. They are excluded from the 19 files listed below.

## F20 — Safe error responses and response completion

**Cause:** The production error handler returned arbitrary `err.message`, including non-operational database/implementation errors, did not check `res.headersSent`, and only handled exactly `development` or `production`. Mongo cast errors and nested validation cast messages could disclose model/input details. Forgot-password sent its public response before finishing its handler's response-independent setup.

**Fix:**

- Only development returns the diagnostic error object and stack. Every other environment, including unset/unsupported values, uses safe error responses.
- Unexpected/non-operational errors return HTTP 500 with `Something went wrong. Please try again later.`
- Cast errors, duplicate keys, nested validation errors and malformed JSON receive controlled 400 messages without raw Mongo input, collection names, stack traces or key values. Oversized bodies remain 413. Fixed, known user-validation messages remain useful and translatable; other model validation messages receive a generic validation explanation.
- Operational `AppError` status/messages remain available, preserving expected 400/401/403/404 behavior. The password limit has the stable `passwordTooLong` code.
- If headers were sent, delegate to Express with `next(err)` without attempting another response.
- Forgot-password starts its existing caught background delivery and explicitly returns the single uniform 200 response. F11's wording, eligibility/cooldown, background SMTP, token consumption and error logging remain unchanged.

Development diagnostics are intentionally sensitive and remain restricted to `NODE_ENV=development`. Unsupported environments fail safely in the error handler; this batch does not change deployment/cookie configuration.

## F21 — Exact password policy

New passwords on signup, password change and password reset must satisfy the **existing minimum of 8 JavaScript string units** and **at most 72 UTF-8 bytes**, measured with `Buffer.byteLength(password, "utf8")`. The minimum's existing Mongoose `minLength` behavior is preserved rather than introducing a new Unicode counting rule.

The controller checks the byte limit before creating/changing a password, and the model validates modified password values as a second boundary. No truncation, normalization, prehashing or hash migration is performed. Login and current-password comparison remain compatible with existing hashes, including legacy passwords longer than 72 bytes. Existing legacy passwords retain bcrypt's historical equivalence until users replace them.

Boundary examples:

| Input | Accepted boundary | Rejected example |
| --- | --- | --- |
| ASCII `a` | 72 repetitions = 72 bytes | 73 repetitions = 73 bytes |
| Vietnamese `ế` | 24 repetitions = 72 bytes | 25 repetitions = 75 bytes |
| Emoji `🙂` | 18 repetitions = 72 bytes | 19 repetitions = 76 bytes |

VI/EN auth feedback explains the 72-byte limit and multibyte characters through the existing shared auth error mapper. No new form/routing flow is added.

## F22 — Client-safe users and private caching

The previous responses serialized whole authentication documents, removing only `password` in auth success responses. Reset credentials, Google subjects and password-session metadata could remain in profile/auth JSON.

The explicit serializer includes only:

`_id`, `name`, `email`, `role`, `photo`, `avatar`, `theme`, `totalXp`, `createdAt`, `updatedAt`.

It excludes every unlisted field, including `password`, `passwordConfirm`, `passwordResetToken`, `passwordResetExpires`, `passwordChangedAt`, `passwordSessionVersion`, `googleId`, `__v` and future server-only metadata. JWT/cookie issuance still uses the internal authentication document; these fields are only excluded from response JSON.

Authentication reads use a separate projection adding only the Google subject and password-change/session-version fields needed internally. Login/password-change reads explicitly select the hidden password; reset reads explicitly select reset token/expiry. Profile/avatar/admin queries select the client fields directly. No schema selection defaults or identity/session rules are changed.

The serializer is used for signup/login/password-change/reset successes, `/users/me`, profile/avatar updates and the existing admin user list. Google-only and dual-method accounts keep the same internal identity and hash behavior. Theme output remains its existing `{ theme }` contract. XP stays `totalXp`; KN is derived by the client and streaks remain computed by the existing leaderboard/study services.

Auth and user routers, plus every route using `protect`, declare `Cache-Control: private, no-store`. This covers private vocabulary, topic, activity, progress and leaderboard responses. The existing development-only public avatar-file endpoint deliberately retains its public immutable asset caching. The leaderboard's public-facing identity projection remains separate and excludes email/auth metadata; its endpoint still requires authentication as before.

## F23 — Frontend HTML security headers

Next's `headers()` applies the policy to `/:path*` with `locale: false`, including VI/EN HTML routes. Existing API rewrites and cookie/deployment topology are unchanged.

Exact production CSP:

```text
default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com; font-src 'self'; connect-src 'self' https://accounts.google.com/gsi/ https://vitals.vercel-insights.com; media-src 'self' blob: https://api.dictionaryapi.dev https://ssl.gstatic.com; frame-src https://accounts.google.com/gsi/; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Other headers:

```text
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Development adds only `'unsafe-eval'` to `script-src` and `ws://localhost:* ws://127.0.0.1:*` to `connect-src` for development runtime/HMR. There are no production eval, wildcard hosts or general `https:` source allowances.

The policy allows local assets/audio, Next's self-hosted fonts, same-origin `/api/v1` requests, Google GIS, Cloudinary/Google profile images, Vercel Analytics and the existing dictionary audio hosts. Providers outside this list are blocked and require a deliberate policy update if introduced.

**Staged limitation:** Inline scripts and styles remain allowed for current static Next hydration, theme initialization and inline UI styling. This CSP limits resource origins and framing; it does not fully mitigate inline-script injection. Nonces would require changing static rendering/caching and propagating request-specific values, beyond this batch's scope. This follows [Next's CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy). Google sources follow [Google GIS guidance](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid); Analytics sources match the installed SDK and [Vercel package guidance](https://vercel.com/docs/analytics/package).

## Validation

- Full server suite: **322/322 passed**, including previous identity, stale-login, CSRF, recovery, session, review/XP, dictionary and logging protections.
- Focused auth/recovery, serialization/cache, password boundaries and errors: **134/134 passed** with `--test-concurrency=1`. Parallel focused attempts hit disposable MongoDB startup `fassert()` failures before affected tests could run; application code was not changed to mask them.
- Focused client tests: **107/107 passed** across CSP/headers/translations, password login, credential attempts, session guards, dialogue attempts/progress saves, review saving and dictionary lookup behavior.
- Production build: **passed**. The first sandboxed attempt could not download Google Fonts; the permitted network retry succeeded. No font/config fallback was added.
- Full client lint: **0 errors**, with two existing `@next/next/no-img-element` warnings in `profile/page.js` and `Header.jsx`. Focused server/CommonJS and changed-client lint passed.
- **16 changed JavaScript files** passed Node syntax checks; both locale JSON files parsed successfully. `git diff --check` passed.
- Production browser CSP check: **48 HTML route checks** across 320/1280px, VI/EN, light/dark, covering homepage, login, signup, Wordlist, Dialogue and Story. Headers, hydration, Google sign-in initiation, analytics script/view requests, localized byte-limit feedback and framing rejection passed with no recorded CSP violations. Local images and real Dialogue/Story audio loaded; mocked Cloudinary/Google images and dictionary audio loaded under the policy.
- Learning browser: **16/16 cases** across 320/375/430/1280px, VI/EN, light/dark. Dialogue/Story attempt/save/replay, activity claim rejection, retry/localization, XP deduplication, navigation, MC/Cloze, Flashcard/Quiz/Write and dictionary validation passed using a disposable local backend/database.
- Auth browser: **112/112 scenarios** across those widths/locales/themes. Delayed login replacement, Google, signup, retry, cross-tab changes, logout revocation and duplicate signup passed using real local cookies and a disposable backend/database. This harness used the development frontend because existing production `.studyjony.com` secure/domain cookies cannot be written on local HTTP; F24 was not changed to accommodate tests.

Google/provider APIs and analytics ingestion were mocked in browser checks. The local production HTML checks use the actual Next production build and actual response headers. The full client suite was not run; the focused checks above are the client result.

## Real-environment checks remaining

No deployment was performed. A future authorized HTTPS/Vercel verification should confirm platform-added headers/rewrites, real Google SDK rendering and redirect/callback/session restoration, Analytics script delivery/ingestion, existing stored avatar URLs, fonts/assets/audio and API requests under the deployed CSP. Confirm the deployed auth domain/cookie behavior using its actual hostname. Local provider mocks cannot establish those live-service results.

## Changed files — 19 in this batch

| Purpose | Files |
| --- | --- |
| F20 error handling | `server/controllers/errorController.js` |
| Shared F20/F21/F22 auth paths | `server/controllers/authController.js` |
| F21 password validation | `server/utils/passwordPolicy.js`, `server/models/userModel.js` |
| F21 VI/EN feedback | `client/app/_lib/authErrorMessage.js`, `client/messages/en.json`, `client/messages/vi.json` |
| F22 projection/serialization | `server/utils/clientUser.js`, `server/controllers/userController.js` |
| F22 private caching | `server/middleware/privateResponse.js`, `server/routes/authRoutes.js`, `server/routes/userRoutes.js` |
| F23 frontend headers | `client/security-headers.cjs`, `client/next.config.js` |
| Focused tests | `server/tests/productionErrors.test.js`, `server/tests/privateResponsesPassword.test.js`, `client/scripts/tests/integration/security-headers.test.mjs`, `client/scripts/tests/browser/test-security-headers-browser.cjs` |
| Reviewable evidence/policies | `SECURITY_F20_F21_F22_F23_FIX.md` |

Production code imports no test harnesses. No generated catalogue, lesson content, exercise flow, SRS/reward service, theme layout, dependencies, proxy/cookie settings or F17/F18/F24 files were changed. Temporary command logs are kept outside the repository.
