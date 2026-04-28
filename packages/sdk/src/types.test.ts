import { describe, it, expectTypeOf } from 'vitest';
import type { StorageAdapter, ChannelAdapter, MediaProvider } from './types.js';

describe('types', () => {
  it('StorageAdapter has required methods', () => {
    expectTypeOf<StorageAdapter>().toHaveProperty('createTicket');
    expectTypeOf<StorageAdapter>().toHaveProperty('getTicket');
    expectTypeOf<StorageAdapter>().toHaveProperty('findTicketByChannelRef');
    expectTypeOf<StorageAdapter>().toHaveProperty('appendMessage');
    expectTypeOf<StorageAdapter>().toHaveProperty('getMessages');
  });

  it('ChannelAdapter has required methods', () => {
    expectTypeOf<ChannelAdapter>().toHaveProperty('postTicket');
    expectTypeOf<ChannelAdapter>().toHaveProperty('postReply');
    expectTypeOf<ChannelAdapter>().toHaveProperty('getWebhookRouter');
  });

  it('MediaProvider has upload method', () => {
    expectTypeOf<MediaProvider>().toHaveProperty('upload');
  });
});
