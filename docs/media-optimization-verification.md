# Media optimization verification

Prepared on 2026-10-17. This branch contains media changes only. The untracked A Little Lie lesson and unrelated quiz, review, translation, registry, and backend data edits in the original workspace are excluded.

## Storage and image quality

- 196 PNGs replaced with lossless WebP, including three character filenames that had incorrect casing in their URLs.
- Every conversion compared decoded visible RGB pixels and all alpha values. RGB under fully transparent pixels may be normalized by WebP; rendered pixels and transparency are unchanged.
- 13 unreferenced duplicate PNGs removed after comparing decoded pixels with retained, referenced artwork.
- Net tracked image saving: **153,074,918 bytes (145.98 MiB)**. Tracked images: 402,212,185 -> 249,137,267 bytes.
- Tracked audio remains 27,655,528 bytes; no audio file was changed.
- Browser caching still uses ETags; conditional requests and audio byte ranges are checked locally.

## Missing image investigation

The original Windows file check reported 14 missing URLs. A case-sensitive runtime audit now checks the actual assembled lessons, rather than counting unused draft/configuration strings. All **676 distinct media URLs in 42 active lessons across 9 courses** resolve with exact filename casing.

| Original missing URL | Finding / action |
| --- | --- |
| `/dialogue/asking-for-directions/finding-a-cafe/bg.png` | Stale media fallback. Pointed to existing `bg-ben.webp`; actual dialogue lines retain their existing speaker scenes. |
| `/dialogue/asking-for-directions/thumbnails/finding-the-restroom.png` | Unpublished config entry; no active lesson. Kept. |
| `/dialogue/at-a-hotel/asking-for-extra-towels/bg.png` | Draft metadata placeholder; runtime uses the two existing speaker scenes. Hotel course is disabled in the active registry. Kept. |
| `/dialogue/at-a-hotel/reporting-a-room-problem/bg.png` | Metadata placeholder overridden by existing speaker scenes. Hotel course is disabled. Kept. |
| `/dialogue/at-a-hotel/thumbnails/asking-about-the-room.png` | Unpublished config entry. Kept. |
| `/dialogue/coffee-shop/thumbnails/paying-at-the-counter.png` | Unpublished config entry. Kept. |
| `/dialogue/restaurant/thumbnails/asking-for-the-bill.png` | Unpublished config entry. Kept. |
| `/dialogue/weekend-camping/thumbnails/setting-up-the-tent.png` | Legacy config placeholder. Authored course uses its existing numbered thumbnails; course is disabled. Kept. |
| `/stories/the-boy-who-was-afraid-to-fall/thumbnails/the-new-bicycle.png` | Untracked future config; excluded from this branch. |
| `/stories/the-boy-who-was-afraid-to-fall/thumbnails/the-first-fall.png` | Untracked future config; excluded from this branch. |
| `/stories/the-boy-who-was-afraid-to-fall/thumbnails/one-more-try.png` | Untracked future config; excluded from this branch. |
| `/stories/the-boy-who-was-afraid-to-fall/thumbnails/riding-on-my-own.png` | Untracked future config; excluded from this branch. |
| `/stories/the-lost-wallet/a-wallet-on-the-ground/bg.png` | Unpublished generated draft. Kept. |
| `/stories/the-lost-wallet/thumbnails/a-wallet-on-the-ground.png` | Unpublished generated draft. Kept. |

The exact-case audit also found three active character URL mismatches that Windows had hidden:

- `a-small-surprise/shared/noah.png` referenced `Noah.png`: fixed as `noah.webp` (three lessons).
- `a-small-surprise/the-broken-cake/shared/noah.png` referenced `Noah.png`: fixed as `noah.webp`.
- `naruto-season-1/the-forbidden-scroll/shared/mizuki.png` referenced `Mizuki.png`: fixed as `mizuki.webp` (two lessons).

## Duplicate removals

Paths below are relative to `client/public/`. Each removed image had no source URL reference, and its visible pixels match the retained artwork. Existing media mappings already use the retained files.

| Removed PNG | Retained artwork |
| --- | --- |
| `stories/a-small-surprise/a-special-day/shared/dad.png` | `stories/a-small-surprise/the-best-gift/shared/dad.webp` |
| `stories/a-small-surprise/shared/dad.png` | `stories/a-small-surprise/the-best-gift/shared/dad.webp` |
| `stories/a-small-surprise/a-special-day/shared/mom.png` | `stories/a-small-surprise/shared/mom.webp` |
| `stories/a-small-surprise/the-best-gift/shared/mom.png` | `stories/a-small-surprise/shared/mom.webp` |
| `stories/a-small-surprise/a-special-day/shared/Noah.png` | `stories/a-small-surprise/shared/noah.webp` |
| `stories/a-small-surprise/the-best-gift/shared/Noah.png` | `stories/a-small-surprise/shared/noah.webp` |
| `stories/naruto-season-1/the-forbidden-scroll/shared/naruto.png` | `stories/naruto-season-1/the-lonely-boy/shared/naruto.webp` |
| `stories/naruto-season-1/the-ninja-test/shared/naruto.png` | `stories/naruto-season-1/the-lonely-boy/shared/naruto.webp` |
| `stories/naruto-season-1/the-ninja-test/shared/iruka.png` | `stories/naruto-season-1/the-lonely-boy/shared/iruka.webp` |
| `dialogue/at-a-hotel/asking-for-extra-towels/shared/ben-bg.png` | `dialogue/at-a-hotel/asking-for-extra-towels/ben-bg.webp` |
| `dialogue/at-a-hotel/asking-for-extra-towels/shared/maya-bg.png` | `dialogue/at-a-hotel/asking-for-extra-towels/maya-bg.webp` |
| `dialogue/walk-in-the-park/shared/ben.png` | `dialogue/walk-in-the-park/meeting-at-the-park/shared/ben.webp` |
| `dialogue/walk-in-the-park/shared/emma.png` | `dialogue/walk-in-the-park/meeting-at-the-park/shared/emma.webp` |

Four unique legacy PNGs are retained: `office-introduction/shared/anna-eyes-closed.png`, `eyes-closed.png`, `tom-eyes-closed.png`, and `office-introduction/thumbnails/office-tour.png`. They are outside the active media graph, but unique artwork was not deleted solely for lacking a reference.

## Automation and checks

The existing `dialogue:build` workflow runs the optimizer after glossary validation and before publication. PNG inputs are converted only when useful; all references to converted files are updated. Thumbnail preparation accepts PNG and WebP references. Player characters download on playback intent and decode before audio begins; upcoming scenes preload only near their turn. Direct lossless character delivery keeps `unoptimized` and avoids recompression or duplicate optimized/raw downloads.

The isolated new-lesson fixture verifies backgrounds, characters, thumbnails, exact alpha/visible colors, URL updates, repeat builds, unrelated content preservation, and replacement PNGs for already optimized thumbnails. It exposed and fixed the replacement-thumbnail case. The optimizer is included in the builder's focused checks.

Verification commands from `client/`:

```text
npm run audit:media
node --test scripts/tests/unit/dialogue-image-optimizer.test.mjs scripts/tests/unit/dialogue-content-paths.test.mjs scripts/tests/integration/dialogue-a1-content-rules.test.mjs scripts/tests/integration/dialogue-mc-report.test.mjs scripts/tests/integration/dialogue-practice-rule.test.mjs scripts/tests/integration/contextual-glossary-workflow.test.mjs
npm run build
```

Changed JavaScript files pass ESLint. The focused tests pass 28/28. The backend catalogue checks 1,207 tasks without content changes. The production build succeeds; its first isolated attempt needed network access for the existing Google Inter font.

Desktop and mobile production checks cover the repaired Noah and Mizuki scenes, a speaker-specific Dialogue, lesson thumbnails after scrolling, and a Story exercise. They assert image decoding, no media HTTP failures, audio progress, no runtime exceptions, and no horizontal overflow. A stalled image response in an earlier test server cleared on a fresh production server; the final scroll checks pass. The existing media browser suite uses an intercepted Cloudinary avatar URL compatible with the site's CSP; the previous test-only hostname was blocked by that policy.

The existing browser media suite passes 80 production page checks at 320, 375, 430, 768, and 1280 pixels in Vietnamese and English, with light and dark themes. It also verifies three Next Image transformations, audio byte ranges and decoding, avatars, and the compiled API rewrite. The separate playback checks cover real audio progress and the repaired characters at desktop and mobile sizes.

The existing PR workflows also run the exact-case media audit. Deployment trigger conditions and the production approval gate are unchanged. This branch is intended for a draft pull request, not a push to `main` or a production workflow dispatch.
