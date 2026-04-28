import { z } from 'zod';
import type { StorageAdapter, ChannelAdapter, MediaProvider } from '../types.js';

const CreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['bug', 'feature']),
  url: z.string(),
  userAgent: z.string(),
});

const ReplySchema = z.object({ message: z.string().min(1) });

export type ServiceResult<T> =
  | ({ ok: true } & T)
  | { ok: false; status: number; error: string };

export interface FileInput {
  buffer: Buffer;
  mimetype: string;
  filename: string;
}

export async function submitTicket(
  fields: unknown,
  file: FileInput | undefined,
  storage: StorageAdapter,
  channels: ChannelAdapter[],
  media?: MediaProvider,
): Promise<ServiceResult<{ ticketId: string }>> {
  const parsed = CreateSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Invalid request' };
  }

  const { title, description, type, url, userAgent } = parsed.data;

  let mediaUrl: string | undefined;
  if (file && media) {
    mediaUrl = await media.upload(file);
  }

  // Build a provisional ticket object (no id yet) so channels can format the message.
  // Channels don't use ticket.id, so this is safe.
  const provisional = {
    id: '', title, description, type, url, userAgent,
    channelRefs: {}, mediaUrl, createdAt: new Date().toISOString(),
  };

  // Post to channels first so we can collect their refs before writing to storage.
  // This ensures findTicketByChannelRef can match Slack thread_ts on inbound webhooks.
  const channelRefs: Record<string, string> = {};
  await Promise.allSettled(
    channels.map(async (ch) => {
      try {
        channelRefs[ch.name] = await ch.postTicket(provisional, mediaUrl);
      } catch (err) {
        console.error(`Channel ${ch.name} failed:`, err);
      }
    }),
  );

  const ticket = await storage.createTicket({
    title, description, type, url, userAgent, channelRefs, mediaUrl,
  });

  return { ok: true, ticketId: ticket.id };
}

export async function getTicketMessages(
  ticketId: string,
  storage: StorageAdapter,
): Promise<ServiceResult<{ messages: unknown[] }>> {
  const ticket = await storage.getTicket(ticketId);
  if (!ticket) return { ok: false, status: 404, error: 'Ticket not found' };
  return { ok: true, messages: await storage.getMessages(ticket.id) };
}

export async function addReply(
  ticketId: string,
  body: unknown,
  storage: StorageAdapter,
  channels: ChannelAdapter[],
  file?: FileInput,
  media?: MediaProvider,
): Promise<ServiceResult<Record<never, never>>> {
  const ticket = await storage.getTicket(ticketId);
  if (!ticket) return { ok: false, status: 404, error: 'Ticket not found' };

  const parsed = ReplySchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: 'Invalid request' };

  const { message } = parsed.data;

  let mediaUrl: string | undefined;
  if (file && media) {
    mediaUrl = await media.upload(file);
  }

  await storage.appendMessage(ticket.id, { ticketId: ticket.id, senderType: 'user', body: message, mediaUrl });

  await Promise.allSettled(
    channels.map(async (ch) => {
      const ref = ticket.channelRefs[ch.name];
      if (ref) {
        try { await ch.postReply(ref, message, mediaUrl); }
        catch (err) { console.error(`Channel ${ch.name} reply failed:`, err); }
      }
    }),
  );

  return { ok: true };
}

export function getHealth(channels: ChannelAdapter[]): { ok: true; channels: string[] } {
  return { ok: true, channels: channels.map((c) => c.name) };
}
