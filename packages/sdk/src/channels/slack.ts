import { WebClient } from '@slack/web-api';
import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import type { ChannelAdapter, StorageAdapter, Ticket } from '../types.js';

export interface SlackChannelOptions {
  botToken: string;
  signingSecret: string;
  channelId: string;
}

export class SlackChannel implements ChannelAdapter {
  readonly name = 'slack';
  private client: WebClient;
  private signingSecret: string;
  private channelId: string;

  constructor(opts: SlackChannelOptions) {
    this.client = new WebClient(opts.botToken);
    this.signingSecret = opts.signingSecret;
    this.channelId = opts.channelId;
  }

  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    const emoji = ticket.type === 'bug' ? '🐛' : '✨';
    const label = ticket.type === 'bug' ? 'Bug' : 'Feature';

    const blocks: object[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} ${label}: ${ticket.title}` },
      },
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
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Media:* <${mediaUrl}|View attachment>` },
      });
    }

    const res = await this.client.chat.postMessage({
      channel: this.channelId,
      blocks,
      text: `${emoji} ${label}: ${ticket.title}`,
    });

    if (!res.ok || !res.ts) throw new Error(`Slack postMessage failed: ${res.error}`);
    return res.ts;
  }

  async postReply(channelRef: string, text: string): Promise<void> {
    const res = await this.client.chat.postMessage({
      channel: this.channelId,
      thread_ts: channelRef,
      text,
    });
    if (!res.ok) throw new Error(`Slack thread reply failed: ${res.error}`);
  }

  private verifySignature(req: Request & { rawBody?: string }): boolean {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSig = req.headers['x-slack-signature'];
    if (typeof timestamp !== 'string' || typeof slackSig !== 'string') return false;
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;
    const base = `v0:${timestamp}:${req.rawBody ?? ''}`;
    const hmac = 'v0=' + crypto.createHmac('sha256', this.signingSecret).update(base).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(slackSig));
  }

  getWebhookRouter(storage: StorageAdapter): Router {
    const router = Router();

    router.post('/webhook/slack', async (req: Request & { rawBody?: string }, res: Response) => {
      if (!this.verifySignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const body = req.body as Record<string, unknown>;

      if (body['type'] === 'url_verification') {
        res.json({ challenge: body['challenge'] });
        return;
      }

      res.status(200).send('ok');

      if (body['type'] !== 'event_callback') return;

      const event = body['event'] as Record<string, unknown> | undefined;
      if (!event || event['type'] !== 'message' || event['subtype'] === 'bot_message' || !event['thread_ts']) return;

      const threadTs = String(event['thread_ts']);
      const text = String(event['text'] ?? '');
      const userId = String(event['user'] ?? '');

      const ticket = await storage.findTicketByChannelRef(threadTs);
      if (!ticket) return;

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
    });

    return router;
  }
}
