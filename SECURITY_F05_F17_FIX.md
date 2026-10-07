# StudyJony — F05 / F17 remediation report

Date: 2026-10-07. Scope: F05 and the locally provable application part of F17 only. No deployment, production requests, dependency installation, or production data changes.

## Result

- **F05 implemented:** Dialogue/Story progress and Study Activity now share read/write budgets, enforced both before authentication by transport-peer IP and after authentication by verified user ID.
- **F17 partially addressed, deployment hardening blocked:** the new learning IP guard cannot be bypassed by forwarded headers. Existing numeric Express proxy trust and the production listener are unchanged because the actual proxy/firewall path is not verified. Older auth/general API IP limiters retain that conditional risk.
- **F24 untouched.** Authentication cookies, OAuth identity/state checks, credential-attempt/session guards, CSRF middleware, learning controllers and existing data contracts are unchanged.

## Confirmed root causes

### F05

`server/app.js` mounts `/api/v1/dialogue-progress` and `/api/v1/study-activities` without the existing `apiLimiter`. Their routers previously installed authentication alone. Completion/replay calls can run MongoDB transactions; activity POSTs perform database upserts. Replaying an already completed task avoids duplicate XP but still incurs database work.

The fix is installed in both routers, so isolated router consumers also receive protection. No controller-specific duplication was added.

### F17

`server/app.js:23` still configures `trust proxy: 1`; `server/server.js:21` listens without an explicit host. A direct caller can supply an X-Forwarded-For value that becomes `req.ip` under that trust configuration. The new isolated tests reproduce that IP substitution while proving it does not reset the new learning peer budget.

The tracked deployment workflow restarts PM2 `studyjony-api`, but does not establish its worker count, actual bind, Nginx upstream/header rules, firewall restrictions, or the Vercel → Nginx → Node path. No tracked Nginx or PM2 ecosystem configuration was found. This does not prove that the live Node port is exposed.

## Exact limiter policy

One shared module, `server/middleware/learningRateLimit.js`, creates four process-local express-rate-limit stores. Both routers use the same instances.

| Scope | Reads per 10 minutes | Writes per 10 minutes | Identity |
| --- | ---: | ---: | --- |
| Authenticated learner | **3,000** | **600** | Database-backed `req.user._id` after `protect` |
| Transport peer | **60,000** | **12,000** | `req.socket.remoteAddress`, normalized by the installed `ipKeyGenerator` |

- GET/HEAD/OPTIONS are reads; other methods use the write budget. Full-app OPTIONS preflight remains handled by CORS before the routers.
- Dialogue and Story share the progress router; progress and activity share each budget. Changing task/course IDs, route, query, body, forged user fields, JWT issuance, or forwarded headers cannot create a new authenticated-user bucket.
- The peer guard runs **before `protect`**, bounding unauthenticated/expired-token requests before authentication database work. The user guard runs **after `protect`**, using verified identity rather than caller-supplied fields.
- All attempts count, including replay, invalid task IDs and failed requests. There is no payload-based exemption or successful-response-only counting.
- User budgets are separate for learners behind one IP. Peer budgets are deliberately much larger to allow shared networks/proxies.
- IPv4-mapped addresses are normalized; IPv6 uses the library's default /56 grouping. If the transport address is unavailable, requests share a fixed fallback bucket rather than acquiring an unlimited or header-derived identity.

The user write budget allows one write per second sustained for ten minutes, with a full 600-request burst allowance. It covers rapid task completion and legacy per-word activity writes. Reads allow repeated catalogue fan-out, lesson navigation, progress refreshes and multiple tabs. A cheap mock-endpoint test confirms a rapid 200-answer burst and 120 course reads remain allowed. These are initial, generous application budgets, not capacity measurements or a guarantee that every possible study speed fits.

Behind Nginx/Vercel, the socket peer may represent the proxy, so the peer limit can aggregate **all traffic arriving through that proxy**. It is not claimed to identify each browser's public IP. For scale context, 100 learners writing every five seconds would use the 12,000 peer-write ceiling in ten minutes. Actual production traffic should be checked before rollout; higher aggregate capacity or a verified client-IP policy may be needed for larger concurrency. Per-user protection does not depend on resolving that topology.

Rate-limited responses use HTTP **429**, JSON `{ status: "fail", code: "learningRateLimited", message: "Too many learning requests. Please wait and try again." }`, draft-8 rate-limit headers and `Retry-After`. The existing localized progress-save failure/Retry UI handles 429; it cannot present Continue as successfully saved. No UI redesign was required.

Normal controllers are unchanged: XP remains deduplicated, replays award zero, progress IDs remain unique, and qualified learning days/legacy activity counts keep their previous semantics. A rejected request does not reach those controllers. Limits do not add answer verification or change other deferred reward-abuse findings.

## F17 changes and remaining deployment dependency

### Changes made

The new peer key ignores `req.ip`, X-Forwarded-For, X-Real-IP and Forwarded. In the direct-listener test, X-Forwarded-For still changes Express `req.ip`, but the next request still receives 429 from the socket-peer guard. Authenticated-user limits likewise remain keyed to the same verified account.

### Changes deliberately not made

- No change to `app.set("trust proxy", 1)`.
- No change to `app.listen(port)` or deployment workflow.
- No guessed proxy address, Vercel CIDR list, Nginx rule, firewall rule or cookie scope.
- No replacement of existing auth/general API IP keys with a shared proxy key, which could collapse their existing low limits across legitimate users.

Express warns that proxy trust must match the actual topology and forwarding-header handling. See [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/). F17 cannot be considered fully resolved until the following checks establish that direct access is restricted and forwarded identity is trustworthy.

## Exact manual VPS / Nginx / firewall verification

These checks were **not run**. Use the deployed port and addresses you verify; do not assume the repository's default port is the live one.

### 1. Establish the running process and port

On the VPS:

```sh
pm2 list
pm2 describe studyjony-api
sudo ss -ltnp
```

Record the entry script, working directory, exec mode, number of workers and the actual Node TCP listener. Confirm the deployed revision includes these router changes. Review configuration locally to identify the effective PORT and NODE_ENV; no full environment dump is needed.

Check both IPv4 and IPv6: `0.0.0.0:PORT` or `[::]:PORT` represents a wildcard bind; a loopback-only listener is narrower. Confirm whether Nginx and Node share a host/network namespace or use containers/separate hosts.

### 2. Inspect the actual proxy configuration

```sh
sudo nginx -t
sudo nginx -T
```

Review the relevant server/location blocks locally. Record:

- The API `proxy_pass` destination and whether it corresponds to the Node listener.
- Existing `proxy_set_header X-Forwarded-For`, `X-Real-IP`, `Forwarded`, `Origin` and `Referer` handling.
- Any `set_real_ip_from`, `real_ip_header`, `real_ip_recursive` or PROXY-protocol configuration, including its inherited rules.
- Whether Nginx accepts public requests directly in addition to requests from Vercel/another edge proxy.
- The actual frontend API rewrite destination and every route by which requests can reach Node.

Do not trust all sources (`0.0.0.0/0` or `::/0`) for real-IP replacement. Trust only verified proxy senders and a header whose provider behavior is understood. Nginx's [real-IP documentation](https://nginx.org/en/docs/http/ngx_http_realip_module.html) explains the source allowlist and recursive selection rules.

After verifying that `$remote_addr` has the intended trustworthy client identity, the following is a **conditional header-normalization example**, not a configuration applied by this batch:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header Forwarded "";
```

If `$remote_addr` is still a Vercel/edge IP, this groups clients at the edge and is not yet an end-user identity. Verify the upstream edge identity and source restrictions first. Keep Origin/Referer and authentication/Set-Cookie forwarding intact for F09/F06/OAuth. See [Nginx proxy header documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header).

### 3. Inspect host and provider firewalls

```sh
sudo ufw status verbose
sudo nft list ruleset
```

If the host uses legacy iptables instead of nftables, inspect `sudo iptables -S`. Also inspect the VPS provider firewall/security group and any container port publishing. Verify that the Node port is unavailable to arbitrary Internet clients on **IPv4 and IPv6**, while Nginx can still reach it. Preserve required SSH access.

From your own authorized external machine, a single connectivity check can confirm direct-port reachability:

```sh
nc -vz YOUR_VPS_PUBLIC_IP YOUR_NODE_PORT
```

Use the verified values; check IPv6 separately if configured. This is one connection check, not a scan or rate-limit/load test.

### 4. Choose proxy trust/binding only after those checks

- If Nginx and Node are verified to communicate over local TCP on the same host, a loopback-only Node bind plus an explicit loopback proxy trust policy is a candidate. Align IPv4/IPv6 upstreams first.
- If they use different hosts/containers, bind/restrict access to the verified private network/proxy sources and trust only those sources. Do not substitute guessed private IPs or blanket hop trust.
- If Node is meant to accept direct clients, those direct peers must not authorize caller-controlled forwarding headers.
- Overwrite/normalize forwarded identity at the trusted boundary. Account for every shorter/direct path before using hop counts.

Review the verified topology before making these changes in a separate controlled step. Keep F24 out of that step unless its independent cookie topology is also verified.

### 5. Validate the result in isolated staging

Use the same proxy path with a disposable account/database. Send a few requests with different forged forwarding headers and confirm they cannot change the effective identity or gain a fresh budget. Confirm separate real clients and shared-network learners remain usable. Use a short, test-only window to verify 429/recovery; do not exhaust production quotas. Recheck `/users/me`, login/logout/account switching, Google state/callback, F09 Origin handling and normal Dialogue/Story saves.

### 6. Establish worker count / shared-store needs

The current stores are **in memory per Node process**. They reset on restart and do not coordinate between PM2 workers or hosts. With N workers, a user may obtain roughly N independent budgets; changing payload/headers still cannot reset a worker's bucket. See [express-rate-limit configuration](https://express-rate-limit.mintlify.app/reference/configuration).

If PM2 runs multiple workers or multiple API instances, plan a supported shared store with distinct namespaces for the four policies and atomic counters/expiry. No shared-store dependency or deployment was added in this batch. Worker-count verification and a shared-store rollout are still required for strict cross-worker quotas.

## Files changed in this batch

| File | Change |
| --- | --- |
| `server/middleware/learningRateLimit.js` | Shared read/write user and socket-peer policies; JSON 429/headers |
| `server/routes/dialogueProgressRoutes.js` | Peer guard → existing protect → user guard |
| `server/routes/studyActivityRoutes.js` | Same shared guards around existing authentication |
| `server/tests/learningRateLimit.test.js` | Eight isolated limiter/key/burst/recovery tests |
| `server/tests/learningSecurity.test.js` | Six full-app/disposable-replica-set security/progress/XP/streak tests |
| `client/scripts/test-learning-security-browser.cjs` | Real learning UI + local full Express app; normal/replay/429/Retry/expiry coverage |
| `SECURITY_F05_F17_FIX.md` | This report and deployment verification checklist |

Hashes of all previously dirty files were checked against the starting snapshot and preserved, including F09 app/middleware/tests, F07/F08 controllers, previous browser harnesses/reports and the existing Logo edit. No authentication, cookie, infrastructure, dependency or lesson-content files were changed.

## Tests and checks

| Check | Result |
| --- | --- |
| New focused limiter/security tests | **14/14 passed** |
| Full server, `node --test --test-concurrency=1 tests/*.test.js` | **258/258 passed** |
| Relevant client progress-save, auth/session/login and heatmap suites | **104/104 passed** |
| New learning browser matrix | **16/16 passed** at 320/375/430/1280px, VI/EN, light/dark |
| Production Next 16.3.8 build | **Passed**; 613 catalogue tasks verified |
| Client test runner lint under existing Next ESLint config | **Passed** |
| Changed/new server files, ESLint no-undef/no-unused-vars | **Passed** |
| Node syntax and `git diff --check` | **Passed** |

The full server suite includes F02 identity security, F06 credential/session protections, password-session invalidation, F07/F08 ownership, F09 CSRF, Dialogue/Story progress and XP deduplication, SRS, qualified streaks, heatmap/mixed activity and timezone boundaries.

New cases prove shared user quotas across task/source/payload changes, independent users behind one peer, unauthenticated/expired requests, forged X-Forwarded-For, separate read/write budgets, structured 429/Retry-After, expiry recovery, blocked requests without progress/reward/activity writes, and F09 rejection before budget consumption. Small quotas/windows are injected only in isolated test fixtures; production policy has no request-controlled settings.

Browser cases complete real Dialogue and Story exercises, replay a completion, read progress, post activity, deliberately reach a small fixture quota, verify localized failure with no Continue, wait for actual expiry, triple-click Retry, and verify one successful retry and no duplicate XP. Navigation and horizontal-overflow checks pass; no unexpected hydration/runtime errors were detected in those flows. Learning audio playback/codecs were not tested or changed.

An initial new browser-runner selector assumed a `main` element around the exercise input. The current exercise uses a div wrapper; the runner was corrected. Application UI was not changed. An initial client ESLint invocation ignored server paths; those paths were subsequently checked with explicit core rules from the workspace root. Existing Mongoose/VM-module warnings were not altered.

The entire client suite and the earlier 160-case credential browser matrix were not rerun. Relevant client checks and the full server auth/security suites passed; no auth application code was changed. The previously documented unrelated dictionary failures were not fixed. Real Google/production proxy/TLS/firewall/multi-worker verification remains unperformed.

## Compatibility / data impact

- No schema, learning-data, XP, KN, SRS, streak or account migration.
- New behavior is bounded learning requests with HTTP 429 and automatic budget recovery. Existing localized save-failure/Retry handling remains usable.
- No new environment variables or dependencies. No new sensitive request/user/content logging.
- Budgets aggregate per verified user across both learning routers and tabs; normal single-user bursts and multiple users behind a peer were tested.
- Production scale, actual proxy identity and worker count need the manual checks above. F17 is still partly blocked; F24 remains untouched. Stop after F05/F17.
