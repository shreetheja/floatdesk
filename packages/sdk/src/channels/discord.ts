import { Client, GatewayIntentBits, Partials, Events, type Message as DMessage } from 'discord.js';
import type { ChannelAdapter, StorageAdapter, Ticket, WebhookRequest, WebhookResponse } from '../types.js';

export interface DiscordChannelOptions {
  botToken: string;
  channelId: string;
}

export class DiscordChannel implements ChannelAdapter {
  readonly name = 'discord';
  readonly webhookPath = '/webhook/discord';
  private client: Client;
  private channelId: string;
  private storage?: StorageAdapter;

  constructor(opts: DiscordChannelOptions) {
    this.channelId = opts.channelId;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel],
    });

    this.client.on(Events.MessageCreate, async (msg: DMessage) => {
      if (msg.author.bot || !msg.reference?.messageId || !this.storage) return;
      const ticket = await this.storage.findTicketByChannelRef(msg.reference.messageId);
      if (!ticket) return;
      await this.storage.appendMessage(ticket.id, {
        ticketId: ticket.id,
        senderType: 'agent',
        senderName: msg.author.displayName ?? msg.author.username,
        body: msg.content,
      });
    });

    this.client.login(opts.botToken);
  }

  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel?.isTextBased()) throw new Error('Discord channel not found or not text-based');

    const emoji = ticket.type === 'bug' ? '🐛' : '✨';
    const label = ticket.type === 'bug' ? 'Bug' : 'Feature';

    const sent = await (channel as import('discord.js').TextChannel).send({
      embeds: [{
        title: `${emoji} ${label}: ${ticket.title}`,
        description: ticket.description,
        fields: [
          { name: 'URL', value: ticket.url, inline: true },
          { name: 'Time', value: ticket.createdAt, inline: true },
          { name: 'User Agent', value: ticket.userAgent.slice(0, 100), inline: false },
          ...(mediaUrl ? [{ name: 'Media', value: mediaUrl }] : []),
        ],
        color: ticket.type === 'bug' ? 0xff4444 : 0x6b9a00,
      }],
    });
    return sent.id;
  }

  async postReply(channelRef: string, text: string): Promise<void> {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel?.isTextBased()) throw new Error('Discord channel not found');
    const original = await (channel as import('discord.js').TextChannel).messages.fetch(channelRef);
    await original.reply({ content: text });
  }

  // Discord replies come through the gateway (bot WebSocket), not an HTTP webhook.
  // This route exists only for structural symmetry; storage is wired via the constructor listener.
  async handleWebhook(_req: WebhookRequest, storage: StorageAdapter): Promise<WebhookResponse> {
    this.storage = storage;
    return { status: 200, body: 'ok' };
  }
}
