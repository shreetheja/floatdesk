# @floatdesk/react

## 3.0.0

### Major Changes

- 3d80c25: feat: Book a call

## 2.2.0

### Minor Changes

- Add unread indicator (toast + dot badge) and new-user signup session notifications.

  **@floatdesk/react**

  - `<SupportWidget>` now accepts `signupUser` and `signupMessage` props. On first mount for a new user identity, the widget calls `POST /api/session` to post a configurable message to Slack. Deduplication via `localStorage` ensures the notification fires exactly once per user — never on subsequent page loads.
  - Background polling (every 15 s) now runs whether the widget panel is open or closed. When a new agent message arrives while the panel is closed, a **toast popup** slides up near the FAB with the sender name and message preview (auto-dismisses after 4 s), and a **red dot badge** appears on the FAB until the widget is opened.
  - Clicking the toast opens the widget directly to the relevant thread.
  - Session threads appear in the ticket list with a distinct blue `MessageCircle` icon.
  - New `Toast` component exported for standalone use.

  **@floatdesk/sdk**

  - `Ticket.type` now accepts `'session'` in addition to `'bug'` and `'feature'`. No storage migration required — existing Postgres, Mongo, and Memory adapters are fully compatible.
  - New `createSessionTicket(fields, storage, channels)` service function — validates input with Zod, resolves `{name}` / `{email}` / `{url}` placeholders in the message template, posts to all channels, and persists to storage.
  - New `POST /api/session` route added to the Express adapter (and `createExpressRouter`).
  - `SlackChannel.postTicket` handles the `'session'` type with a `👋` emoji and `Session` label.
  - `createSessionTicket` is exported from `@floatdesk/sdk`.

## 2.1.0

### Minor Changes

- Add GCS media provider, ticket list view, thread media uploads, and Slack reply sync fixes

  **New features**

  - `GCSMediaProvider` — upload screenshots and recordings to Google Cloud Storage; `projectId` is optional (inferred from ADC when running on GCP)
  - `SupportWidget` now shows a **Your Tickets** list on open when previous tickets exist in localStorage; tickets are persisted across page reloads
  - Thread replies support media attachments (screenshot / screen recording); sent as multipart and forwarded to Slack as image blocks
  - Media UI (screenshot/record buttons) is automatically hidden when no media provider is configured on the server — driven by a new `media: boolean` field in the `/health` response

  **Bug fixes**

  - Slack reply sync: `channelRefs` (including Slack `thread_ts`) are now written to storage before ticket creation, so `findTicketByChannelRef` reliably matches inbound events
  - Slack echo: bot messages with `bot_id` set are filtered in `processEvent` to prevent user widget replies from appearing twice
  - `stream is not readable`: replaced custom raw-body middleware with `express.json({ verify })` so the request stream is read only once
  - `PostgresAdapter`: optional `ssl` config + automatic SSL when connecting to a non-localhost host; respects `?sslmode=require` / `?sslmode=no-verify` in the connection URL
  - `SlackChannel.signingSecret` is now optional — bot token + channel ID alone are sufficient for posting tickets; signing secret is only needed for agent reply sync
  - Type dropdown in ticket form replaces pill buttons (previous pills used Tailwind classes that weren't bundled)

## 2.0.0

### Major Changes

- Attachements server and fixes for slack

## 1.1.0

### Minor Changes

- 450b0de: Changed access modes

## 1.0.0

### Major Changes

- Initializing the floatdesk
