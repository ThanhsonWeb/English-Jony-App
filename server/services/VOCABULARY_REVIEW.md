# Vocabulary review

`POST /api/v1/vocab/:id/review` requires the existing authenticated session.

- Flashcard: `{ "mode": "flashcard", "rating": "again|hard|medium|easy" }`
- Quiz: `{ "mode": "quiz", "answer": "selected Vietnamese translation" }`
- Writing: `{ "mode": "writing", "answer": "typed English word" }`
- Optional `practice: true` leaves scheduling/progress unchanged.

Quiz/writing are graded on the server against the owned vocabulary record,
using the existing trim/lowercase comparison. Flashcards remain self-rated.
Client-supplied correctness, amounts, reward keys and dates are ignored.
Generic vocabulary GET/PATCH requests never award XP or qualify study.

Response: `{ status: "success", data: { updatedVocab, correct, xp: { awarded,
total, reason } } }`. Reasons: `awarded`, `already_awarded`, `incorrect`,
`daily_cap`. Incorrect/Again, duplicate and capped reviews still save progress
and qualify the day. Invalid input, missing words and unauthorized requests do not.

Rewards are 5 XP for correct quiz/writing and 2 XP for Hard/Medium/Easy.
The first positive reward wins across all modes per word per Vietnam day.
Incorrect/Again does not consume reward eligibility. The stable word key is a
SHA-256 hash of NFKC-normalized, trimmed, lowercase English text with collapsed
whitespace. Identical words in different lists, or deleted and recreated words,
share eligibility. A changed spelling is treated as a different word.

Daily vocabulary rewards cannot exceed 100 XP. A full reward must fit; no
partial rewards are issued. Dialogue XP is excluded. The source of the daily
sum is XPEvent. An internal StudyActivity vocabularyReviewVersion increment
serializes same-user/day transactions, including requests for different words
or requests with identical timestamps. Progress, qualification and XP commit
or roll back together. The XP event time, key date and study date use the same
server timestamp, fixed across retries. Midnight in Asia/Ho_Chi_Minh resets both
word eligibility and the daily cap.

Existing review intervals are preserved: Again/wrong +1 hour and reset count;
Hard 1/3/7/14 days, Medium or correct quiz/writing 3/7/14/30 days, Easy
7/14/30/60 days based on the prior review count. Practice reviews still obey XP
limits and qualify study, but do not update those progress fields. Existing
frontend legacy activity count writes remain separate and unchanged.

These are personal vocabulary records with readable answers, not proctored
exams; the endpoint verifies saved answers, ownership and reward limits, not
whether a person recalled an answer without help.
