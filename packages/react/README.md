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

| Prop | Type | Description |
|------|------|-------------|
| `serverUrl` | `string` | Base URL of your `@floatdesk/sdk` server (no trailing slash) |

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

1. User clicks the bug icon → animated panel slides up
2. User fills the form and optionally attaches media
3. On submit → `POST /api/ticket` (multipart) → server fans out to Slack / Telegram / Discord
4. Panel transitions to `ThreadView`
5. ThreadView polls every 4 seconds — agent replies appear as chat bubbles
6. User can reply directly from the widget → message goes to all channel threads

## Styling

The widget uses inline styles only — no CSS imports or Tailwind required. The color scheme is dark (`#1a1a1a` panel, `#6b9a00` accent). Override with your own components if needed — `TicketForm`, `ThreadView`, and `useMediaCapture` are all exported individually.
