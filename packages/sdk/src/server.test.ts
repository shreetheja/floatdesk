import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createSupportServer } from './server.js';
import { MemoryAdapter } from './storage/memory.js';
import type { ChannelAdapter } from './types.js';

const stubChannel: ChannelAdapter = {
  name: 'stub',
  webhookPath: '/webhook/stub',
  async postTicket() { return 'ref-123'; },
  async postReply() { /* noop */ },
  async handleWebhook() { return { status: 200, body: { ok: true } }; },
};

describe('createSupportServer', () => {
  let app: ReturnType<typeof createSupportServer>;

  beforeAll(() => {
    app = createSupportServer({ storage: new MemoryAdapter(), channels: [stubChannel] });
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/ticket creates a ticket', async () => {
    const res = await request(app)
      .post('/api/ticket')
      .field('title', 'Test bug')
      .field('description', 'Something broke')
      .field('type', 'bug')
      .field('url', 'http://localhost')
      .field('userAgent', 'vitest')
      .field('timestamp', new Date().toISOString());

    expect(res.status).toBe(200);
    expect(res.body.ticketId).toBeTruthy();
  });

  it('GET /api/ticket/:id/messages returns empty array', async () => {
    const create = await request(app)
      .post('/api/ticket')
      .field('title', 'T')
      .field('description', 'D')
      .field('type', 'feature')
      .field('url', 'http://x')
      .field('userAgent', 'ua')
      .field('timestamp', new Date().toISOString());

    const { ticketId } = create.body as { ticketId: string };
    const res = await request(app).get(`/api/ticket/${ticketId}/messages`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
