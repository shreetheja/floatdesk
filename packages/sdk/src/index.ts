// Express convenience wrapper
export { createSupportServer } from './server.js';

// Express adapter (use this if you want just the Router, not a full app)
export { createExpressRouter } from './adapters/express.js';
export type { ExpressAdapterOptions } from './adapters/express.js';

// Core service functions — framework-agnostic, use with Hono, Fastify, or anything else
export { submitTicket, getTicketMessages, addReply, getHealth } from './core/ticket-service.js';
export type { ServiceResult, FileInput } from './core/ticket-service.js';

// Types / interfaces
export type {
  Ticket,
  Message,
  StorageAdapter,
  ChannelAdapter,
  MediaProvider,
  SupportServerOptions,
  WebhookRequest,
  WebhookResponse,
} from './types.js';

// Storage adapters
export { MemoryAdapter } from './storage/memory.js';
export { PostgresAdapter } from './storage/postgres.js';
export { MongoAdapter } from './storage/mongo.js';

// Channel adapters
export { SlackChannel } from './channels/slack.js';
export { TelegramChannel } from './channels/telegram.js';
export { DiscordChannel } from './channels/discord.js';

// Media providers
export { S3MediaProvider } from './media/s3.js';
