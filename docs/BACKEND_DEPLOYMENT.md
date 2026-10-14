# StudyJony backend deployment — Phase 1

Status: repository preparation only. The `deploy` job has the literal condition
`if: ${{ false }}`. Neither a secret nor a repository variable enables it. Do not
enable the disabled GitHub workflow, migrate PM2, or remove this guard until the
operator approves Phase 2. Tests may run on a feature PR; production cannot run.

## Architecture

One dedicated account, `studyjony`, owns both deployment and the API's PM2 daemon.
It has no sudo, Docker-group access, or root SSH key. An administrator performs
the one-time account/startup setup through the trusted console. Routine deployment
uses only the non-root SSH key, pinned server identity, npm, Node, and that user's
PM2. Keep Nginx, verified port, cookies, CSRF, database credentials and data unchanged.

```
/var/www/studyjony/
  incoming/<sha>-<run>-<attempt>/  # verified SSH uploads; never served
  releases/<sha>.<random>/        # each source/dependency installation is separate
  shared/backend.env             # real values, owner studyjony, mode 0600
  shared/local-avatars/           # only if production has mutable local uploads
  current -> releases/<sha>.<random>/
  previous -> releases/<sha>.<random>/
  deploy.lock
  deploy-state.json               # present only during activation/recovery
```

PM2 uses the exact release script and cwd, not the `current` symlink. Its config
is a single fork worker with watch disabled. Confirm the current API uses this
worker count/mode; if not, stop and review the config instead of silently changing
concurrency or per-worker rate limits. A switch briefly stops the named process;
this is not a zero-downtime or blue/green deployment.

The workflow tests the exact commit on Ubuntu/Node 22.23.2 using disposable MongoDB.
It verifies the committed Dialogue/Story catalogue against its frontend inputs,
then builds a deterministic JSON source bundle with full SHA and per-file hashes.
The bundle includes `server/`, the dialogue `_data/` tree, the course configuration
tree and the localization module needed by the catalogue checker. It excludes installed packages and rejects
environment files, private-key files, local uploads, symlinks and unsafe paths.
No production configuration enters GitHub artifacts or CI test jobs.

After approval, the same run's artifact is uploaded using pinned SSH trust. The
workflow rejects an approval if main has advanced since that run was tested. The
VPS takes a non-blocking lock, verifies the hash and commit, extracts into an empty
new directory, and runs production `npm ci`, dependency/native/syntax/catalogue
checks. It links the shared environment only after dependency lifecycle scripts
finish. A read-only database ping uses `DATABASE` from this file, with auto-create
and auto-index disabled on the probe. This probe does not prove all write privileges
or transaction semantics; the separately verified production DB preflight remains
required. The application itself retains its existing model/index behavior.

## Before Phase 2

- Retain the verified application/database backups and the current root PM2
  definition securely. Hash equality proves transfer integrity; also confirm the
  restore procedure and that the backup contains configuration and native packages.
- Confirm the actual PM2 script, cwd, interpreter, worker mode/count, port and all
  configuration sources. Do not share full PM2 JSON, `.env`, or private keys.
- Ensure Node 22.23.2, npm, PM2, Bash, GNU coreutils/findutils and `flock` are
  accessible to the new account. A Node installation inside `/root/.nvm` is not
  suitable for that account or its boot service. Do not upgrade unrelated services.
- Confirm the verified Node port is usable by a non-root process. Do not grant
  broad capabilities or alter the reverse proxy to work around an unknown port.
- Verify the application DB user's CRUD, createCollection/createIndex, and index
  inspection permissions on the actual application database, including the new
  receipt/session collections. Do not substitute an administrator connection or
  grant cluster-wide administration. Replica-set/session/index verification is
  already reported complete by the operator; validate that it used this identity.
- Reconcile PM2-injected values with the existing `.env` privately. The new shared
  file is the authoritative secret source. Preserve effective values, including
  `DATABASE`, JWT/OAuth/SMTP/Cloudinary values, `FRONTEND_URL`, and `PORT`. Set
  `NODE_ENV=production`. Never put secrets in the committed ecosystem config.
- Inventory mutable files and symlinks. Cloudinary data stays where it is. If local
  avatars exist, move/copy them into shared storage after stopping writes.
- Confirm there is space for two good releases plus a candidate and that releases
  are on the same filesystem as the activation pointers. Do not delete old checkouts.

## One-time migration — administrator and operator, after approval

These are instructions, not Phase 1 actions. Use the trusted VPS console or an
existing authenticated administrator with interactive sudo; never enable root SSH.

1. Pause automatic deployment and establish a controlled maintenance window. Keep
   the old root process available for rollback. Preserve its environment/definition
   privately; do not use `pm2 kill`, `delete all`, or `unstartup` against root's other apps.
2. Create `studyjony` with its own home and login shell, no sudo membership. Create
   `/var/www/studyjony/{incoming,releases,shared}` owned by that account, mode 0700.
   Set `shared/backend.env` to the reconciled production values, mode 0600, owned by
   studyjony. Install a dedicated public SSH key; the `restrict` authorized_keys
   option disables forwarding/PTY while permitting the workflow's SSH/SCP commands.
   Restrict this account's filesystem access to its own home/application directory.
3. On a trusted checkout, build the already tested production baseline using the
   new artifact tool (do not build from a dirty working tree or package `.env`):

   ```bash
   node server/scripts/release-artifact.js build \
     9c7c077da34786f5acf6ac28749fbcd1f9bbe52f baseline.json
   ```

   Upload the bundle and its checksum, plus Phase 1's `release-artifact.js`,
   `check-deployment.js` and `ecosystem.config.cjs`, into a private bootstrap inbox.
   Baseline application code stays at the deployed revision; control tools come
   from the reviewed Phase 1 revision. No repository credentials are needed on VPS.
4. As `studyjony`, set the verified loopback URL and bootstrap paths. Create the
   release with `mktemp -d /var/www/studyjony/releases/<full-sha>.XXXXXXXX`. Run:

   ```bash
   node "$INBOX/release-artifact.js" extract "$INBOX/baseline.json" \
     "$VERIFIED_CHECKSUM" "$BASELINE_SHA" "$RELEASE"
   cd "$RELEASE/server"
   npm ci --omit=dev --engine-strict --no-audit --no-fund
   npm ls --omit=dev
   node "$INBOX/check-deployment.js" --dependencies "$RELEASE"
   npm run dialogue:catalogue:check
   node "$INBOX/check-deployment.js" --config /var/www/studyjony "$RELEASE"
   ln -s /var/www/studyjony/shared/backend.env "$RELEASE/server/.env"
   node "$INBOX/check-deployment.js" --database /var/www/studyjony "$RELEASE"
   ```

   Set variables to verified values, not guessed ports/paths. Link shared uploads
   if required. Validate syntax as the workflow does. No new API process has started yet.
5. As root's existing PM2 owner, stop only `studyjony-api`. As `studyjony`, start it:

   ```bash
   env -i HOME="$HOME" PATH="$PATH" PM2_HOME="$HOME/.pm2" NODE_ENV=production \
     STUDYJONY_RELEASE="$RELEASE" \
     pm2 start "$INBOX/ecosystem.config.cjs" --only studyjony-api
   pm2 jlist | node "$INBOX/check-deployment.js" --pm2 "$RELEASE"
   node "$INBOX/check-deployment.js" --health
   node "$INBOX/check-deployment.js" --database /var/www/studyjony "$RELEASE"
   node "$INBOX/check-deployment.js" --private-api
   node "$INBOX/check-deployment.js" --public-api /var/www/studyjony "$RELEASE"
   ```

   Verify public routing/private headers and the same six live smoke scenarios
   using designated test accounts. If anything fails, stop/delete only this user's
   named app and restart root's preserved named app without changing its environment.
6. Only after success, create `current` pointing to this release and `pm2 save` as
   studyjony. Generate and inspect PM2's user-specific systemd startup command
   (`pm2 startup`, then administrator executes the reviewed command for `-u studyjony`
   and its home). Check the unit's interpreter path, user and saved process list.
7. Delete only `studyjony-api` from root's PM2 list and run root's `pm2 save` so it
   cannot respawn at boot and claim the same port. Preserve other root applications.
   Keep the old checkout/definition until the migration and boot-restoration checks
   are accepted. Root-to-user rollback remains an explicit administrator procedure.

## GitHub setup and activation — separate approval

The workflow file can run tests when enabled, but its production job remains
hard-disabled. Phase 1 does not call the API to enable the workflow or change settings.

- Configure a `production` environment restricted to main. Put VPS_HOST, VPS_PORT,
  VPS_USER (`studyjony`), VPS_SSH_KEY, VPS_KNOWN_HOSTS and VPS_HOST_KEY_SHA256 in that
  environment, and set its VPS_HEALTH_URL variable to the verified loopback URL.
  Confirm the public host key/fingerprint independently; no `ssh-keyscan` trust.
- Configure required reviewers and check that approval actually blocks access to
  secrets. Availability depends on repository visibility/GitHub plan. If required
  reviewers are unavailable, keep the literal kill switch and review a manual-only
  activation design; `environment: production` alone does not impose approval.
- Review repository branch permissions because main deployment code can run with
  application privileges. This account intentionally has no host administration.
- After non-root migration, boot restoration and fault tests pass, use a separate
  activation PR to replace `if: ${{ false }}` with an explicit main/non-PR condition.
  Only then enable the workflow if it is disabled. The shell also rejects non-main.
- Vercel has independent deployment timing. API/lesson changes requiring a new
  backend must coordinate the frontend rollout; this workflow cannot delay Vercel.

## Release activation and rollback

The deployment records `{previous, candidate}` in `deploy-state.json` before
changing PM2. It starts the candidate with exact script/cwd/interpreter and a clean
CLI environment. It verifies one online worker, the intended release, loopback
health, a read-only database ping and an unauthenticated 401 with `private, no-store`
both directly and through the configured HTTPS frontend proxy. Public probes send no cookies.
Only then does it update `previous`/`current`, save PM2 state and remove the journal.

- An install/config/preflight failure leaves the old process and current pointer alone.
- A restart/health/DB/header/pointer/save failure restores the recorded release,
  verifies it again and saves that state. The workflow still fails clearly.
- If rollback fails, both releases and the journal remain; the job reports
  `DEPLOYMENT AND ROLLBACK FAILED`. Use the trusted console for recovery.
- ERR/INT/TERM/HUP are handled. SIGKILL, machine failure or complete connectivity
  loss cannot guarantee immediate rollback. A leftover journal is recovered on the
  next explicit deployment invocation, which then fails rather than installing a
  different release. Verify recovery before rerunning. Reboot uses the last PM2 save.
- No automatic DB restore or destructive migration is run. Code rollback is suitable
  only when intervening data writes remain compatible. Review schema/reward changes
  before approval; restoring a DB snapshot could erase new user progress.
- No automatic pruning is performed. Retain the last good releases and backups.
  Inspect disk use and remove only explicitly reviewed, inactive release directories.

For manual recovery as `studyjony`, get PREVIOUS from the private journal (or the
validated previous link), validate it with `--release`, then delete only the named
app, start it with STUDYJONY_RELEASE=PREVIOUS and the reviewed ecosystem config,
and repeat PM2/health/DB/private-header checks. Repair `current` using a temporary
symlink and atomic rename, save PM2, and remove the journal only after success.
Never source the journal as shell code or share its associated environment files.

## Local validation

Run `node --test --test-concurrency=1 tests/*.test.js` from server. The deployment
suite executes the real Bash state machine with disposable npm/PM2/health/database
stubs and real artifact/path/file operations. It tests root refusal, locking,
artifact checksums, bad release identity, failed install and validation, wrong PM2
paths, rollback, save failure, failed rollback and interrupted-deployment recovery.
No fixture contacts the VPS, GitHub, production DB, or live providers. Linux CI
still must prove actual npm/native dependency and PM2/systemd integration before
production activation. Local simulations are not live migration evidence.
