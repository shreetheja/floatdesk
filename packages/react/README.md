# @floatdesk/react

A drop-in React support widget powered by `@floatdesk/sdk`. Renders a floating button in the corner of your app — users click it to file bug reports or feature requests, attach screenshots or screen recordings, and follow up in a live chat thread.

## Install

```bash
pnpm add @floatdesk/react
```

React 18+ and React DOM are peer dependencies.

## Usage

```tsx
import { SupportWidget } from '@floatdesk/react';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <SupportWidget serverUrl="https://support.yourapp.com" />
    </>
  );
}
```

That's it. The widget renders a green bug-icon button fixed to the bottom-right corner.

## Components

### `<SupportWidget serverUrl="..." />`

The main entry point. Manages open/closed state and transitions between the ticket form and the thread view.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `serverUrl` | `string` | ✓ | Base URL of your `@floatdesk/sdk` server (no trailing slash) |
| `signupUser` | `{ id?: string; email?: string; name?: string }` | — | Pass the newly signed-up user's identity. On first mount, the widget posts a Slack notification once and tracks the thread for replies. Requires at least `id` or `email`. |
| `signupMessage` | `string` | — | Message template sent to Slack on new signup. Supports `{name}`, `{email}`, `{url}` placeholders. Required when `signupUser` is set. |

#### Signup notifications

When `signupUser` and `signupMessage` are provided, the widget fires a one-time `POST /api/session` on the first ever mount for that user identity. This posts a configured message to Slack as a new thread. If an agent replies on that Slack thread, the reply is routed back into the user's widget — they see an unread dot and a toast popup, and can reply directly from the widget.

```tsx
<SupportWidget
  serverUrl="https://support.yourapp.com"
  signupUser={{ id: user.id, email: user.email, name: user.name }}
  signupMessage="🎉 New signup: {name} ({email}) joined from {url}"
/>
```

The notification is sent **only once per user identity** — subsequent page loads reuse the existing session from `localStorage` and never re-post to Slack.

#### Unread indicator

When the widget panel is closed and an agent replies to any ticket or session thread, the widget:
- Shows a **toast popup** near the FAB with the sender name and message preview (auto-dismisses after 4 s)
- Leaves a **red dot badge** on the FAB until the widget is opened

Clicking the toast opens the relevant thread directly. The background poll interval is 15 seconds.

### `<TicketForm serverUrl="..." onSuccess={fn} />`

The submission form. Users choose bug vs feature, fill in title and description, and optionally attach a screenshot or screen recording. Submits as `multipart/form-data` to `POST /api/ticket`.

| Prop | Type | Description |
|------|------|-------------|
| `serverUrl` | `string` | Base URL of your support server |
| `onSuccess` | `(ticketId: string, title: string) => void` | Called after successful submission |

### `<ThreadView serverUrl="..." ticketId="..." title="..." />`

Polls `GET /api/ticket/:id/messages` every 4 seconds and renders a chat-bubble UI. Users can send replies which call `POST /api/ticket/:id/reply`.

| Prop | Type | Description |
|------|------|-------------|
| `serverUrl` | `string` | Base URL of your support server |
| `ticketId` | `string` | Ticket ID returned from form submission |
| `title` | `string` | Ticket title shown in the thread header |

### `useMediaCapture()`

Hook that drives the screenshot and screen recording buttons in `TicketForm`. Can be used standalone.

```typescript
const { attachment, isCapturing, captureScreenshot, recordScreen, clearAttachment } = useMediaCapture();
```

| Return | Type | Description |
|--------|------|-------------|
| `attachment` | `MediaAttachment \| null` | Current blob + preview URL |
| `isCapturing` | `boolean` | True while capturing |
| `captureScreenshot` | `() => Promise<void>` | Takes a full-page screenshot via html2canvas |
| `recordScreen` | `() => Promise<void>` | Opens screen-share picker, records until stopped (max 60s) |
| `clearAttachment` | `() => void` | Revokes preview URL and clears state |

## How it works

### Ticket flow
1. User clicks the bug icon → animated panel slides up
2. User fills the form and optionally attaches media
3. On submit → `POST /api/ticket` (multipart) → server fans out to Slack / Telegram / Discord
4. Panel transitions to `ThreadView`
5. ThreadView polls every 4 seconds — agent replies appear as chat bubbles
6. User can reply directly from the widget → message goes to all channel threads

### Signup notification flow
1. App mounts `<SupportWidget signupUser={...} signupMessage="..." />`
2. Widget checks `localStorage` — if no prior session for this user, calls `POST /api/session`
3. Server posts the template-resolved message to Slack as a new thread
4. Agent sees the notification in Slack and can reply in the thread
5. Reply is routed back to the widget via the Slack Events API webhook
6. Widget shows a toast popup + red dot badge on the FAB button
7. User opens the widget → sees the session thread with a `💬` icon, can reply

## Styling

The widget uses inline styles only — no CSS imports or Tailwind required. The color scheme is dark (`#1a1a1a` panel, `#6b9a00` accent). Override with your own components if needed — `TicketForm`, `ThreadView`, and `useMediaCapture` are all exported individually.
