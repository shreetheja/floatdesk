import TelegramBot from 'node-telegram-bot-api';
import type { ChannelAdapter, StorageAdapter, Ticket, WebhookRequest, WebhookResponse } from '../types.js';

export interface TelegramChannelOptions {
  botToken: string;
  chatId: string | number;
}

export class TelegramChannel implements ChannelAdapter {
  readonly name = 'telegram';
  readonly webhookPath = '/webhook/telegram';
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

  async handleWebhook(req: WebhookRequest, storage: StorageAdapter): Promise<WebhookResponse> {
    const update = req.body as {
      message?: {
        message_id: number;
        reply_to_message?: { message_id: number };
        from?: { first_name?: string; username?: string };
        text?: string;
      };
    };

    const msg = update.message;
    if (!msg?.reply_to_message || !msg.text) return { status: 200, body: 'ok' };

    const replyToId = String(msg.reply_to_message.message_id);
    const ticket = await storage.findTicketByChannelRef(replyToId);
    if (!ticket) return { status: 200, body: 'ok' };

    const senderName = msg.from?.first_name ?? msg.from?.username ?? 'Agent';
    await storage.appendMessage(ticket.id, {
      ticketId: ticket.id,
      senderType: 'agent',
      senderName,
      body: msg.text,
    });

    return { status: 200, body: 'ok' };
  }
}
