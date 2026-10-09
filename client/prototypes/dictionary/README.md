# Dictionary candidate (offline prototype)

This folder is independent of the production popup. Nothing here is imported by
the application. `dictionary-candidate.json` is a compact offline package with
`words`, `lemmas`, `formPronunciations`, `phrases`, and license metadata. Word entries use the v3
`pos`, `pron`, `primaryMeaning`, and `meanings` fields. Lemmas are explicit aliases;
the prototype never guesses suffixes at lookup time. Inflections use their own
source pronunciations, or an empty list, rather than inheriting the base IPA.

From the repository root, with Node 22.13 or newer:

```sh
node client/scripts/build-dictionary-candidate.mjs
node client/scripts/evaluate-dictionary-candidate.mjs
node --test client/scripts/tests/integration/dictionary-candidate.test.mjs
```

The generator reads a disposable SQLite copy, the existing v3 dictionary,
phrase overrides, lemma hints, frequency headwords, and content. SQLite supplies
new vocabulary and candidate senses. The existing v2 sense filter/ranker is
reused; all senses compete, independent of database ordering. Useful existing
v3 entries are retained. Explicit proposed editorial corrections and grammar
aliases are recorded in `build-review.json`, never labeled human-approved.
The frequency and cleaned dictionaries supply headwords only, not translations.

The fixed comparison corpus is the 24 JSON files in `benchmark-files.json`:
20 dialogue files and four Stories currently enabled in `lessonData.js`.
Only spoken/narrated `dialogue[].text` is counted, using the live subtitle
tokenizer. Tasks, translations, draft duplicates, and disabled courses are
excluded from this benchmark. Additional existing content still contributes
vocabulary to generation. The evaluator calls the current popup lookup and
meaning resolver for the baseline, then uses equivalent phrase boundary/clause
rules and the same meaning resolver for the candidate. Coverage measures clicks
with a meaning, **not translation correctness**.

`review-report.md` contains 96 real sentence examples, source locations,
current/proposed popup meanings, and review reasons. `evaluation.json` retains
all missing words, per-file results, regressions, and measurements.
`build-review.json` keeps selected SQLite sense IDs and definitions, provenance,
lemma evidence, rejected/unresolved entries, and review flags outside the compact
runtime file. Every example awaits a human decision. A larger vocabulary is not
evidence of correct meanings or pronunciations.

Data remains CC BY-SA 4.0. Keep `ATTRIBUTION.md`, `LICENSE`, and this change notice
with any distribution. The upstream notices are copied unchanged from Skypedia;
the existing production `DATA_ATTRIBUTION.md` is unchanged. The derivative changes
are sense filtering/ranking, a learner subset, retained v3/phrase edits, proposed
editorial corrections, lemma aliases, and compact JSON formatting. Credits:
[Skypedia](https://github.com/skypediacode/english-vietnamese-dictionary),
[MinhQND](https://github.com/minhqnd/dictionary), and the upstream resources listed
in `ATTRIBUTION.md`. License:
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
