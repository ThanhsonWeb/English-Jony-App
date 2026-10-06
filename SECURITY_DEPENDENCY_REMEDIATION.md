# Security dependency remediation — F01 / F04 / F15

Date: 2026-10-06. Local verification: Windows, Node 22.14.0, npm 10.9.2.

## Result and scope

- Both **production dependency audits report zero vulnerabilities**.
- All three originally reported Next.js Critical advisories and the `proxy-addr` Critical advisory are absent from the resulting audited trees. Installed versions were checked against lockfiles and affected version ranges.
- Across both original audit outputs, **35 of 36 distinct GHSA identifiers were eliminated**. The one remaining advisory is `GHSA-vfj7-8cjw-p6xm` in development-only `braces` dependency chains.
- Full audits remain non-clean: **client: 5 High affected-package records; server: 3 High affected-package records**. These are propagated records for that single underlying development advisory, not eight independent vulnerabilities.
- No application behavior, authentication controller, localization, audio, database schema, data, or deployment configuration was changed in this batch. SHA-256 checks confirm all 11 existing F02/audit files were preserved. F03 and F05+ application findings remain outside scope.
- No `npm audit fix`, `--force`, dependency downgrade, RCE payload, interrupted-stream stress test, production scan, real Google login, real mail delivery, or production database access was used.

## Versions before → after

### Client

| Package / dependency family | Before | After | Reason |
| --- | --- | --- | --- |
| `next` | 16.2.12 | **16.3.8**, exact pin | Latest stable compatible supported 16.x release verified from npm and maintainer release notes. |
| `eslint-config-next`, `@next/eslint-plugin-next` | 16.2.12 | **16.3.8** | Keep the related framework tooling aligned. |
| `@next/env`, platform SWC packages | 16.2.12 | **16.3.8** | Framework runtime/compiler stack. |
| `sharp`, platform Sharp packages | 0.34.5 | **0.35.5** | Patched native image dependency selected by Next's `^0.35.4` range. |
| Platform libvips packages where separate packages exist | 1.2.4 | **1.3.4** | Native stack selected with Sharp. |
| `postcss` nested under Next | 8.4.31 | **8.5.23** | Patched dependency selected by Next. Existing root PostCSS 8.5.25 remains unchanged. |
| `nanoid` | 3.3.16 | **3.3.20** | Compatible patched transitive update. |
| `source-map-js` | 1.2.1 | **1.2.2** | Compatible patched transitive update. |
| `js-yaml` | 4.3.0 | **4.3.2** | Compatible patched development transitive update. |
| `brace-expansion` | 1.1.18 / 5.0.9 | **1.1.21 / 5.0.12** | Patch both development dependency branches. |
| `@swc/helpers` | 0.5.15 | **0.5.23** | Required by updated Next. |
| `fastq` | 1.20.1 | **1.20.3** | Compatible helper resolution in the updated dependency tree. |

React and React DOM **19.2.4**, next-intl **4.13.7**, and next-auth **4.24.15** remain unchanged. Their declared peer ranges accept Next 16.3.8; production build and browser verification passed. No optional Instant Navigations/cache/root-param feature was enabled.

Actual Windows native runtime reports Sharp **0.35.5**, libvips **8.18.7**, and libheif **1.23.5**. Linux/macOS platform packages are included in the lockfile; their native execution was not tested here.

The old client lockfile contained a stale root `sharp` declaration already absent from `package.json`. npm reconciled that root metadata; Sharp remains installed through Next's native image stack. Original lockfile indentation was restored after npm serialized it differently, preserving a focused diff without changing dependency data.

### Server

| Package | Before | After | Reason / compatibility |
| --- | --- | --- | --- |
| `compression` | 1.8.1 | **1.8.2** | Patched supported 1.x release; global compression configuration unchanged. |
| `proxy-addr` | 2.0.7 | **2.0.8** | Compatible Express transitive patch. Trust-proxy configuration unchanged. |
| `nodemailer` | 9.0.4 | **10.0.15** | The 9.x line does not fix all reported advisories. Reviewed 10.x migration; existing CommonJS SMTP API passed local tests. |
| `morgan` | 1.11.0 | **1.12.1** | Compatible direct dependency patch; no new logging middleware enabled. |
| `@grpc/grpc-js` | 1.14.4 | **1.14.5** | Latest patched release satisfying the existing `^1.14.4` dependency range. |
| `qs` | 6.15.3 | **6.16.0** | Compatible Express/body-parser transitive patch. |
| `ip-address` | 10.4.0 | **10.7.3** | Compatible rate-limiter transitive patch. |
| `brace-expansion` | 5.0.9 | **5.0.12** | Compatible development transitive patch. |
| `destroy` | Not previously installed | **1.2.0** | New dependency required by patched compression. |

## Compatibility review

- Next 16.3.8 requires **Node >=20.9.0** and accepts the existing React 19 versions. The current Node 22.14.0 meets this requirement. Release 16.3.8 includes the current security fixes; 16.x remains the supported line. [Next release](https://github.com/vercel/next.js/releases/tag/v16.3.8), [support policy](https://nextjs.org/support-policy), [16.3 release overview](https://nextjs.org/blog/next-16-3).
- Nodemailer 10's documented breaking requirement is **Node >=20**. Its CommonJS build and `createTransport`/`sendMail` SMTP usage work with StudyJony's existing helper. A local SMTP listener received the real helper's message, and a mocked transport failure still propagated. The configured external SMTP host/credentials were never passed to a network transport during tests. **Verify the VPS Node version before deployment**; it was not inspected remotely. [Nodemailer 10 migration release](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.0).
- Normal gzip/identity JSON API responses, auth rejection, CORS response behavior and health checks passed through the actual updated Express application. No compression options were changed. [Compression advisory](https://github.com/expressjs/compression/security/advisories/GHSA-vc2v-76pw-4v95).
- Installs used `--ignore-scripts`, targeted versions/ranges and compatible transitive updates. Existing native binaries were verified by actual image conversion and backend tests. Separate temporary `npm ci --ignore-scripts --no-audit` installations reproduced both lockfiles successfully; dependency JSON remained equal.
- `npm ls --all` exits successfully. Server reports no tree problems. On Windows, client npm lists two extra optional/platform artifacts, `@img/sharp-wasm32` 0.35.5 and `@emnapi/runtime` 1.11.3. They match locked versions and appear identically after a fresh isolated `npm ci`; native Sharp is the tested image implementation. No unrelated package pruning was performed.
- No data migration or user-account reconciliation is introduced by these dependency changes.

## Originally Critical advisories

| Advisory | Fixed boundary | Verified result |
| --- | --- | --- |
| [GHSA-p293-qw3h-jr36 — Windows-hosted Next RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) | Next 16.3.3 | Installed/locked Next 16.3.8; absent from post-update audit. No exploit executed. |
| [GHSA-2xp9-vwfh-vxw4 — AVIF image optimization RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) | Next 16.3.3 | Next 16.3.8 and patched Sharp/native stack; absent from audit. Benign PNG-to-WebP image optimization tested. No AVIF attack input used. |
| [GHSA-vcvr-r3jv-pc5j — Node `next/og` ImageResponse RCE](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) | Next 16.3.6 | Next 16.3.8; absent from audit. No app `next/og` consumer was added or exploited. |
| [GHSA-jqcg-44mw-7w3h — proxy-addr trust-subnet spoofing](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | proxy-addr 2.0.8 | Installed/locked 2.0.8; absent from audit. The application's separate numeric trust-proxy/edge exposure finding remains unchanged. |

Both Sharp advisories (`GHSA-f88m-g3jw-g9cj`, `GHSA-rgj7-g3m4-5g8c`) and compression's `GHSA-vc2v-76pw-4v95` are also absent from the post-update audited trees.

## Reachability classification of original affected dependencies

Classification describes repository consumers and advisory prerequisites, not a claim that every listed advisory was successfully exploited. No exploit/stress tests were performed.

### 1. Production/runtime with active consumers

| Dependency | Consumer / qualifier | Remediation |
| --- | --- | --- |
| Next / Sharp native image stack | Next serves the app and its Image API; benign logos/thumbnails are optimized. Windows, AVIF and Node OG advisories have different prerequisites. Node OG had no app consumer. | Patched Next, Sharp and native packages. |
| compression | Global middleware handles ordinary API responses. | Patched to 1.8.2; gzip and identity checked. |
| Nodemailer | Password recovery sends to a stored, validator-checked email through fixed SMTP configuration. Arbitrary transports/attachments/recipient arrays are not app features; individual advisory reachability varied. | Patched to 10.0.15; isolated SMTP and failure handling checked. |
| ip-address | Runtime transitive dependency of rate limiting; IPv6 parsing is used for client keys. Specific subnet/link-local classification conditions were not established as app attack paths. | Patched to 10.7.3. |

### 2. Production/runtime but specific vulnerable usage not established

| Dependency / advisory path | Why the reported exploit condition was not established | Remediation |
| --- | --- | --- |
| proxy-addr CIDR trust-subnet advisory | App uses numeric hop trust, not a configured vulnerable trust-subnet policy. This does not resolve the separate trust-proxy configuration risk. | Patched to 2.0.8. |
| @grpc/grpc-js | Google client dependency; no app gRPC server or server certificate-auth-context policy. | Patched to 1.14.5. |
| qs | Default simple query parsing and JSON bodies; no configured extended/urlencoded input parser. | Patched to 6.16.0. |
| morgan | Installed but not registered as app middleware. | Patched to 1.12.1. |
| PostCSS / source-map-js | No learner-facing arbitrary CSS/source-map parsing endpoint. | Patched affected copies. |
| nanoid custom-generator advisory | No app-controlled custom-generator size-zero path accepting user input was found. | Patched to 3.3.20. |
| Next Node ImageResponse | No app use of attacker-controlled `next/og` SVG generation. | Covered by Next upgrade. |

### 3. Development-only/transitive

`brace-expansion` and `js-yaml` were updated within compatible versions. Remaining glob-tooling chains are described below. No learner API accepts developer glob/YAML configuration for these tools.

## Remaining advisory — deliberately not forced

**High: [GHSA-vfj7-8cjw-p6xm — braces nested-pattern stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).**

| Workspace | Remaining package records | Chain / exposure |
| --- | --- | --- |
| Client | `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, `eslint-config-next` | eslint-config-next 16.3.8 → Next ESLint plugin → fast-glob 3.3.1 → micromatch 4.0.8 → braces 3.0.3. Development lint/glob tooling. |
| Server | `braces`, `chokidar`, `nodemon` | nodemon 3.1.14 → chokidar 3.6.0 → braces 3.0.3. Development file watching. |

At verification time, the latest published stable `braces` is **3.0.3**, still affected, with no compatible patched release. npm suggests downgrading parent packages; that was rejected. Forcing Chokidar 4 into Nodemon's 3.x range would change its glob contract and is not a safe transitive patch. No library was replaced.

These chains are excluded by both `npm audit --omit=dev` results and are not learner-facing runtime consumers. They can matter if developer tooling processes attacker-controlled patterns or repositories. Deployment still needs to use the updated locks and avoid treating development tools as production request handlers. Monitor upstream patches and update within compatible ranges once available.

## Tests/checks and results

| Check | Result |
| --- | --- |
| Full server `node --test tests/*.test.js` | **183/183 passed**; includes F02, password/JWT sessions, Google mocks, ownership, SRS, rewards/streaks, profile and Dialogue/Story progress. |
| New server compatibility tests | **5/5 passed** within the full suite: actual gzip/identity API responses, auth/health, loopback SMTP and mail transport failure. |
| Full client scan of 32 `.test.js`/`.test.mjs` files in scripts and app libraries | **268/271 passed; 3 pre-existing dictionary failures**. Not reported as a clean full suite. |
| Isolated pre-upgrade Git HEAD dictionary comparison | **90/93 passed; the same three failures**. Built-in Node/data-only tests run with archived original sources/data and no upgraded dependency installation. |
| New client `dependency-runtime.test.cjs` | **2/2 passed**: installed/locked native versions and real PNG/WebP conversion; compiled rewrite plus actual upgraded Next proxy forwarding POST JSON, queries, cookies, Set-Cookie and 401 status to loopback only. |
| Production `npm run build` | **Passed**, Next 16.3.8; existing prebuild verified 613 catalogue tasks. First restricted-network build failed to fetch Inter; permitted-network retry passed without a font/code change. |
| F02 production browser suite | **60/60 scenarios passed**. |
| Existing catalogue/password-login/session-restoration production browser suite | **60/60 cases passed**. |
| New media production browser suite | **80/80 page checks passed**, plus three Next Image optimizations, static audio range/Chrome metadata decoding, and compiled API rewrite verification. |
| Existing global/topic Due/All review production browser suite | **240 completed Flashcard/Quiz/Write sessions and 40 Wordlist count/filter checks passed**. |
| Full client ESLint | **0 errors, 2 existing img-element warnings** in Profile/Header. New test files passed focused ESLint. |
| Syntax and `git diff --check` | **Passed**, including generated tracked dependency changes. |
| Both isolated `npm ci` reproductions | **Passed**; lock content reproduced unchanged. |
| Full npm audits | Client **5 High**, server **3 High**, all from the remaining development `braces` chain. |
| Production npm audits | **0 vulnerabilities in both workspaces**. |

### Existing client failures kept outside scope

1. `app/_lib/dictionary/resolveMeaning.test.mjs`: runtime v3 lookup assertion expects `this` to be absent, while current dictionary data includes it.
2. `scripts/build-dictionary-v3.test.mjs`: generated dictionary-v3 JSON differs from the checked-in artifact.
3. `scripts/extract-dictionary-v2.test.mjs`: generated dictionary-v2 JSON differs from the checked-in artifact.

All three reproduced in the isolated pre-upgrade Git HEAD archive. Dictionary/content files were not changed.

An older standalone `test-wordlist-browser.cjs` attempt timed out on its initial `nature` row selector. It is recorded as failed, not counted as passing or fixed here. The more recent global/topic suite subsequently passed all 240 review sessions and 40 Wordlist checks. Further investigation of that older harness is outside this dependency batch.

### Browser setup and limitations

- Production server ran the actual upgraded build locally. Tests used 320/375/430/768/1280px, VI/EN, light/dark themes, mocked account/API/provider responses, and real local images/audio.
- F02, catalogue/auth and media suites checked for console/runtime/hydration errors and horizontal overflow. The review suite checked outcomes/counts in all three modes.
- Initial browser attempts used a mismatched local bind hostname (`127.0.0.1` while Proxy rewrite URLs used `localhost`), producing a VI redirect loop. Relaunching the test server with hostname `localhost` resolved it without application changes. This is not a claim that arbitrary self-hosted hostname configurations were verified.
- Production Vercel Analytics uses a relative `/_vercel/insights` script unavailable on a standalone local Next server. Initial browser attempts reported its 404. Test wrappers mocked that deployment-only script, as well as Google/provider responses, rather than modifying application code or suppressing unrelated errors. Final listed runs passed.
- Playwright came from the existing external npm cache; it was not added as an application dependency.
- Actual deployed Vercel behavior, VPS Node/OS, upstream HTTPS/cookies, real Google OAuth, SMTP credentials/delivery, and Linux native binaries require controlled deployment verification. Local rewrite transport was tested against a loopback mock, never the configured production API.
- A zero npm audit result is a dependency-database result, not a claim that application security findings are resolved or that deployed systems already use these packages.

## Files changed in this batch

1. `client/package.json`, `client/package-lock.json`.
2. `server/package.json`, `server/package-lock.json`.
3. `server/tests/dependencyCompatibility.test.js`.
4. `client/scripts/dependency-runtime.test.cjs`.
5. `client/scripts/test-dependency-media-browser.cjs`.
6. `SECURITY_DEPENDENCY_REMEDIATION.md`.
7. **150 already-tracked server/node_modules files have content changes/removals** from npm in `.package-lock.json`, `@grpc/grpc-js`, `brace-expansion`, `compression`, `ip-address`, `morgan`, `nodemailer`, `proxy-addr`, and `qs`. Git status lists **212 vendor entries**, including 62 additional installation/line-ending-only changes with no content diff. No vendor files were hand-edited. New ignored distribution files are local install artifacts; deploy by installing from the lockfile, not by treating the tracked vendor directory as a complete bundle. No node_modules cleanup/untracking or F18 infrastructure refactor was performed.

Existing F02 files and both earlier security reports are unchanged. No commit, deployment, production-data operation, or migration was performed. **Stopped after F01/F04/F15.**
