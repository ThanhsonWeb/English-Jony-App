# Mobile login production prerequisites

## MongoDB (prepare before deploying a mobile-enabled release)

The existing deployment `--database` gate now also checks mobile login readiness,
both before switching releases and after startup. An older release without the
mobile feature retains its original ping check, including during rollback.
The checks do not create collections/indexes, change roles, or write probe rows.

An operator must use a separately approved provisioning account in the verified
application database to prepare:

- A normal collection named `mobileloginwindows`, with the default `_id_` index.
- A completed single-field `{ expiresAt: 1 }` TTL index with
  `expireAfterSeconds: 0`. It must not be partial, sparse, hidden, or unique.
- The application's actual database account must have `find`, `insert`, and
  `update` on this collection. Readiness also requires `listCollections` on the
  application database and `listIndexes` on this collection. The checker uses
  `connectionStatus` with `showPrivileges: true` to inspect effective grants.
  It does not print the returned users or privilege documents.

The mobile model disables automatic collection/index creation, so mobile runtime
does not require `createCollection`, `createIndex`, or `remove` for its counters.
Do not change other models or remove permissions needed by existing web features.
Unavailable privilege inspection, unauthenticated connections, missing indexes,
unfinished builds, incompatible collection options, and missing write grants all
fail the gate. Do not bypass it or use an admin account just to make it pass.

Run the existing `--database BASE SELECTED_RELEASE` check through the deployment
procedure using its private shared configuration. The standalone
`npm run verify:production-db` additionally uses its explicitly supplied
`MONGODB_URI` (never a fallback); use the same application principal, and keep
connection strings out of terminal history and shared output. It still checks
the existing transaction/index prerequisites and now also checks mobile readiness.

TTL deletion is asynchronous. Counter windows expire logically in the limiter;
security does not depend on immediate deletion. Monitor collection growth, index
health, and permission drift after deployment. Do not remove the shared collection
when rolling back: another mobile worker may still need its counters.

## Proxy/client IP: implemented for the operator-reported Nginx path

On 2026-10-19 the operator reported these VPS findings (not independently checked
by this local implementation):

- `api.studyjony.com` and the VPS outgoing public IP are `162.4.177.199`.
- Nginx forwards to `127.0.0.1:5000`, sets `X-Real-IP`, and appends `X-Forwarded-For`.
- No Cloudflare headers were observed; UFW blocks public access to port 5000.

Express now trusts only socket peer `127.0.0.1` (including Node's mapped form
`::ffff:127.0.0.1`), and only at hop zero. It does not trust another forwarded hop,
the public VPS address, all private networks, all loopback addresses, or CDN
headers. The actual appended client is therefore the rightmost X-Forwarded-For
value; arbitrary values supplied before it cannot select another identity.

Mobile login now keys its existing 60-attempt/15-minute budget by Express `req.ip`.
Different external IPv4 clients behind this Nginx receive separate budgets;
IPv4-mapped aliases normalize to the same key and IPv6 retains /56 grouping to
limit address rotation. The independent 10-attempt/15-minute account budget and
MongoDB counter storage remain unchanged. `X-Real-IP`, `Forwarded`, and
`CF-Connecting-IP` are not alternative identity sources. Invalid selected IPs
fail with a generic 503 before counter or password operations.

Non-Nginx direct peers cannot replace their address with forwarding headers.
Local callers are inside the proxy trust boundary: a process able to connect
from 127.0.0.1 can impersonate Nginx, so host access must remain restricted.
Missing X-Forwarded-For falls back to the socket peer and aggregates that traffic;
Nginx must consistently append the actual connection source for client isolation.

### Remaining production verification before release

1. Inspect the effective API location and inherited real-IP directives. Confirm
   the appended address is the actual connection source, not a client-controlled
   header substituted by an untrusted `real_ip` configuration. No proxy rules or
   firewall rules were changed by this implementation.
2. Confirm the actual Node socket peer is 127.0.0.1 and port 5000 is inaccessible
   externally on IPv4 and IPv6, including provider/container paths. Main now binds
   Node to `127.0.0.1`. The operator reports the port-5000 issue is fixed; verify
   the running release and external reachability before deployment.
3. Confirm whether any other ingress/CDN/load balancer exists. Absence of
   Cloudflare headers alone does not prove there is none. An extra proxy remains
   the client identity until its behavior is verified; do not extend trust blindly.
4. After separately approved activation, check from two external client networks
   that budgets are separate and forged XFF prefixes/X-Real-IP/Forwarded headers
   do not reset them. Confirm web password login, OAuth, logout, and CSRF behavior
   through the real HTTPS path. Local tests do not certify these live checks.
5. Run MongoDB readiness using the application account and inspect the actual PM2
   worker/release configuration. Mobile counters are shared in MongoDB; existing
   web limiters still have their existing per-worker behavior.

### Read-only commands for the VPS operator

These commands are for later inspection on the VPS; they have not been run here.
Use the administrator account that normally inspects Nginx and firewall settings.
They do not reload Nginx, restart Node, change firewall rules, or deploy a release.
If a command is unavailable or access is denied, report that result; do not install
tools, change permissions, or enable services just to collect the output.

Inspect relevant Nginx directives without printing the full configuration:

```bash
sudo nginx -T 2>&1 | awk '
  /^# configuration file / { print; next }
  /^[[:space:]]*(listen|server_name|upstream|server|location|proxy_pass|real_ip_header|set_real_ip_from|real_ip_recursive)[[:space:]]/ { print; next }
  /^[[:space:]]*proxy_set_header[[:space:]]+(Host|X-Forwarded-For|X-Real-IP|Forwarded|X-Forwarded-Proto|X-Forwarded-Host|Origin|Referer)[[:space:]]/ { print }
'
```

This is a summary, not proof of the active proxy chain. Inspect complete relevant
blocks locally for inherited settings. If Nginx uses a custom configuration path,
prefix, or container, inspect that verified instance instead of assuming the default
command targets it. `-T` reads/tests the on-disk configuration; it does not prove
that the running workers have loaded that revision. Review results locally and
redact credentials, private paths, and sensitive values before sharing excerpts.

Inspect listening addresses and process names without command arguments or env:

```bash
sudo ss -ltnp
ps -eo pid,ppid,user,comm
```

Inspect the firewall tool(s) already used on the host:

```bash
sudo ufw status verbose
sudo nft list ruleset
```

For a host using legacy iptables instead of nftables:

```bash
sudo iptables -S
sudo ip6tables -S
```

Check cloud firewall/security-group rules in the provider's console as well.
An inactive UFW, an unavailable command, or a successful loopback health check
does not establish that the backend port is protected. Do not paste `.env`,
`printenv`, `/proc/*/environ`, full `pm2 jlist`, or full Nginx dumps into chat.
CDN/load-balancer trust ranges and forwarding behavior must also be verified
from the actual provider settings; these host commands cannot establish them.

References: [MongoDB connectionStatus](https://www.mongodb.com/docs/manual/reference/command/connectionstatus/),
[MongoDB resource scope](https://www.mongodb.com/docs/manual/reference/resource-document/),
[Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/),
[Nginx command-line parameters](https://nginx.org/en/docs/switches.html).
