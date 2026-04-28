import TelegramBot from 'node-telegram-bot-api';
import { Router, type Request, type Response } from 'express';
import type { ChannelAdapter, StorageAdapter, Ticket } from '../types.js';

export interface TelegramChannelOptions {
  botToken: string;
  chatId: string | number;
  webhookUrl?: string;
}

export class TelegramChannel implements ChannelAdapter {
  readonly name = 'telegram';
  private bot: TelegramBot;
  private chatId: string | number;

  constructor(opts: TelegramChannelOptions) {
    this.bot = new TelegramBot(opts.botToken, { polling: false });
    this.chatId = opts.chatId;
  }

  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    const emoji = ticket.type === 'bug' ? '🐛' : '✨';
    const label = ticket.type === 'bug' ? 'Bug' : 'Feature';
    const text =
      `${emoji} *${label}: ${ticket.title}*\n\n` +
      `📝 ${ticket.description}\n\n` +
      `🔗 ${ticket.url}\n` +
      `🕒 ${ticket.createdAt}\n` +
      (mediaUrl ? `📎 [Attachment](${mediaUrl})` : '');

    const msg = await this.bot.sendMessage(this.chatId, text, { parse_mode: 'Markdown' });
    return String(msg.message_id);
  }

  async postReply(channelRef: string, text: string): Promise<void> {
    await this.bot.sendMessage(this.chatId, text, {
      reply_to_message_id: parseInt(channelRef, 10),
    });
  }

  getWebhookRouter(storage: StorageAdapter): Router {
    const router = Router();

    router.post('/webhook/telegram', async (req: Request, res: Response) => {
      res.status(200).send('ok');

      const update = req.body as {
        message?: {
          message_id: number;
          reply_to_message?: { message_id: number };
          from?: { first_name?: string; username?: string };
          text?: string;
        };
      };

      const msg = update.message;
      if (!msg?.reply_to_message || !msg.text) return;

      const replyToId = String(msg.reply_to_message.message_id);
      const ticket = await storage.findTicketByChannelRef(replyToId);
      if (!ticket) return;

      const senderName = msg.from?.first_name ?? msg.from?.username ?? 'Agent';

      await storage.appendMessage(ticket.id, {
        ticketId: ticket.id,
        senderType: 'agent',
        senderName,
        body: msg.text,
      });
    });

    return router;
  }
}
