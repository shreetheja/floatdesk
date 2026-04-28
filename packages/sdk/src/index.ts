// Server factory
export { createSupportServer } from './server.js';

// Types / interfaces
export type {
  Ticket,
  Message,
  StorageAdapter,
  ChannelAdapter,
  MediaProvider,
  SupportServerOptions,
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
