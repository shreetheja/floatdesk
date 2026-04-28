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

  // Capture raw body for webhook signature verification (Slack HMAC).
  // Skip for multipart — multer reads the stream directly.
  app.use((req, _res, next) => {
    if ((req.headers['content-type'] ?? '').startsWith('multipart/')) { next(); return; }
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      (req as typeof req & { rawBody: string }).rawBody = data;
      next();
    });
  });

  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', createExpressRouter(opts));
  app.get('/health', (_req, res) => res.json({ ok: true, channels: opts.channels.map((c) => c.name) }));

  return app;
}
