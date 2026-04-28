import express, { type Express } from 'express';
import cors from 'cors';
import { createExpressRouter } from './adapters/express.js';
import type { SupportServerOptions } from './types.js';

/**
 * Convenience wrapper: creates a ready-to-listen Express app.
 * If you prefer another framework (Hono, Fastify, etc.) use the
 * core service functions from @floatdesk/sdk/core directly.
 */
export function createSupportServer(opts: SupportServerOptions): Express {
  const app = express();

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
  app.get('/health', (_req, res) => res.json({ ok: true, channels: opts.channels.map((c) => c.name) }));

  return app;
}
