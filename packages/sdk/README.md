# @floatdesk/sdk

Framework-agnostic support ticket SDK. Plug in any storage adapter, channel adapter, and media provider. Use the built-in Express convenience wrapper or wire the core service functions into Hono, Fastify, or any other framework.

## Install

```bash
pnpm add @floatdesk/sdk
```

## Usage

### Express (batteries-included)

```typescript
import { createSupportServer, MemoryAdapter, SlackChannel } from '@floatdesk/sdk';

const app = createSupportServer({
  storage: new MemoryAdapter(),
  channels: [new SlackChannel({ botToken: '...', channelId: '...', signingSecret: '...' })],
});

app.listen(3002);
```

### Express (router only)

Mount the router at any prefix inside your existing Express app:

```typescript
import express from 'express';
import { createExpressRouter, MemoryAdapter } from '@floatdesk/sdk';

const app = express();
app.use(express.json());
app.use('/support', createExpressRouter({ storage: new MemoryAdapter(), channels: [] }));
```

### Framework-agnostic usage

The core service functions take plain objects in and return plain objects out — no framework dependencies:

```typescript
import { submitTicket, getTicketMessages, addReply } from '@floatdesk/sdk';

// Hono
app.post('/api/ticket', async (c) => {
  const form = await c.req.formData();
  const result = await submitTicket(
    Object.fromEntries(form),
    undefined,            // file: { buffer, mimetype, filename } | undefined
    storage,
    channels,
    media,                // optional
  );
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ticketId: result.ticketId });
});

app.get('/api/ticket/:id/messages', async (c) => {
  const result = await getTicketMessages(c.req.param('id'), storage);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.messages);
});

app.post('/api/ticket/:id/reply', async (c) => {
  const result = await addReply(c.req.param('id'), await c.req.json(), storage, channels);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true });
});

// Wire channel webhooks
for (const ch of channels) {
  app.post(`/api${ch.webhookPath}`, async (c) => {
    const rawBody = await c.req.text();
    const result = await ch.handleWebhook(
      { headers: Object.fromEntries(c.req.raw.headers), body: JSON.parse(rawBody), rawBody },
      storage,
    );
    return c.json(result.body, result.status);
  });
}
```

## API Routes

When using `createSupportServer` or `createExpressRouter` (mounted at `/api`):

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ticket` | Create a ticket (`multipart/form-data`) |
| `GET` | `/api/ticket/:id/messages` | Poll messages for a ticket |
| `POST` | `/api/ticket/:id/reply` | Send a reply from the user |
| `POST` | `/api/webhook/slack` | Slack Events API webhook |
| `POST` | `/api/webhook/telegram` | Telegram webhook |
| `POST` | `/api/webhook/discord` | Discord no-op (replies come via gateway) |
| `GET` | `/health` | Health check — `{ ok: true, channels: [...] }` |

## Storage Adapters

### MemoryAdapter

In-memory — great for development and tests. No setup required.

```typescript
import { MemoryAdapter } from '@floatdesk/sdk';
const storage = new MemoryAdapter();
```

### PostgresAdapter

Backed by Drizzle ORM + `pg`. Call `migrate()` once on startup to create tables.

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

Posts tickets as rich Slack blocks. Optionally syncs agent thread replies back as messages.

```typescript
import { SlackChannel } from '@floatdesk/sdk';

new SlackChannel({
  botToken:      'xoxb-...',      // required — posts tickets and replies
  channelId:     'C0123456789',   // required — target channel
  signingSecret: '...',           // optional — only needed for agent reply sync
});
```

#### Getting your Slack credentials

**1. Create a Slack app**

Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**. Give it a name (e.g. "FloatDesk") and pick your workspace.

**2. Add bot scopes**

In your app settings: **OAuth & Permissions** → **Scopes** → **Bot Token Scopes** → add:

| Scope | Purpose |
|---|---|
| `chat:write` | Post tickets and replies |
| `users:read` | Resolve agent names in reply sync |

**3. Install the app**

**OAuth & Permissions** → **Install to Workspace** → Authorize. Copy the **Bot User OAuth Token** — it starts with `xoxb-`. This is your `botToken`.

**4. Get the channel ID**

Open the target Slack channel in the browser or desktop app. The channel ID is the last segment of the URL:
```
https://app.slack.com/client/T01234/C0123456789
                                    ^^^^^^^^^^^^ this is channelId
```
Alternatively, right-click the channel → **View channel details** → scroll to the bottom for the ID.

Invite the bot to the channel: `/invite @YourAppName`

**5. (Optional) Enable reply sync**

This lets agent replies posted in the Slack thread appear back in the support widget.

- In your app settings: **Event Subscriptions** → toggle **Enable Events** on
- Set **Request URL** to `https://yourhost/api/webhook/slack` (must be publicly reachable; use [ngrok](https://ngrok.com) locally: `ngrok http 3003`)
- Under **Subscribe to bot events** add: `message.channels`
- Save. Slack will send a verification challenge to your endpoint.
- **Basic Information** → **App Credentials** → copy **Signing Secret**. This is your `signingSecret`.

Without this step, tickets are posted to Slack but agent replies won't appear in the widget.

**Required bot scopes:** `chat:write`, `users:read`

### TelegramChannel

Posts tickets to a Telegram chat. Replies to the ticket message are synced back.

```typescript
import { TelegramChannel } from '@floatdesk/sdk';

new TelegramChannel({
  botToken: '123456:ABC-...',
  chatId:   '-1001234567890',   // group/channel ID
});
```

**Webhook setup:** `https://api.telegram.org/bot<token>/setWebhook?url=https://yourhost/api/webhook/telegram`

### DiscordChannel

Posts tickets as embeds. Listens for replies via the Discord gateway (bot WebSocket) — no HTTP webhook needed.

```typescript
import { DiscordChannel } from '@floatdesk/sdk';

new DiscordChannel({
  botToken:  'Bot ...',
  channelId: '1234567890123456789',
});
```

**Required gateway intents:** `GUILDS`, `GUILD_MESSAGES`, `MESSAGE_CONTENT`

## Media Provider

### S3MediaProvider

Uploads attachments to S3 and returns a public URL.

```typescript
import { S3MediaProvider } from '@floatdesk/sdk';

new S3MediaProvider({
  region:          'us-east-1',
  bucket:          'my-bucket',
  accessKeyId:     '...',
  secretAccessKey: '...',
  publicBaseUrl:   'https://cdn.example.com', // optional, defaults to S3 URL
});
```

### GCSMediaProvider

Uploads attachments to Google Cloud Storage and returns a public URL.

```typescript
import { GCSMediaProvider } from '@floatdesk/sdk';

new GCSMediaProvider({
  projectId: 'my-gcp-project',
  bucket:    'my-floatdesk-bucket',
  credentials: {
    client_email: 'floatdesk@my-gcp-project.iam.gserviceaccount.com',
    private_key:  '-----BEGIN RSA PRIVATE KEY-----\n...',
  },
  publicBaseUrl: 'https://cdn.example.com', // optional, defaults to storage.googleapis.com/<bucket>
});
```

If `credentials` is omitted the provider falls back to **Application Default Credentials** — useful when running on GCP (Cloud Run, GKE, Compute Engine) where the runtime service account is picked up automatically.

#### GCP setup

**1. Create a bucket**

```bash
gsutil mb -l us-central1 gs://my-floatdesk-bucket
```

**2. Make uploaded objects publicly readable**

```bash
# Uniform bucket-level access (recommended)
gcloud storage buckets update gs://my-floatdesk-bucket --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding gs://my-floatdesk-bucket \
  --member=allUsers --role=roles/storage.objectViewer
```

**3. Create a service account and download a key**

```bash
gcloud iam service-accounts create floatdesk \
  --display-name="FloatDesk uploader"

gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:floatdesk@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectCreator"

gcloud iam service-accounts keys create key.json \
  --iam-account=floatdesk@YOUR_PROJECT.iam.gserviceaccount.com
```

Copy `client_email` and `private_key` from `key.json` into your env vars. Replace literal newlines in `private_key` with `\n` so the value fits on one line.

## Custom Adapters

### Custom StorageAdapter

```typescript
import type { StorageAdapter } from '@floatdesk/sdk';

class RedisAdapter implements StorageAdapter {
  async createTicket(data) { ... }
  async getTicket(id) { ... }
  async findTicketByChannelRef(ref) { ... }
  async appendMessage(ticketId, msg) { ... }
  async getMessages(ticketId) { ... }
}
```

### Custom ChannelAdapter

```typescript
import type { ChannelAdapter, WebhookRequest, WebhookResponse } from '@floatdesk/sdk';

class LinearChannel implements ChannelAdapter {
  readonly name = 'linear';
  readonly webhookPath = '/webhook/linear'; // registered automatically

  async postTicket(ticket, mediaUrl?) {
    // create an issue in Linear, return its ID as channelRef
    return issueId;
  }

  async postReply(channelRef, text) {
    // post a comment on the Linear issue
  }

  async handleWebhook(req: WebhookRequest, storage): Promise<WebhookResponse> {
    // req.headers, req.body, req.rawBody — all plain objects, no framework types
    const event = req.body as { type: string; comment?: { body: string } };
    if (event.type === 'Comment') {
      const ticket = await storage.findTicketByChannelRef(event.issueId);
      if (ticket) await storage.appendMessage(ticket.id, { ... });
    }
    return { status: 200, body: { ok: true } };
  }
}
```

## Environment Variables

```
# Postgres
DATABASE_URL=postgresql://user:pass@localhost:5432/floatdesk

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...        # only needed for reply sync via webhooks
SLACK_CHANNEL_ID=C0123456789

# AWS S3
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-floatdesk-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```
