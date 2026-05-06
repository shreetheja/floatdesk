import express, { type Express } from 'express';
import cors from 'cors';
import { createExpressRouter } from './adapters/express.js';
import type { SupportServerOptions } from './types.js';
import type { SlackChannel } from './channels/slack.js';

/**
 * Convenience wrapper: creates a ready-to-listen Express app.
 * If you prefer another framework (Hono, Fastify, etc.) use the
 * core service functions from @floatdesk/sdk/core directly.
 */
export function createSupportServer(opts: SupportServerOptions): Express {
  const app = express();

  // Inject callConfig into SlackChannel so block_actions handler knows the reward amount
  if (opts.call) {
    const slack = opts.channels.find((c) => c.name === 'slack') as SlackChannel | undefined;
    if (slack) slack.setCallConfig(opts.call);
  }

  app.use(cors({ origin: '*' }));
  // Capture raw body during the single json parse so webhook signature
  // verification (Slack HMAC) can access it without consuming the stream twice.
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody: string }).rawBody = buf.toString();
    },
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', createExpressRouter(opts));
  app.get('/health', (_req, res) => res.json({ ok: true, channels: opts.channels.map((c) => c.name), media: !!opts.media, call: !!opts.call }));

  return app;
}
