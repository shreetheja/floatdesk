/**
 * Local test server — not published, git-ignored.
 * Runs with: pnpm dev  (from test-app/) or  pnpm --filter @floatdesk/test-app dev
 *
 * Uses MemoryAdapter (data resets on restart) and a stub channel that
 * just logs to the console. Swap in real channels below when you're ready.
 */
import { createSupportServer, MemoryAdapter } from '@floatdesk/sdk';
import type { ChannelAdapter, StorageAdapter, Ticket, WebhookRequest, WebhookResponse } from '@floatdesk/sdk';

// ---------------------------------------------------------------------------
// Stub channel — logs every action to stdout, no external API needed
// ---------------------------------------------------------------------------
const consoleChannel: ChannelAdapter = {
  name: 'console',
  webhookPath: '/webhook/console',

  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    console.log('\n📨  New ticket posted to channel:');
    console.log(`  [${ticket.type.toUpperCase()}] ${ticket.title}`);
    console.log(`  ${ticket.description}`);
    console.log(`  URL: ${ticket.url}`);
    if (mediaUrl) console.log(`  Media: ${mediaUrl}`);
    const ref = `console-ref-${Date.now()}`;
    console.log(`  → channelRef: ${ref}\n`);
    return ref;
  },

  async postReply(channelRef: string, text: string): Promise<void> {
    console.log(`\n💬  Reply on [${channelRef}]: ${text}\n`);
  },

  async handleWebhook(_req: WebhookRequest, _storage: StorageAdapter): Promise<WebhookResponse> {
    console.log('\n🔔  Webhook hit /webhook/console\n');
    return { status: 200, body: { ok: true } };
  },
};

// ---------------------------------------------------------------------------
// To use Slack instead, uncomment and fill in your credentials:
//
// import { SlackChannel } from '@floatdesk/sdk';
// const slackChannel = new SlackChannel({
//   botToken:      process.env.SLACK_BOT_TOKEN!,
//   signingSecret: process.env.SLACK_SIGNING_SECRET!,
//   channelId:     process.env.SLACK_CHANNEL_ID!,
// });
//
// Then pass [slackChannel] to channels below.
// ---------------------------------------------------------------------------

const app = createSupportServer({
  storage: new MemoryAdapter(),
  channels: [consoleChannel],
  // media: new S3MediaProvider({ ... }),
});

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

app.listen(PORT, () => {
  console.log(`\n🚀  FloatDesk test server running at http://localhost:${PORT}`);
  console.log(`    Health:  GET  http://localhost:${PORT}/health`);
  console.log(`    Ticket:  POST http://localhost:${PORT}/api/ticket  (multipart)`);
  console.log(`    Messages:GET  http://localhost:${PORT}/api/ticket/:id/messages`);
  console.log(`    Reply:   POST http://localhost:${PORT}/api/ticket/:id/reply\n`);
  console.log('    Test with curl:');
  console.log('    curl -X POST http://localhost:3002/api/ticket \\');
  console.log('      -F "title=Widget crash" \\');
  console.log('      -F "description=Crashes on submit" \\');
  console.log('      -F "type=bug" \\');
  console.log('      -F "url=http://localhost:3000" \\');
  console.log('      -F "userAgent=curl"\n');
});
