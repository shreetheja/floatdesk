import express, { type Express } from 'express';
import cors from 'cors';
import { createTicketRouter } from './routes/ticket.js';
import type { SupportServerOptions } from './types.js';

export function createSupportServer(opts: SupportServerOptions): Express {
  const app = express();

  app.use((req, _res, next) => {
    const contentType = req.headers['content-type'] ?? '';
    if (contentType.startsWith('multipart/')) {
      // Skip raw body buffering for multipart — multer handles those
      next();
      return;
    }
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

  app.use('/api', createTicketRouter(opts.storage, opts.channels, opts.media));

  for (const channel of opts.channels) {
    app.use('/api', channel.getWebhookRouter(opts.storage));
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true, channels: opts.channels.map((c) => c.name) });
  });

  return app;
}
