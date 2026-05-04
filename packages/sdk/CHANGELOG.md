# @floatdesk/sdk

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
