# F02: Google identity and email account collisions

## Scope and confirmed cause

Only Security Finding F02 is addressed. The original `SECURITY_AUDIT.md` remains an audit snapshot.

The callback previously selected `User.findOne({ email })` after Google token verification. It did not check `email_verified` or the stored provider subject. A password account created with someone else's email could therefore become the account the real Google owner entered, while the attacker's password remained valid. An already-bound Google account could also be selected by a different subject using its email. The profile API permitted an unverified replacement email as another way to create a collision.

## Chosen policy

1. Keep Google library signature, issuer, audience and expiration verification, OAuth state validation, fixed redirects, and existing session guards.
2. Require a valid string `sub`, a valid email string, and boolean `email_verified: true` before database lookup. Strings such as `"true"` do not qualify.
3. Identify an existing Google account by the exact stored `googleId`, never by email. A changed provider email does not change the StudyJony account's email or select another account.
4. If no subject-bound account exists and the normalized email is unused, create a Google-only account with that verified subject.
5. If the email is already used, **reject the callback with no JWT or account mutation**. This applies to password-only collisions and an email bound to a different Google subject. Being signed into the colliding account is not implicit linking consent.
6. If multiple existing records share a subject, reject rather than choose an arbitrary account. No automatic merge, deletion, password removal, or learning-data transfer occurs.
7. Profile name edits remain available. `/users/updateMe` rejects actual email changes with `400 / emailChangeRequiresVerification`; an unchanged email, including case/whitespace normalization, is ignored safely. There is no existing verified email-change flow.

This follows [Google's guidance to identify users by `sub`](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token). A verified email claim alone is especially insufficient to transfer ownership of a third-party email account.

### What happens in the pre-registration attack

The victim's Google callback stops at an account conflict. It never authenticates as, links to, or adopts the attacker's password account. The attacker can still sign into the rejected, separate password account until verified recovery/reconciliation is performed. **This fix does not claim that the victim can immediately complete Google login for a colliding email.** That deliberate denial preserves existing accounts while removing the unsafe shared identity.

No self-service linking endpoint is introduced. The localized conflict message explains that no accounts were linked and directs a legitimate existing account owner to the existing login method, or to StudyJony for ownership verification. Unknown callback errors remain mapped to the generic localized failure.

## Existing-account compatibility

| Existing state | Result |
| --- | --- |
| Password-only account, ordinary signup/login | Unchanged; Google with its email is a conflict, not an automatic link. |
| Google-only account, same verified subject | Login and `/users/me` continue using the existing account and learning data. Password login still returns controlled 401. |
| Google-only account, different subject but same email | Rejected; no JWT or identity change. |
| Both password and Google identity, same verified subject | Both existing methods remain available. Google login does not modify the password/name/data. |
| Bound subject now supplies a different verified email | Original subject-bound account is used, even if that email belongs to another StudyJony account; no email update or merge. |
| Unverified/missing/ill-typed verification claim | Rejected, including for already-bound accounts. |
| Duplicate legacy `googleId` | Google login blocked pending manual reconciliation. Other legitimate sign-in methods are not silently removed. |
| API client previously changing email through profile updates | Actual email changes now rejected. Current Profile UI only edits the name. |

## Sessions

The callback does not change existing ownership or authentication credentials, so a rejected collision does not revoke an unrelated logged-in account. It clears only OAuth state/locale cookies and does not issue or clear the JWT. Successful subject-based login uses the existing JWT creation/password-session markers.

Password changes and token-based password recovery still rotate `passwordSessionVersion` and maintain `passwordChangedAt`. Tests prove that verified recovery of a colliding password account invalidates the original password and JWT, and that changes on an existing dual-method account revoke both its old password-login and Google-login sessions while replacement sessions work.

The client session-generation, profile-response guards, shared initial/OAuth session restoration, and single-navigation guards are not weakened or refactored. This patch does **not** retroactively identify/revoke historical JWTs issued through unsafe email matching. Those tokens have no provider-subject provenance; suspected accounts require reconciliation and session-version rotation.

## Reconciliation plan — not executed

No production service is contacted and no data migration/index change runs automatically.

1. In an authorized maintenance task, inventory subject duplicates, password-only email collisions reported by owners, dual-method accounts, and suspicious binding/email history. Current data alone cannot prove which historical passwords were authorized.
2. Verify the intended owner through independently trusted evidence. A matching email string or the colliding account's password alone is insufficient for a reported pre-registration incident. Google `sub` must be verified again. For third-party email ownership, use an independent fresh email challenge when needed; Google may not be authoritative for that mailbox.
3. Resolve a collision explicitly with the verified owner. Keep legitimate learning data and stable ownership IDs. Do not merge distinct people's data just because an email matches. Decide whether to retain the original account, quarantine a pre-created account, or associate the verified subject with a recovered account.
4. For any approved ownership/binding recovery, remove/replace unauthorized password access and outstanding reset credentials, and rotate the password/session version before issuing a new session. Changing `googleId` alone does not revoke existing tokens. Verified password reset already revokes old sessions through the shared model hooks, but does not itself link Google.
5. Review existing dual-method accounts if compromise is suspected; preserve legitimate methods after verification. The patch retains previously stored bindings rather than asserting that all historical bindings/passwords were legitimate.
6. After reviewing and resolving duplicates/empty legacy IDs, plan a manually approved partial unique index for valid Google subjects. This patch deliberately adds no auto-built unique index that could fail on production duplicates. Current lookup rejects ambiguity. The existing unique email index handles simultaneous callbacks for the same email; simultaneous same-subject creation with different emails is not a database-enforced uniqueness invariant yet.
7. Validate revoked old sessions and valid replacement sessions through `/users/me`, then verify learning-data ownership/counts and both locale callback paths.

F03 and other security findings are unchanged. The isolated recovery test proves token possession/session invalidation; it does not establish that production email delivery or reset-link origin is secure. Review those separately before relying on a deployed recovery process for an incident.

## Files changed

- `server/controllers/authController.js`: verified-claim validation; subject-first lookup; collision/ambiguity rejection; safe duplicate-email race failure; reject unverified email changes.
- `client/app/[locale]/(auth)/oauth/google/callback/page.js`: preserve the allowlisted account-conflict code while keeping unknown errors generic and existing restoration/navigation guards.
- `client/app/[locale]/(auth)/login/page.js`: show localized account-conflict feedback in the existing alert.
- `client/messages/en.json`, `client/messages/vi.json`: one conflict message per locale.
- `server/tests/googleIdentity.test.js`: isolated database and mocked Google integration coverage.
- `server/tests/authenticationFailures.test.js`: realistic boolean verified-email claims in successful Google fixtures.
- `server/tests/passwordSessions.test.js`: verified-email fixtures; the password-change Google test now uses an already-bound dual-method account instead of relying on unsafe automatic linking.
- `client/scripts/tests/browser/test-google-identity-browser.cjs`: local-only mocked callback/UI browser tests.
- `SECURITY_F02_FIX.md`: this implementation and compatibility record.

## Tests and deployment verification

All backend integration tests use disposable MongoDB instances. Google token exchange/verification is mocked; no real Google account, mail delivery, production database, or migration is used.

- **Full server suite: 178/178 passed** with `node --test tests/*.test.js`. Includes 26 focused Google identity tests plus existing password sessions, authentication failures, profile names/themes/avatar, vocabulary ownership, SRS/reviews, XP, Dialogue/Story progress, streaks/heatmap and catalogue coverage.
- **Relevant client suites: 81/81 passed** with `node --test scripts/tests/unit/auth-session-guard.test.mjs scripts/tests/unit/session-restore.test.mjs scripts/tests/unit/password-login.test.mjs scripts/tests/integration/theme.test.mjs scripts/tests/unit/dialogue-progress-save.test.mjs scripts/tests/unit/latest-dictionary-lookup.test.mjs scripts/tests/unit/vocabulary-events.test.mjs`.
- **New F02 browser suite: 60/60 scenarios passed** with `node scripts/tests/browser/test-google-identity-browser.cjs`. Tests account conflict, an unknown/sanitized callback error, and successful callback at 320/375/430/768/1280px, VI/EN, light/dark. Checks localized feedback, a valid pre-existing session not bypassing a failed callback, exactly one callback navigation, horizontal overflow in error UI, and no console/hydration/runtime errors.
- **Existing OAuth/session browser suite: final rerun 32/32 cases passed** with `STUDYJONY_TEST_WIDTHS=320,1280 node scripts/tests/browser/test-sound-oauth-browser.cjs`. VI/EN and light/dark coverage includes direct callback load, single shared session read, refresh, cancellation, invalid state, malformed/4xx/5xx/network responses, slow/fast restoration order, expired previous session, logout then Google login, and stale response protection after logout/account switching. Its temporary auth probe route was removed by the test cleanup.
- Focused ESLint for the two changed pages and new browser script passed. Node syntax checks for the controller and both new test scripts passed. `git diff --check` passed.

Playwright uses the existing external npm cache via `NODE_PATH`; no dependency was installed. Earlier attempts at the existing broader browser suite encountered a local resource 500 and then dev-server connection refusal/reset; the final rerun passed. These failed attempts are kept separate from passing runs; no unrelated application changes were made to suppress them.

Live Google/deployment verification still needs a controlled test account: configured client ID/audience/redirect URI, real boolean verification claims and stable subject, HTTPS/state/session cookie behavior, VI/EN callback routes, session restore after refresh, cancellation, collision feedback, and existing account data. This work does not deploy the change.
