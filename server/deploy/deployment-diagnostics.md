# Deployment diagnostics

The existing deployment and database checks keep their original gates, timeouts,
command order and rollback behavior. Diagnostic output adds no database writes or
retries. The logger remains inside check-deployment.js so the existing incoming
upload list remains sufficient.

## Reading a failure

The Bash script emits fixed operation/stage labels to stderr. Operations are
preparation, activation and rollback. Markers identify checks, installation,
configuration links, journal changes, PM2 operations, pointer changes and saving.
They never include expanded commands, arguments, paths or environment values.
The first failed activation marker is printed before rollback starts; a rollback
failure gets a separate marker. Early failures before the existing traps are
installed retain the original exit behavior; the last started marker names the
step. Use the marker together with the workflow's nonzero exit status.

The guard emits JSON events to stderr. For example (illustrative values only):

```json
{"event":"deployment_check","stage":"db.connect","status":"failed","elapsedMs":5002,"category":"server_selection","code":"ETIMEDOUT"}
```

Database stages are db.config, db.connection_setup, db.connect, db.ping,
db.mobile_readiness, db.collection, db.indexes, db.permissions and db.close.
Read the first failed database sub-stage before its parent failure summary.
A later db.close failure is reported separately; the original JavaScript finally
error precedence remains unchanged.

Only predefined categories/codes are emitted. Related DNS/TLS/network codes can
appear in causeCodes; server names, exception messages/stacks, users, privilege
documents and database contents are never serialized. Unknown error properties
are omitted. Output failures do not replace check errors or skip cleanup.

Readiness validation can identify these fixed reasons:

| Code | Inspect privately |
| --- | --- |
| MOBILE_COLLECTION_NOT_READY | Collection type and existing options |
| MOBILE_INDEXES_NOT_READY | Default identity index and completed expiresAt TTL=0 index |
| MOBILE_PERMISSIONS_UNAVAILABLE | Authenticated effective-privilege inspection |
| MOBILE_COUNTER_PERMISSIONS_MISSING | Effective find/insert/update grants |

These codes do not authorize changes. Keep connection strings and private
configuration out of shared output. Do not enable shell tracing or dump complete
environment/PM2 documents to investigate a failure.

## Compatibility and approval

The database selection timeout remains 5000 ms; automatic collection/index
creation remains disabled. The collection/index/privilege rules are unchanged.
Direct callers of the readiness helper remain quiet unless they supply the
optional diagnostic callback. Older mobile readiness helpers ignore that callback
and retain the outer db.mobile_readiness stage. Legacy releases without mobile
files retain their original ping-only gate during rollback.

A diagnostics PR runs tests only. Merging main can trigger the existing production
workflow and must have separate release approval. Deploy a newly tested commit
and its matching artifact to use these diagnostics; rerunning an older workflow
uses its older code. Preserve failed candidates and any recovery journal for
inspection. Do not bypass gates or repeat deployment automatically after failure.
