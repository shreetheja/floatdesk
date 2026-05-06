import 'dotenv/config';
import {
  createSupportServer,
  MemoryAdapter,
  PostgresAdapter,
  SlackChannel,
  GCSMediaProvider,
  S3MediaProvider,
} from '@floatdesk/sdk';
import type { ChannelAdapter, StorageAdapter, Ticket, WebhookRequest, WebhookResponse } from '@floatdesk/sdk';

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
// Feedback Call Booking
// ---------------------------------------------------------------------------
const call = process.env['MEETING_URL'] ? {
  bookingUrl: process.env['MEETING_URL'],
  creditReward: parseInt(process.env['CALL_CREDIT_REWARD'] ?? '100', 10),
} : undefined;

// ---------------------------------------------------------------------------
// Media — GCS takes priority, then S3, otherwise no media uploads
// ---------------------------------------------------------------------------
function buildMedia() {
  if (process.env['GCS_BUCKET']) {
    return new GCSMediaProvider({
      bucket: process.env['GCS_BUCKET'],
      ...(process.env['GCS_PROJECT_ID'] ? { projectId: process.env['GCS_PROJECT_ID'] } : {}),
      ...(process.env['GCS_CLIENT_EMAIL'] && process.env['GCS_PRIVATE_KEY']
        ? { credentials: {
            client_email: process.env['GCS_CLIENT_EMAIL'],
            // .env stores \n literally — convert to real newlines
            private_key:  process.env['GCS_PRIVATE_KEY'].replace(/\\n/g, '\n'),
          } }
        : {}),
      ...(process.env['GCS_SIGNED_URL_EXPIRES_IN'] ? { signedUrlExpiresIn: parseInt(process.env['GCS_SIGNED_URL_EXPIRES_IN'], 10) } : {}),
    });
  }

  if (process.env['AWS_S3_BUCKET'] && process.env['AWS_REGION'] &&
      process.env['AWS_ACCESS_KEY_ID'] && process.env['AWS_SECRET_ACCESS_KEY']) {
    return new S3MediaProvider({
      region:          process.env['AWS_REGION'],
      bucket:          process.env['AWS_S3_BUCKET'],
      accessKeyId:     process.env['AWS_ACCESS_KEY_ID'],
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
      ...(process.env['AWS_PUBLIC_BASE_URL'] ? { publicBaseUrl: process.env['AWS_PUBLIC_BASE_URL'] } : {}),
    });
  }

  return undefined;
}

const media = buildMedia();

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const app = createSupportServer({ storage, channels, media, call });
const PORT = parseInt(process.env['PORT'] ?? '3003', 10);

const storageLabel = storage instanceof PostgresAdapter ? `Postgres (${process.env['DATABASE_URL']!.replace(/:\/\/[^@]+@/, '://<credentials>@')})` : 'Memory (resets on restart)';
const channelLabels = channels.map((c) => c.name).join(', ');
const mediaLabel = media instanceof GCSMediaProvider ? `GCS (${process.env['GCS_BUCKET']})`
                 : media instanceof S3MediaProvider  ? `S3 (${process.env['AWS_S3_BUCKET']})`
                 : 'none (media uploads disabled)';

app.listen(PORT, () => {
  console.log(`\n🚀  FloatDesk test server → http://localhost:${PORT}`);
  console.log(`    Storage:  ${storageLabel}`);
  console.log(`    Channels: ${channelLabels}`);
  console.log(`    Media:    ${mediaLabel}`);
  console.log(`\n    Health:   GET  http://localhost:${PORT}/health`);
  console.log(`    Ticket:   POST http://localhost:${PORT}/api/ticket  (multipart)`);
  console.log(`    Messages: GET  http://localhost:${PORT}/api/ticket/:id/messages`);
  console.log(`    Reply:    POST http://localhost:${PORT}/api/ticket/:id/reply\n`);
});
