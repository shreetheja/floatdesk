export interface Ticket {
  id: string;
  title: string;
  description: string;
  type: 'bug' | 'feature';
  url: string;
  userAgent: string;
  createdAt: string;
  channelRefs: Record<string, string>;
  mediaUrl?: string;
}

export interface Message {
  id: string;
  ticketId: string;
  senderType: 'user' | 'agent';
  senderName?: string;
  body: string;
  createdAt: string;
}

export interface StorageAdapter {
  createTicket(ticket: Omit<Ticket, 'id' | 'createdAt'>): Promise<Ticket>;
  getTicket(ticketId: string): Promise<Ticket | null>;
  findTicketByChannelRef(channelRef: string): Promise<Ticket | null>;
  appendMessage(ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  getMessages(ticketId: string): Promise<Message[]>;
}

export interface ChannelAdapter {
  readonly name: string;
  postTicket(ticket: Ticket, mediaUrl?: string): Promise<string>;
  postReply(channelRef: string, text: string): Promise<void>;
  getWebhookRouter(storage: StorageAdapter): import('express').Router;
}

export interface MediaProvider {
  upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string>;
}

export interface SupportServerOptions {
  storage: StorageAdapter;
  channels: ChannelAdapter[];
  media?: MediaProvider;
}
