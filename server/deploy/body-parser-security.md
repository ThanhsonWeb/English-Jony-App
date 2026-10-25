# Backend body-parser security fix

Reviewed: 2026-10-25. This change is prepared for review, not deployed.

## Minimal dependency update

Express 5.2.1 already accepts body-parser `^2.2.1`. The server lockfile now
resolves body-parser 2.4.0, fixing
[GHSA-27r3-jxmh-p828](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828).

Only three installed package versions change:

| Package | Before | After | Reason |
| --- | --- | --- | --- |
| body-parser | 2.3.0 | 2.4.0 | Compressed-request crash fix |
| body-parser's content-type | 2.0.0 | 2.1.0 | Required by body-parser 2.4.0 |
| qs | 6.16.0 | 6.16.1 | Required by body-parser 2.4.0; also shared by Express |

No direct dependency, override, Express upgrade, parser option, authentication,
CSRF, proxy, rate-limit, deployment or database configuration changes are included.
Use the committed lockfile with `npm ci`; changing production requires separate approval.

## Regression coverage

`tests/bodyParserSecurity.test.js` loads the real app in short-lived child
processes on random loopback ports. It checks the parser Express actually resolves,
gzip/deflate trailers, valid compressed/uncompressed JSON, malformed JSON, the
existing decoded-body limit, health and unauthenticated private-route denial.

Children do not load server.js or dotenv and receive no inherited database
credentials. They never connect to MongoDB. Existing full-backend tests separately
cover web cookies/CSRF, mobile login/Bearer sessions, logout/revocation, password
changes, vocabulary ownership and deployment rollback using disposable fixtures.

The regression was run before and after the update: the old version failed the
minimum-version and gzip survival checks; all four new checks pass with 2.4.0.

Validation with Node 22.23.2: all 429 backend tests passed, catalogue validation
passed for 1,430 tasks, the media audit found no missing assets, and all 108
JavaScript syntax checks passed. On Windows, the catalogue check first detected
checkout CRLF conversion; validation used the exact committed LF bytes without
changing catalogue content or adding catalogue files to this PR.

## Remaining dependency review

Fresh npm audit after this fix reports **1 high and 2 moderate affected package
entries**. Runtime-only audit (`--omit=dev`) reports **0 high and 2 moderate**.

- **follow-redirects 1.16.0, high:** development-only MongoMemoryServer download
  tooling; absent from the production dependency audit. Review separately:
  [array-header handling](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8),
  [second reported issue](https://github.com/advisories/GHSA-8r9p-f939-6h3c).
- **ip-address 10.7.3, moderate:** runtime dependency through express-rate-limit.
  [Advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5).
- **nodemailer 10.0.15, moderate:** runtime email/address parsing.
  [Nested comments](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8),
  [address groups](https://github.com/advisories/GHSA-m943-m63m-w62w),
  [quoted local parts](https://github.com/advisories/GHSA-85x2-q946-cp5h).

Fixes are reported as available, but are outside this narrowly scoped update.
No audit suppression, forced upgrade or vulnerability acceptance is included.
The audit reports affected packages, not proof that every application path is
exploitable. Refresh and review these findings before a public release.
