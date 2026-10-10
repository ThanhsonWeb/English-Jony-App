StudyJony exercise progression — 2026-10-10

**Root cause**

Dialogues and Stories share the same exercise route, completion hook, and Continue wrapper. Answer checks already set correct/incorrect feedback immediately. `DialogueProgressLink` then replaced Continue and exercise arrows with disabled buttons while saving, awaited the progress request before navigation, and blocked again after failures. The task-scoped effect also cancelled attempts and requests on unmount, so simply removing the disabled state would have made rapid navigation unsafe.

**Result and progress protection**

Completed answers are synchronously written to a queue in this browser before immediate progression is allowed. A provider above exercise routes owns the worker, so task navigation, Exit, and the final useful-words screen do not cancel completed work. Ordinary saves and temporary failures with automatic retries show no notice or reserved space. A notice appears for failures without automatic retries, unavailable device storage, or damaged recovery data. This visibility uses a read-only queue snapshot flag; persistence, retries, confirmation, and navigation safeguards are unchanged. Correctness checks, lesson content, scoring, XP rules, SRS, audio, and exercise input behavior were not changed.

The queue uses one key per account and task. It processes completions in order, uses an origin-wide Web Lock to coordinate tabs, and coalesces duplicate pending completions. Attempt IDs and answer proofs are retained across retries and reloads. Network errors, request timeouts, HTTP 408/429, and server failures retry with bounded backoff. Permanent failures remain visible and retained, with an explicit Retry button. Reconnection, returning to the tab, and restoring the same account also retry. An unresolved failure holds later writes in the queue to preserve ordering.

Only a server response confirming the specific task, account, and lesson marks a write saved. Existing server transactions, completed-task sets, and XP award keys remain responsible for idempotency. Expired attempts renew through the existing attempt API; confirmed exercise replays use fresh attempts. A new optional account header rejects queued writes if cookies have switched accounts, before creating an attempt or mutating progress.

If storage cannot be written/read back, is corrupt, or Web Locks are unavailable/refused, the current tab waits for server confirmation before allowing progression. Corrupt stored records produce an explicit recovery error while other readable completions are still processed. Enter continues to activate Check/Continue and cannot advance the underlying exercise through an open exit modal.

**Practical limits**

A closed browser cannot run a reliable JavaScript retry worker. Pending work resumes when this site is opened again on the same browser/device with the same account. Do not clear site data while saves are pending; private browsing or storage eviction can remove local pending records. A beforeunload warning and keepalive requests provide additional protection, but neither is proof of a successful server save. Browsers do not reliably fire beforeunload on every mobile shutdown: [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event). Persistent storage and cross-tab locking follow [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) and [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

The updated client and server account guard should be released together. No deployment or live-provider checks were performed. Browser checks use headless Chrome with desktop/mobile viewports and touch emulation, not physical phones or Safari.

In fallback mode, forcing a refresh/close or signing out before confirmation can discard work held only in memory. Keep the tab and account open until confirmation. Continue and exercise Exit wait for confirmation, and reloads show a browser warning when supported; the app cannot prevent every browser shutdown.

**Files changed for this task**

- `client/app/_lib/dialogueProgressQueue.mjs` — persistent queue, ordered worker, retries, cross-tab coordination, recovery/fallback.
- `client/app/_lib/dialogueProgressSave.mjs` — retained attempts, timeouts, cancellation, account header, keepalive PATCH.
- `client/app/_components/DialogueProgressSave.jsx` — shared provider, immediate Continue, global notice, unload warning.
- `client/app/[locale]/layout.js` — mount the worker above task routes.
- `client/app/[locale]/(main)/layout.js` — show the notice across learning screens.
- `client/app/[locale]/(main)/dialogue/[lessonId]/[dialogueId]/[taskId]/page.js` — remove the task-local notice.
- `client/app/_components/DialogueExerciseHeader.jsx` — honest Exit message and unsafe-storage guard.
- `client/app/_hooks/useDialogueShortcuts.js` — prevent Enter advancing exercises behind a modal.
- `client/messages/en.json`, `client/messages/vi.json` — saving, error, recovery, and exit messages.
- `server/controllers/dialogueProgressController.js` — reject mismatched intended accounts.
- `server/tests/learningAttemptsSecurity.test.js` — verify account isolation and existing transaction/reward behavior.
- `client/scripts/tests/unit/dialogue-progress-queue.test.mjs` — queue reliability tests.
- `client/scripts/tests/unit/dialogue-progress-save.test.mjs` — translation checks for new states.
- `client/scripts/tests/browser/test-dialogue-background-progress.cjs` — new progression/recovery browser scenarios.
- `client/scripts/tests/browser/test-learning-security-browser.cjs` — await server confirmations independently of Continue; retry race handling.
- `client/scripts/tests/browser/test-regression-four-to-seven-browser.cjs` — update progress assertions/attempt fixture and allow focused progress selection.
- `docs/EXERCISE_BACKGROUND_PROGRESS.md` — this report.

Existing lesson, glossary, image, audio, and story-generation changes were preserved. The standard prebuild regenerated/verified the existing server catalogue from current lesson data: 713 tasks.

**Verification**

Notification follow-up: all 179 client unit tests, 11 background-progress browser scenarios, 48 focused exercise regression cases, and 16 local full-app browser configurations passed again. The updated checks assert that normal saves and automatic retries render neither a banner nor its spacing wrapper, while permanent failures still offer Retry and unsafe storage still requires confirmation. Lint passed with the same two existing image warnings; the production build passed. Browser coverage uses headless Chrome with mobile/desktop emulation. The saving transport, Continue/Exit handlers, shortcuts, server controller, and generated catalogue/rules were verified unchanged for this follow-up.

The focused progress suites passed 29 tests: slow saves, rapid completion/FIFO, deduplication, lost responses, refresh restoration, startup timing, backoff/manual retry, quota failure, missing/refused locks, two tabs (including a proof created after another tab read the queue), account changes, malformed confirmations, timeout/expiry recovery, fresh replays, corrupt storage, and clock rollback across tabs. All 179 client unit tests passed. The server learning-attempt suite passed all 16 tests against a disposable MongoDB replica set, including transaction rollback, SRS, Dialogue/Story rewards, retries/replays, and the new account guard.

The new browser suite passed 11 scenarios: eight combinations of Dialogue/Story, Vietnamese/English, and 375/1280px; plus unavailable storage, duplicate completion in two tabs, and closing/reopening a tab. Each main scenario checks immediate wrong/correct feedback, held slow PATCH requests, Enter, rapid ordered completions, temporary failures, refresh after failure/lost response, Exit while pending, the final exercise, and horizontal overflow.

The existing learning-security browser suite passed all 16 configurations against the full local Express app/disposable replica set: 320/375/430/1280px, Vietnamese/English, and light/dark themes. It covers Dialogue/Story attempts, answer proof checks, retries/replays, fixed XP, navigation, multiple-choice/cloze, vocabulary SRS, and dictionary API guards. The focused older progression regression suite passed 48 cases across 375/1280px, both languages/themes, both content types, and fill-blank/multiple-choice/cloze. Together these runs passed 75 browser cases.

Client lint passed with two existing `<img>` warnings in Header/profile. Production build passed; the first sandboxed attempt could not fetch the existing Inter font, then a network-enabled build passed and the final cached build passed. Broader client integration checks returned 60/63: three dictionary tests attempt to read a directory as a file (`EISDIR`). App checks returned 52/53: the existing production-result dictionary assertion disagrees with the current grateful story glossary. Those dictionary files were not changed by this task.

The unfiltered older regression browser script also stops at a profile-login timeout: its mock handles `/auth/login`, while the current login code calls `/auth/credentials/login`. That unrelated fixture was left unchanged. Its progress cases are run separately with `STUDYJONY_TEST_GROUP=progress`; this selection is explicit and does not represent the full script passing.

Reproduce from `client` with `npm run test:unit`, `npm run lint`, and `npm run build`. From `server`, run `node --test tests/learningAttemptsSecurity.test.js`. Browser tests require local Next at `http://localhost:3000` (or `STUDYJONY_TEST_URL`) and Playwright/Chrome. Playwright was installed in a temporary test folder, without changing project dependencies:

```powershell
$env:NODE_PATH = "$env:TEMP\studyjony-exercise-tests\node_modules"
node scripts/tests/browser/test-dialogue-background-progress.cjs
node scripts/tests/browser/test-learning-security-browser.cjs
$env:STUDYJONY_TEST_WIDTHS = '375,1280'
$env:STUDYJONY_TEST_GROUP = 'progress'
node scripts/tests/browser/test-regression-four-to-seven-browser.cjs
```
