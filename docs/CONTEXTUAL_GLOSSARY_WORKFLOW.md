# Codex-authored contextual glossaries

Dialogue and Story now share the same glossary authoring and publishing workflow.
Codex selects meanings during content authoring, using every English line and its
Vietnamese translation. Scripts prepare exact mappings and validate reviewed JSON;
they never generate translations or call a translation service.

## Authoring a new lesson

1. Use the existing `create:dialogue` flow for either content type. It writes the
   usual generation prompt and a companion `glossary-prompt.txt`. New generated
   content includes `metadata.contextualGlossaryVersion: 1`.
2. Save and review `draft.json`, then run `npm run glossary:prepare -- <courseId>
   <dialogueId>` from `client`. Codex's instructions in `client/AGENTS.md` require
   this step automatically after every new Dialogue or Story draft.
3. Read the prepared prompt and `glossary-template.json`. Codex authors a separate
   `glossary.json` in that same generated lesson directory. Every word occurrence
   needs a reviewed meaning, including grammar words and words inside expressions.
   Add useful phrases; keep explanations in hidden optional notes.
4. Run `npm run glossary:check -- <courseId> <dialogueId>`. Review uncertain meanings
   before continuing. Passing validation does not establish linguistic accuracy.
5. Continue the existing thumbnail-manifest workflow. The existing
   `dialogue:build` command validates the glossary again before production writes.
   Audio generation remains part of the existing builder; `--skip-audio` avoids it.

Preparation does not fill meanings: its entries deliberately have empty meanings
and POS. It refreshes the source-based authoring request but preserves existing
templates and authored glossary files. When a draft changes, Codex must deliberately
revise its authored occurrence maps; scripts cannot silently fix or translate them.

## Before promotion

The builder requires a glossary for any new lesson without production JSON and any
draft with `contextualGlossaryVersion: 1`. If missing, it automatically prepares an
empty template and authoring request, then fails before publication. It validates:

- All source line IDs, full English text, speaker and Vietnamese translation.
- Exact token sequence and one mapping for every clickable word.
- Referenced entries, non-empty meanings and POS, optional note/IPA types.
- Lowercase English word identity for each referenced word position.
- Inclusive phrase endpoints, exact phrase text, phrase POS and punctuation gaps.
- Character names and roles.

Changing a sentence to another with the same number of words still fails validation.
The same checks apply to `dialogue` and `story`, using their existing storage helpers.

An existing approved glossary is validated against the draft and never overwritten.
If a pending glossary differs from it, the builder stops for an explicit review and
update. Stale approved content also blocks the build. Exclusive file creation guards
against accidentally overwriting a glossary published by another author.

Legacy lessons without glossaries retain their current dictionary fallback. This is
intentional compatibility, not a request to generate glossaries for existing content.

## Offline storage and popup

The existing schema is preserved: `schemaVersion`, `lessonId`, `dialogueId`,
`characters`, shared `entries`, and `lines` with exact source text, translations,
tokens, word entry references and phrase spans. There are no runtime meaning APIs.

Drafts use `generated/dialogues/<course>/<lesson>/glossary.json` or
`generated/stories/<course>/<lesson>/glossary.json`. New approved Dialogue glossaries
use `app/_lib/dictionary/glossaries/<course>/<lesson>.json`, preserving the pilot's
path. Story glossaries use `glossaries/stories/<course>/<lesson>.json`.

On promotion, the builder updates `lessonGlossaries.js` with static JSON imports of
published glossaries. This registers new lessons without hand-editing popup lookup.
Course IDs in the existing combined config registry identify both content types.
Runtime still checks exact line text, speaker, translation and token order before
using contextual data. Otherwise it uses the existing production dictionary/resolver.
Individual word meanings remain accessible through the existing phrase/word switch.
Notes remain hidden; pronunciation, audio, highlighting and phone layout are retained.

## Additional lesson result

The workflow was exercised on exactly one additional lesson, the Story
`ten-minutes-a-day/the-old-book`. Its English/Vietnamese content was not changed.
Codex authored its glossary after reading the complete Story and prepared request.
The existing builder promoted it successfully with audio skipped.

- 11 lines, 79/79 word occurrences, 15 phrase spans covering 12 useful expressions.
- 68 shared entries, including separate entries where the same word changes sense.
- Names/roles: Mr. Daniel is the teacher; Leo and Ryan are students.
- Useful-word/phrase IPA reuses already authored lesson pronunciation when available.

| Sentence | Word meaning | Useful expression meaning |
| --- | --- | --- |
| I have a book for each of you. | I → thầy; for → cho; each → mỗi | each of you → mỗi em |
| An English book? It looks old. | looks → trông có vẻ; old → cũ | English book → cuốn sách tiếng Anh |
| What should we do with it? | should → nên; do → làm | — |
| Read it for ten minutes every day. | for → trong; minutes → phút | every day → mỗi ngày |
| I can do that after dinner. | I → em; can → có thể | after dinner → sau bữa tối |
| I get bored when I read. | get → cảm thấy; bored → chán | get bored → cảm thấy chán |
| Do not worry about reading a lot. Just read a little every day. | Do → trợ động từ; not → đừng | do not → đừng; a little → một chút |
| What if I miss a day? | miss → bỏ lỡ | What if → nếu ... thì sao |
| Start again the next day. The important thing is to continue. | again → lại; continue → tiếp tục | Start again → bắt đầu lại; the next day → ngày hôm sau |

Grammar labels and idioms still benefit from independent learner/human review.
For example, `get` receives its contextual linking sense only inside `get bored`;
`of` in `each of you` has a short grammatical label and hidden explanation.
No validator claims to prove the Vietnamese sense is correct. Unknown IPA remains
empty instead of copying a lemma's IPA into a different surface form.

## Verification

- 75 focused Node tests passed, covering both storage types, preparation without
  translations, approved-file preservation, deterministic registry output, and real
  builder failures for missing glossaries, new lessons, shifted phrases and equal-count
  sentence changes before publication. Existing dialogue/localization/path tests pass.
- All 65 restaurant pilot occurrences and 79 additional Story occurrences are tested.
  The other 1,957 clicks across the remaining lessons retain exact production results.
- Additional Story Chrome checks: 158 word clicks and 286 popup selections passed
  across 1365px desktop and 390px phone layouts.
- Restaurant regression Chrome checks: 130 word clicks and 266 popup selections passed.
- Focused ESLint, production Next.js build, and `git diff --check` passed.
- Hash comparisons confirm the production dictionary, original pilot glossary, all
  dialogue/Story source JSON, and unrelated dirty files were preserved.

Browser checks use isolated Chrome profiles, mocked guest APIs/media/speech, rendered
button handlers, and real lesson routes. They verify meanings, phrase/word switches,
IPA, highlights, popup bounds, audio URLs, speech requests and Escape dismissal.
They do not verify live APIs, audible speech, codecs or physical phone gestures.
No audio provider call, deployment or bulk glossary generation ran.

## Main implementation files

- `client/AGENTS.md`: automatic Codex authoring steps.
- `client/scripts/create-dialogue.mjs` and `prompts/dialogue-generator.mjs`: companion
  glossary request and required-glossary marker for new drafts.
- `client/scripts/prompts/contextual-glossary.mjs`: authoring instructions with source.
- `client/scripts/contextual-glossary.mjs`: prepare/check commands.
- `client/scripts/lib/contextual-glossary.mjs`: templates, validation plans, protected
  publication and offline registry generation.
- `client/scripts/build-dialogue.mjs`: pre-promotion glossary gate and publication.
- `client/app/_lib/dictionary/validateLessonGlossary.js`: strengthened schema/source checks.
- `client/app/_lib/dictionary/findLessonLookup.js` and `lessonGlossaries.js`: registered
  contextual lookup, preserving the production fallback.
- `client/scripts/tests/integration/contextual-glossary-workflow.test.mjs` and updated
  lookup/browser tests: authoring, publication, Story and existing-pilot coverage.
- Additional Story artifacts: generated prompt/template/authored glossary and published
  `client/app/_lib/dictionary/glossaries/stories/ten-minutes-a-day/the-old-book.json`.

The workflow is ready for the next newly authored lesson. Only the restaurant pilot
and this additional Story are registered; existing lessons have not been bulk-generated.
