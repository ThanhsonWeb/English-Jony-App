# Avatar upload intents and account deletion

The avatar endpoint reserves and claims an intent before writing to storage. It attaches a verified upload under the active-account fence and updates the User, new intent, and replaced managed intent in one transaction. The cleanup worker is a separately invoked command; the backend does not start it automatically.

## Tracked uploads and storage identity

Each upload uses a stable server-generated UUID as `operationId` and a unique service-generated storage key. A Cloudinary intent stores the configured Cloudinary account name (`cloudName`) when reserved. Cleanup verifies that the stored account name matches the worker's `CLOUDINARY_CLOUD_NAME`, and validates the stored avatar URL's account identity before deleting. Missing or mismatched identity fails closed. Do not infer the identity of older intents from current configuration; leave them blocked until their account can be established with reliable evidence.

The worker claims an eligible unattached intent before contacting storage. It retries definite failures and holds ambiguous outcomes. Claims do not expire: recovery requires fencing all old workers and proving the old request cannot still execute. Local file cleanup is excluded unless the operator explicitly runs the worker on the upload host with local cleanup enabled.

## Initiation and cleanup

`initiateAccountDeletion(userId)` is an internal service. In one transaction it changes an active account to `deleting`, detaches its currently tracked avatar, and queues eligible cleanup. Duplicate initiation is idempotent. Missing or inconsistent intent tracking fails closed. A legacy avatar without a managed intent is retained and blocks readiness until resolved; it is never silently discarded.

The optional `--deleting-only` worker flag restricts claims to deleting accounts with no unresolved avatar reference; the account check and claim share a transaction. It does not start a scheduler. Without the flag the existing worker still scans all accounts.

The separately invoked cleanup worker processes eligible Cloudinary intents and, only with explicit local-host permission, local intents. An upload that is unfinished or has an uncertain outcome remains tracked and cannot be cleaned. Pending/retrying cleanup, held claims, mismatched storage tracking, and legacy avatars remain blockers. Do not treat elapsed time, a missing response, or a timeout as proof of successful deletion.

Internal cleanup services remove only the deleting account's dependent database records, in bounded transactions and prerequisite order: vocabulary review receipts, vocabularies, topics, dialogue progress, study activity, XP events, dialogue attempts, and definitively completed avatar intents. Each step is account-scoped and retryable. External avatar files are handled only by the cleanup worker.

## Readiness and finalization

`checkAccountDeletionReadiness(userId)` is read-only. It uses a consistent snapshot, checks avatar upload/cleanup/tracking state, and reports remaining counts for avatar intents and account-owned learning records. It is ready only when no dependent records, unresolved avatars, unfinished or uncertain uploads, pending/retrying cleanup, held claims, malformed fields, or inconsistent tracking remain. A caller can pass an existing transaction session so readiness can be reused inside a larger transaction.

`finalizeAccountDeletion(userId)` is an internal service. It runs the preflight and readiness checks, creates the privacy-preserving completion receipt, and deletes the User record in one MongoDB transaction. The target must already be in `deleting` state. Any blocker or transaction failure aborts the whole operation; the receipt and User deletion cannot commit separately. The receipt stores a versioned HMAC of normalized email and completion/expiry timestamps, requires `ACCOUNT_DELETION_RECEIPT_HMAC_SECRET` (at least 32 bytes), and has at most 30 days of retention. MongoDB TTL removal is asynchronous.

The User record remains as a lifecycle tombstone until finalization succeeds. Password accounts may request deletion through `POST /api/v1/users/request-account-deletion` when `ACCOUNT_DELETION_REQUEST_ENABLED=true`; the endpoint requires authentication, same-origin CSRF protection, exact confirmation, and the current password, and rejects Google-only accounts. The profile UI is separately gated by `NEXT_PUBLIC_ACCOUNT_DELETION_UI_ENABLED=true`.

For manual processing, run `node scripts/run-avatar-cleanup.js --deleting-only` first (Cloudinary by default; add `--local-upload-host` only on the upload host for local files). Review the `complete`, `retry`, `held`, and `skipped` counts; held or uncertain claims remain blocked and must not be reset based on elapsed time. Then run `node scripts/run-account-deletion.js --confirm-account-deletion`; it processes at most one deleting account per invocation and can be rerun after resolving blockers. The optional `ACCOUNT_DELETION_SCHEDULER_ENABLED=true` flag starts the account runner every minute after server startup; it does not run the avatar cleanup worker and is disabled unless explicitly enabled.

## Index and rollout notes

`AvatarUploadIntent` declares a unique `(user, operationId)` index, a unique `storageKey` index, and a `(cleanupStatus, updatedAt)` worker index. Its schema enables Mongoose automatic index creation. The main server connection does not disable `autoIndex`, so loading the model after a deployment may attempt to build these indexes. Verify or provision required indexes through the approved rollout plan before enabling avatar-intent traffic; do not rely on application startup as the migration process.

The User model also declares a partial unique index for non-empty string Google IDs. Run the aggregate-only Google ID audit against the confirmed production target and resolve duplicate groups through an approved process before allowing that index to be built. The deletion receipt model declares an `expiresAt` TTL index; provision and verify it before enabling finalization. Existing production database checks do not verify every avatar-intent and receipt index.

Existing legacy intents without verified Cloudinary account identity remain blocked and require evidence-based reconciliation. Never rewrite their identity based only on the currently configured Cloudinary account.