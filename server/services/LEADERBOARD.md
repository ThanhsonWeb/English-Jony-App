# Leaderboard API

`GET /api/v1/leaderboard` uses the existing authentication middleware.

Query parameters match the current rank UI:

- `period=week|month` (default `month`)
- `timeframe=current|previous` (default `current`)
- `limit=1..100` (default `10`)

The response is `{ status: "success", data: { ... } }`:

```json
{
  "period": "week",
  "timeframe": "current",
  "timeZone": "Asia/Ho_Chi_Minh",
  "start": "2026-09-13T17:00:00.000Z",
  "end": "2026-09-20T17:00:00.000Z",
  "limit": 10,
  "totalRanked": 1,
  "leaderboard": [
    {
      "id": "user-id",
      "rank": 1,
      "name": "Learner",
      "avatar": "/avatars/learner.png",
      "periodXp": 50,
      "lifetimeXp": 1200,
      "isCurrentUser": true
    }
  ],
  "currentUser": {
    "id": "user-id",
    "rank": 1,
    "name": "Learner",
    "avatar": "/avatars/learner.png",
    "periodXp": 50,
    "lifetimeXp": 1200,
    "isCurrentUser": true
  }
}
```

The signed-in user is always returned separately, including outside `limit`.
Without period XP they have `rank: null` and `periodXp: 0`; they are not inserted
into the ranked list. Lifetime XP comes from `User.totalXp`, defaulting to zero
for legacy records. Avatar comes from `User.photo`; missing photos return `""`.

XP is summed from `XPEvent.earnedAt >= start && earnedAt < end`, not `dayKey`,
activity counts, or the user's lifetime total. Weeks begin Monday at midnight
in Vietnam. Months begin on the first day. UTC boundaries are returned above.
Period boundaries and the clock are server-controlled; client-supplied dates are not used.

Positions are sequential, ordered by period XP descending, then ObjectId
ascending for stable ties. Deleted users are removed before assigning positions.
A single aggregation produces the list, current user's position, and count.
Only public identity and XP fields are returned; no email or authentication data.
Responses are private and not cacheable by shared caches.

The pipeline uses the existing `earnedAt` XPEvent index and MongoDB 5.0+
window functions. It aggregates all qualifying users before taking the top list;
materialized rankings/caching can be considered later if volume requires it.

Every leaderboard entry and `currentUser` also includes level fields, calculated
by `utils/learnerLevel.js` from `User.totalXp` alone. Period filters do not affect level.

- Level starts: 1 at 0 XP, 2 at 100, 3 at 250, 4 at 500, 5 at 1000.
- `currentLevelXp`: lifetime XP minus the current level's starting threshold.
- `nextLevelXp`: XP required to complete this level, or `null` at level 5.
- `progressPercent`: progress within the level (0–100); level 5 is always 100.

For example, 175 lifetime XP returns `level: 2`, `currentLevelXp: 75`,
`nextLevelXp: 150`, `progressPercent: 50`. At 1000 XP it returns level 5,
0 current-level XP, no next level, and 100% progress. Further XP is retained.
No separate level field is stored in MongoDB and no migration is needed.

The rank frontend consumes these fields directly.

Every returned user also has `streakDays` and `completedWeekdays` (seven booleans,
Monday through Sunday for the current Vietnam week). These describe current
study activity, independent of the selected XP ranking period.

Only StudyActivity records with `hasQualifiedStudy: true` count. The streak
counts backward from today if qualified, otherwise from yesterday, stopping at
the first missing day. Future days are excluded. Dates use Asia/Ho_Chi_Minh.

Successful dialogue completion, including a replay awarding zero XP, marks the
day inside the completion transaction. `firstStudyAt` and `lastStudyAt` retain
the earliest and latest completion timestamps. Qualification never increments
`count`: existing values remain intact and new qualification-only rows start at
zero. The legacy activity endpoint still increments count without qualifying
the day. Old activity records are not backfilled into streaks. No vocabulary
XP changes are included.
