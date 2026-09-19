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

The frontend is not connected. Its mock `kn` maps to `periodXp`, `avatar` to
`avatar`, and `rank` to `rank`. Streaks, level progress, and weekday activity are
not supplied or fabricated by this API. No vocabulary changes are included.
