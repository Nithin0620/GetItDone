# getitdone — Extended Plan

Illustrative numbers and UI examples in this document are concepts only, not real tracked data.

## 0. Locked decisions

| Decision | Choice |
| --- | --- |
| Users | Multi-user. Each person signs up, logs in, and sees only their own data. |
| Authentication | Google only (OAuth 2.0). No email/password screens. |
| Browser integration | Chrome extension (Manifest V3). Chrome and Edge share one build. |
| Database | MongoDB. |
| App shell | Next.js web app (pages: Dashboard, Tasks, Calendar, Workspaces, My Day, Analytics, Goals, Settings). |

Consequences of these choices:

- Every MongoDB document carries `userId`; every query and index is scoped by it.
- The extension does **not** run its own Google sign-in. The web app issues a per-user sync token; the user authorizes the extension once in its popup, and all extension writes go through our backend API with that token.
- Google Calendar access is requested **incrementally**, only when the user clicks "Connect Google Calendar". It stays optional so the core app works without it.
- Two-way Google Calendar sync requires push notifications (`watch`), a sync token, retry/reconciliation logic, and OAuth verification before a public launch. Treat it as a later phase.

## 1. Vision

One home for all the work: organized into workspaces, planned day by day, focused with a timer, measured with analytics, synchronized with Google Calendar, and enriched with automatic tracking of where time actually goes on the web.

## 2. Users, authentication and settings

- Google OAuth via Auth.js or Better Auth with the Google provider.
- `users` collection stores profile (name, email, avatar), preferences (theme, default view, timezone, week start, focus durations), and created/updated timestamps.
- On first login, create the default workspaces: DSA Preparation, Web Development, College, Projects, and General / Personal.
- Session management, logout, and account deletion (with cascading cleanup of that user's documents and sync mappings).
- Settings page: profile, appearance, focus durations, notification preferences, Google Calendar connection, extension sync token, data export/delete, page-tracking privacy controls.

## 3. Workspaces / lists

Concept dashboard:

- 💻 DSA Preparation — 42 tasks · 12 completed
- 🌐 Web Development — 24 tasks · 16 completed
- 🎓 College — 15 tasks · 8 completed
- 🚀 Projects — 10 tasks · 4 completed
- 📝 General / Personal — daily activities, errands, habits, miscellaneous tasks

Each workspace has:

- Name, emoji/icon, color, description, and personal ordering.
- Its own categories, tags, priorities, progress (derived from its tasks), and saved custom views.
- Its own notes, goals, and time reports.
- Archive/restore instead of hard delete, so completed projects stay without clutter.
- Progress calculation: completed tasks / total non-archived tasks, plus completion by category and priority.

## 4. Task model (advanced task management)

Every task supports:

- Title and description.
- Priority: `Low`, `Medium`, `High`, `Urgent`.
- Status: `Backlog`, `Todo`, `In Progress`, `Done`.
- Start date and due date.
- Estimated time (30 min, 1 hour, 2 hours, or custom minutes).
- Tags and categories.
- Subtasks / checklists (nested items with their own done state).
- Recurrence: daily, weekly, monthly, or custom interval; generates the next occurrence on completion.
- Attachments and reference links (links first; file uploads later).
- Notes and comments (task-level discussion with timestamps).
- Actual time spent, sourced from focus sessions and browser time events.
- Workspace ownership, sort order, completion timestamp, archive flag.
- Optional Google Calendar event mapping (`googleEventId`) and sync state.

Behaviors:

- Recurring tasks keep their history: completing one instance marks it done and creates the next instance rather than mutating the past.
- Estimated vs actual time is shown on the task detail page and fed into analytics.
- Overdue detection derives from `dueDate` and `status !== Done`.

## 5. Views and navigation

- **Dashboard** — workspace cards with progress, today's plan preview, overdue tasks, streaks, and recent focus.
- **Workspace detail** — task list with filters and saved custom views.
- **Custom views** — named saved filters (e.g. "Urgent this week", "Backlog", "Tagged DP") rendered as List, Board/Kanban by status, or Calendar by date.
- **My Day** — see section 6.
- **Inbox** — unsorted quick-captured tasks before organizing them into a workspace.
- **Calendar** — month/week view of tasks by due date plus synced Google Calendar events.
- **Goals** — see section 8.
- **Analytics** — see section 9.
- **Global search** — one shortcut/command palette searching tasks, notes, and workspaces across every workspace.
- **Archive** — completed projects, archived tasks, and archived workspaces.
- **Notes** — workspace-level notes (separate from task comments).

## 6. Daily planner / My Day

Dedicated page, e.g. "Thursday, November 26 — Daily plan".

- Combines tasks from all workspaces into today's focus list, e.g.:
  - 09:00–10:30 · DSA · Practice binary search problems
  - 11:00–12:00 · Web Development · Implement authentication
  - 14:00–15:00 · College · Complete software engineering practical
  - 17:00–17:30 · Personal · Review weekly goals
- Time blocks are editable; drag to reorder; tasks show workspace color.
- "Focus on this" starts a Pomodoro session attached to that task.
- Unfinished tasks can roll over to the next day with one action.
- Quick add into a chosen workspace without leaving the page.

## 7. Focus timer / Pomodoro

UI concept: `FOCUS SESSION 25:00 — Working on: Solve DP Problems — 25 min focus / 5 min break`.

- 25/5 sessions by default, with custom focus and break durations.
- Associate each session with a task (and therefore a workspace); unassociated sessions are allowed.
- Track actual time spent and compare with the task's estimated time.
- Daily and weekly focus reports by workspace, task, and time of day.
- Timer state survives refresh; idle time pauses the clock; completion triggers a notification.
- Optional automation: when a focus session starts, the Chrome extension can block distracting domains for its duration.

## 8. Goals and milestones

Especially useful for learning workspaces.

Example: **DSA goal — Solve 200 problems by December**, broken into:

- Arrays: 30 problems
- Binary Search: 20
- Trees: 30
- Graphs: 30
- Dynamic Programming: 40

Features:

- Goal title, description, deadline, workspace, target value and unit.
- Sub-goals/milestones with their own targets and deadlines.
- Progress derived from linked tasks, tags, or manual increments.
- Visual progress bars, remaining amount, days left, and coupling to streaks.
- Milestone completion events appear in analytics.

## 9. Productivity analytics

Dashboard answering "am I actually making progress?":

- Tasks completed per day / week / month.
- Completion rate by workspace, category, and priority.
- Time spent per workspace (focus sessions + browser time events).
- Most productive days and hours.
- Overdue tasks and aging backlog.
- Estimated vs actual time, overall and per task.
- Weekly productivity trends.
- Focus streaks and goal progress.
- Top visited sites/domains and how they map to workspaces.
- Date-range filters and CSV export.

All metrics come from aggregation pipelines over tasks, focus sessions, goals, and page-time events.

## 10. Quick capture and global utilities

| Feature | What it does |
| --- | --- |
| Quick capture | Add tasks instantly with a keyboard shortcut; lands in Inbox unless a workspace is chosen. |
| Global search | Search tasks across every workspace from one command palette. |
| Recurring tasks | Repeat daily, weekly, or monthly. |
| Calendar view | View tasks by date and month. |
| Reminders | Notifications before deadlines (in-app/browser; email or push later). |
| Notes | Maintain notes related to each workspace. |
| Archive | Keep completed projects without clutter. |
| Streaks | Track consecutive days of activity. |
| Inbox | Capture unsorted tasks before organizing them. |

## 11. Google Calendar integration

### 11.1 Connect

UI concept: a settings/integration card showing "Google Calendar — Not connected — Connect Google Calendar".

- Google OAuth 2.0 with the minimum scopes necessary: read events; create/update events; delete only if deleting synced events is supported.
- Connection state, connected account, and a disconnect button are stored per user.

### 11.2 Creating synced tasks

Task creation dialog concept:

- Task title: "Solve 5 Dynamic Programming problems"
- Due date: Nov 28, 2026
- Duration: 2 hours
- `[x] Add to Google Calendar`
- `[ ] Enable reminder`
- `Create task`

On submit, the backend creates the task and, if checked, the corresponding calendar event.

### 11.3 Two-way synchronization

| Action | Expected result |
| --- | --- |
| Create task in our app | Create Calendar event. |
| Change task date | Update Calendar event. |
| Change event time in Google Calendar | Update task schedule. |
| Delete synced task | Delete associated event, subject to user settings. |
| Complete task | Mark task completed; optionally update event description. |
| Create event in Google Calendar | Optionally import it into our app. |

Implementation details:

- Stable mapping between our task ID and Google's event ID, stored per user in a mapping document/collection.
- Google `events.watch` push notifications plus periodic `events.list` reconciliation with `syncToken` to catch missed webhooks.
- Conflict resolution using a single `updatedAt` clock plus an explicit "last edit source" field; user preference decides which side wins on ties.
- Retry queue with backoff, dead-letter entries, and visible errors in `calendar_sync_logs`.
- User setting: delete events on task deletion or keep them; import external events on or off.
- Publishing note: calendar scopes require Google OAuth verification for a public app; testing mode is fine during development.

## 12. End-to-end architecture

```text
Next.js Frontend           Dashboard · Tasks · Calendar · Workspaces · My Day · Analytics · Goals
        |
Backend API                Google auth · Task CRUD · Scheduling · Sync engine · Aggregations
        |
MongoDB                    Users · Tasks · Workspaces · Mappings · Time events · Logs
        |
Google Calendar API        Events · Watch notifications · Availability
        |
Background Sync Worker     Retries · Webhooks · Reconciliations
        |
Chrome MV3 Extension       Active-tab timer · Local buffer · Sync to backend with user token
```

Main flows:

- Task create/update → API → MongoDB → (if synced) Google Calendar → mapping/log update.
- Google event change → watch webhook → worker → reconcile with `syncToken` → MongoDB → UI updates.
- Chrome tab focus → extension timer → local buffer → periodic API batch → MongoDB time-series events → analytics and workspace mapping.
- Focus session start → timer in web app → optional extension domain blocking → session saved with actual duration.

## 13. MongoDB structure

Required collections:

| Collection | Purpose |
| --- | --- |
| `users` | User profiles and preferences |
| `workspaces` | DSA, Web Dev, College, etc. |
| `tasks` | All tasks and subtasks |
| `tags` | Custom labels |
| `focus_sessions` | Pomodoro and time tracking |
| `goals` | Long-term objectives |
| `calendar_integrations` | OAuth credentials and calendar settings |
| `calendar_sync_logs` | Sync history and errors |

Expanded document shapes and indexes:

- **users** — `googleId` (unique), name, email, avatar, preferences, theme, timezone, focus durations, createdAt, updatedAt.
- **workspaces** — `userId`, name, emoji, color, description, categories[], viewSettings, order, archivedAt. Index `{ userId: 1 }`.
- **tasks** — `userId`, `workspaceId`, title, description, status, priority, startAt, dueAt, estimatedMinutes, actualMinutes, tagIds[], category, checklist[], recurrence, attachments[], comments[], completedAt, archivedAt, `googleEventId`, `syncState`, `lastEditSource`, order. Indexes `{ userId: 1, workspaceId: 1 }`, `{ userId: 1, dueAt: 1 }`, `{ userId: 1, status: 1 }`. Subtasks can be embedded for small lists or stored in `tasks` with `parentTaskId` for large ones.
- **tags** — `userId`, name, color, workspaceId (or global), usage count. Index `{ userId: 1 }`.
- **focus_sessions** — `userId`, `taskId`, `workspaceId`, plannedMinutes, actualSeconds, startedAt, endedAt, pausedSeconds, source (`web`/`extension`). Index `{ userId: 1, startedAt: -1 }`.
- **goals** — `userId`, `workspaceId`, title, description, targetValue, unit, currentValue, deadline, milestones[], linkedTaskIds[]/tagIds[], createdAt. Index `{ userId: 1 }`.
- **calendar_integrations** — `userId`, provider (`google`), encrypted access/refresh tokens, scopes, calendarId, syncToken, channelId/resourceId/expiration, settings (delete behavior, import external events), connectedAt. Index `{ userId: 1, provider: 1 }` unique.
- **calendar_sync_logs** — `userId`, `taskId`, `googleEventId`, direction (`push`/`pull`), action, status, error, retryCount, timestamp. Index `{ userId: 1, timestamp: -1 }`.

Supporting collections:

- **page_time_events** — MongoDB time-series collection: `userId`, `domain`, optional path/title, startTime, endTime, activeSeconds, source (`chrome_extension`), workspaceId (from mapping rules), createdAt. Query with aggregation by day/week/domain/workspace.
- **domain_rules** — `userId`, domain, workspaceId/category, budgetMinutesPerDay, blockedDuringFocus. Index `{ userId: 1, domain: 1 }`.
- **notes** — `userId`, `workspaceId`, title, body, timestamps.
- **reminders** and **sync_tokens** — scheduled reminder jobs and hashed extension sync tokens with revocation.

Rule: every read/write filters on `userId`; ObjectIds never leak across users. The task ↔ Google event mapping is kept in `tasks.googleEventId` with the per-operation history in `calendar_sync_logs` (or a dedicated `calendar_event_mappings` collection if two-way sync grows complex).

## 14. Chrome extension: continuous webpage time tracking

### 14.1 Why an extension

A website cannot see which other tabs are open — browser sandboxing limits it to its own page. Per-page time tracking requires a Chrome extension using `tabs`, `windows`, `idle`, `storage`, `alarms` and, for blocking, `declarativeNetRequest`. The web app remains the dashboard and control plane.

### 14.2 How it works

- MV3 service worker receives `tabs.onActivated`, `windows.onFocusChanged`, and `idle` events; `chrome.alarms` drives periodic flushes because MV3 workers are ephemeral (no long-lived `setInterval`).
- Timer counts only the active tab of the focused window; a configurable idle threshold (e.g. 60–120 s) pauses tracking.
- Handles multiple windows, tab switches, tab close/navigation, and browser restarts by persisting open intervals in `chrome.storage.local` / IndexedDB.
- Strips query parameters and stores domain-level data by default; path/title capture is optional.
- Local buffer batches events to the backend using the user's sync token; retries on failure and shows sync status in the popup.
- Popup: today's time, top sites, tracking on/off, pause, privacy settings, sync status, "Open dashboard".

### 14.3 Dashboard analytics from extension data

- Daily and weekly time per domain/site, with category and workspace breakdowns.
- Mapping rules: `leetcode.com → DSA`, `github.com → Projects`, `youtube.com → Personal/Learning`, etc.
- Time budgets per domain or workspace, with daily/weekly progress.
- Comparison: time spent on a workspace vs estimated task time and focus sessions.
- Streaks and trends over time; drill-down from a workspace to the sites contributing to it.

### 14.4 Privacy and accuracy

- Opt-in with clear explanation; pause button and per-domain exclusions; incognito tracking off by default.
- Sensitive URLs (query strings, tokens) are never stored by default; domain-level aggregation first.
- Data export and deletion from settings; configurable retention period.
- "Active tab" is an approximation of attention, not proof of reading; video/audio tabs and multi-window usage need explicit handling rules.
- Minimal host permissions; no access to page contents unless a feature explicitly requires it.

### 14.5 Integration with the rest of the app

- Automatic time logging into tasks/workspaces: if a focus session tagged "DSA" runs while LeetCode is open, the interval feeds both the session and the workspace analytics.
- Optional distraction blocking during focus sessions via `declarativeNetRequest` and a user-managed block list.
- Browser time data is separate from focus sessions but displayed together in analytics.

## 15. Roadmap

**Current status:** Phases 0–5 complete; product is at launch-prep stage.

**Phase 0 — Foundation (complete):** Next.js app, Google auth, MongoDB connection, user model, layout/design system, default workspaces.

**Phase 1 — Core product (complete):** Workspaces, full task model, subtasks/tags/priorities/status/recurrence, List/Board/Calendar views, My Day, Inbox, quick capture, global search, archive, notes, reminders.

**Phase 2 — Time and insight (complete):** Pomodoro with task association, goals/milestones, productivity analytics, streaks, dashboard polish.

**Phase 3 — Chrome extension (complete):** Active-tab time tracking, domain mapping rules, popup, sync to backend, browser-time analytics and optional focus blocking.

**Phase 4 — Google Calendar (complete):** OAuth connection, one-way task → event sync, then two-way sync with webhooks, reconciliation, retries, and conflict rules.

**Phase 5 — Polish (complete):** Smart browser reminders, MongoDB GridFS attachments, JSON/CSV exports, deferred search, security headers, PWA metadata, health check, robots/sitemap, and launch prep.

**Launch checklist:** Use an HTTPS `AUTH_URL`, add both Google redirect URIs, verify the OAuth consent screen, set `MONGODB_URI` and `AUTH_SECRET`, run lint/typecheck/build, then submit Google OAuth verification if expanding scope beyond testing accounts.

## 16. Open questions

- Chrome tracker shipped in Phase 3.
- Visual direction: dark or light first; minimal and calm or colorful and energetic; any reference app to imitate?
- Deployment: personal cloud host vs managed platform; custom domain?
- Do you want reminders by email/push, or in-app/browser notifications only initially?
- Should file attachments be stored in the app or kept as reference links only?
- Any non-Chrome browsers later (Firefox, Safari), or Chrome-only forever?

## 17. Explicitly out of scope for now

- Team collaboration / shared workspaces and permissions.
- Email/password or other social login providers.
- Firefox/Safari extensions.
- Offline-first editing with full conflict-free sync.
- AI suggestions and automatic task generation.
