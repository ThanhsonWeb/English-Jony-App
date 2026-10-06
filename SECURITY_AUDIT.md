# StudyJony Security Audit

**Date:** 2026-10-06, Asia/Ho_Chi_Minh  
**Reviewed revision:** `43506cad11a1c28a3fc53bb580495b06a3250bec`  
**Scope:** Next.js frontend, Express API, Mongoose models/services, committed dependency locks, deployment workflow, and available infrastructure configuration.  
**Mode:** Audit only. No application code, dependencies, configuration, or production data were changed. This report is the only new repository file.

## Executive summary

The earlier regression work supplies useful security controls: password changes invalidate older sessions; private data reads generally include the authenticated owner; vocabulary PATCH uses an allowlist; Google state and ID-token verification are present; and reward deduplication uses transactions and unique indexes. The relevant existing server/client suites passed during this audit.

However, this codebase still has account-identity and ownership weaknesses. The most important confirmed behavior is **account pre-hijacking through automatic Google/email linking**: an attacker can register someone else's unverified email with an attacker-known password; the real owner's subsequent Google login enters that same account, and the attacker password remains usable. Topic editing also accepts a new owner, and password-reset email URLs use a caller-controlled Host header.

A separate frontend reproduction showed that an unfinished **password login** can overwrite a later login or logout. This is distinct from the corrected Google callback/session-restoration race.

Dependency checks returned affected versions, including Critical-rated Next.js advisories and a High-rated, applicable Express compression memory-leak advisory. **No remote-code-execution exploit was attempted or demonstrated.** Next.js advisory prerequisites and the actual deployment matter: the Windows advisory is relevant to a reachable Windows-hosted Next server, while it does not apply solely because development takes place on Windows to a Linux/Vercel deployment.

### Finding totals

| Severity | Findings | Interpretation |
|---|---:|---|
| Critical | 1 | Affected frontend dependencies; deployment/exploit prerequisites explicitly conditional |
| High | 4 | Account identity, reset-link construction, applicable compression advisory, and missing learning-route throttles |
| Medium | 15 | Ownership, session races, CSRF, recovery/reward abuse, dependency and deployment risks |
| Low | 4 | Error disclosure, password truncation, response minimization/cache policy, frontend header policy |
| **Total** | **24** | Includes confirmed behaviors and explicitly marked potential/configuration risks |

**These counts are report findings, not counts of exploitable production vulnerabilities or unique CVEs.** npm's package/effect counts appear separately below.

### Verification terminology

- **Confirmed behavior:** demonstrated through the real local middleware/controllers with a disposable MongoDB, through mocked browser flows, or directly established from code/configuration.
- **Dependency confirmed:** installed/locked version matches the registry advisory. Whether StudyJony exposes the vulnerable operation is stated separately.
- **Potential/configuration risk:** an unsafe condition exists in code or a missing control is visible, but exploitation requires an unverified deployment condition or another compromise.
- **Confidence:** confidence in the stated finding, not a claim that production was tested.

File/line references below refer to the reviewed revision. No real credentials, tokens, or account identifiers are included.

### Confirmed versus conditional evidence

| Evidence group | Finding IDs | What was established |
|---|---|---|
| Reproduced application behavior | F02, F03, F06–F14, F19–F21 | Local API/database/native-library or mocked real-component reproductions; F03/F09 still have explicitly stated delivery/browser prerequisites |
| Confirmed missing application control | F05 | No learning-router limiter; no availability attack attempted |
| Confirmed affected dependency versions | F01, F04, F15 | Lock/installed versions and registry advisories; F04 has an active middleware consumer, while other exploit prerequisites vary |
| Resource or deployment conditions remain relevant | F16–F18, F22–F24 | Code/configuration and some local symptoms confirmed; production quota, proxy, host, cache, header, or subdomain conditions unverified |

These evidence groups distinguish proof of a code behavior from proof of a successful attack against a deployed user. No production compromise was tested or asserted.

## Findings sorted by severity

### F01 — Critical — Frontend dependencies match Critical RCE advisories

- **Location:** `client/package.json:24`; `client/package-lock.json:5787` (`next` 16.2.12); `client/package-lock.json:6736` (`sharp` 0.34.5); `client/next.config.js:7`.
- **Description:** npm identifies three Critical advisories affecting the locked Next.js version, plus image-library advisories. Installed versions matched the lockfile.
- **Exploitation/conditions:** [Windows-hosted App/Pages Router RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) requires the affected Windows-hosted server to be reachable. [AVIF optimization RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) requires an attacker-controlled AVIF to reach optimization. [Node `next/og` ImageResponse RCE](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) requires attacker-controlled values in SVG generation. No `ImageResponse`/`next/og` consumer was found. No custom remote image allowlist or AVIF upload path was found; avatars accept JPEG/PNG/WebP and displayed remote avatars are unoptimized/native images. A reachable AVIF input was **not established**.
- **Impact:** code execution and secrets/data compromise if a relevant prerequisite exists. Windows development alone does not establish production exposure.
- **Recommended fix:** upgrade Next.js and its native image dependencies together to a supported patched release. The three Next advisories are patched by the 16.3.6 line or later; npm currently proposes 16.3.8. Verify the final native dependency versions and rerun application/image regressions. Review network exposure of the Windows development server separately.
- **Confidence/status:** **High** that affected dependencies are present; **conditional** application/deployment exposure. No RCE or crafted image test was run.

### F02 — High — Google email auto-linking permits account pre-hijacking and ignores existing subject binding

- **Location:** `server/controllers/authController.js:70`, `:267`, `:374`, `:377`; `server/models/userModel.js:14`, `:79`.
- **Description:** signup accepts an email without verifying ownership. The `updateMe` API accepts email changes without a password or email verification; the current Profile UI edits the name, so email manipulation here requires a direct API call. Google login finds an existing account by email and authenticates it without checking its stored `googleId`, `email_verified`, or whether linking was authorized.
- **Reproduction:** register `victim@example.test` with an attacker-known password. Complete a mocked, verified Google login for the real email owner. The callback issues a JWT for the pre-created account. Password login with the attacker password still succeeds afterward. A separate mocked callback with `email_verified: false` and a different `sub` also authenticated an existing Google account.
- **Impact:** continuing attacker access to future vocabulary/profile/progress data when the owner begins using the pre-created account. Different Google subjects can map to the same existing identity solely through email.
- **Recommended fix:** verify email ownership before trusting email/password registration or email changes; require recent authentication for changing identity information; use the verified Google subject as the provider identity; implement an explicit, authenticated account-linking/recovery policy for an existing email collision. Reconcile pre-created accounts and revoke unauthorized existing sessions as part of that policy.
- **Confidence/status:** **High; confirmed local API behavior with mocked Google assertions.** No real Google account was attacked. Google recommends identifying accounts by `sub` and warns that third-party email ownership is not always authoritative even when `email_verified` is true. [Google ID-token guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

### F03 — High — Password-reset email URLs trust the request Host/protocol

- **Location:** `server/controllers/authController.js:174`, `:183`; `server/app.js:22`.
- **Description:** the reset URL is built from `req.protocol` and `req.get("host")`, rather than a configured trusted HTTPS origin.
- **Reproduction:** a raw local HTTP request for a test user's recovery used `Host: reset-link.attacker.test`. The mocked outgoing email contained a reset URL on that host. Raw HTTP was necessary because Node's fetch implementation replaced the attempted Host override.
- **Exploitation:** an attacker requests recovery for a known email using a poisoned Host header. If the edge forwards it and the owner follows/submits to the emailed URL, the attacker can receive the live reset token. Proxy-derived protocol can also affect the URL.
- **Impact:** password reset/account takeover after token disclosure.
- **Recommended fix:** construct reset links from an explicit trusted HTTPS application origin; reject unexpected public hosts at the reverse proxy/application boundary. Preserve the actual reset route/form contract when doing this.
- **Confidence/status:** **High; poisoned URL confirmed with mocked mail delivery.** Real delivery and whether production Nginx accepts the forged Host are unverified. The current Mailtrap sandbox transport further limits what can be inferred about live exploitability.

### F04 — High — Globally enabled compression uses a known memory-leak version

- **Location:** `server/package.json:30`; `server/package-lock.json:712`; `server/app.js:45`.
- **Description:** `compression` 1.8.1 is installed and globally used. The maintainer reports a leak when clients disconnect during compressed responses; repeated disconnects can exhaust process memory.
- **Exploitation:** repeatedly begin receiving compressed responses and disconnect before completion. Edge buffering/rate controls affect practical reachability, but the affected middleware is present.
- **Impact:** backend denial of service/process restart.
- **Recommended fix:** update to at least 1.8.2 or a later supported patched version and validate normal/compressed response behavior. Review edge connection limits.
- **Confidence/status:** **High; dependency and active consumer confirmed.** No memory-exhaustion or disconnect flood was performed. [Maintainer advisory GHSA-vc2v-76pw-4v95](https://github.com/expressjs/compression/security/advisories/GHSA-vc2v-76pw-4v95).

### F05 — High — Expensive learning/progress routes bypass the application rate limiter

- **Location:** `server/app.js:61–68`, particularly `:66–67`; `server/routes/dialogueProgressRoutes.js:13–17`; `server/controllers/dialogueProgressController.js:49–77`; `server/routes/studyActivityRoutes.js:7–12`.
- **Description:** other API routers are mounted behind `apiLimiter`, but study activity and dialogue progress are not. Dialogue writes initialize models and perform multi-document transactions, including on repeated completions.
- **Exploitation:** an authenticated account repeatedly invokes known task writes/replays or progress reads; those routes have no application request budget. Account creation does not require a verified email, making disposable identities feasible.
- **Impact:** shared database/worker saturation and availability loss. This does not bypass owner filtering or duplicate-XP protection.
- **Recommended fix:** add appropriate per-user and per-IP budgets to these routers, with lower write/transaction budgets and deliberate replay handling; apply edge concurrency controls. Use a shared limiter store if deployment has multiple workers.
- **Confidence/status:** **High; route omission and unthrottled responses confirmed locally.** No flood/load attack was executed; production edge protections were not inspected.

### F06 — Medium — A stale password-login response can replace a newer session or logout

- **Location:** `client/app/[locale]/(auth)/login/page.js:86–103`; analogous signup success at `client/app/[locale]/(auth)/signup/page.js:27–58`; `client/app/_contexts/AuthContext.js:25–31`; `server/controllers/authController.js:58–65`.
- **Description:** login's asynchronous handler unconditionally calls `setUser` and navigates after success. It has no auth-attempt identity, session-generation check, or cancellation on page close. The session guard intentionally starts a new generation for `setUser`; it cannot distinguish an obsolete login call from an intentional new login.
- **Reproduction:** start a delayed login for A, close its page through the normal client link, then log into B. Release A's response: A replaces B and navigates to Wordlist. Starting A's request while already logged into B, closing the page, logging out, and then releasing A also restores A. Both variants reproduced in VI/EN: **4/4 browser scenarios**.
- **Impact:** account confusion or unintended sign-in on shared devices, with subsequent activity/data potentially entered under the wrong identity.
- **Recommended fix:** coordinate all login/signup attempts with an auth-attempt generation and cancellation mechanism. Invalidate obsolete attempts on logout/navigation/account replacement, guard both state writes and navigation, and account for delayed server `Set-Cookie` responses. A UI-only guard is insufficient if an obsolete response can still install an old-account cookie.
- **Confidence/status:** **High; real components reproduced with mocked API responses.** The backend sends a cookie on successful login, but cookie ordering in deployed browsers was not separately tested. Signup shares the unguarded pattern; its race was not separately reproduced. The corrected Google callback and profile mutation guards passed their existing tests.

### F07 — Medium — Topic PATCH can change its owner and inject it into another account

- **Location:** `server/controllers/topicController.js:28–35`; `server/models/topicModel.js:12–17`.
- **Description:** the query checks current ownership, but the unrestricted update body can replace `user`.
- **Reproduction:** A PATCHes an A-owned topic with `{ "user": "<B id>", "name": "Injected topic" }`. The stored owner becomes B and the topic appears in B's topic list.
- **Impact:** cross-account data injection and loss of the original owner's topic access. **This does not allow editing an already B-owned topic or reading B's vocabulary:** direct foreign-topic edits/deletes remained blocked in tests.
- **Recommended fix:** allowlist editable topic text fields and keep `user`, `_id`, and timestamps server-controlled. Return a controlled not-found outcome when the owner-scoped query matches nothing.
- **Confidence/status:** **High; confirmed through the full local API.**

### F08 — Medium — Vocabulary creation accepts foreign topic links and forged scheduler/source fields

- **Location:** `server/controllers/vocabController.js:75–79`; `server/models/vocabModel.js:9–30`, `:50–70`.
- **Description:** creation spreads the whole request body. Although `user` is correctly overridden, callers can choose another user's topic and provide review counts, levels, review dates, timestamps, and purported dialogue source metadata.
- **Reproduction:** an A-owned new word accepted B's topic ID, `reviewCount: 999`, `learningLevel: 99`, a 2099 review date, a 1990 creation date, and a nonexistent dialogue source. B still could not read that word because vocabulary reads use the owner predicate.
- **Impact:** invalid cross-owner associations and forged learning/provenance records; corruption of server scheduling assumptions. This is not a recurrence of the fixed vocabulary PATCH ownership bug.
- **Recommended fix:** add a creation allowlist, initialize scheduler/provenance fields on the server, and validate an optional topic against the current user. Keep global notebook creation with no topic supported.
- **Confidence/status:** **High; confirmed local API behavior.**

### F09 — Medium — Simple cross-origin POSTs can change activity and log the user out

- **Location:** `server/app.js:35–44`; `server/controllers/authController.js:38–43`, `:98`; `server/controllers/studyActivityController.js:13–18`; `server/routes/authRoutes.js:16`.
- **Description:** production JWT cookies use `SameSite=None`; the application does not validate Origin/Referer or a CSRF token on mutations. Activity and logout accept bodyless/simple POSTs. Static CORS headers restrict response reading, but do not reject execution of a simple request.
- **Reproduction:** a local request with a valid test cookie, attacker Origin, and `Content-Type: text/plain` successfully incremented activity. The same kind of logout request returned a cookie-clearing header. The response's allowed origin remained the legitimate frontend, so attacker response reading was not granted.
- **Impact:** unwanted sign-out and falsified personal heatmap activity. **No arbitrary cross-site JSON PATCH or private-data read was demonstrated:** those requests normally need a preflight that the fixed CORS origin does not grant.
- **Recommended fix:** protect cookie-authenticated mutations using validated origins plus a suitable CSRF strategy; reject inappropriate simple content types where JSON is required. Choose SameSite/cookie scope according to the actual frontend/API deployment, not by weakening OAuth navigation.
- **Confidence/status:** **High** for server acceptance; browser exploitation depends on cookie delivery, same-site/subdomain context, and browser third-party-cookie policy. No live cross-site attack was performed. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

### F10 — Medium — Password-reset tokens are not atomically consumed

- **Location:** `server/controllers/authController.js:219–233`.
- **Description:** token lookup and password save are separate operations. Two requests can both read the still-valid token before either clears it.
- **Reproduction:** two concurrent resets using one disposable token and different passwords both returned 200. Exactly one resulting session remained valid, showing that the earlier password-session-version fix still protected the final password state.
- **Impact:** a person possessing a reset token can race its legitimate use and replace the password despite a competing successful reset. Token possession is a prerequisite; this does not let an attacker guess the 256-bit token.
- **Recommended fix:** consume reset eligibility with an atomic conditional operation/transaction so only one reset wins, while preserving password hashing hooks and version-based session invalidation.
- **Confidence/status:** **High; confirmed on disposable MongoDB.**

### F11 — Medium — Recovery/signup permit account enumeration and recovery has a coarse abuse budget

- **Location:** `server/controllers/authController.js:176–177`, `:203–205`; `server/controllers/errorController.js:3–6`; `server/routes/userRoutes.js:41–42`; `server/app.js:23–31`, `:62`.
- **Description:** unknown recovery emails receive 401 while known emails receive 200 after mail handling. Signup duplicate-email handling explicitly identifies an existing address. Recovery is under the general 500/hour/IP production API budget, not the tighter auth-router budget, and has no account/email-specific cooldown.
- **Exploitation:** enumerate addresses, then repeatedly trigger reset messages/token replacement for existing users using multiple IPs/workers.
- **Impact:** privacy disclosure, targeted phishing/credential-stuffing preparation, email abuse, and invalidation of pending recovery links. Normal wrong-password/unknown-email/Google-only login responses were consistently 401; those existing message protections passed.
- **Recommended fix:** use a uniform recovery response/status and asynchronous mail workflow; add normalized account/email cooldowns and shared IP abuse controls. Decide an explicit duplicate-signup privacy policy. Login's short-circuit bcrypt path may have a timing distinction; that was not measured and is not treated as a separate confirmed finding.
- **Confidence/status:** **High** for recovery response enumeration; signup disclosure and limiter scope confirmed in code. No enumeration against real addresses or distributed abuse was performed.

### F12 — Medium — Legacy study counts can be fabricated without a learning event

- **Location:** `server/controllers/studyActivityController.js:13–23`; `client/app/_lib/useBackgroundReviewSave.mjs:15–18`; `client/app/_lib/studyHeatmap.mjs:28–30`.
- **Description:** any authenticated bodyless activity POST increments the day's legacy count, independently of a saved review or lesson event.
- **Reproduction:** two direct calls created/incremented count to 2 without studying. The day still had `hasQualifiedStudy: false` and total XP stayed zero.
- **Impact:** fabricated Profile heatmap intensity/summary counts and extra writes. **It does not by itself award XP or establish the leaderboard's qualified streak**, which reads `hasQualifiedStudy` at `server/services/studyStreak.js:49`.
- **Recommended fix:** increment the relevant count alongside the authenticated server review/event commit, with an event identity for deduplication; remove or constrain the standalone client claim while preserving the distinct count versus qualification semantics.
- **Confidence/status:** **High; confirmed API and database state.**

### F13 — Medium — Dialogue/Story reward claims require a known task ID, not a validated attempt

- **Location:** `server/controllers/dialogueProgressController.js:41–75`; `server/utils/dialogueCatalogue.js:1–5`.
- **Description:** a caller can complete any catalogue task without submitting a valid answer, attempt identity, prerequisite, or sequence. Body fields are not used to verify correctness; each first known task claim awards the fixed 10 XP and qualifies the day.
- **Reproduction:** two previously untouched Story tasks were claimed with deliberately wrong answer text and a forged large XP amount. Each received the server's fixed 10 XP; replay awarded zero and B's XP remained unchanged.
- **Impact:** automated completion, XP/KN-derived ranking inflation, and qualified-streak claims without the intended exercise. It is not an arbitrary amount or infinite same-task reward bug; deduplication worked and the catalogue bounds distinct claims.
- **Recommended fix:** define server-verifiable completion rules appropriate to each exercise, use a bound/expiring attempt identity and prerequisite checks where intended, and introduce realistic reward/write budgets. Public lesson answers and self-rated flashcards mean correctness checks alone cannot prove actual learning; preserve those product semantics and focus on abuse bounds.
- **Confidence/status:** **High; confirmed API/reward effects.** No large-scale farming was performed. Unknown and currently inactive task IDs were rejected.

### F14 — Medium — Logout does not revoke a copied JWT

- **Location:** `server/controllers/authController.js:98–101`, `:124–155`.
- **Description:** logout clears the browser cookie but records no server-side session revocation.
- **Reproduction:** after local logout returned the clearing cookie, reusing the original test JWT still returned 200 from `/users/me`.
- **Impact:** a previously copied/stolen token remains usable until its expiration or a password change. An attacker must already possess the token; logout does not independently disclose it. The actual production JWT lifetime was not read.
- **Recommended fix:** decide and document logout's revocation guarantee. If logout must revoke the active credential, use an identifiable server session/revocation mechanism and bounded lifetimes. Preserve the successful password-change invalidation behavior.
- **Confidence/status:** **High; confirmed token replay behavior.**

### F15 — Medium — Additional affected dependencies need reachability-specific remediation

- **Location:** `server/package-lock.json:98`, `:2260`, `:2513`, `:2542`; `client/package-lock.json:5960`, `:5730`, `:6891`; full inventory below.
- **Description:** both lockfiles contain other affected runtime and development dependencies. npm's Critical `proxy-addr` advisory requires problematic subnet trust configuration, while this app currently uses numeric `trust proxy: 1`; **that advisory's subnet bug was not established in this configuration**. Other advisories affect SMTP parsing, gRPC server configuration, CSS/source-map processing, and development glob parsers.
- **Exploitation/impact:** depends on the vulnerable operation receiving attacker input. Possible outcomes include denial of service, information disclosure, or trust-boundary errors. No gRPC server or attacker-supplied CSS/source-map pipeline was found; Morgan is imported nowhere in application middleware.
- **Recommended fix:** update affected production dependencies first, then build/development dependencies. Verify transitive resolution and the installed deployment artifact, rather than relying on manifest ranges. Do not accept npm's parent-package downgrade/force suggestions without compatibility review.
- **Confidence/status:** **High** for version matches; **potential/consumer-dependent** application exploitation. Advisory links and local line numbers are supplied in the inventory.

### F16 — Medium — Public dictionary lookups have unbounded cache/cost and duplicate-miss risks

- **Location:** `server/routes/dictionaryRoutes.js:6`; `server/controllers/dictionaryController.js:8–11`, `:25–43`, `:218–237`, `:331–387`; `server/app.js:65`.
- **Description:** the public endpoint calls translation/providers on misses. It lacks a word-length/shape limit, a bounded cache, a shared cost/concurrency budget, and first-lookup request coalescing. Expired entries are removed only when that same key is requested again. Google translation calls lack an explicit timeout in this wrapper.
- **Reproduction:** with deliberately delayed mocked providers, three simultaneous same-word misses caused three translation calls and six dictionary HTTP calls. The existing enrichment map only deduplicates later background enrichment.
- **Impact:** avoidable provider charges, unbounded retained keys, excessive pending work, and service degradation under distributed traffic. The endpoint does have the general 500/hour/IP production limiter; it is **not unlimited per IP**.
- **Recommended fix:** bound accepted lookup input, coalesce initial misses, use bounded/actively expiring storage, time out upstream work, and enforce shared concurrency/spending budgets. Keep any intentionally public lookup product flow available under appropriate quotas.
- **Confidence/status:** **High** for code and mocked duplication; **potential** live memory/billing impact. No real translation calls, cost consumption, cache flood, or exhaustion test was performed.

### F17 — Medium — Numeric proxy trust can allow client-IP spoofing if the backend is directly reachable

- **Location:** `server/app.js:22–31`; `server/server.js:20–21`.
- **Description:** the app trusts one network hop from any source, and the Node listener does not specify a loopback bind address. Production proxy/firewall topology is unavailable.
- **Reproduction:** on the disposable direct listener, 31 auth requests under one supplied `X-Forwarded-For` reached 429, then a different supplied value restored a 200 response.
- **Impact:** if an attacker can reach Node directly, or an edge forwards the wrong client header, per-IP brute-force/API limits can be bypassed. This does not prove the Ubuntu backend is publicly exposed; correct Nginx/firewall behavior can prevent the tested condition.
- **Recommended fix:** restrict access to the intended proxy path; trust explicitly known proxy addresses/hops and normalize forwarding headers there. Verify the Vercel → Nginx → Node chain and use a shared limiter store for multiple PM2 workers. This is separate from the `proxy-addr` CIDR advisory.
- **Confidence/status:** **High** local direct-listener reproduction; **unverified deployment condition**.

### F18 — Medium — Deployment trust/reproducibility controls are incomplete

- **Location:** `.github/workflows/deploy-backend.yml:20`, `:28–35`; `server/.gitignore:2`; representative tracked dependency `server/node_modules/express/package.json:1`.
- **Description:** CI trusts the host key returned by `ssh-keyscan` during that deployment instead of comparing it with a previously trusted fingerprint. The remote script uses `npm install`, has no `set -e`/explicit failure gate, and restarts PM2 without a security/test gate. Git still tracks **5,645 `node_modules` files** despite the ignore rule.
- **Exploitation/impact:** an active network attacker can impersonate the deployment destination when host-key trust is established in-band; dependency/code drift or failed install/pull can leave an old or unintended artifact running. This finding does **not** claim that SSH public-key authentication sends the private key to the peer, or that this alone compromises the real VPS. Committed dependency files also complicate artifact/integrity review.
- **Recommended fix:** pin and validate an independently obtained host fingerprint; fail deployment on any failed step; use a reviewed lockfile and reproducible install; remove generated dependencies from version control in a controlled batch; pin/verify Node/runtime and verify the installed artifact before restart.
- **Confidence/status:** **High** configuration/tracked-file evidence; **potential** MITM/supply-chain impact. No SSH/CI/deployment connection was made.

### F19 — Medium — Reset credentials and private vocabulary are written to logs

- **Location:** `server/routes/userRoutes.js:22–24`; `server/controllers/authController.js:217`; `server/controllers/vocabController.js:59–60`.
- **Description:** user-route logging records the full reset URL, including the raw bearer reset token. Reset handling also logs its hash; vocabulary updates log the submitted body and full saved document.
- **Reproduction:** the targeted reset probe captured the raw disposable token in the route log. Token contents were not included in this report. Vocabulary logging is unconditional in the controller, including production.
- **Exploitation/impact:** log readers/collectors can acquire a live reset credential within its validity window, or view private learning notes. Hash logging alone does not reveal the 256-bit token, but the raw path does.
- **Recommended fix:** redact sensitive URL segments, remove raw vocabulary/document dumps, and use structured minimal event logs. Review retention, access permissions, and historical exposure before deciding whether any incident response is needed.
- **Confidence/status:** **High; raw-token logging confirmed locally.** Production log audiences/retention were not examined.

### F24 — Medium — Parent-domain JWT cookies broaden the session trust boundary

- **Location:** `server/controllers/authController.js:38–43`, `:50`.
- **Description:** production uses `Domain=.studyjony.com`, `Path=/`, `SameSite=None`, and an ordinary `jwt` cookie name. Every matching HTTPS subdomain can receive that cookie in requests; HttpOnly blocks JavaScript reads but not a receiving server's access to Cookie headers.
- **Exploitation/impact:** control of a weaker/dangling subdomain could expose or replace session cookies, enabling token replay/account confusion. No subdomain takeover or DNS configuration was investigated. Broad domain sharing can be intentional for frontend/API integration, so it needs an explicit trust-boundary decision.
- **Recommended fix:** prefer a host-only, appropriately prefixed cookie via a same-origin API proxy if the deployment allows it; otherwise protect and inventory every participating subdomain and account for cookie injection/conflicts. Preserve Google state-cookie host/path compatibility.
- **Confidence/status:** **High** cookie configuration; **potential** impact requiring unverified subdomain control.

### F20 — Low — Production errors disclose internals and recovery continues after sending a response

- **Location:** `server/controllers/errorController.js:24–41`; `server/controllers/authController.js:203–208`; `server/app.js:70–74`.
- **Description:** production sends `err.message` even for unexpected internal failures. The handler does not guard `res.headersSent`; successful forgot-password handling calls `next()` after sending its response.
- **Reproduction:** malformed vocabulary ID returned 500 with a Mongoose cast/model detail, but no stack in the JSON response. Running recovery through the full app also produced `ERR_HTTP_HEADERS_SENT` after its 200 because the unmatched-route/error path tried to respond again. Route-only regression fixtures do not exercise that final app path.
- **Impact:** schema/implementation disclosure and avoidable server errors/log noise. No process termination or client stack disclosure was demonstrated. If `NODE_ENV` is neither development nor production, this handler has no response branch; deployed environment settings are unverified.
- **Recommended fix:** send a generic message for unexpected errors, keep safe operational error messages, handle already-sent responses, and terminate a completed handler without continuing. Validate the deployment environment at startup.
- **Confidence/status:** **High; local full-app behavior confirmed.**

### F21 — Low — Passwords beyond bcrypt's byte limit are silently truncated

- **Location:** `server/models/userModel.js:22–28`, `:86–88`, `:124–135`.
- **Description:** passwords have a minimum character length but no maximum byte limit. Native bcrypt ignores bytes after its 72-byte input boundary.
- **Reproduction:** a hash created from 72 ASCII bytes plus one suffix accepted the same 72 bytes with a different suffix.
- **Impact:** long-password users receive less effective entropy and different apparent passwords can authenticate identically. There is no general bypass of normal shorter passwords.
- **Recommended fix:** enforce/document a compatible byte-based maximum in frontend and backend, or plan a deliberate password-hash migration with a suitable long-input strategy. Do not silently change existing password interpretation.
- **Confidence/status:** **High; native bcrypt behavior confirmed.**

### F22 — Low — Private user responses expose unnecessary auth metadata and lack explicit no-store policy

- **Location:** `server/models/userModel.js:75–79`; `server/controllers/userController.js:6–20`; `server/controllers/authController.js:58–65`; contrast `server/controllers/leaderboardController.js:11`.
- **Description:** password selection is correctly disabled, but ordinary user serialization can expose reset hashes/expiry and password-session markers. `/users/me` and other private reads lack a shared `Cache-Control: private, no-store` policy. The leaderboard already sets one explicitly.
- **Reproduction:** a test user's `/users/me` response contained reset/session metadata and no Cache-Control header. Password was absent. Admin listing uses `User.find()` but is correctly admin-protected.
- **Impact:** needless sensitive metadata in browser/third-party-script memory and possible retention by improperly configured caches. **No cross-user cache leak, raw reset token disclosure through these JSON responses, or password-hash disclosure was demonstrated.**
- **Recommended fix:** serialize an explicit client-safe user projection; keep auth/reset markers server-side. Establish no-store rules for authenticated responses and verify that proxies/CDNs respect them without caching by URL across accounts.
- **Confidence/status:** **High** metadata/header evidence; **potential** cache impact dependent on deployment.

### F23 — Low — Frontend CSP/framing policy is not defined in repository configuration

- **Location:** `client/next.config.js:7–16`; `client/app/layout.js:28`; `client/app/[locale]/(auth)/login/page.js:42–48`; `client/app/[locale]/(auth)/signup/page.js:78–83`.
- **Description:** repository Next configuration contains rewrites but no frontend CSP/frame-ancestors/header policy. Google SDK and Vercel Analytics execute in the application context. Express Helmet protects backend responses; it does not automatically protect Next HTML.
- **Exploitation/impact:** absent deployed framing policy can permit clickjacking; absent CSP reduces containment if a script/vendor or future injection is compromised. These are defense gaps, **not confirmed XSS or malicious third-party scripts**.
- **Recommended fix:** inspect deployed frontend headers, then define/test a CSP and framing policy compatible with Next.js, Google sign-in, and intended analytics. Prefer narrowly approved sources/nonces where applicable; account for dynamically updated vendor SDKs.
- **Confidence/status:** **High** that the policy is absent from repository config; **unverified** Vercel/edge headers. Local malicious-text rendering checks did not execute HTML.

## Authentication and authorization assessment

| Area | Assessment and evidence |
|---|---|
| JWT signing/verification | Signed with environment secret and configured expiration; invalid/expired/malformed claims return controlled 401; user existence/role is read from DB. `authController.js:25–35,104–159`. Actual secret quality/lifetime and deployed versions are not known. Explicit algorithm/issuer/audience constraints could be defense in depth; no signature bypass was found. |
| JWT cookie | HttpOnly; Secure in production; lifetime derives from signed expiry; clearing reuses cookie identity. `authController.js:38–53,98–101`. Parent-domain scope, SameSite/CSRF, and logout revocation concerns are F09/F14/F24. |
| Password hashing/change | bcrypt cost 12; no hash comparison for a missing Google-only password; changed-password timestamp plus random session version reject old/same-second/overlapping-change sessions. `userModel.js:86–135`. Existing tests passed. F21 concerns only the long-input boundary. |
| Recovery | Random 32-byte token, stored as SHA-256, 20-minute expiry, and new session after successful reset. F03/F10/F11/F19/F20 address URL trust, atomic consumption, enumeration, logging, and response lifecycle. |
| Google OAuth | Cryptographic state, short-lived HttpOnly/Lax state cookie, timing-safe comparison, fixed-environment redirect destination, code exchange, and library ID-token audience verification are present. `authController.js:286–405`. Invalid/cancelled/token-verification paths passed tests. F02 concerns identity linking after verification, not a forged-signature claim. |
| Session restore/account switching | Shared restore aborts/suppresses stale reads; logout/account generation protects late profile updates and callback navigation. `AuthContext.js:25–58`, `authSessionGuard.mjs:6–21`, `sessionRestore.mjs:9–37`. Tests passed. F06 concerns unguarded credential-submission responses, a different path. |
| Role escalation | Public signup allowlists name/email/password fields; updateMe permits only name/email; theme/avatar endpoints own only their fields. Admin list uses `protect, restrictTo("admin")` at `userRoutes.js:40`. Role and XP injection at signup failed in isolated checks. |
| Vocabulary ownership | Reads/get/edit/delete/review scope to authenticated owner. PATCH allowlist and owned-topic reassignment validation passed. `vocabController.js:8–16,24–57,87–92`; `vocabularyReview.js:57–58`. Creation gap: F08. |
| Topic ownership | Reads/delete use authenticated owner; direct foreign-resource edits/deletes did not alter B. PATCH can transfer an A-owned resource: F07. |
| Progress/activity/profile ownership | These read/write paths use current authenticated user, rather than a supplied user ID. Injected reward-recipient/user fields did not credit B. Self-claim abuse and absent budgets remain F05/F12/F13. |
| Public routes | Health, dictionary, signup/login/recovery and OAuth entry/callback are public intentionally. Protected private APIs returned 401 for guests. Dictionary's resource budget deserves F16 remediation. |
| Published/unpublished content | Lessons intentionally support guests, so lack of learner-page auth is not itself a vulnerability. Active `lessonData.js:13–23` excludes commented-out courses; server task catalogue validates the active registry. Inactive/unknown task claims were rejected. Files/assets for inactive content may still be bundled/deployed publicly; no confidentiality/entitlement policy was supplied, so this is not claimed as an unauthorized-content vulnerability. |

## Backend and frontend assessment

- **Injection:** body sanitization exists at `server/app.js:46–49`, and ownership query predicates are server-built. Tested Mongo operator/prototype payloads did not bypass authentication, cross owner boundaries, or pollute Object.prototype. Express uses its default simple query parser; not sanitizing query objects is not by itself proof of a Mongo injection. These limited probes are not a guarantee against all malformed input.
- **Mass assignment:** signup and vocabulary PATCH controls worked; topic PATCH and vocabulary POST remain exposed as F07/F08. No exposed generic admin/user update route was found.
- **Input/resource limits:** JSON defaults reject a body above about 100 KB (local 413 check). Avatar raw parser enforces 2 MB; content signatures/type checks, random local filenames, and signed Cloudinary response validation are present. Ordinary topic/vocabulary text has no field-length/account-storage quotas; include appropriate bounds when resolving F08/F16/F05, without mistaking user-controlled study content for privileged XP input.
- **URL/file handling:** dictionary provider hostnames are fixed and word paths are encoded; no demonstrated dictionary SSRF. Production Cloudinary upload checks HTTPS, host, expected public ID and signature. Development avatar route uses a strict filename pattern and is disabled outside development. No arbitrary path traversal/upload execution was found in these handlers.
- **XSS:** no application `dangerouslySetInnerHTML`, eval, user-controlled innerHTML, srcDoc or document.write sink was found in the runtime source search. Word/topic/profile text is rendered through React. Twelve mocked browser cases confirmed that hostile HTML-like values remain text in the tested VI/EN mobile/desktop flows.
- **Redirects:** Google callback destination comes from configured frontend URL, locale is constrained to VI/EN, and query errors are encoded. Client navigation destinations are local app routes. No user-controlled external redirect was demonstrated.
- **Browser storage:** runtime local/session storage uses theme, word-view preference, playback speed/account ID, and a guest-reminder flag. No JWT/password/reset-token storage was found. SDKs run with frontend privileges; keep public API data minimal (F22/F23).
- **Privacy:** leaderboard explicitly projects public ranking fields and excludes email/password/reset metadata; tests passed. Publicly displayed name/avatar/XP/streak are product behavior, not automatically an authorization flaw.

## Infrastructure and production review

**No production service was contacted.** Repository evidence is insufficient to certify the deployed Vercel/Ubuntu/Nginx/PM2/Atlas setup.

| Layer | Repository evidence | Still requires operator/deployment verification |
|---|---|---|
| Vercel/Next frontend | API rewrite to an environment-configured backend at `client/next.config.js:8–14`; public Google client ID used in auth pages. No committed Vercel project config/headers found. | Deployed Next/native library version, WAF/platform mitigations, CSP/framing/cache headers, HTTPS redirects, preview-deployment exposure, variable scopes and correct HTTPS API destination. |
| Ubuntu VPS/Node | `server/server.js:16–21` connects using environment DB URI and listens without an explicit host bind. | Firewall/security groups, direct port reachability, supported Node/OS patch levels, service user privileges, filesystem permissions and dependency artifact integrity. |
| Nginx | No Nginx config was found in tracked deployment files. | Host allowlist/default server, TLS certificate/protocol policy, HTTP→HTTPS redirect, forwarding-header normalization, body/connection/rate limits, buffering, and log redaction. |
| PM2 | Workflow restarts `studyjony-api --update-env` and saves at `.github/workflows/deploy-backend.yml:34–35`; no ecosystem file found. | Effective NODE_ENV, correct working directory/version, number of workers, shared limiter state, restart policy, memory limits, and redacted log retention/access. |
| MongoDB Atlas | Mongoose environment connection; transaction/index models visible. Readiness helper exists in `server/scripts/verify-production-db.js`. | Network allowlist, TLS, least-privilege DB user, replica-set/transaction availability, actual unique indexes, backups and audit access. The production verification helper was **not executed**. |
| Google/SMTP/storage | Google redirect/client/secret read from environment; SMTP points to `sandbox.smtp.mailtrap.io` at `server/utils/email.js:5–10`; Cloudinary production configuration is required. | Google Console authorized redirects/origins and state-cookie host/path compatibility; actual recovery-email delivery; credential restrictions, quotas and rotation. No real mail/Google/Cloudinary request was made by tests. |
| Secrets | No currently tracked env/private-key files; no matching env-file history entries in available Git refs. Limited credential-pattern scan of 377 first-party text files found no matches. Public frontend variables found were API URL and Google client ID, which are not private secrets. | Actual environment values, JWT entropy/lifetime, GitHub secret permissions, Atlas credentials, historical secrets under unexpected names, CI artifacts/logs, and external secret-manager policy. No `.env` contents were read or reported. |

The secret scan excluded vendored `node_modules`, ignored environment files, binary files, and text files above 3 MB. It checked a small set of known token/private-key signatures. It is **not** a full-history entropy scan or a guarantee that no secret exists anywhere.

## Dependency vulnerability inventory

Read-only `npm audit --package-lock-only --ignore-scripts --json --registry=https://registry.npmjs.org` succeeded for both workspaces after the restricted-network attempt failed. No `audit fix`, install, upgrade, or lifecycle script was run.

| Workspace | npm Critical | npm High | npm Moderate | Affected package/effect records |
|---|---:|---:|---:|---:|
| Client, including development | 1 | 11 | 0 | 12 |
| Server, including development | 1 | 7 | 3 | 11 |

Of these records, five client and seven server records contain production dependencies. Parent/effect records can repeat the same underlying advisory; do not total them as independent CVEs. Selected installed versions were checked against their locks and matched.

| Dependency/version | File anchor | Registry rating / relevant advisory | StudyJony exposure assessment |
|---|---|---|---|
| Client `next` 16.2.12 | `client/package-lock.json:5787` | Critical: [Windows RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [AVIF RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [ImageResponse RCE](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) | F01: version confirmed; prerequisites assessed separately, no RCE test |
| Client `sharp` 0.34.5 | `client/package-lock.json:6736` | High: [libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [libheif](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | Next image processing; untrusted input path not established |
| Client nested `postcss` 8.4.31 | `client/package-lock.json:5960` | High aggregate: [source-map file read](https://github.com/advisories/GHSA-6g55-p6wh-862q), [path traversal](https://github.com/advisories/GHSA-r28c-9q8g-f849); also [CSS output XSS](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [incomplete map fix](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | No user CSS/source-map compilation route found |
| Client `nanoid` 3.3.16 | `client/package-lock.json:5730` | High: [zero-size custom-generator loop](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | No direct vulnerable custom-generator call found |
| Client `source-map-js` 1.2.1 | `client/package-lock.json:6891` | High: [indexed-map DoS](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | No user source-map input route found |
| Client `brace-expansion` 1.1.18 and 5.0.9; server 5.0.9 | `client/package-lock.json:3150`, `:2382`; `server/package-lock.json:544` | High aggregate: [recursion DoS](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p), [nested-group DoS](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [quadratic expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Development dependency paths; no runtime user pattern input found |
| Client/server `braces` 3.0.3 | `client/package-lock.json:3161`; `server/package-lock.json:557` | High: [nested-pattern stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Development glob tooling |
| Client `js-yaml` 4.3.0 | `client/package-lock.json:5210` | High: [omap CPU consumption](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [merge-source CPU consumption](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | Development tooling; no user YAML endpoint found |
| Client ESLint Next plugin/config 16.2.12, fast-glob 3.3.1, micromatch 4.0.8 | `client/package-lock.json:1105`, `:3851`, `:4204`, `:5686` | High parent/effect records through braces/glob dependencies above | Not independent additional exploits; development path |
| Server `compression` 1.8.1 | `server/package-lock.json:712` | High: [disconnect memory leak](https://github.com/expressjs/compression/security/advisories/GHSA-vc2v-76pw-4v95) | Active global middleware; F04 |
| Server `proxy-addr` 2.0.7 | `server/package-lock.json:2513` | Critical: [IPv4-mapped IPv6 trust-subnet spoofing](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | Numeric hop trust does not establish this CIDR-specific bug; patch dependency and independently resolve F17 |
| Server `nodemailer` 9.0.4 | `server/package-lock.json:2260` | High aggregate: [address parser DoS](https://github.com/advisories/GHSA-2x7j-588g-ccc2), [free-text parser DoS](https://github.com/advisories/GHSA-v53p-9fqp-m79j); Moderate: [legacy resolveContent](https://github.com/advisories/GHSA-8m3c-c648-2xjj), [IDN allowlist](https://github.com/advisories/GHSA-wmmp-3585-3rmp), [comment parsing](https://github.com/advisories/GHSA-cc9r-2j5m-2m83), [DNS/TLS cross-transport issue](https://github.com/advisories/GHSA-6vj9-mwq6-2f5v), [recipient arrays](https://github.com/advisories/GHSA-8vvx-rff5-p5rq) | Recovery transport is active; its recipient comes from validator-checked stored email, and transport host is fixed. Arbitrary attachment/recipient arrays and attacker-selected transports were not found. No parser bomb tested |
| Server `@grpc/grpc-js` 1.14.4 | `server/package-lock.json:98` | High: [unauthorized cert context](https://github.com/advisories/GHSA-m9gg-hp2v-232j); Low: [server error detail](https://github.com/advisories/GHSA-f596-whhp-79r4) | Google dependency path; no app gRPC server/auth-context policy found |
| Server `qs` 6.15.3 | `server/package-lock.json:2542` | Moderate: [array-limit bypass](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [isBuffer DoS](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | App uses default simple query parser and JSON, not a configured extended body parser; vulnerable parse usage not established |
| Server `ip-address` 10.4.0 | `server/package-lock.json:1663` | Moderate: [link-local](https://github.com/advisories/GHSA-rpw4-54j3-4h4q), [NAT64](https://github.com/advisories/GHSA-2vr4-cq9g-pvrc), [cross-family subnet](https://github.com/advisories/GHSA-j6r3-76f7-8jcv), [parse diagnostic DoS](https://github.com/advisories/GHSA-h3mg-xc3c-68pw) | No app address-classification/SSRF allowlist consumer found |
| Server `morgan` 1.11.0 | `server/package-lock.json:2121` | Moderate: [Unicode log forging](https://github.com/advisories/GHSA-jxfw-x594-9x9m), [quoted-field injection](https://github.com/advisories/GHSA-9f6g-j8ch-79g4) | Not used in app middleware; unconditional console logging remains F19 |
| Server chokidar 3.6.0/nodemon 3.1.14 | `server/package-lock.json:636`; `server/package.json:49` | High parent/effect records through glob dependencies above | Development tooling; deployment installs development dependencies unless separately configured |

## Existing security controls that passed review

1. **Private API protection:** guests received 401 for user/vocabulary/topic/activity/progress/leaderboard reads; ordinary users received 403 for admin listing.
2. **Ownership predicates:** direct other-account word access and foreign-topic modification/deletion were blocked; vocabulary PATCH could not change ownership, scheduler metadata, or source fields.
3. **Signup role/XP allowlist:** submitted admin role, large XP, and forged Google ID did not become account privileges.
4. **JWT/password lifecycle:** controlled invalid/expired/missing JWT outcomes, Google-only password login, password-change/reset invalidation, and valid newly issued sessions passed existing suites.
5. **Google checks before account lookup:** cancellation/state failure/code exchange/ID-token verification failure paths passed mocked tests; redirect destinations are constrained. Unsafe linking is a later step, F02.
6. **Frontend auth generation:** current restore controller/account guards passed stale-read/logout/A→B tests. F06 is a separate unguarded credential-submission path.
7. **XP integrity:** server chooses recipient/amount; transactions, unique award keys, replay protection, vocabulary daily cap and simultaneous-claim protection passed existing tests. Caller-supplied million-XP input did not affect fixed rewards.
8. **SRS:** review service validates mode/answer/rating, scopes owned words, and sets review dates on the server; incorrect/Again retry behavior passed. Self-rated flashcard behavior is intentional, not labelled a vulnerability.
9. **HTTP/input controls:** Helmet supplies backend nosniff/HSTS headers; JSON size limit returned 413; fixed CORS origin did not grant attacker response/preflight access; auth per-IP limiter reached 429 under an unchanged key.
10. **Files/storage/rendering:** avatar constraints and signed URL checks passed; tested React text escaped HTML; no authentication secret storage or runtime unsafe HTML/eval sink was found in the source search.

## Testing performed and limitations

### Existing suites rerun

| Suite | Result |
|---|---|
| Server: authenticationFailures, passwordSessions, vocabularyOwnership, vocabularyReview, awardXp, dialogueXp, leaderboard, studyStreak, userTheme, avatarUpload, profileName, googleDisplayName, dialogueCatalogue | **136/136 passed** |
| Client: auth-session-guard, session-restore, password-login, dialogue-progress-save, latest-dictionary-lookup, theme, vocabulary-events | **81/81 passed** |
| Mocked browser malicious-text rendering: Wordlist/topic/Profile, VI/EN, 320/1280px | **12/12 checks passed; no HTML execution/page runtime errors in these flows** |
| Mocked browser stale password login: A→B and A→logout, VI/EN, 1280px | **4/4 vulnerability reproductions confirmed** |

### Additional isolated probes

The full real Express app was mounted only on loopback with disposable MongoDB 7.0.14 (including a one-node replica set for transactions). Google verification/exchange, SMTP, translation, and dictionary HTTP providers were mocked. External application-service requests were rejected/intercepted.

- **22 initial probe checks passed**, covering private-route/role denial, topic transfer and foreign-resource protection, vocabulary creation/PATCH behavior, injection payloads, raw production errors, concurrent reset use, recovery enumeration, Google pre-hijacking/subject checks, email updates, simple POST behavior, activity/reward effects, unknown tasks, JWT replay, serialization, bcrypt limits, body/Helmet controls, CORS, and direct proxy-header rate bypass.
- Two initial harness assertions did not establish the intended condition: Node fetch overwrote Host, and instantaneous dictionary mocks completed before the requests overlapped. **Two corrected targeted checks passed** using raw HTTP and delayed mocks, establishing poisoned recovery URLs/raw-token logging and duplicate dictionary misses. These were harness corrections, not application fixes.
- Full-app recovery also produced a real `ERR_HTTP_HEADERS_SENT` after its 200; this is reported in F20 rather than claiming the probe run was runtime-error-free.
- The rate-budget check used only 31 small requests to the disposable listener under a synthetic IP, plus one changed-IP request. No production traffic or resource-exhaustion attack occurred.
- Dependency scans were read-only. Registry vulnerability counts are positive findings, so native `npm audit` reports nonzero status; this is not a passing/clean dependency result.
- Secret/path checks printed only metadata/locations. No environment file was opened. Selected package manifests/locks were read, not installed.

### Limits of this audit

- No production scans, SSH connections, live accounts, actual Google consent, real mail/translation/Cloudinary requests, Atlas access, production readiness-script run, destructive attacks, or RCE/DoS payloads.
- Browser reproduction used local Next.js and mocked API responses. It was not a production-build/WAF test; real Set-Cookie ordering and cross-site cookie delivery remain deployment checks.
- No Nginx/Vercel/PM2/Atlas configuration export was available. Missing repository files do not prove an insecure live configuration.
- No exhaustive dependency source review, deep Git-history secret scan, fuzzing, formal proof, or large-scale concurrency/load benchmark was performed.
- Passing controls cover the tested paths, not a guarantee that every possible input or deployment is secure.

## Prioritized remediation plan

Prioritize real-user account/data impact first, while immediately checking the conditions for the Critical dependency advisories. Keep fixes in small, reviewed batches with negative/security regressions.

| Priority | Finding(s) | Action and acceptance criteria |
|---|---|---|
| 1 | F02 | Define verified identity/linking semantics; prove pre-created email/password accounts cannot leave attacker access after the real owner's Google authentication, and mismatched subject/unverified claims cannot select another identity. Plan existing-account reconciliation and session revocation carefully. |
| 2 | F01, F04, F15 | Assess Windows/AVIF/OG exposure immediately; patch Next/native image stack and the active compression middleware, then applicable production/development transitive packages. Verify installed versions and rerun focused regressions. No automatic force/downgrade fixes. |
| 3 | F03, F19 | Use trusted HTTPS recovery origins and redact reset tokens/private log bodies. Prove forged Host/protocol cannot enter email links and credential material is absent from logs. |
| 4 | F06 | Guard/cancel obsolete credential submissions and navigation; test A request→close→B login and A request→logout including real cookie state, while retaining current Google/profile generation protections. |
| 5 | F07, F08 | Apply topic-update and vocabulary-create allowlists plus owner-validated optional topics; prove foreign owner/source/scheduler injection is rejected and zero-topic global notebook use still works. |
| 6 | F09, F24 | Resolve cookie host boundaries and CSRF protections using the actual frontend/API/Google redirect topology. Test bodyless/simple POST rejection and VI/EN Google login without breaking lesson audio or guest content. |
| 7 | F05, F17 | Add learning-router budgets, fix/verify proxy trust and direct-port restrictions, and share limit state across workers. Prove normal study works and forged headers cannot grant extra budget through the real proxy chain. |
| 8 | F10, F11, F14 | Make reset consumption single-use, normalize recovery disclosure and budgets, and define logout revocation. Test simultaneous resets, uniform outcomes, and the selected logout guarantee. |
| 9 | F12, F13, F16 | Move counts to verified event commits, bound reward claims without breaking intentional self-rating, and bound/coalesce dictionary work and costs. Preserve daily caps, XP dedupe, qualified-streak rules, and Vietnam day boundaries. |
| 10 | F18, F20–F23 | Harden deployment verification/reproducibility, production error handling, long-password policy, safe user serialization/private caching, and frontend header policy. Verify actual deployed configuration with operator-provided evidence before certifying it. |

**Stop point:** this report delivers the audit only. No finding has been fixed in this run.
