# StudyJony — F12, F13 and F16 remediation

## Scope and result

Implemented only F12 (standalone study counts), F13 (Dialogue/Story reward attempts), and F16 (dictionary resource controls). No deployment, production database access, real Google verification, real translation requests, paid-provider traffic, dependency installation, or stress testing.

Previous authentication, password recovery, session revocation, ownership, CSRF, dependency and regression fixes remain in place. F17/F24 deployment configuration is unchanged.

## F12 — Activity comes from committed reviews

**Confirmed cause:** `recordActivity` incremented `StudyActivity.count` for any authenticated POST; the vocabulary client sent this separately after saving a review. That claim had neither a learning record nor retry identity.

**Fix:**

- Standalone `POST /api/v1/study-activities` returns controlled **405** without modifying data. GET remains available, with existing authentication, CSRF and learning limits.
- Each accepted client review gets a UUID v4 `reviewId`. The HTTP review endpoint requires it.
- A durable `VocabularyReviewEvent` receipt uses SHA-256(user ID + review ID) as its unique identifier. A hash binds it to the word, mode, answer/rating and practice flag. It stores no answer/meaning text.
- Receipt, SRS save, qualification, non-practice count increment and XP commit in the existing MongoDB transaction. Failure rolls all of them back, using MongoDB's [multi-document transaction support](https://www.mongodb.com/docs/manual/core/transactions/).
- Same-event retries return current vocabulary and zero new XP, without advancing SRS, incrementing activity or qualifying another day. Reusing an ID with another payload/word returns 409.
- Internal service callers can begin a fresh event automatically; external HTTP callers cannot bypass the required identity.
- New activity documents default to count 0. Existing stored counts remain unchanged.

**Semantics preserved:**

| Learning action | Legacy vocabulary count | Qualified study | XP |
| --- | --- | --- | --- |
| Non-practice vocabulary review, including incorrect/Again | +1 per committed event | Yes | Existing correctness/rating rules and daily cap |
| Practice vocabulary review | No increment | Yes | Existing daily-limited rules |
| Valid Dialogue/Story completion or genuine replay | No increment | Yes | Fixed 10 XP for first eligible completion; zero on replay |
| Retry of the same completed event/attempt | No increment | No new qualification | Zero new reward |
| Page visit, attempt start, standalone activity claim | No increment | No | None |

All day keys retain **Asia/Ho_Chi_Minh**. Tests cover retries across Vietnam midnight, adjacent qualified days, mixed activity, the Profile heatmap, incorrect reviews and the one-hour SRS retry.

A self-rated vocabulary review remains an intentional product action. Its correctness/human participation cannot be proved; this change removes the separate arbitrary count claim and makes actual server review commits idempotent.

## F13 — Issued attempts and checked completions

**Confirmed cause:** the progress PATCH accepted a known task ID without an attempt or answer. Existing fixed reward and replay checks were correct.

**Inspection:** the published catalogue has **613 tasks**: 460 fillBlank, 129 multipleChoice, 24 dialogueCloze. The supported arrangeWords and review components were also inspected.

**Fix:**

1. Authenticated `POST /api/v1/dialogue-progress/:lessonId/:dialogueId/tasks/:taskId/attempt` validates active catalogue membership and issues a cryptographically random 32-byte identity.
2. MongoDB binds each attempt to the authenticated user and complete course/dialogue/task tuple. Attempts expire in **10 minutes**, with a TTL index for cleanup; eligibility also checks expiry explicitly.
3. Still-open attempts can be reused, preserving their start time. Attempt starts/visits do not award XP or qualify study.
4. The completion PATCH requires that identity and the relevant proof:
   - fillBlank: every answer passes the existing punctuation, number, apostrophe and hyphen matching rules;
   - multipleChoice: the original correct option index, independent of localized display text;
   - arrangeWords: sentence matching with the existing case/punctuation/spacing rules;
   - dialogueCloze: every blank matches the existing case/trim rules;
   - review: explicit `acknowledged: true`, retaining self-confirmed reading behavior.
5. Minimum elapsed attempt time is **500 ms** for objective tasks and **2 seconds** for reading review. This is an automation bound, not evidence of listening or learning.
6. Consumption happens inside the same transaction as progress, qualification and XP. A failed transaction leaves the attempt retryable. A lost-response retry cannot qualify a new day.
7. Existing XP award keys, fixed amounts, vocabulary daily cap, legacy completion handling, inactive/unknown rejection and replay behavior remain intact. Caller XP/user fields never control rewards.
8. Attempt issuance is limited to **180 requests per authenticated user per 10 minutes**, shared across task IDs. Both start and completion also spend the existing **600 learning writes/user/10 minutes** and transport-peer budget. Existing generous read limits remain separate.
9. The shared client save path starts an attempt in the background, submits the learner's completion data, keeps it for Retry, and renews expired attempts without asking learners to repeat answers. Save/Continue/error UI and session-generation guards remain.

**Realistic limitation:** answers are already public, and reading review is self-confirmed. A script can still submit correct public answers through the bounded attempt flow. This prevents direct task-ID claims and supplies identity, timing, validation, rate limits and atomic replay protection; it does not prove human learning. No new curriculum sequence restriction was imposed on the existing free task navigation.

## F16 — Bounded dictionary/provider work

**Confirmed cause:** initial misses were not coalesced; the cache had no entry cap or active expiration; translation had no explicit wrapper timeout; background dedupe alone did not protect initial work/cost.

| Policy | Implemented value |
| --- | --- |
| Accepted input | Normalized Latin-script word/short phrase, apostrophes/hyphens/spaces; up to 64 characters and 8 words; bounded raw input |
| Initial miss coalescing | One shared operation per normalized key |
| Cache | LRU, maximum 2,000 entries |
| Successful/partial cache TTL | 24 hours, retaining the original creation expiry |
| Failed provider-result TTL | 30 seconds |
| Active expiry cleanup | Every 60 seconds; timer does not keep Node alive |
| Background retry cooldown | 5 minutes per cached entry |
| Provider jobs concurrently active | Maximum 8; foreground/background share slots |
| Pending foreground queue | Maximum 32; 1.5-second queue deadline |
| Background work under saturation | Skipped, then eligible after cooldown |
| Process provider-job admission budget | 600 jobs per rolling 10 minutes, including enrichment |
| Dictionary HTTP deadline | 900 ms foreground; 5 seconds enrichment; abort losing requests |
| Google Translate | Native 3-second HTTP timeout verified in the installed SDK; [automatic retries disabled](https://docs.cloud.google.com/nodejs/docs/reference/translate/latest/translate/v2.translateconfig) |
| Caller wait deadline | 8 seconds; controlled 503 with Retry-After on unavailability |
| Dictionary HTTP body | Maximum 64 KiB per provider response |
| Cached fields | Explicit length bounds for meanings, examples, pronunciation, audio URLs and part of speech |

Cached results bypass expensive-work admission. Concurrent failures are coalesced, and provider failure is briefly cached. Dictionary HTTP requests use [AbortController cancellation](https://nodejs.org/api/globals.html#class-abortcontroller). An uncooperative provider that outlives the caller deadline retains its active slot until the underlying operation ends, preventing timed-out callers from spawning unlimited replacement work.

Public GET access and the existing general API limiter remain. Existing local dictionary data/generators, valid lookup fields, pronunciation/audio behavior and asynchronous example enrichment are preserved. MiniDictionary displays localized VI/EN validation/unavailable errors; its existing desktop-only visibility is unchanged.

## Learner-visible changes

- Review counts now follow successful server review commits; a failed save cannot leave a phantom count.
- Extremely fast lesson completion may briefly show the existing Saving state while the minimum attempt time finishes.
- Expired lesson attempts renew automatically using the entered answer. Offline/429/server failure still shows the existing localized Retry flow.
- Dictionary rejects invalid/overlong inputs with localized guidance. Provider saturation/unavailability returns a retryable failure.
- No layout, typography, learning content, curriculum navigation or audio redesign.

## Files changed

### Application/server

- `server/controllers/studyActivityController.js`
- `server/controllers/vocabularyReviewController.js`
- `server/controllers/dialogueProgressController.js`
- `server/controllers/dictionaryController.js`
- `server/models/studyActivityModel.js`
- `server/models/vocabularyReviewEventModel.js` — new durable receipts
- `server/models/dialogueAttemptModel.js` — new expiring attempts
- `server/services/vocabularyReview.js`
- `server/services/studyStreak.js` — comment explaining count separation
- `server/services/dialogueAttempt.js` — new attempt/validation service
- `server/services/dictionaryLookup.js` — new bounded lookup service
- `server/middleware/learningRateLimit.js`
- `server/routes/dialogueProgressRoutes.js`
- `server/utils/dialogueCatalogue.js`
- `server/utils/fillBlankAnswer.js` — server matcher mirroring the existing client; parity tested
- `server/scripts/generate-dialogue-catalogue.js`
- `server/data/dialogueTaskRules.json` — generated rules from published public content

### Application/client

- `client/app/[locale]/(main)/dialogue/[lessonId]/[dialogueId]/[taskId]/page.js`
- `client/app/_components/DialogueProgressSave.jsx`
- `client/app/_components/FillBlankTask.jsx`
- `client/app/_components/MultipleChoiceTask.jsx`
- `client/app/_components/ArrangeWordsTask.jsx`
- `client/app/_components/DialogueClozeReviewTask.jsx`
- `client/app/_components/DialogueReviewTask.jsx`
- `client/app/_components/MiniDictionary.jsx`
- `client/app/_lib/dialogueProgressSave.mjs`
- `client/app/_lib/reviewSaveController.mjs`
- `client/app/_lib/useBackgroundReviewSave.mjs`
- `client/messages/vi.json`
- `client/messages/en.json`

### Tests and report

- `server/tests/learningAttemptsSecurity.test.js` — new
- `server/tests/dictionarySecurity.test.js` — new
- `server/tests/helpers/learningAttempt.js` — new isolated fixture helper
- `server/tests/csrfProtection.test.js`
- `server/tests/dialogueXp.test.js`
- `server/tests/learningRateLimit.test.js`
- `server/tests/learningSecurity.test.js`
- `server/tests/studyHeatmap.test.js`
- `server/tests/vocabularyReview.test.js`
- `client/scripts/tests/unit/dialogue-attempt-client.test.mjs` — new
- `client/scripts/tests/unit/dialogue-progress-save.test.mjs`
- `client/scripts/tests/unit/review-save-controller.test.mjs`
- `client/scripts/tests/unit/mistake-review-session.test.mjs`
- `client/scripts/tests/browser/test-learning-security-browser.cjs`
- `SECURITY_F12_F13_F16_FIX.md`

The existing ID-only task catalogue was regenerated but has no content diff. Authentication/session controllers, AuthContext, app proxy settings, listener binding, cookies, package manifests and lockfiles have no changes.

## Verification

| Check | Result |
| --- | --- |
| Full server suite, sequential disposable MongoDB fixtures | **307/307 passed** |
| Focused client attempt/save/review/session/login/heatmap tests | **60/60 passed** |
| Full client unit suite | **305/308 passed**; same three existing dictionary-data failures below |
| Core local browser learning/security matrix | **16/16 passed**: 320/375/430/1280px × VI/EN × light/dark |
| Expanded local browser exercise/review/dictionary matrix | **16/16 passed**, same width/locale/theme matrix; no runtime/hydration errors or horizontal overflow |
| Production Next build | **Passed**, Next.js 16.3.8; catalogue prebuild, compilation, page generation and route output completed |
| Focused client and server lint | Passed, no errors/warnings |
| Node syntax and generated catalogue checks | Passed; 613 active tasks verified |
| Git diff whitespace/scope review | Passed |

Server coverage includes concurrent same-token/event usage; transaction rollback; F02 identity; F06 credentials/session races; F07/F08 ownership; F09 origin checks (including the new attempt route); password reset/logout revocation; all review modes and one-hour retry; fixed XP/replays/caps; qualified streak/heatmap and Vietnam boundaries; dictionary coalescing, LRU/active expiry, concurrency/queue/budget limits, provider cancellation and timeout.

Core browser coverage uses the actual local Express app and disposable replica set. It checks Dialogue/Story attempt/save/replay, fake activity rejection, localized 429 → Retry, duplicate-click suppression and navigation. Expanded checks exercise multiple-choice/cloze proofs and actual Flashcard/Quiz/Write reviews. Dictionary API is checked on phones; the visible MiniDictionary UI is checked on desktop. All providers are mocked.

Three unchanged client failures, also documented in the preceding remediation report:

1. `client/app/_lib/dictionary/resolveMeaning.test.mjs`: runtime v3 lookup/lemma data.
2. `client/scripts/tests/integration/build-dictionary-v3.test.mjs`: committed generated dictionary reproducibility.
3. `client/scripts/tests/integration/extract-dictionary-v2.test.mjs`: generated dictionary reproducibility.

Those source/data/generator files were not changed. The full client suite is not clean. Existing Node module/VM and Mongoose deprecation warnings are separate from focused lint.

## Compatibility and deployment requirements

- No existing account, progress, vocabulary, XP or historical activity data was deleted/reconciled. Historical fabricated counts cannot reliably be distinguished from real legacy counts; no automatic cleanup was attempted.
- New collections are `vocabularyreviewevents` (durable idempotency receipts) and `dialogueattempts` (TTL-cleaned attempt records). No one-time user migration is required. Confirm index/collection permissions and the existing replica-set transaction capability when deploying.
- Review receipts intentionally remain durable for retry dedupe; monitor storage growth and consider a separately designed retention/account-deletion policy. No TTL that silently re-enables old review IDs was added.
- Deploy compatible frontend/backend artifacts together. Existing open/older clients sending reviews without reviewId or progress without attempts receive controlled errors and need a reload. Old activity POSTs return 405. No insecure fallback accepts old bodyless reward claims.
- Keep generated rules synchronized using the existing catalogue prebuild/prestart/check workflow. No lesson source or media edits were made.
- Dictionary maps, cache, budget and slots are **per Node process**. With N PM2 workers, aggregate admitted work can be N × 600 jobs/10 minutes and N × 8 active jobs; same-word calls on different workers can duplicate work. A shared cache/admission store and provider-side billing/quota limits need deployment planning. Existing learning/attempt in-memory user limits have the same per-worker limitation.
- No new environment variables are required. F17 proxy topology and F24 cookie topology remain unresolved by this batch.
- Real provider credential discovery, latency/cancellation, provider quotas/billing, PM2 worker count, production MongoDB indexes and deployed frontend/backend routing were not tested. No production/live verification was performed.
