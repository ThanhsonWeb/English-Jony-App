# Contextual dictionary refinement: restaurant/getting-a-table

Reviewed all 12 source lines, 65 word occurrences, and 13 phrase spans (12 expressions). Shortened or corrected 53 of the 63 shared entry meanings. The remaining 10 meanings were already concise. Character meanings are now the names alone; roles and proper-name explanations remain separate.

Word meanings and expression meanings are both accessible. Clicking a word still selects its useful expression first. A small underlined button inside the existing popup switches to the clicked word; clicking again returns to the expression. Only one meaning is shown at a time. Notes are stored for maintainers and never displayed. The production dictionary remains the fallback.

## Examples

| Word | Individual meaning | Expression | Expression meaning |
| --- | --- | --- | --- |
| two | hai | table for two | bàn cho hai người |
| like | muốn | would like | muốn |
| enjoy | thưởng thức | Enjoy your meal | chúc ngon miệng |
| welcome | không có gì | You are welcome | không có gì |
| table | bàn ăn | table for two | bàn cho hai người |
| do | trợ động từ | do not | chưa đặt bàn |

Grammar words stay grammatical where a literal translation would mislead: a → mạo từ không xác định, the → mạo từ xác định, question do → trợ động từ. In line 7 the first is → trợ động từ (short answer), while the second is → là. Other copular uses of is/are have short labels and optional notes. We remains chúng tôi for both customers and staff; separate references and notes preserve who is speaking.

## Structure and validation

Shared entry IDs and line-ID keys are preserved. Each word entry adds its English word to catch references put in the wrong slot. Exact token arrays pin the occurrence order. Each phrase stores its exact text alongside inclusive zero-based start/end positions. Full sentence text, speaker, and Vietnamese translation are compared to the actual dialogue JSON, even after edits with equal word counts.

```json
{
  "schemaVersion": 1,
  "lessonId": "restaurant",
  "dialogueId": "getting-a-table",
  "entries": {
    "like-request": {
      "meaning": "muốn",
      "pos": [
        "v"
      ],
      "note": "muốn (trong “would like”); không phải “thích”",
      "word": "like"
    },
    "would-like": {
      "meaning": "muốn",
      "pos": [
        "phrase"
      ],
      "pron": [
        "/wʊd laɪk/"
      ],
      "note": "muốn (cách đề nghị lịch sự)"
    }
  },
  "lines": {
    "9": {
      "speaker": "Ben",
      "text": "We would like that table, please.",
      "translation": "Chúng tôi muốn chọn bàn đó.",
      "words": [
        "we-customers",
        "would-request",
        "like-request",
        "that-table",
        "table",
        "please"
      ],
      "phrases": [
        {
          "start": 1,
          "end": 2,
          "entry": "would-like",
          "text": "would like"
        }
      ],
      "tokens": [
        "We",
        "would",
        "like",
        "that",
        "table",
        "please"
      ]
    }
  }
}
```

The excerpt only shows two shared entries; the real JSON defines all referenced entries. There is no automatic glossary generator.

## Complete meaning review

Changed rows describe meanings revised in this refinement. Optional notes preserve useful explanations outside the popup. The label mạo từ không xác định has six Vietnamese syllables; other meanings contain at most five.

| Shared entry | English word/expression | Current Vietnamese meaning | Review |
| --- | --- | --- | --- |
| greeting-good | good | tốt | changed |
| evening | evening | buổi tối | unchanged |
| how-quantity | how | bao nhiêu | changed |
| many | many | nhiều | changed |
| people | people | người | changed |
| a | a | mạo từ không xác định | changed |
| table | table | bàn ăn | changed |
| for-two | for | cho | changed |
| two | two | hai | changed |
| please | please | vui lòng | changed |
| do-question | do | trợ động từ | changed |
| you-customers | you | hai bạn | changed |
| have-booked | have | có | changed |
| reservation | reservation | việc đặt bàn trước | changed |
| no | no | không | changed |
| we-customers | we | chúng tôi | changed |
| do-short-answer | do | trợ động từ | changed |
| not | not | chưa | changed |
| that-situation | that | điều đó | changed |
| is-fine | is | động từ nối | changed |
| fine | fine | ổn | changed |
| we-staff | we | chúng tôi | changed |
| have-available | have | có sẵn | changed |
| near | near | gần | unchanged |
| the-window | the | mạo từ xác định | changed |
| window | window | cửa sổ | unchanged |
| is-question | is | động từ be | changed |
| it-place | it | chỗ đó | changed |
| quiet | quiet | yên tĩnh | unchanged |
| yes | yes | có | changed |
| is-short-answer | is | trợ động từ | changed |
| it-area | it | đó | changed |
| is-area | is | là | changed |
| area | area | khu vực | changed |
| that-suggestion | that | điều đó | changed |
| sounds | sounds | nghe có vẻ | unchanged |
| good-agreement | good | ổn | changed |
| would-request | would | trợ động từ | changed |
| like-request | like | muốn | changed |
| that-table | that | đó | changed |
| great | great | tuyệt | changed |
| the-table | the | mạo từ xác định | changed |
| is-ready | is | động từ nối | changed |
| ready | ready | sẵn sàng | changed |
| thank | thank | cảm ơn | unchanged |
| you-server | you | bạn | changed |
| are-welcome | are | động từ nối | changed |
| welcome-response | welcome | không có gì | changed |
| enjoy-wish | enjoy | thưởng thức | changed |
| your-customers | your | của hai bạn | changed |
| meal | meal | bữa ăn | unchanged |
| good-evening | Good evening | chào buổi tối | unchanged |
| how-many | How many | bao nhiêu | changed |
| table-for-two | table for two | bàn cho hai người | unchanged |
| have-a-reservation | have a reservation | có đặt bàn trước | changed |
| do-not-booked | do not | chưa đặt bàn | changed |
| that-is-fine | That is fine | không sao | changed |
| near-the-window | near the window | gần cửa sổ | unchanged |
| sounds-good | That sounds good | nghe ổn đấy | changed |
| would-like | would like | muốn | changed |
| thank-you | Thank you | cảm ơn bạn | changed |
| you-are-welcome | You are welcome | không có gì | changed |
| enjoy-your-meal | Enjoy your meal | chúc ngon miệng | changed |

## Pronunciation and remaining concerns

Word pronunciation continues to use existing production IPA. The missing reservation IPA now uses the pronunciation already authored in this lesson. Five expressions keep their existing lesson IPA; phrases without a trustworthy IPA stay empty. No word pronunciation is passed off as pronunciation of an entire expression. The short-answer is entry now has auxiliary POS; other copular be entries retain verb POS.

Grammar labels are explanations rather than Vietnamese translations. Greeting Good and quantity How are not independently translated in natural Vietnamese sentences; their expression meanings should usually be preferred. The notes retain that distinction. Translation review here is an authored review backed by regression checks, not independent human approval. Existing IPA is preserved rather than comprehensively re-authored.

## Files changed in this refinement

- client/app/_lib/dictionary/glossaries/restaurant/getting-a-table.json: concise meanings, optional notes, token/word identity, exact phrase text, reservation IPA.
- client/app/_lib/dictionary/findLessonLookup.js: guarded occurrence/phrase lookup, word alternative for contextual expressions, stale-translation guard.
- client/app/_lib/dictionary/validateLessonGlossary.js: source-aware glossary validation (new).
- client/app/_components/DialoguePlayer.jsx: small contextual-only word/expression switch inside the existing popup.
- client/app/_lib/dictionary/findLessonLookup.test.mjs: all-word access, semantic checks and invalid/stale glossary fixtures.
- client/scripts/tests/browser/test-contextual-dictionary-browser.mjs: switches, individual highlighting, speech and hidden-note checks.
- docs/CONTEXTUAL_DICTIONARY_PILOT.md: this review and verification report.

Other dialogue/Story content and dictionary-v3.json were not changed. Existing dirty files were preserved.

## Verification

- 44 focused Node tests passed: all 65 occurrences, individual/phrase meanings, repeated-word distinctions, punctuation, references, stale English/Vietnamese, token positions and phrase boundaries. Exact existing results remain unchanged for 2,036 clicks in the other 27 dialogue/Story files.
- Chrome at 1365px and 390px: 130 initial word clicks and 266 popup selections passed, including phrase → word → phrase switches, exact meanings/IPA, individual and phrase highlights, speech requests, audio URLs, bounds and Escape dismissal. No browser runtime exceptions.
- Focused ESLint passed.
- Production Next.js build passed. The restricted build first failed fetching Inter from Google Fonts; the build passed when allowed to fetch the existing font.

```sh
node --test client/app/_lib/dictionary/findLessonLookup.test.mjs client/app/_lib/dictionary/findPreferredLookup.test.mjs client/app/_lib/dictionary/resolveMeaning.test.mjs
cd client
npx --no-install eslint app/_components/DialoguePlayer.jsx app/_lib/dictionary/findLessonLookup.js app/_lib/dictionary/validateLessonGlossary.js app/_lib/dictionary/findLessonLookup.test.mjs scripts/tests/browser/test-contextual-dictionary-browser.mjs
npx --no-install next build
npx --no-install next start --hostname 127.0.0.1 --port 3100
```

With the server running, from the repository root:

```sh
node client/scripts/tests/browser/test-contextual-dictionary-browser.mjs
```

The browser harness uses an isolated temporary Chrome profile. STUDYJONY_TEST_URL and STUDYJONY_CHROME override URL/browser path. Guest APIs, media play and speech output are mocked. These checks verify rendered behavior and request wiring; audible output, codec support, live services and physical phone gestures were not tested. Chrome may require normal process permissions on Windows. The temporary profile is removed after the check.

The refined pilot passes the requested local checks and is ready for learner/human review. Automatic glossary generation remains a future task.
