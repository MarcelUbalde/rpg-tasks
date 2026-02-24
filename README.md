# RPG Tasks

A lightweight task tracker that rewards you with RPG-style level-ups for completing story-pointed tasks.

## Stack

- Node.js 22+ (uses built-in `node:sqlite` — no native compilation required)
- Express 4
- Vitest (unit tests)
- Vanilla JS + Canvas (no frontend framework, no bundler)

## Quickstart

```bash
npm install
npm test     # 5 unit tests — all pass
npm start    # → http://localhost:3000
```

Open http://localhost:3000 in your browser.

## Development

```bash
node --watch server/index.js   # auto-restarts on file changes
```

## Project Structure

```
server/
  index.js                Entry point, Express setup
  domain/                 Pure business logic (no side effects)
    User.js               levelUpCost, applyExpGain, getAvatarColor
    Task.js               Task value object
    RewardService.js      Core reward logic — calls applyExpGain
  application/
    completeTask.js       Use case: duplicate check, reward, persist
  infrastructure/
    db.js                 SQLite setup (node:sqlite) + migrations
    repositories/
      userRepository.js
      rewardRepository.js
      logRepository.js
  routes/                 HTTP handlers (validate input, call use case)
    user.js
    tasks.js
    log.js
public/                   Static frontend (no build step)
  index.html
  styles.css
  avatar.js               Canvas avatar rendering
  api.js                  fetch wrappers
test/
  completeTask.test.js    5 unit tests (zero DB dependency)
```

## API

```
GET  /api/user                → { id, level, exp, gold }
POST /api/tasks/complete      body: { taskId, storyPoints }
GET  /api/log?limit=10        → array of log entries (newest first)
```

### POST /api/tasks/complete

| Scenario | Response |
|----------|----------|
| Duplicate taskId | `{ rewarded: false, reason: "duplicate" }` |
| storyPoints < 1 | HTTP 400 |
| Normal reward | `{ rewarded: true, newLevel, newExp, levelsGained, logEntry }` |

## EXP / Level Progression

Each completed task grants EXP equal to its story points.
Cost to advance from level N to N+1 follows Fibonacci: 1, 2, 3, 5, 8, 13 …

| Transition | EXP cost |
|-----------|---------|
| 1 → 2 | 1 |
| 2 → 3 | 2 |
| 3 → 4 | 3 |
| 4 → 5 | 5 |
| 5 → 6 | 8 |

A single task can trigger multiple level-ups if it grants enough EXP.

## Avatar Colors

| Level | Color |
|-------|-------|
| 1 | Gray |
| 2–3 | Green |
| 4–5 | Blue |
| 6–7 | Purple |
| 8+ | Gold |

## Architecture

The codebase follows a light Domain-Driven Design approach:

- **Domain layer** (`server/domain/`) — pure functions, zero dependencies. Fully testable in isolation.
- **Application layer** (`server/application/`) — orchestrates the use case. Repositories are injected, making unit tests trivial (pass mock objects — no real DB).
- **Infrastructure layer** (`server/infrastructure/`) — SQLite via `node:sqlite`. Prepared statements compiled once at module load.
- **Routes** — thin: validate input, call use case, return JSON.

---

## Next Steps: Jira Integration

To sync with Jira **without touching domain logic**:

1. Add `server/infrastructure/jiraClient.js` — wraps Jira REST API calls
2. Add a polling service `server/infrastructure/jiraPoller.js` that:
   - Queries Jira for recently resolved issues (status = Done)
   - Calls `completeTask(useCase)` with the Jira issue key as `taskId` and its story points
   - The duplicate-check in the use case prevents double-rewarding on re-poll
3. For webhooks: add `POST /api/jira/webhook` route that maps the Jira payload and calls the same `completeTask` use case
4. `server/domain/User.js` and `server/domain/RewardService.js` need **zero changes**

The key design decision that enables this: `completeTask` receives repos as parameters, so any caller (HTTP route, poller, webhook handler) can invoke the same use case with the same business rules.
