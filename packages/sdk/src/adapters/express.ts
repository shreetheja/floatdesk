import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { StorageAdapter, ChannelAdapter, MediaProvider } from '../types.js';
import { submitTicket, getTicketMessages, addReply, getHealth } from '../core/ticket-service.js';

const upload = multer({ storage: multer.memoryStorage() });

export interface ExpressAdapterOptions {
  storage: StorageAdapter;
  channels: ChannelAdapter[];
  media?: MediaProvider;
}

/**
 * Returns an Express Router with all FloatDesk routes.
 * Mount this at whatever prefix you like, e.g. app.use('/api', createExpressRouter(opts)).
 * Works with plain Express — no other framework required.
 */
export function createExpressRouter(opts: ExpressAdapterOptions): Router {
  const { storage, channels, media } = opts;
  const router = Router();

  // POST /ticket — multipart form, optional media file
  router.post('/ticket', upload.single('media'), async (req: Request, res: Response) => {
    const result = await submitTicket(
      req.body,
      req.file
        ? { buffer: req.file.buffer, mimetype: req.file.mimetype, filename: req.file.originalname || 'attachment' }
        : undefined,
      storage, channels, media,
    );
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ticketId: result.ticketId });
  });

  // GET /ticket/:ticketId/messages
  router.get('/ticket/:ticketId/messages', async (req: Request, res: Response) => {
    const result = await getTicketMessages(String(req.params.ticketId ?? ''), storage);
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json(result.messages);
  });

  // POST /ticket/:ticketId/reply — accepts JSON or multipart (when media is attached)
  router.post('/ticket/:ticketId/reply', upload.single('media'), async (req: Request, res: Response) => {
    const result = await addReply(
      String(req.params.ticketId ?? ''),
      req.body,
      storage,
      channels,
      req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype, filename: req.file.originalname || 'attachment' } : undefined,
      media,
    );
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ok: true });
  });

  // Webhook routes — each channel declares its own path
  for (const ch of channels) {
    router.post(ch.webhookPath, async (req: Request & { rawBody?: string }, res: Response) => {
      const headers: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) headers[k] = v;

      const result = await ch.handleWebhook(
        { headers, body: req.body, rawBody: req.rawBody ?? '' },
        storage,
      );
      res.status(result.status).json(result.body);
    });
  }

  return router;
}
