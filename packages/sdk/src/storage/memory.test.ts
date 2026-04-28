import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from './memory.js';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => { adapter = new MemoryAdapter(); });

  it('createTicket returns ticket with id and createdAt', async () => {
    const t = await adapter.createTicket({
      title: 'Bug', description: 'Oops', type: 'bug',
      url: 'http://x.com', userAgent: 'test', channelRefs: {},
    });
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.createdAt).toBeTruthy();
  });

  it('getTicket returns the same ticket', async () => {
    const t = await adapter.createTicket({
      title: 'T', description: 'D', type: 'feature',
      url: 'http://x.com', userAgent: 'ua', channelRefs: {},
    });
    const found = await adapter.getTicket(t.id);
    expect(found?.id).toBe(t.id);
  });

  it('findTicketByChannelRef finds by any channel ref value', async () => {
    const t = await adapter.createTicket({
      title: 'T', description: 'D', type: 'bug',
      url: 'http://x.com', userAgent: 'ua', channelRefs: { slack: 'ts-999' },
    });
    const found = await adapter.findTicketByChannelRef('ts-999');
    expect(found?.id).toBe(t.id);
  });

  it('appendMessage and getMessages work correctly', async () => {
    const t = await adapter.createTicket({
      title: 'T', description: 'D', type: 'bug',
      url: 'http://x.com', userAgent: 'ua', channelRefs: {},
    });
    const msg = await adapter.appendMessage(t.id, { ticketId: t.id, senderType: 'user', body: 'Hello' });
    expect(msg.id).toBeTruthy();
    const msgs = await adapter.getMessages(t.id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.body).toBe('Hello');
  });
});
