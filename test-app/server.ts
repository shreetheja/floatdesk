import 'dotenv/config';
import {
  createSupportServer,
  MemoryAdapter,
  PostgresAdapter,
} from '@floatdesk/sdk';
import type { ChannelAdapter, StorageAdapter, Ticket, WebhookRequest, WebhookResponse } from '@floatdesk/sdk';
import { SlackChannel } from '@floatdesk/sdk';

// ---------------------------------------------------------------------------
// Storage — Postgres if DATABASE_URL is set, otherwise in-memory
// ---------------------------------------------------------------------------
function buildStorage(): StorageAdapter {
  const url = process.env['DATABASE_URL'];
  if (!url) return new MemoryAdapter();

  // Determine SSL: honour ?sslmode= in the URL, or fall back to checking
  // whether the host is a remote address (not localhost / 127.x).
  let ssl: boolean | { rejectUnauthorized: boolean } | undefined;
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get('sslmode');
    if (mode === 'require')   ssl = true;
    if (mode === 'no-verify') ssl = { rejectUnauthorized: false };
    if (!mode) {
      const host = parsed.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!isLocal) ssl = { rejectUnauthorized: false }; // remote host — try SSL, allow self-signed
    }
  } catch { /* malformed URL — let pg handle it without ssl override */ }

  return new PostgresAdapter(url, ssl !== undefined ? { ssl } : undefined);
}

const storage = buildStorage();

if (storage instanceof PostgresAdapter) {
  console.log('⏳  Running Postgres migrations…');
  await storage.migrate();
  console.log('✅  Migrations done\n');
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------
const channels: ChannelAdapter[] = [];

if (process.env['SLACK_BOT_TOKEN'] && process.env['SLACK_CHANNEL_ID']) {
  channels.push(new SlackChannel({
    botToken:  process.env['SLACK_BOT_TOKEN'],
    channelId: process.env['SLACK_CHANNEL_ID'],
    // signingSecret is optional — only needed for agent reply sync via Events API
    ...(process.env['SLACK_SIGNING_SECRET'] ? { signingSecret: process.env['SLACK_SIGNING_SECRET'] } : {}),
  }));
}

// Always keep a console channel so every action is visible in the terminal
const consoleChannel: ChannelAdapter = {
  name: 'console',
  webhookPath: '/webhook/console',
  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    console.log('\n📨  New ticket:');
    console.log(`  [${ticket.type.toUpperCase()}] ${ticket.title}`);
    console.log(`  ${ticket.description}`);
    if (mediaUrl) console.log(`  Media: ${mediaUrl}`);
    const ref = `console-ref-${Date.now()}`;
    console.log(`  → channelRef: ${ref}\n`);
    return ref;
  },
  async postReply(channelRef: string, text: string): Promise<void> {
    console.log(`\n💬  Reply on [${channelRef}]: ${text}\n`);
  },
  async handleWebhook(_req: WebhookRequest, _storage: StorageAdapter): Promise<WebhookResponse> {
    return { status: 200, body: { ok: true } };
  },
};

channels.push(consoleChannel);

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const app = createSupportServer({ storage, channels });
const PORT = parseInt(process.env['PORT'] ?? '3003', 10);

const storageLabel = storage instanceof PostgresAdapter ? `Postgres (${process.env['DATABASE_URL']!.replace(/:\/\/[^@]+@/, '://<credentials>@')})` : 'Memory (resets on restart)';
const channelLabels = channels.map((c) => c.name).join(', ');

app.listen(PORT, () => {
  console.log(`\n🚀  FloatDesk test server → http://localhost:${PORT}`);
  console.log(`    Storage:  ${storageLabel}`);
  console.log(`    Channels: ${channelLabels}`);
  console.log(`\n    Health:   GET  http://localhost:${PORT}/health`);
  console.log(`    Ticket:   POST http://localhost:${PORT}/api/ticket  (multipart)`);
  console.log(`    Messages: GET  http://localhost:${PORT}/api/ticket/:id/messages`);
  console.log(`    Reply:    POST http://localhost:${PORT}/api/ticket/:id/reply\n`);
});
