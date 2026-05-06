# FloatDesk

A framework-agnostic support ticket SDK with plug-in storage adapters, Slack / Telegram / Discord channel integrations, AWS S3 media uploads, and a drop-in React widget.

## Packages

| Package | Description |
|---------|-------------|
| [`@floatdesk/sdk`](./packages/sdk) | Framework-agnostic core + Express adapter + storage & channel adapters |
| [`@floatdesk/react`](./packages/react) | `<SupportWidget>` React component |

## Quick Start

### 1. Install

```bash
pnpm add @floatdesk/sdk @floatdesk/react
```

### 2. Start a support server

```typescript
import { createSupportServer, SlackChannel, PostgresAdapter, S3MediaProvider } from '@floatdesk/sdk';

const storage = new PostgresAdapter(process.env.DATABASE_URL);
await storage.migrate();

const app = createSupportServer({
  storage,
  channels: [
    new SlackChannel({
      botToken: process.env.SLACK_BOT_TOKEN,   // post tickets
      channelId: process.env.SLACK_CHANNEL_ID, // where to post
      signingSecret: process.env.SLACK_SIGNING_SECRET, // only needed for reply sync
    }),
  ],
  media: new S3MediaProvider({
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }),
});

app.listen(3002, () => console.log('FloatDesk running on :3002'));
```

### 3. Add the widget to your React app

```tsx
import { SupportWidget } from '@floatdesk/react';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <SupportWidget serverUrl="http://localhost:3002" />
    </>
  );
}
```

### 4. (Optional) Signup notifications + unread indicator

Pass the signed-up user to the widget. On first mount, a message is posted to Slack. Agent replies route back into the widget — the user sees a toast popup and a red dot badge on the FAB.

```tsx
<SupportWidget
  serverUrl="http://localhost:3002"
  signupUser={{ id: user.id, email: user.email, name: user.name }}
  signupMessage="🎉 New signup: {name} ({email}) joined from {url}"
/>
```

The notification fires **once per user identity** — deduplication is handled automatically via `localStorage`. See the [React package README](./packages/react) for full prop docs.

## Not using Express?

The core service functions are framework-agnostic. Use them with Hono, Fastify, or anything else:

```typescript
import { submitTicket, getTicketMessages, addReply } from '@floatdesk/sdk';

// Hono example
app.post('/api/ticket', async (c) => {
  const form = await c.req.formData();
  const result = await submitTicket(Object.fromEntries(form), undefined, storage, channels);
  return c.json(result);
});
```

See the [SDK README](./packages/sdk#framework-agnostic-usage) for the full pattern.

## Development

```bash
pnpm install
pnpm build       # build all packages
pnpm test        # run all tests
pnpm typecheck   # typecheck all packages
```

## Local Testing

```bash
pnpm --filter @floatdesk/test-app dev
# server starts at http://localhost:3002 with an in-memory store and a console-logging stub channel
```

## Publishing

```bash
pnpm changeset add   # describe your changes
pnpm release         # build + publish to npm
```

## Architecture

```
floatdesk/
├── packages/
│   ├── sdk/
│   │   ├── src/core/           ← framework-agnostic business logic
│   │   ├── src/adapters/       ← express.ts (only file that imports Express)
│   │   ├── src/storage/        ← MemoryAdapter, PostgresAdapter, MongoAdapter
│   │   ├── src/channels/       ← SlackChannel, TelegramChannel, DiscordChannel
│   │   └── src/media/          ← S3MediaProvider
│   └── react/                  ← SupportWidget, TicketForm, ThreadView
└── test-app/                   ← local dev server (git-ignored)
```
