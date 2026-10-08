# Repository Cleanup Audit

**Date:** 2026-10-08  
**Scope:** Static repository inspection only. No files were removed, moved, or edited other than creating this audit report. No tests or builds were run.

## How the audit was done

The tracked and visible repository files were inventoried, excluding Git internals and installed/build output. Searches covered imports and exports, dynamic imports, route registration, package scripts, generated content paths, asset URL helpers, documentation references, and exact SHA-256 matches among public assets. Next.js route files were treated as routes even when they have no imports; Express route files were checked against `server/app.js` mounts. Content paths assembled from course/dialogue IDs were treated as live unless stronger evidence showed otherwise.

At audit start, the security reports were already staged as moves into `docs/security/`. Two other working-tree deletions were already present: `.vscode/settings.json` and `mockups/wordlist-workspace-v2.png`. Both were left untouched and excluded from changes made by this audit.

## Safe to remove after approval

The directories below are empty local folders; the dependency has no in-repository code references:

| Candidate | Evidence |
| --- | --- |
| `client/app/[locale]/(main)/rank/_data/` | Empty local directory; no files are tracked there. |
| `client/generated/dialogues/restaurant/output-mode-invalid/` | Empty local directory with no matching references. Other generated drafts and prompts are used by the dialogue tools and are not candidates. |
| `server/.local-avatars/` | Empty local directory and no source reference. The configured development storage path is `server/local-avatars/` in `server/services/avatarUpload.js`; that active directory must be kept. |
| Client dependency `next-auth` in `client/package.json` | The package is declared, but no import, configuration, or NextAuth API route was found in the client source. The app has its own Google OAuth callback route. Remove it from the manifest and lockfile together if maintainers confirm no external tooling depends on it. |

The three directories are empty local folders and do not contribute tracked repository bytes. No application component, hook, controller, route, or service was confirmed safe to remove from this static pass.

## Needs review

| Candidate | Evidence and why it needs a person to decide |
| --- | --- |
| `client/scripts/lib/public-asset-path.mjs` | It duplicates `getPublicAssetDirectory` and `getPublicAssetPath` from `client/scripts/lib/dialogue-content-paths.mjs`, and no repository reference to this file was found. Check whether a developer uses it directly outside the repository before removing it. |
| Fourteen client browser harnesses without package-script or external code/document references | These may still be run manually, so a missing package script does not prove they are obsolete. The files are `test-mobile-cloze-dock-browser.cjs`, `test-mobile-four-to-six-browser.cjs`, `test-mobile-seven-and-nine-browser.cjs`, `test-mobile-ten-to-twelve-browser.cjs`, `test-mobile-thirteen-to-sixteen-browser.cjs`, `test-mobile-top-three-browser.cjs`, `test-rank-browser.cjs`, `test-regression-eight-to-ten-browser.cjs`, `test-regression-eleven-to-fourteen-browser.cjs`, `test-regression-fifteen-to-eighteen-browser.cjs`, `test-regression-four-to-seven-browser.cjs`, `test-regression-nineteen-to-twenty-one-browser.cjs`, `test-vocabulary-retry-browser.cjs`, and `test-vocabulary-review-browser.cjs`. Other browser harnesses are cited by the security reports and should be kept with those reports. |
| Exact duplicate public images | SHA-256 comparison found 20 identical-image groups: 48 files total, 28 extra copies, about 55.2 MiB if each group kept only one physical copy. Examples include the hotel `ben-bg.png` files, four identical Coffee Shop dialogue backgrounds, shared character images used by both Coffee Shop and Restaurant, and course thumbnails that match dialogue thumbnails. Code and builders construct paths by content type, course ID, and dialogue ID, so each path may still be required. No audio duplicates were found. Do not consolidate until every generated/runtime URL can continue resolving. |
| `mockups/wordlist-workspace-v2.png` | It was already deleted in the working tree when this audit began. The `HEAD` version is the only tracked file under root `mockups/`; a repository search found no direct path reference. Confirm whether it is still needed as design history before accepting the existing deletion. |
| `client/README.md` | It is the generic Create Next App starter README. Its `app/page.js`, Geist font, and plain `npm run dev` instructions do not match the current locale routes, Inter font, and wrapped development scripts. It may still serve as an onboarding page; review it for replacement or removal. |

## Keep

- Keep all twelve security reports under `docs/security/`. Their staged moves were present before this audit and are preserved.
- Keep application routes and their supporting code. `server/app.js` mounts the auth, user, vocabulary, topic, dictionary, study activity, dialogue progress, and leaderboard routers. The Next.js `page`, `layout`, `loading`, and error route files are also framework entry points.
- Keep `server/data/dialogueTaskCatalogue.json` and `server/data/dialogueTaskRules.json`. `server/scripts/generate-dialogue-catalogue.js` creates them, `server/utils/dialogueCatalogue.js` loads them at runtime, and tests read them.
- Keep `server/scripts/`. Package scripts invoke the development wrapper, catalogue generator, production database verifier, and avatar URL audit; deployment uses the deployment check and shell script.
- Keep `server/local-avatars/`. It is the active, ignored development upload directory configured in `server/services/avatarUpload.js`.
- Keep the client dialogue/story registry, generated drafts/prompts, and shared media paths. The course registry and builder resolve content dynamically by `contentType`, course ID, and dialogue ID. A literal text search alone cannot show that these files or images are unused.
- Keep `bcryptjs`: `server/tests/authenticationFailures.test.js` imports it. The other client and server dependencies have source, test, or script references in this inspection.
- Keep the `shared/` folders under public media: they hold character images referenced by lesson data and the thumbnail-preparation helper. There is no root `shared/` directory in the repository. There is also no root `scripts/` directory; the active tooling is under `client/scripts/` and `server/scripts/`.
- Keep feature-specific documents such as `server/AVATAR_UPLOAD.md`, `server/services/XP.md`, `server/services/LEADERBOARD.md`, `server/services/VOCABULARY_REVIEW.md`, `client/AGENTS.md`, and the dictionary attribution record. They describe active features, data, or development workflows.

## Unused files and folders discovered

The only strong static candidates are the four items in **Safe to remove after approval**. No unused application module or individual public media file was confirmed. The empty local folders are not tracked by Git. The root `mockups/` image is a pre-existing working-tree deletion and is listed for review, not as an audit change.

## Duplicate or redundant code and assets

- `public-asset-path.mjs` repeats two path helpers from `dialogue-content-paths.mjs`; it is unreferenced in this repository, pending external-use review.
- The public image tree has 20 exact-content groups (28 redundant copies by hash), as described above. They occupy separate content paths, and the current builder/runtime relies on those paths.
- The client starter README is out of date; no duplicate feature-specific documentation was confirmed.

## Unused dependencies

- **Candidate:** `client` dependency `next-auth`. No source import, configuration, or matching API route was found.
- **Keep:** `server` dependency `bcryptjs` is used by an authentication test. No other manifest dependency was confirmed unused in this static audit.

## Estimated cleanup impact

Removing the confirmed empty folders and the unused client dependency would simplify three local directory entries and remove one package from the client dependency tree; it would not remove tracked application files. Consolidating every identical image group has a theoretical upper bound of about **55.2 MiB**, but the content-specific URLs make that a higher-risk project and the actual removable amount may be much lower. Reviewing the manual test scripts and documentation could reduce maintenance clutter, but this pass does not estimate their removal without owner confirmation.

## Recommended safe cleanup order

1. After approval, remove only the three confirmed empty directories and remove `next-auth` from both the client manifest and lockfile.
2. Ask the project owner whether the old mockup and the starter README should be retained, replaced, or removed; preserve the existing mockup deletion until that decision is made.
3. Ask whether the fourteen unregistered browser harnesses are still used manually. Keep the harnesses cited by security reports.
4. Review the duplicate path helper for external use.
5. Consider image deduplication only after a path-by-path asset manifest confirms every generated and runtime URL remains available; then verify the affected dialogue/story pages and media.

No cleanup action beyond creating this report has been taken. This audit makes no changes to application code, dependencies, user data, or the existing staged and unstaged Git changes.