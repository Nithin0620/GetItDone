# getitdone

getitdone is a calm, multi-user productivity app built with Next.js, TypeScript, React, MongoDB and Google sign-in. It combines tasks, workspaces, My Day, notes, goals, Pomodoro focus sessions, productivity analytics, Chrome-based website time tracking and two-way Google Calendar sync in one minimal interface.

This README is intentionally extended. It covers product behavior, architecture, local setup, environment variables, API contracts, data model, browser extension, calendar sync, deployment and troubleshooting.

## Table of contents

- [Quick start](#quick-start)
- [What is included](#what-is-included)
- [Product tour](#product-tour)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Authentication](#authentication)
- [State and persistence](#state-and-persistence)
- [Data model](#data-model)
- [MongoDB collections](#mongodb-collections)
- [API reference](#api-reference)
- [Chrome extension](#chrome-extension)
- [Google Calendar sync](#google-calendar-sync)
- [Reminders](#reminders)
- [Attachments](#attachments)
- [Exports](#exports)
- [Analytics](#analytics)
- [Settings](#settings)
- [Security notes](#security-notes)
- [Performance notes](#performance-notes)
- [Verification](#verification)
- [Deployment checklist](#deployment-checklist)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Commands](#commands)

## Quick start

Install dependencies:

```bash
npm install
```

Copy the environment template:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

With no credentials configured, the app runs in local demo mode. Data is stored in the browser under the `getitdone:state:v1` localStorage key. Google sign-in, MongoDB sync, extension sync, calendar sync, attachments and server exports require credentials.

To verify the codebase:

```bash
npm run lint
npm run typecheck
npm run build
```

## What is included

The application was implemented in phases:

1. Foundation: Next.js app shell, design system, Google auth, MongoDB connection, user model.
2. Core product: workspaces, tasks, board/list/calendar views, My Day, Inbox, search, notes, archive, quick capture.
3. Time and insight: Pomodoro timer, task-linked focus sessions, goals, milestones, streaks and analytics.
4. Browser integration: Chrome MV3 extension, per-domain time tracking, popup, domain rules, sync token and web-time analytics.
5. Google Calendar: incremental OAuth consent, token refresh, two-way event sync, watch webhooks and conflict resolution.
6. Polish: smart reminders, GridFS attachments, JSON/CSV exports, PWA metadata, robots, sitemap, health check and security headers.

All phases are implemented. External steps such as Google OAuth consent verification and production deployment remain manual.

## Product tour

### Today dashboard

The home page is the daily control center. It shows:

- Tasks marked for My Day.
- Focus time accumulated today.
- Current streak.
- Goals preview.
- Workspace shortcuts.
- Quick capture affordances.

Keyboard shortcuts:

- `N` opens quick capture.
- `⌘K` or `Ctrl+K` opens the command menu.
- `Esc` closes modals and the task drawer.

### Workspaces

The Workspaces page lists active workspaces. A workspace detail page supports:

- Task list view.
- Board view with drag-and-drop status changes.
- Calendar view grouped by due date.
- Workspace notes.
- Workspace settings such as name, icon, color and categories.

### Inbox

Tasks without a workspace land in Inbox. This is the fastest place to capture something before deciding where it belongs.

### My Day

My Day is a deliberate daily plan. It shows:

- Tasks specifically selected for today.
- Tasks with due dates.
- Overdue tasks.
- A direct `Focus` button for starting a Pomodoro on a task.
- A rollover action for unfinished items.

### Search

Search covers tasks, notes and workspaces. It uses `useDeferredValue` so typing stays responsive while filtering larger datasets.

### Notes

Notes can be workspace-scoped or global. The editor is intentionally simple and fast.

### Goals

Goals support:

- Target value and unit.
- Manual current value.
- Linked tag.
- Deadline.
- Milestones.

Goal progress is derived from linked tasks, tags and manual values.

### Analytics

Analytics shows:

- Tasks completed in the last seven days.
- Focus minutes per day.
- Completion rate.
- Consecutive active-day streak.
- Completion by workspace.
- Focus by workspace.
- Estimated versus actual focus time.
- Web time by site when the Chrome extension is connected.
- Web time trend.
- Most productive day and overdue count.

### Archive

Archived tasks and workspaces can be restored from Archive.

## Architecture

The app uses a client-heavy state model with server-side persistence.

```text
Browser
  |
  |-- Next.js App Router pages
  |-- StoreProvider (React context)
  |     |-- localStorage in demo mode
  |     `-- /api/state when signed in
  |
  |-- Chrome extension
  |     |-- active-tab timer
  |     |-- local event buffer
  |     `-- /api/extension/* with bearer token
  |
  `-- Google Calendar
        |-- OAuth callback
        |-- sync API
        `-- webhook notifications

Server
  |
  |-- Auth.js Google provider
  |-- MongoDB collections
  |-- GridFS attachment bucket
  `-- Google Calendar REST API
```

Key architectural decisions:

- Every user-owned Mongo document carries `userId`.
- Every query is scoped by `userId`.
- The extension never signs in with Google. It receives a per-user sync token from the web app.
- Google Calendar tokens are stored server-side, not in browser storage.
- Local demo mode and cloud mode share the same `AppState` shape.
- Old state documents are normalized through `normalizeState` so new fields do not break existing data.

## Project structure

```text
.
|-- app/
|   |-- api/
|   |   |-- attachments/
|   |   |-- auth/[...nextauth]/
|   |   |-- calendar/
|   |   |-- export/
|   |   |-- extension/
|   |   |-- health/
|   |   |-- state/
|   |   `-- web-time/
|   |-- archive/
|   |-- analytics/
|   |-- goals/
|   |-- inbox/
|   |-- manifest.ts
|   |-- myday/
|   |-- notes/
|   |-- robots.ts
|   |-- search/
|   |-- settings/
|   |-- sitemap.ts
|   |-- workspaces/
|   |-- globals.css
|   |-- icon.svg
|   `-- layout.tsx
|-- components/
|   |-- AppShell.tsx
|   |-- AuthButton.tsx
|   |-- CommandMenu.tsx
|   |-- FocusTimer.tsx
|   |-- QuickAdd.tsx
|   |-- StoreProvider.tsx
|   |-- TaskDrawer.tsx
|   `-- TaskRow.tsx
|-- extension/
|   |-- manifest.json
|   |-- popup.html
|   |-- popup.js
|   |-- service-worker.js
|   `-- styles.css
|-- lib/
|   |-- analytics.ts
|   |-- cors.ts
|   |-- export.ts
|   |-- extension-auth.ts
|   |-- google-calendar.ts
|   |-- mongodb.ts
|   |-- seed.ts
|   |-- types.ts
|   `-- utils.ts
|-- auth.ts
|-- next.config.ts
|-- package.json
|-- plan.md
|-- tsconfig.json
`-- .env.example
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values you need.

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTH_GOOGLE_ID` | For Google login and calendar OAuth | OAuth client ID from Google Cloud Console. |
| `AUTH_GOOGLE_SECRET` | For Google login and calendar OAuth | OAuth client secret. |
| `AUTH_SECRET` | For production auth | Secret used by Auth.js to sign/session tokens. Generate with `openssl rand -base64 32`. |
| `MONGODB_URI` | For cloud persistence and server features | MongoDB Atlas or self-hosted MongoDB connection string. |
| `MONGODB_DB` | No | Database name. Defaults to `getitdone` in code when omitted. |
| `AUTH_URL` | For deployed OAuth callbacks and calendar webhooks | Public base URL. Locally `http://localhost:3000`. |
| `NEXTAUTH_URL` | Fallback | Used only if `AUTH_URL` is omitted. |

Auth is considered enabled only when all three of these are present:

```text
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
MONGODB_URI
```

If any are missing, `authEnabled` is false and the app behaves as a local demo.

### Google redirect URIs

Add both of these in the Google Cloud OAuth client configuration:

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/calendar/callback
```

For production, use your HTTPS domain instead of `localhost:3000`.

### Calendar scope

The calendar connect flow requests:

```text
https://www.googleapis.com/auth/calendar.events
```

This scope allows reading and writing events and establishing a watch channel on the primary calendar.

## Local development

Start the dev server:

```bash
npm run dev
```

If port 3000 is already in use, identify the process:

```bash
ss -ltnp '( sport = :3000 )'
```

Then stop it:

```bash
kill <pid>
```

Run all checks:

```bash
npm run lint && npm run typecheck && npm run build
```

Run production build locally:

```bash
npm run build
npm start
```

Useful local URLs:

```text
http://localhost:3000
http://localhost:3000/settings
http://localhost:3000/analytics
http://localhost:3000/api/health
```

The health endpoint returns:

```json
{
  "ok": true,
  "timestamp": "...",
  "auth": false,
  "mongo": false
}
```

## Authentication

Authentication uses Auth.js v5 with the Google provider only.

Flow:

1. User clicks Google sign-in.
2. Auth.js exchanges the code with Google.
3. The `signIn` callback upserts a user document in MongoDB.
4. A `userId` is attached to the JWT and session.
5. API routes read `session.user.id` and scope all queries by it.

Session strategy:

```text
JWT
```

There is no email/password login and no separate registration screen.

The user document contains:

```text
userId
googleId
name
email
image
settings
createdAt
updatedAt
```

## State and persistence

### Demo mode

When auth is disabled, all state lives in localStorage:

```text
getitdone:state:v1
```

There is no server sync in demo mode. Reloading the browser restores the local snapshot.

### Cloud mode

When signed in:

1. State is loaded from `GET /api/state`.
2. If the user has no state yet, seed state is created server-side.
3. Client changes are debounced and sent through `PUT /api/state`.
4. The server replaces user-owned collections with the submitted state.

Cloud sync is bulk-document replacement rather than fine-grained diffing. This keeps the client model simple and works well for personal-scale datasets.

### Normalization

`normalizeState` adds missing defaults for older documents. It currently guards:

- `focusSessions`
- `goals`
- `domainRules`
- task `calendarSyncState`
- all `settings` fields

This allows new fields to be introduced without migrating every existing document first.

## Data model

The core client-side state is `AppState`:

```ts
interface AppState {
  version: 1;
  workspaces: Workspace[];
  tasks: Task[];
  notes: Note[];
  tags: Tag[];
  focusSessions: FocusSession[];
  goals: Goal[];
  domainRules: DomainRule[];
  settings: Settings;
}
```

### Task

Important task fields:

```text
id
workspaceId
title
description
status
priority
startDate
dueDate
estimatedMinutes
reminderAt
remindedAt
tags
category
checklist
recurrence
links
comments
completedAt
archived
myDay
dayBlock
calendarEventId
calendarSyncState
calendarUpdatedAt
calendarSyncError
order
createdAt
updatedAt
```

`calendarSyncState` values:

- `local`: changed locally and waiting to push.
- `synced`: last known state agrees with Google.
- `conflict`: changed in both places and awaiting user choice.

### Settings

```text
theme
notifications
focusMinutes
breakMinutes
reminderLeadMinutes
calendarSyncEnabled
```

### DomainRule

```text
id
domain
workspaceId
category
budgetMinutesPerDay
blockedDuringFocus
```

Domain rules are used by the Chrome extension for workspace mapping, budgets and focus-time blocking.

## MongoDB collections

`ensureIndexes` creates or maintains indexes for:

```text
users
workspaces
tasks
tags
notes
focus_sessions
goals
calendar_integrations
calendar_oauth_states
calendar_sync_logs
domain_rules
extension_tokens
page_time_events
attachments.files
```

### users

One document per Google account.

### workspaces, tasks, tags, notes

Mirror the client state collections. Every document includes `userId`.

### focus_sessions

Stores Pomodoro sessions from the web app. The extension can also contribute sessions with `source: "extension"`.

### goals

Stores goals and milestones.

### domain_rules

Stores extension mapping and blocking rules.

### extension_tokens

Stores hashed bearer tokens for extension sync. The raw token is shown only when generated.

Token fields:

```text
userId
tokenHash
createdAt
lastUsedAt
revokedAt
```

### page_time_events

Time-series collection for website time.

```text
timeField: startTime
metaField: userId
granularity: minutes
```

Each event contains:

```text
userId
domain
title
startTime
endTime
activeSeconds
workspaceId
createdAt
```

### calendar_integrations

Stores Google Calendar OAuth credentials and sync state:

```text
userId
accessToken
refreshToken
tokenExpiresAt
scope
calendarId
syncToken
channelId
channelResourceId
channelToken
channelExpiration
connectedAt
lastSyncedAt
status
lastError
```

### calendar_oauth_states

Short-lived OAuth `state` documents used for CSRF protection. They expire through a TTL index.

### calendar_sync_logs

Append-only log of sync runs with pulled, pushed and conflict counts.

### attachments.files and attachments.chunks

GridFS bucket named `attachments`. File metadata includes:

```text
userId
taskId
contentType
uploadedAt
```

## API reference

All routes are under `/api`.

### `/api/state`

Authentication: Google session.

Methods:

- `GET`: load the current user's full state.
- `PUT`: replace the current user's state collections.

### `/api/health`

Authentication: none.

Returns service status and whether auth/Mongo are configured.

### `/api/web-time`

Authentication: Google session.

Returns last seven days of browser-time events aggregated by domain and UTC day.

Response shape:

```json
{
  "items": [
    { "domain": "example.com", "day": "2026-11-27", "seconds": 1200 }
  ]
}
```

### `/api/export`

Authentication: Google session.

Query:

```text
?format=json
?format=csv
```

Returns a downloadable file with `Content-Disposition: attachment`.

### `/api/attachments`

Authentication: Google session.

Methods:

- `GET ?taskId=...`: list attachments for a task.
- `POST`: multipart upload with `taskId` and `file`.

Maximum upload size is 10 MB.

### `/api/attachments/[id]`

Authentication: Google session.

Methods:

- `GET`: download the file.
- `DELETE`: remove the file.

Ownership is checked against GridFS metadata.

### `/api/extension/token`

Authentication: Google session.

Methods:

- `GET`: return the current raw token if newly created, otherwise `token: null`.
- `DELETE`: revoke all active tokens.

### `/api/extension/config`

Authentication: bearer token.

Returns:

```json
{
  "domainRules": [],
  "focusActive": false,
  "settings": null
}
```

### `/api/extension/events`

Authentication: bearer token.

Methods:

- `POST`: batch insert page-time events.
- `OPTIONS`: CORS preflight.

### `/api/calendar/connect`

Authentication: Google session.

Redirects the browser to Google OAuth consent with calendar scope and a stored `state`.

### `/api/calendar/callback`

Authentication: Google session plus OAuth `state` verification.

Exchanges the authorization code, stores tokens and runs an initial sync.

### `/api/calendar/status`

Authentication: Google session.

Returns connection status, last sync time, channel expiration, last error and conflict count.

### `/api/calendar/conflicts`

Authentication: Google session.

Returns tasks whose local and remote changes overlap.

### `/api/calendar/resolve`

Authentication: Google session.

Body:

```json
{ "taskId": "...", "choice": "local" }
```

or:

```json
{ "taskId": "...", "choice": "google" }
```

### `/api/calendar/sync`

Authentication: Google session.

Runs a manual sync.

### `/api/calendar/disconnect`

Authentication: Google session.

Stops the watch channel, deletes integration state and marks calendar-linked tasks as locally dirty.

### `/api/calendar/webhook`

Authentication: Google channel ID and channel token headers.

Triggers sync when Google sends change notifications.

## Chrome extension

The extension lives in `extension/` and uses Chrome Manifest V3.

Files:

```text
manifest.json
service-worker.js
popup.html
popup.js
styles.css
```

Permissions:

```text
tabs
idle
storage
alarms
declarativeNetRequest
<all_urls>
```

### Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `/home/nithin/Projects/getitdone/extension`.
5. Open the extension popup.
6. Set Dashboard URL to `http://localhost:3000`.
7. Paste a sync token from Settings → Time tracking extension.
8. Click Connect.

### Tracking behavior

The service worker:

- Tracks the active tab in the focused window.
- Records hostname only, not full URLs or query strings.
- Strips `www.` from domains.
- Ignores `chrome://`, `about:` and extension pages.
- Closes the current interval on tab change, window blur, tab close, idle or lock.
- Buffers events locally.
- Flushes events every minute.
- Loads remote config every minute.
- Applies focus-time blocking rules when a focus session is running.

Events shorter than five seconds are discarded.

### Sync token flow

1. Signed-in user clicks Generate token in Settings.
2. Server creates a random token, hashes it with SHA-256 and stores the hash.
3. Raw token is shown once.
4. Extension sends it as `Authorization: Bearer <token>`.
5. Server hashes incoming token and resolves the owning user.
6. Revoking the token immediately invalidates the extension.

### Popup

The popup shows:

- Connection state.
- Tracking state.
- Time spent today.
- Current tab.
- Top sites today.
- Pending event count or sync error.
- Open dashboard and Disconnect actions.

### Focus blocking

If a domain rule has `blockedDuringFocus` enabled and the web app has a running focus session, the extension creates a declarativeNetRequest rule to block that domain during focus. Config polling removes the rules when the session ends.

## Google Calendar sync

Calendar sync is implemented in `lib/google-calendar.ts`.

### Connection

1. Settings → Google Calendar → Connect.
2. User grants `calendar.events`.
3. Callback stores access token, refresh token and token expiry.
4. Initial sync runs.
5. A watch channel is created when possible.

### Two-way sync

Local to Google:

- Tasks with `calendarSyncState: "local"`, a due date and `archived: false` are pushed.
- Tasks without `calendarEventId` create a new event.
- Tasks with `calendarEventId` update the existing event.
- The event body includes `extendedProperties.private.getitdoneTaskId`.

Google to local:

- Remote changes are pulled incrementally using Google `syncToken`.
- Initial sync looks back 30 days.
- New events become local tasks.
- Matching events update local task title, description and due date.
- Cancelled events archive the linked task.

### Conflict rule

If a task was changed locally while Google also changed the linked event, the task is marked `conflict`. The local version is preserved. Settings shows the conflict with:

- Keep local: mark the task dirty so local state is pushed on next sync.
- Use Google: overwrite local task fields with the Google event.

### Token refresh

Before every sync, `ensureAccessToken` checks expiry. If the token expires within 60 seconds, it refreshes using the stored refresh token and persists the new access token.

### Watch notifications

`setupWatch` creates a channel at:

```text
/api/calendar/webhook
```

It renews the channel when fewer than 24 hours remain. Watch channels from Google are normally short-lived and require a publicly reachable HTTPS endpoint.

### Auto-sync toggle

Settings → Auto-sync tasks with due dates controls whether webhook notifications trigger sync. Manual Sync always works regardless of the toggle when the calendar is connected.

## Reminders

Reminders are handled in `AppShell`.

Behavior:

- Checks every 30 seconds.
- Uses a custom `reminderAt` when present.
- Falls back to `dueDate` using `reminderLeadMinutes`.
- Fires an in-app toast and, if permission is granted, a browser notification.
- Marks `remindedAt` so the same reminder does not repeat.
- Ignores reminders older than six hours.

If the reminder or due date changes, the task drawer clears `remindedAt` so the new time can fire.

Settings allows selecting:

```text
At due time
5m before
10m before
15m before
30m before
60m before
1 day before
```

Browser notifications require permission and the app tab must be open.

## Attachments

Attachments use MongoDB GridFS.

Features:

- Upload from the task drawer.
- List files by task.
- Download original filename.
- Delete file.
- Ownership enforced through metadata.
- 10 MB per-file limit.

Signed-out users see a prompt to sign in before attaching files.

## Exports

Exports are available in Settings → Data.

Formats:

- JSON: full `AppState` snapshot.
- CSV: flat task list.

In demo mode, exports are generated in the browser with Blob URLs. In cloud mode, the browser downloads from `/api/export`, which reads the user's MongoDB state directly.

CSV columns:

```text
id
title
workspace
status
priority
dueDate
startDate
tags
description
completedAt
archived
```

Attachments are not embedded in exports.

## Analytics

Analytics derives most values from local state:

- `lib/analytics.ts` contains date and aggregation helpers.
- `lastDays(7)` builds the date buckets.
- Focus sessions are filtered to ended sessions.
- Web-time data comes from `/api/web-time`.

Web-time analytics are only available to signed-in users because the extension sync path is token-authenticated.

## Settings

Settings sections:

1. Appearance: light/dark theme.
2. Focus timer: focus and break length.
3. Reminders: notification permission and lead time.
4. Google Calendar: connect, sync, disconnect, conflicts, auto-sync.
5. Time tracking extension: sync token and domain rules.
6. Data: storage mode, reset and exports.

Domain rule controls:

- Add domain.
- Map to workspace.
- Set daily budget in minutes.
- Block during focus sessions.
- Delete rule.

## Security notes

Implemented protections:

- User-scoped Mongo queries.
- Hashed extension tokens.
- Random OAuth state with TTL cleanup.
- Bearer-token authentication for extension APIs.
- CORS headers only on extension endpoints.
- Channel-token verification for calendar webhooks.
- Ownership checks for GridFS downloads and deletes.
- Security headers on all routes.
- `poweredByHeader: false`.
- No secrets logged in normal app flow.

Important security practices for deployment:

- Use a real `AUTH_SECRET`.
- Use HTTPS.
- Restrict MongoDB network access.
- Keep the Google OAuth client secret server-only.
- Revoke extension tokens if a token is leaked.
- Review Google OAuth consent screen before public launch.

## Performance notes

- Search input uses `useDeferredValue`.
- State writes are debounced before sending to `/api/state`.
- Auth.js JWT sessions avoid a database session lookup on every request.
- Mongo indexes cover common user-scoped queries.
- Page-time events use a time-series collection.
- Analytics aggregates web time server-side before returning it.
- Extension events are flushed in batches once per minute.
- DOM rendering stays lightweight with CSS-driven layouts and no chart library.

## Verification

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Expected:

- ESLint passes with zero warnings.
- TypeScript passes with no errors.
- Next.js build completes and lists all app routes.

Smoke checks used during development:

```text
/                              200
/settings                      200
/analytics                     200
/goals                         200
/api/health                    200
/api/state                     401 when signed out
/api/extension/config          401 without token
/api/extension/events          401 without token
/api/calendar/status           401 when signed out
/api/calendar/webhook          200 for unknown channel
OPTIONS /api/extension/events  204 with CORS headers
```

Extension JavaScript syntax can be checked with:

```bash
node --check extension/service-worker.js
node --check extension/popup.js
node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8'))"
```

## Deployment checklist

Before deploying:

1. Set `AUTH_URL` to the public HTTPS origin.
2. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
3. Set a strong `AUTH_SECRET`.
4. Set `MONGODB_URI` and optionally `MONGODB_DB`.
5. Add production Google redirect URIs.
6. Configure the OAuth consent screen.
7. Confirm the calendar scope is allowed for your Google Cloud project.
8. Run lint, typecheck and build.
9. Verify `/api/health`.
10. Sign in with a test Google account.
11. Create a workspace, task, note and goal.
12. Test cloud reload persistence.
13. Test extension token generation and event sync.
14. Test calendar connect and manual sync.
15. Test attachment upload and download.
16. Test JSON and CSV export.
17. Configure backups for MongoDB.
18. Submit OAuth verification if the app will be used by users outside your test project.

## Troubleshooting

### Port 3000 already in use

Identify:

```bash
ss -ltnp '( sport = :3000 )'
```

Stop:

```bash
kill <pid>
```

### Google sign-in is not visible

Check that all of these are set:

```text
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
MONGODB_URI
```

If any are missing, `authEnabled` is false and the app stays in local demo mode.

### Calendar connect fails

Common causes:

- Missing redirect URI in Google Cloud Console.
- Wrong `AUTH_URL`.
- OAuth consent screen not configured.
- Calendar API scope not enabled or not allowed.
- Browser blocked the redirect because of cookie settings.

### Calendar webhook does not fire

Google watch channels require a publicly reachable HTTPS address. `localhost` cannot receive Google webhooks. Manual sync still works locally.

### Extension shows Sync offline

Check:

- Dashboard URL is correct.
- Token was copied correctly.
- Token was not revoked.
- User is still signed in on the web app.
- `/api/extension/events` is reachable.

### Extension does not block sites

Check:

- Domain is in Settings → Domain rules.
- `blockedDuringFocus` is enabled.
- A focus session is currently running.
- Extension has been restarted after config changes.
- Domain spelling matches the hostname without `www.`.

### Attachments fail

Check:

- User is signed in.
- File is under 10 MB.
- MongoDB is reachable.
- GridFS indexes were created successfully.

### Build fails after a dev server is killed or restarted

Remove the stale build cache:

```bash
rm -rf .next
npm run build
```

Do not run `next dev` and `next build` against the same `.next` directory at the same time.

### Reminders do not appear

Check:

- Notifications are enabled in Settings.
- Browser permission is granted.
- The app tab is open.
- Task has `reminderAt` or a due date.
- Reminder is not older than six hours.
- Task is not completed or archived.

## Known limitations

- Browser notifications require the app to be open; there is no Web Push subscription backend.
- Google watch channels require public HTTPS and are short-lived.
- OAuth consent verification is an external Google process.
- Local demo mode cannot sync extension or calendar data because those APIs require a session token.
- Attachments are not included in JSON/CSV exports.
- Remote calendar changes do not overwrite locally dirty tasks; they become conflicts by design.
- Website tracking is Chrome/Edge MV3 only.
- The extension stores hostname-level data, not full page URLs.
- Time-series creation depends on MongoDB supporting time-series collections.
- Bulk state replacement is simple but not designed for very large datasets or multi-device real-time collaboration.

## Commands

```bash
npm install
npm run dev
npm run build
npm start
npm run lint
npm run typecheck
```

Utility commands:

```bash
cp .env.example .env.local
openssl rand -base64 32
rm -rf .next
```

Extension syntax checks:

```bash
node --check extension/service-worker.js
node --check extension/popup.js
```

## Final notes

getitdone is organized so the product can be extended incrementally without changing the core state shape. New features should:

1. Add types to `lib/types.ts`.
2. Add defaults to `lib/seed.ts`.
3. Normalize old documents in `normalizeState`.
4. Add user-scoped Mongo collections and indexes.
5. Expose narrow API routes.
6. Surface controls in the existing Settings or Analytics pages.
7. Run lint, typecheck and build before finishing.

The full product and implementation plan is in `plan.md`.
