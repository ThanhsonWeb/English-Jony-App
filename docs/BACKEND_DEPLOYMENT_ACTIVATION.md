# Backend deployment activation — Phase 2 candidate

No VPS access, restart, production configuration change, workflow enablement or
deployment is part of preparing this PR. The workflow remains manually disabled.
Production facts below are operator-reported; the repository audit is performed
against merged main `d88f2ee901cb1301493f5ea8721fd294860d71a0`.

## Reported readiness

- Phase 1 is merged; all 360 backend tests passed in GitHub's Ubuntu PR workflow.
- The API runs as the dedicated `studyjony` account; PM2 systemd recovery passed.
- The operator confirmed the current release naming/layout, `.release.json`
  manifest, and PM2's exact release script/cwd are already in place.
- The production environment has six SSH secrets, its health URL, required reviewer
  and main-only restriction. Their values are neither inspected nor changed here.
- GitHub's deployment workflow is manually disabled and merged main still has the
  Phase 1 kill switch until this activation PR is merged by the operator.

A read-only GitHub workflow metadata check on 2026-10-14 independently confirmed
`state: disabled_manually`. No enablement, dispatch or setting change was requested.

## Repository audit

The replacement condition requires the canonical repository, `refs/heads/main`,
either `push` or `workflow_dispatch`, and `needs.test.result == 'success'`. It
rejects PRs, forks, tags, schedules, feature-branch dispatches and unsuccessful
tests. The deployment job still declares `needs: test` and `environment: production`.
GitHub environment approval is an external setting; the YAML cannot prove it is
configured. The existing shell guard independently rejects non-main/PR events.

Unchanged safeguards:

- All backend tests, catalogue validation and syntax checks precede source packaging.
- Artifact SHA/checksums, pinned actions, pinned SSH host identity, fingerprint
  comparison, BatchMode/IdentitiesOnly and strict host checking remain intact.
- SSH is restricted to `studyjony`; the receiver rejects root and wrong users.
- The current-main API check refuses a SHA superseded while approval was pending.
- GitHub serialization and the VPS lock prevent overlapping managed activations.
- Dependencies install into a fresh release before private configuration is linked;
  source hashes are rechecked. The live checkout is not installed over or reset.
- Before switching, PM2 ownership, exact script/cwd, release metadata and the
  configuration/database probe must pass. A journal records the previous release.
- Activation verifies PM2 identity, health, DB ping and unauthenticated `private,
  no-store` responses on loopback and through the configured frontend proxy.
- Startup/check/pointer/save failure restores and verifies the previous release.
  If that fails, both releases and the journal remain with an explicit failure.
- Interrupted-journal recovery restores the recorded release and then fails the
  invocation; it cannot silently proceed to install a different revision.

The release script, PM2 config, SSH steps, secrets and production environment
declaration are not changed by this activation PR. Application/auth/learning code
and database schemas are also unchanged.

## First-deployment checks and risks

| Check or risk | Required action before enabling |
| --- | --- |
| Migration alone does not prove the release layout | Confirm `/var/www/studyjony/current` resolves to a direct `releases/<40-hex-SHA>.<8-alphanumeric-suffix>` directory with `.release.json` and intact source hashes. The script intentionally refuses a plain old checkout or an unmanifested baseline. |
| PM2 identity/path/mode mismatch | Confirm the user's daemon runs exactly one fork worker named `studyjony-api`, watch disabled, owned by studyjony, with cwd/script pointing to that exact release. Check root's saved list cannot resurrect a competing API. |
| Non-interactive SSH PATH differs from an operator shell | Confirm the deployment SSH session can find the verified Node 22.x runtime, npm, PM2, Bash, GNU tools and `flock`, and uses the user's intended PM2_HOME. Systemd recovery alone does not prove this PATH. |
| Configuration ownership or health-port mismatch | Confirm `shared/backend.env` is a regular, studyjony-owned 0600 file with the existing effective production values, correct canonical HTTPS frontend origin and port matching VPS_HEALTH_URL. Never paste its contents. |
| Incomplete activation artifacts | Confirm incoming/releases/shared exist, sufficient disk space is available, and no `deploy-state.json` or stale pointer-update files remain unresolved. Preserve the current known-good release and backups. |
| DB ping is narrower than permission/transaction validation | Retain the previously verified replica-set, index and application-user permission evidence. The ping probe has autoCreate/autoIndex disabled; it does not prove CRUD/index creation privileges. |
| Brief restart outage | Use a controlled first-deployment window and keep console recovery available. The script deletes/starts only the named process; it is not a zero-downtime deployment. |
| Transient public proxy/network failure | A failed public probe can trigger rollback even if the backend is healthy. If the same outage affects the old release, rollback verification may report failure; inspect locally and keep the journal until recovery is confirmed. |
| Hard process/host failure | SIGKILL/power loss cannot guarantee immediate rollback. The last saved PM2 release and the journal provide recovery; inspect before retrying. |
| Rollback and user writes | No DB snapshot is restored automatically. Keep schema/data changes backward compatible or use a separately reviewed migration plan. The first activation PR changes no application schemas. |

Nothing in this repository-only audit establishes an SSH connection or verifies
these host facts independently. Unconfirmed layout/PATH/config/journal checks are
activation blockers, not evidence that the migrated VPS is broken.

## Operator activation checklist — later, with explicit approval

1. Review this PR and its complete green Ubuntu PR checks. Keep the deployment
   workflow disabled throughout review. Do not approve an obsolete SHA.
2. Confirm the first-deployment checks above using existing operator access. Keep
   secrets private and preserve the known-good release, backup and recovery tools.
3. Confirm production reviewers, main-only environment restriction and the six
   environment-scoped SSH settings. Verify `VPS_USER=studyjony` and the host key
   independently. Retain read-only repository permissions and no sudo/root SSH.
4. After separate authorization, merge the reviewed activation PR into main.
   Merging while the workflow is disabled does not itself perform a deployment.
5. Only after separate authorization, enable `deploy-backend.yml` in GitHub. This
   audit never enables it or dispatches a run. Start a manual run on latest main
   for the controlled first deployment; do not rerun an old Phase 1 SHA.
6. Let that run's tests/package job finish. The production job must wait for the
   required reviewer. Check the approved SHA and pending environment before approval.
   If main advances while waiting, start a fresh latest-main run instead of retrying
   an obsolete approval (the current-main check intentionally refuses it).
7. Approve the controlled deployment only when console recovery is available.
   Require successful release/PM2/DB/local-and-public header checks and PM2 save.
   Observe the six established live smoke scenarios with designated test accounts.
8. Retain the prior release and backups. On failure, verify the rollback result;
   on rollback failure, use the documented operator recovery before retrying.

See [the deployment/migration/rollback runbook](BACKEND_DEPLOYMENT.md) for recovery.
No automatic release pruning, database restore or production-secret updates are added.
