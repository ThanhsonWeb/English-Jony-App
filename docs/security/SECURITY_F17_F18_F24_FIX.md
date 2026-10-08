# StudyJony — F17, F18 and F24 deployment review

## Result and scope

| Finding | Status | Result |
| --- | --- | --- |
| F17 proxy/direct exposure | **Blocked on deployment evidence** | Repository inspection completed; existing F05 socket-peer/user protections retained. Bind, proxy trust, firewall and shared limiter storage cannot be safely chosen from this repository. |
| F18 deployment | **Local hardening implemented; activation blocked** | Pinned SSH identity, deterministic install, exact revision, fail-fast checks and PM2/health verification prepared. Operator must supply independently verified host trust and health configuration. |
| F24 parent-domain cookies | **Blocked on production callback/topology evidence** | Same-origin browser architecture confirmed. Host-only migration plan prepared; current production cookie scope deliberately unchanged. |

No deployment, push, VPS access, Google/Vercel account access, live OAuth, real-user traffic or production database access occurred. Public documentation, package registry installation in an isolated temporary folder, local tests and build were used. Every one of the 22 previously dirty/untracked application/test/report files is preserved against its starting SHA-256 snapshot. No auth, learning, dictionary, CSRF, XP/SRS/streak, theme, localization, CSP or routing implementation was changed.

## F17 — Confirmed code and unresolved deployment facts

`server/server.js` listens on `PORT` (default 5000) without a host argument. `server/app.js` sets `trust proxy` to numeric `1`. Auth/general rate limits use the resulting `req.ip`; a direct Node connection can supply a forwarded address under this policy. This is a conditional exposure risk, not proof that the live port is reachable.

Learning budgets continue using socket-peer keys before authentication and verified user keys afterward. Recovery's socket-peer budget and shared Mongo account cooldown also remain unchanged. Existing tests prove forged forwarding headers cannot reset those budgets. Numeric proxy trust and the auth/general IP risk remain open.

There is no tracked Nginx or PM2 ecosystem configuration establishing the actual chain, worker count or ingress restrictions. The workflow's PM2 process name and repository directory establish neither the Nginx upstream address nor whether Nginx is colocated with Node. Binding to loopback now could break a container/networked upstream. Disabling proxy trust now would aggregate the existing 30/hour auth budget behind a proxy. Neither change is made without evidence.

Express explicitly requires proxy trust to match the real forwarding topology; short alternative paths can invalidate numeric hop assumptions. See [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/).

### Operator checks on the VPS

These are instructions for the operator, not commands run against production in this batch. Keep private keys, complete environment dumps, PM2 JSON and full Nginx configuration out of shared output.

Inspect listeners and firewall locally:

```bash
sudo ss -ltnp
sudo ufw status verbose
sudo nft list ruleset
# If the host uses legacy iptables instead:
sudo iptables -S
sudo ip6tables -S
```

Find the actual Node PID/port. `127.0.0.1:PORT` or `[::1]:PORT` is loopback; `0.0.0.0:PORT`, `[::]:PORT` or a public/interface address requires separate ingress review. Check cloud/provider security groups as well as host firewall rules, for both IPv4 and IPv6. Missing/inactive UFW does not establish that the port is protected.

From a separate authorized machine, substitute the verified address/port:

```bash
nc -vz -w 3 <VPS_PUBLIC_IPV4> <ACTUAL_NODE_PORT>
# If the VPS has public IPv6:
nc -6 -vz -w 3 <VPS_PUBLIC_IPV6> <ACTUAL_NODE_PORT>
```

A successful connection proves exposure. Failure from one source alone is insufficient; confirm firewall/security-group rules and the listener. Do not perform load tests against production rate limits.

Inspect only relevant Nginx directives:

```bash
sudo nginx -T 2>&1 | awk '
  /server_name|proxy_pass|real_ip_header|set_real_ip_from|real_ip_recursive/ { print }
  /proxy_set_header[[:space:]]+(Host|X-Forwarded-For|X-Real-IP|X-Forwarded-Proto|X-Forwarded-Host|Origin|Referer)[[:space:]]/ { print }
'
sudo nginx -t
```

Confirm the relevant virtual host and `proxy_pass`, whether it points to loopback or another host/container, the actual Node socket peer, and every upstream hop. Check how X-Forwarded-For/X-Real-IP are overwritten or appended, and whether a trusted `real_ip` module rewrites `$remote_addr`. An unverified incoming XFF must never become a trusted client identity. `$proxy_add_x_forwarded_for` appends existing input; it requires correct trust evaluation rather than blindly trusting its leftmost element. Vercel-origin requests may represent proxy IPs unless a verified ingress rule establishes an end-user identity. Do not trust all networks or guess a hop count.

Inspect PM2 without exposing its full environment:

```bash
pm2 jlist | node -e '
  let rows; try { rows = JSON.parse(require("node:fs").readFileSync(0, "utf8")); } catch { process.exit(1); }
  const apps = rows.filter(p => p.name === "studyjony-api");
  console.log(JSON.stringify({ workers: apps.length, processes: apps.map(p => ({
    id: p.pm_id, pid: p.pid, status: p.pm2_env.status,
    mode: p.pm2_env.exec_mode, node: p.pm2_env.node_version,
    watch: p.pm2_env.watch, interpreter: p.pm2_env.exec_interpreter,
    script: p.pm2_env.pm_exec_path, hasArgs: Boolean(p.pm2_env.args), cwd: p.pm2_env.pm_cwd
  })) }, null, 2));
'
node --version
npm --version
# Substitute the actual Node PID identified above:
sudo readlink -f /proc/<NODE_PID>/exe
sudo readlink -f /proc/<NODE_PID>/cwd
```

Inspect arguments privately in the local PM2 configuration; custom arguments could contain credentials and are deliberately omitted above. Confirm the actual process is a production entrypoint, not `npm run dev`, nodemon or a Node watch process. PM2 watch must be disabled. Verify the actual worker interpreter version, not just the login shell's Node version. The deployment guard permits the tested Node 22.x line, at least 22.14.0; use a **current patched 22.x release**, not the old test version as a security target. Node 22 remains LTS according to [Node's release table](https://nodejs.org/en/about/previous-releases). This compatibility floor is not a check for every Node security patch.

Auth/API, learning-user/peer, recovery-peer, avatar and dictionary in-memory state is per process. With N workers, independent counters/concurrency/cache/provider budgets can multiply approximately N-fold (and reset on restarts); routing/stickiness affects the actual result. F11 Mongo account cooldowns, F12 review receipts, F13 attempt/XP transactions and F14 revocation records remain database-backed. Verify worker count and review shared limiter/provider state or a deliberately single-worker setup separately; this batch does not silently change capacity or worker count.

**Required F17 completion evidence:** listener address/port, Nginx upstream and header rules, trusted proxy addresses/path, IPv4/IPv6 firewall and provider rules, external reachability result, PM2 entrypoint/interpreter/count. Only then choose a loopback bind if colocation is established, an explicit trusted-proxy policy, and effective/shared budget enforcement. A passing loopback health check does not prove that the same port is inaccessible externally.

## F18 — Exact hardening

- Workflow now reads the triggering revision with SHA-pinned `actions/checkout` **v7.0.1**, `persist-credentials: false` and read-only repository permissions. The pin is verified against the [official release commit](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1). Its Node 24 action runtime is on the hosted GitHub runner, separate from the VPS Node 22 application policy.
- Removed runtime `ssh-keyscan`. The selected host's known_hosts key must match an independently supplied SHA256 fingerprint before any SSH connection. StrictHostKeyChecking is required, automatic host-key learning is disabled, and missing/mismatched trust fails closed.
- Secrets are passed as environment data, not interpolated into shell source. SSH keys are created under restrictive permissions, are not printed, and runner SSH files are removed even after failure.
- Serialized deployment jobs and bounded runner/SSH timing. No overlapping managed deployment commands.
- Both local and remote Bash use `set -euo pipefail`.
- Remote preflight rejects unsupported CLI Node, missing npm/PM2, absent target processes or PM2 watch mode. It refuses tracked working-tree/index changes, fetches main, performs a fast-forward-only update to the triggering SHA, then checks HEAD equals that SHA. An older/ahead/diverged checkout fails rather than forcing a reset.
- Requires no tracked `server/node_modules` before installing. Uses `npm ci --omit=dev --engine-strict --no-audit --no-fund`; dependency versions and both reviewed package/lockfile contents are unchanged. npm ci fails on manifest/lock disagreement rather than updating resolution. See [npm ci documentation](https://docs.npmjs.com/cli/v10/commands/npm-ci/).
- Before explicit restart: validates runtime/health configuration and PM2 worker status/version, checks the installed production tree, loads runtime dependencies, verifies native bcrypt, checks production/tool JavaScript syntax and verifies the F13 catalogue/rules without regenerating them.
- After restart: requires all named workers online on the supported runtime, probes a verified loopback HTTP `/health` endpoint with bounded retries/timeouts, and saves PM2 state only after success. Health redirects, bad bodies/statuses or startup failures cause failure without `pm2 save`.
- The health URL has no assumed port: configure it after checking the real listener. Only exact `http://127.0.0.1:PORT/health` or `http://[::1]:PORT/health` is accepted. No credentials, queries, fragments, hostnames or arbitrary external probes are accepted.

The existing `/var/www/English-Jony-App` directory and `studyjony-api` name are retained from the original workflow. Confirm both before activation. No VPS operations were run. This is still an **in-place deployment**, not an atomic release/rollback system: checkout/dependency files can change before a later check fails. The script will not issue restart after a failed prerequisite, but that does not guarantee zero downtime or restore earlier files. Failed post-start verification needs operator recovery; no automatic rollback was invented.

### SSH host identity — required operator configuration

Use the VPS provider's trusted console or another independently authenticated channel. On that console:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```

These are the **public host key**, not the deployment user's private key. Confirm sshd actually offers this key (`sudo sshd -T | awk '$1 == "hostkey" { print }'`). If it uses another host-key algorithm, obtain that public key/fingerprint through the same trusted channel instead. Never substitute a fingerprint collected from the first unverified network connection.

In repository **Settings → Secrets and variables → Actions**, retain the existing VPS_HOST/VPS_PORT/VPS_USER/VPS_SSH_KEY and add:

| Setting | Value obtained by operator |
| --- | --- |
| Secret `VPS_KNOWN_HOSTS` | One matching host-key entry using the independently verified public key |
| Secret `VPS_HOST_KEY_SHA256` | Exact `SHA256:...` fingerprint of that selected key |
| Variable `VPS_HEALTH_URL` | Verified Node loopback health URL with actual port |

For SSH port 22 the entry is `<VPS_HOST> <KEY_TYPE> <PUBLIC_KEY_BASE64>`. For another port it is `[<VPS_HOST>]:<VPS_PORT> <KEY_TYPE> <PUBLIC_KEY_BASE64>`. Use the exact configured hostname/IP. Fingerprint the constructed file locally with `ssh-keygen -lf trusted_known_hosts -E sha256` and compare with the console value before storing it. The workflow expects one selected matching key/fingerprint. No fingerprint, host key, health port or OAuth URL was invented here. OpenSSH's strict checking is described in its [configuration manual](https://man.openbsd.org/ssh_config#StrictHostKeyChecking).

Host trust is still an operator blocker. Settings were not read or written in GitHub, and the workflow was not invoked.

### Tracked dependencies — staged cleanup

**5,599 files** under `server/node_modules/` were removed from the Git index with `git rm -r --cached`. All installed files remain on disk, byte-for-byte: the aggregate before/after SHA-256 is `a8a6f698af47e813487bbeed2b60c44589956b9880862ca855de37b76fedea83`. Existing `server/.gitignore` already ignores `/node_modules/` and is unchanged.

```bash
git ls-files server/node_modules
# Expected: no paths.
git diff --cached --name-only -- server/node_modules
# Exact list of all 5,599 staged index removals.
git check-ignore server/node_modules/express/index.js
```

The large file count in this batch is this intentional generated-dependency cleanup. It is not 5,599 application edits. Package versions and the developer's installation are unchanged. Existing staged changes were absent at the start; only these index removals are staged. No commit/push was made.

The first VPS update may find locally modified old tracked dependencies and stop at the clean-tree check. Inspect and preserve that local state before preparing a clean checkout; this batch does not force-reset/stash/delete it remotely. A future authorized deployment installs dependencies from the lockfile after the cleanup revision arrives.

## F24 — Cookie strategy and exact missing evidence

Browser requests use relative `/api/v1/...` paths and `credentials: include`; Next rewrites them to `NEXT_PUBLIC_API_URL`. The browser-visible response host controls a host-only cookie, not the rewrite's internal upstream host. Production JWT/candidate and F06 selection/intent cookies still use `.studyjony.com`; the client writer also sets this Domain. OAuth state/locale cookies are already host-only, HttpOnly, SameSite=Lax and limited to `/api/v1/auth/google`. Google uses the environment-supplied `GOOGLE_REDIRECT_URI` for state response and token exchange, then redirects to the locale-specific frontend callback.

Canonical frontend is confirmed as `https://studyjony.com`. The deployed API rewrite destination and Google callback host are not established. A direct API-host callback could issue host-only auth cookies on that API host; those would not accompany frontend-host rewrite requests. Narrowing only the backend cookie would also desynchronize F06's frontend selection/intent writer. No partial cookie change is made.

### Operator verification

On the VPS, in the actual running application directory, print only non-secret topology settings, never the whole `.env` or PM2 environment:

```bash
cd /var/www/English-Jony-App/server
node <<'NODE'
require("dotenv").config({ quiet: true });
for (const key of ["NODE_ENV", "PORT"]) console.log(key + "=" + (process.env[key] || "<unset>"));
for (const key of ["FRONTEND_URL", "GOOGLE_REDIRECT_URI"]) {
  let url; try { url = new URL(process.env[key]); } catch { console.log(key + "=<unset/invalid>"); continue; }
  console.log(key + "=" + url.origin + url.pathname);
  console.log(key + "_HAS_CREDENTIALS_QUERY_OR_FRAGMENT=" + Boolean(url.username || url.password || url.search || url.hash));
}
NODE
```

PM2-injected environment may override `.env`. If so, inspect **only these same selected keys** from the matching PM2 process locally. Verify the running executable/cwd first. Do not share DATABASE, JWT_SECRET, GOOGLE_CLIENT_SECRET, SMTP credentials, Cloudinary secrets or full environment output.

In Vercel project settings inspect the **Production** `NEXT_PUBLIC_API_URL` and actual deployed build/rewrite; do not assume development/preview values are production. Confirm frontend and backend `FRONTEND_URL=https://studyjony.com`, canonical/www redirects, whether direct API auth consumers exist, and which host receives every Set-Cookie response. Next embeds rewrite configuration at build time; verify the actual deployed build rather than only the current setting.

In Google Console, inspect the existing authorized JavaScript origin and exact authorized redirect URI for the deployed client. Compare with the VPS `GOOGLE_REDIRECT_URI` and the browser state response's `redirectUri`. Do not change them or invent a new production callback during this review.

In an authorized HTTPS browser check both VI/EN password login/signup, Google state/callback/session restoration, password reset/change, logout, tabs, late credential responses, and `/users/me`. Inspect **cookie names, Domain/host-only, Path, HttpOnly, Secure, SameSite and expiry only**. Never copy JWT/state/reset token values. Confirm the proxy preserves multiple Set-Cookie headers and Origin/Referer, callback/state share the required host/path, and no auth cookie is needed by an unrelated subdomain.

### Preferred coordinated migration — not implemented

If all issuance/state/callback/browser API paths are verified on the canonical frontend host, migrate JWT/candidate and public selection/intent cookies together to a **new host-only namespace**, preferably `__Host-` in production. Keep HttpOnly on credentials, Secure, Path=/, signed-expiry alignment, revocation and the F06 attempt/generation/cross-tab rules. Public selectors remain non-credential values. Choose/test SameSite using the verified same-origin API and top-level OAuth flow; do not change it speculatively. `__Host-` requires Secure, Path=/ and no Domain in supporting browsers; see [cookie prefix requirements](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

Old `.studyjony.com` cookies require explicit retirement with their original Domain/Path. Use a new namespace so old parent-domain cookies and delayed old-version responses cannot compete with the new host-only names. Do not rely on duplicate same-name Cookie header order. Legacy credentials should be available only for intentional cleanup/revocation during the transition, not silently regain authentication priority. Expire legacy candidate/selector/intent/JWT cookies in controlled migration paths; preserve exact-session cleanup so delayed credential/logout responses cannot erase a newer active session. A mandatory new-namespace transition can require re-login; it must not reset account/learning data.

Before implementing, test mixed old/new cookies, duplicate names, subdomain injection, delayed old/new responses, logout/reset revocation, Google/password/dual-method accounts and F06 race cases. If direct API-host issuance truly requires sharing, the operator must establish that requirement or coordinate callback/API routing first. No legacy cookies were deleted and no sessions were migrated in this batch.

## Changed files in this batch

| File | Purpose |
| --- | --- |
| `.github/workflows/deploy-backend.yml` | Pinned SSH trust, exact revision, serialized fail-fast deployment |
| `server/scripts/deploy-backend.sh` | Remote deployment sequence with guarded install/check/restart/save |
| `server/scripts/check-deployment.js` | Deployment-only runtime, PM2, native dependency and local health checks |
| `server/.gitattributes` | Keep the new Bash deployment script LF on Windows checkouts |
| `server/tests/deploymentSecurity.test.js` | 21 offline policy and shell failure-injection tests |
| `SECURITY_F17_F18_F24_FIX.md` | Results, exact manual checks and blocked cookie/proxy strategy |
| `server/node_modules/**` — 5,599 index removals | Stop version-controlling generated dependencies; physical files preserved |

New deployment helpers are not imported by application request paths. Previously dirty F20–F23 and dictionary files are preserved and excluded from this list.

## Validation and limits

- Full server suite, `node --test --test-concurrency=1 tests/*.test.js`: **343/343 passed**, no failures/skips. Covers F02 Google identity, F05 budgets, F06 credentials, F09 CSRF, F10/F11/F14 passwords/recovery/revocation, F12/F13 counting/rewards, F16 dictionary, F19 logging and F20–F22 regression tests.
- Deployment-specific tests: **21/21 passed**, including failed dirty-tree/fetch/merge/revision/tracked-dependency/PM2/watch/install/tree/native/syntax/catalogue steps never reaching explicit restart, post-restart failures not saving state, and successful order. These execute the actual Bash script against disposable local command stubs, not production commands.
- Isolated `npm ci --omit=dev --engine-strict --no-audit --no-fund`: **passed**, 213 production packages; native bcrypt hash/compare passed. Developer dependencies and reviewed lockfiles were not rewritten. This Windows install does not prove VPS Linux/native compatibility; the deployment guard checks native bcrypt there before restart.
- Production Next build: **passed**, preserving all rewrites/CSP/content. Focused client auth/session/proxy/security-header tests: **81/81 passed**.
- Full client lint: **0 errors**, two existing image warnings in profile/page.js and Header.jsx. Focused deployment JavaScript lint and Node syntax checks passed.
- Workflow YAML parsed; actual workflow run blocks and remote script passed Bash syntax checks. No GitHub-hosted runner invocation/actionlint/live SSH integration was performed.
- `git diff --check` and `git diff --cached --check`: **passed**. Staged removals contain only the 5,599 generated dependency paths. All 22 earlier dirty/untracked files and all 5,599 installed dependency files passed hash comparisons. Logs are outside the repository.

Local mocks and tests cannot establish deployed proxy/IP enforcement, worker budgets, host-key authenticity, firewall reachability, Google Console configuration, cookie scope transition, HTTPS browser behavior or Vercel header/cookie forwarding. F17/F24 and F18 activation remain blocked until the operator provides the evidence above. Earlier reports also retain live-service checks and a development-only dependency advisory snapshot; no fresh npm audit or resolution of those items is claimed here. The security audit cannot be declared complete from these local results. No other findings were started.
