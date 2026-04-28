# @floatdesk/sdk

Express server factory for FloatDesk support tickets. Plug in any storage adapter, channel adapter, and media provider — get a fully wired HTTP server back.

## Install

```bash
pnpm add @floatdesk/sdk
```

## Usage

```typescript
import {
  createSupportServer,
  MemoryAdapter,
  SlackChannel,
  TelegramChannel,
  DiscordChannel,
  PostgresAdapter,
  MongoAdapter,
  S3MediaProvider,
} from '@floatdesk/sdk';

const app = createSupportServer({
  storage: new MemoryAdapter(),          // or PostgresAdapter / MongoAdapter
  channels: [new SlackChannel({ ... })], // one or more channel adapters
  media: new S3MediaProvider({ ... }),   // optional
});

app.listen(3002);
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ticket` | Create a ticket (multipart/form-data) |
| `GET` | `/api/ticket/:id/messages` | Poll messages for a ticket |
| `POST` | `/api/ticket/:id/reply` | Send a reply from the user |
| `POST` | `/api/webhook/slack` | Slack Events API webhook |
| `POST` | `/api/webhook/telegram` | Telegram webhook |
| `POST` | `/api/webhook/discord` | Discord placeholder (bot uses gateway) |
| `GET` | `/health` | Health check |

## Storage Adapters

### MemoryAdapter

In-memory store — great for development and tests. No setup required.

```typescript
import { MemoryAdapter } from '@floatdesk/sdk';
const storage = new MemoryAdapter();
```

### PostgresAdapter

Backed by Drizzle ORM + `pg`. Calls `migrate()` to create tables.

```typescript
import { PostgresAdapter } from '@floatdesk/sdk';
const storage = new PostgresAdapter('postgresql://user:pass@localhost/db');
await storage.migrate();
```

### MongoAdapter

Backed by Mongoose.

```typescript
import { MongoAdapter } from '@floatdesk/sdk';
const storage = new MongoAdapter('mongodb://localhost:27017/floatdesk');
```

## Channel Adapters

### SlackChannel

Posts tickets as Slack messages with rich blocks. Webhook verifies HMAC-SHA256 signatures. Agent replies in threads are synced back as messages.

```typescript
import { SlackChannel } from '@floatdesk/sdk';

new SlackChannel({
  botToken: 'xoxb-...',
  signingSecret: '...',
  channelId: 'C0123456789',
});
```

Required Slack bot scopes: `chat:write`, `users:read`. Enable Events API and subscribe to `message.channels`.

### TelegramChannel

Posts tickets to a Telegram chat. Agent replies (reply-to the ticket message) are synced back.

```typescript
import { TelegramChannel } from '@floatdesk/sdk';

new TelegramChannel({
  botToken: '123456:ABC-...',
  chatId: '-1001234567890',
});
```

Set your webhook URL: `https://api.telegram.org/bot<token>/setWebhook?url=https://yourhost/api/webhook/telegram`

### DiscordChannel

Posts tickets as embeds. Uses the Discord gateway (bot token) to listen for replies. The `/api/webhook/discord` route is a no-op placeholder.

```typescript
import { DiscordChannel } from '@floatdesk/sdk';

new DiscordChannel({
  botToken: 'Bot ...',
  channelId: '1234567890',
});
```

Required gateway intents: `GUILDS`, `GUILD_MESSAGES`, `MESSAGE_CONTENT`.

## Media Provider

### S3MediaProvider

Uploads attachments to S3 and returns a public URL.

```typescript
import { S3MediaProvider } from '@floatdesk/sdk';

new S3MediaProvider({
  region: 'us-east-1',
  bucket: 'my-bucket',
  accessKeyId: '...',
  secretAccessKey: '...',
  publicBaseUrl: 'https://cdn.example.com', // optional, defaults to s3 URL
});
```

## Custom Adapters

Implement the `StorageAdapter`, `ChannelAdapter`, or `MediaProvider` interfaces to plug in any backend.

```typescript
import type { StorageAdapter } from '@floatdesk/sdk';

class MyAdapter implements StorageAdapter {
  // implement 5 methods: createTicket, getTicket, findTicketByChannelRef,
  //                       appendMessage, getMessages
}
```

## Environment Variables (example)

```
DATABASE_URL=postgresql://...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_CHANNEL_ID=C0123456789
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-floatdesk-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```
