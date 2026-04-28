import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { StorageAdapter, ChannelAdapter, MediaProvider } from '../types.js';

const upload = multer({ storage: multer.memoryStorage() });

const CreateBody = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['bug', 'feature']),
  url: z.string(),
  userAgent: z.string(),
  timestamp: z.string(),
});

const ReplyBody = z.object({ message: z.string().min(1) });

export function createTicketRouter(
  storage: StorageAdapter,
  channels: ChannelAdapter[],
  media?: MediaProvider
): Router {
  const router = Router();

  router.post('/ticket', upload.single('media'), async (req, res) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      return;
    }

    const { title, description, type, url, userAgent } = parsed.data;

    try {
      let mediaUrl: string | undefined;
      if (req.file && media) {
        mediaUrl = await media.upload({
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          filename: req.file.originalname || 'attachment',
        });
      }

      const ticket = await storage.createTicket({
        title,
        description,
        type,
        url,
        userAgent,
        channelRefs: {},
        mediaUrl,
      });

      const channelRefs: Record<string, string> = {};
      await Promise.allSettled(
        channels.map(async (ch) => {
          try {
            const ref = await ch.postTicket(ticket, mediaUrl);
            channelRefs[ch.name] = ref;
          } catch (err) {
            console.error(`Channel ${ch.name} failed:`, err);
          }
        })
      );

      (ticket as { channelRefs: Record<string, string> }).channelRefs = channelRefs;

      res.json({ ticketId: ticket.id });
    } catch (err) {
      console.error('Error creating ticket:', err);
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  });

  router.get('/ticket/:ticketId/messages', async (req, res) => {
    const ticket = await storage.getTicket(req.params['ticketId'] ?? '');
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const messages = await storage.getMessages(ticket.id);
    res.json(messages);
  });

  router.post('/ticket/:ticketId/reply', async (req, res) => {
    const ticket = await storage.getTicket(req.params['ticketId'] ?? '');
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const parsed = ReplyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    const { message } = parsed.data;
    await storage.appendMessage(ticket.id, { ticketId: ticket.id, senderType: 'user', body: message });

    await Promise.allSettled(
      channels.map(async (ch) => {
        const ref = ticket.channelRefs[ch.name];
        if (ref) {
          try {
            await ch.postReply(ref, message);
          } catch (err) {
            console.error(`Channel ${ch.name} reply failed:`, err);
          }
        }
      })
    );

    res.json({ ok: true });
  });

  return router;
}
