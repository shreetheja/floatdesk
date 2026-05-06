export interface Ticket {
  id: string;
  title: string;
  description: string;
  type: 'bug' | 'feature' | 'session';
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
  mediaUrl?: string;
  createdAt: string;
}

export interface StorageAdapter {
  createTicket(ticket: Omit<Ticket, 'id' | 'createdAt'>): Promise<Ticket>;
  getTicket(ticketId: string): Promise<Ticket | null>;
  findTicketByChannelRef(channelRef: string): Promise<Ticket | null>;
  appendMessage(ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  getMessages(ticketId: string): Promise<Message[]>;
  createFeedbackCall(data: Omit<FeedbackCall, 'id' | 'createdAt'>): Promise<FeedbackCall>;
  getFeedbackCall(id: string): Promise<FeedbackCall | null>;
  updateFeedbackCall(id: string, data: Partial<Pick<FeedbackCall, 'status' | 'creditsAwarded'>>): Promise<FeedbackCall>;
  getCredits(email: string): Promise<number>;
}

/** Framework-agnostic webhook request — populate from Express, Hono, or any other framework. */
export interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody: string;
}

/** Framework-agnostic webhook response returned by channel adapters. */
export interface WebhookResponse {
  status: number;
  body: unknown;
}

export interface ChannelAdapter {
  readonly name: string;
  /** Path this channel expects its webhook on, e.g. '/webhook/slack'. */
  readonly webhookPath: string;
  postTicket(ticket: Ticket, mediaUrl?: string): Promise<string>;
  postReply(channelRef: string, text: string, mediaUrl?: string): Promise<void>;
  handleWebhook(req: WebhookRequest, storage: StorageAdapter): Promise<WebhookResponse>;
}

export interface MediaProvider {
  upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string>;
}

export interface FeedbackCall {
  id: string;
  email: string;
  topic: string;
  status: 'pending' | 'credited' | 'dismissed';
  creditsAwarded?: number;
  createdAt: string;
}

export interface CallConfig {
  bookingUrl: string;
  creditReward?: number;
}

export interface SupportServerOptions {
  storage: StorageAdapter;
  channels: ChannelAdapter[];
  media?: MediaProvider;
  call?: CallConfig;
}
