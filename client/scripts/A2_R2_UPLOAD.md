# A2 dialogue media upload

Run from `client`. AWS CLI v2 must support `s3api put-object --if-none-match`.
Configure a least-privilege R2 API token through the AWS CLI credential provider
chain; never put credentials in command arguments, source files, or logs. Set
`R2_ACCOUNT_ID` in the process environment to the Cloudflare account ID. The
bucket is fixed to `english-app-media` and keys start with
`a2/dialogue/<course>/<lesson>/`.

First review the local-only plan:

```powershell
node scripts/upload-a2-media.mjs everyday-plans making-plans-after-work --dry-run
```

The plan includes supported media under the lesson directory and matching
thumbnail files. Shared character images outside that directory are excluded.
Dry-run does not contact R2 and cannot determine which objects already exist.

Only after separate approval, use `--upload` in place of `--dry-run`. Each
existing object's SHA-256 metadata is compared with the local hash. A match is
skipped; a mismatch or missing hash stops the run. New objects are written with
`If-None-Match: *` to prevent overwrites. SHA-256 metadata is a comparison hint,
not independent verification of object bytes. A failed run can leave earlier
objects uploaded; inspect the result before retrying. This tool does not change
lesson URLs, delete objects, or publish the application.
