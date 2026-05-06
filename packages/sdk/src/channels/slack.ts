import { WebClient } from '@slack/web-api';
import type { Block, KnownBlock } from '@slack/web-api';
import crypto from 'crypto';
import type { ChannelAdapter, StorageAdapter, Ticket, FeedbackCall, CallConfig, WebhookRequest, WebhookResponse } from '../types.js';

export interface SlackChannelOptions {
  botToken: string;
  /** Only required for agent reply sync via Slack Events API webhook. */
  signingSecret?: string;
  channelId: string;
  call?: CallConfig;
}

export class SlackChannel implements ChannelAdapter {
  readonly name = 'slack';
  readonly webhookPath = '/webhook/slack';
  readonly client: WebClient;
  private signingSecret: string | undefined;
  private channelId: string;
  private callConfig: CallConfig | undefined;

  constructor(opts: SlackChannelOptions) {
    this.client = new WebClient(opts.botToken);
    this.signingSecret = opts.signingSecret;
    this.channelId = opts.channelId;
    this.callConfig = opts.call;
  }

  setCallConfig(config: CallConfig): void {
    this.callConfig = config;
  }

  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    const emoji = ticket.type === 'bug' ? '🐛' : ticket.type === 'session' ? '👋' : '✨';
    const label = ticket.type === 'bug' ? 'Bug' : ticket.type === 'session' ? 'Session' : 'Feature';

    const blocks: (Block | KnownBlock)[] = [
      { type: 'header', text: { type: 'plain_text', text: `${emoji} ${label}: ${ticket.title}` } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Description:*\n${ticket.description}` },
          { type: 'mrkdwn', text: `*URL:*\n${ticket.url}` },
          { type: 'mrkdwn', text: `*Time:*\n${ticket.createdAt}` },
          { type: 'mrkdwn', text: `*User Agent:*\n${ticket.userAgent.slice(0, 80)}` },
        ],
      },
    ];

    if (mediaUrl) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Media:* <${mediaUrl}|View attachment>` } });
    }

    const res = await this.client.chat.postMessage({
      channel: this.channelId,
      blocks,
      text: `${emoji} ${label}: ${ticket.title}`,
    });

    if (!res.ok || !res.ts) throw new Error(`Slack postMessage failed: ${res.error}`);
    return res.ts;
  }

  async postReply(channelRef: string, text: string, mediaUrl?: string): Promise<void> {
    const blocks: (Block | KnownBlock)[] | undefined = mediaUrl ? [
      { type: 'section', text: { type: 'mrkdwn', text } },
      { type: 'image', image_url: mediaUrl, alt_text: 'Attachment' } as KnownBlock,
    ] : undefined;
    const res = await this.client.chat.postMessage({
      channel: this.channelId,
      thread_ts: channelRef,
      text,
      ...(blocks ? { blocks } : {}),
    });
    if (!res.ok) throw new Error(`Slack thread reply failed: ${res.error}`);
  }

  async postCallRequest(call: FeedbackCall, config: CallConfig): Promise<void> {
    const reward = config.creditReward ?? 100;
    await this.client.chat.postMessage({
      channel: this.channelId,
      text: `📞 Feedback call from ${call.email}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📞 *Feedback call request*\n*From:* ${call.email}\n*Topic:* ${call.topic}\n*Booking:* ${config.bookingUrl}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              style: 'primary',
              text: { type: 'plain_text', text: `✅ Award ${reward} Credits` },
              action_id: 'award_credits',
              value: call.id,
            },
            {
              type: 'button',
              style: 'danger',
              text: { type: 'plain_text', text: '❌ Dismiss' },
              action_id: 'dismiss_call',
              value: call.id,
            },
          ],
        },
      ],
    });
  }

  async handleWebhook(req: WebhookRequest, storage: StorageAdapter): Promise<WebhookResponse> {
    if (!this.verifySignature(req)) {
      return { status: 401, body: { error: 'Invalid signature' } };
    }

    // Slack interactive payloads arrive as URL-encoded { payload: "<json>" }
    const rawBody = req.body as Record<string, unknown>;
    let body = rawBody;
    if (typeof rawBody['payload'] === 'string') {
      try { body = JSON.parse(rawBody['payload']) as Record<string, unknown>; } catch { /* ignore */ }
    }

    if (body['type'] === 'url_verification') {
      return { status: 200, body: { challenge: body['challenge'] } };
    }

    if (body['type'] === 'block_actions') {
      this.processBlockAction(body, storage).catch((err) => console.error('Slack block_action error:', err));
      return { status: 200, body: '' };
    }

    // Fire and forget — respond immediately, process async
    this.processEvent(body, storage).catch((err) => console.error('Slack event error:', err));
    return { status: 200, body: 'ok' };
  }

  private verifySignature(req: WebhookRequest): boolean {
    if (!this.signingSecret) return true; // reply sync not configured — skip verification
    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSig = req.headers['x-slack-signature'];
    if (typeof timestamp !== 'string' || typeof slackSig !== 'string') return false;
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;
    const base = `v0:${timestamp}:${req.rawBody}`;
    const hmac = 'v0=' + crypto.createHmac('sha256', this.signingSecret).update(base).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(slackSig));
  }

  private async processBlockAction(body: Record<string, unknown>, storage: StorageAdapter): Promise<void> {
    const actions = body['actions'] as Array<Record<string, unknown>> | undefined;
    const action = actions?.[0];
    if (!action) return;

    const callId = String(action['value'] ?? '');
    const actionId = String(action['action_id'] ?? '');
    const message = body['message'] as Record<string, unknown> | undefined;
    const channel = body['channel'] as Record<string, unknown> | undefined;
    const messageTs = String(message?.['ts'] ?? '');
    const channelId = String(channel?.['id'] ?? this.channelId);

    const call = await storage.getFeedbackCall(callId);
    if (!call || call.status !== 'pending') return;

    const reward = this.callConfig?.creditReward ?? 100;

    if (actionId === 'award_credits') {
      await storage.updateFeedbackCall(callId, { status: 'credited', creditsAwarded: reward });
      await this.client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `✅ ${reward} credits awarded to ${call.email}`,
        blocks: [{
          type: 'section',
          text: { type: 'mrkdwn', text: `✅ *${reward} credits awarded* to ${call.email}\n*Topic:* ${call.topic}` },
        }],
      });
    } else if (actionId === 'dismiss_call') {
      await storage.updateFeedbackCall(callId, { status: 'dismissed' });
      await this.client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `❌ Call request from ${call.email} dismissed`,
        blocks: [{
          type: 'section',
          text: { type: 'mrkdwn', text: `❌ *Dismissed* — ${call.email}\n*Topic:* ${call.topic}` },
        }],
      });
    }
  }

  private async processEvent(body: Record<string, unknown>, storage: StorageAdapter): Promise<void> {
    if (body['type'] !== 'event_callback') {
      console.log('[Slack] skipping — outer type:', body['type']);
      return;
    }
    const event = body['event'] as Record<string, unknown> | undefined;
    if (!event) { console.log('[Slack] skipping — no event field'); return; }
    if (event['type'] !== 'message') { console.log('[Slack] skipping — event type:', event['type']); return; }
    if (event['subtype'] === 'bot_message' || event['bot_id']) { console.log('[Slack] skipping — bot message'); return; }
    if (!event['thread_ts']) { console.log('[Slack] skipping — no thread_ts (message is not a threaded reply)'); return; }

    const threadTs = String(event['thread_ts']);
    const text = String(event['text'] ?? '');
    const userId = String(event['user'] ?? '');

    console.log(`[Slack] looking up ticket for thread_ts: ${threadTs}`);
    const ticket = await storage.findTicketByChannelRef(threadTs);
    if (!ticket) { console.log(`[Slack] no ticket found for ref: ${threadTs}`); return; }
    console.log(`[Slack] matched ticket ${ticket.id}, appending message from ${userId}`);

    let senderName = userId;
    try {
      const userRes = await this.client.users.info({ user: userId });
      senderName = userRes.user?.real_name ?? userRes.user?.name ?? userId;
    } catch { /* non-fatal */ }

    await storage.appendMessage(ticket.id, {
      ticketId: ticket.id,
      senderType: 'agent',
      senderName,
      body: text,
    });
  }
}
