import { randomUUID } from 'crypto';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pgTable, text, jsonb, integer } from 'drizzle-orm/pg-core';
import { eq, sql } from 'drizzle-orm';
import pg from 'pg';
import type { StorageAdapter, Ticket, Message, FeedbackCall } from '../types.js';

const ticketsTable = pgTable('floatdesk_tickets', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(),
  url: text('url').notNull(),
  userAgent: text('user_agent').notNull(),
  createdAt: text('created_at').notNull(),
  channelRefs: jsonb('channel_refs').notNull().$type<Record<string, string>>(),
  mediaUrl: text('media_url'),
});

const messagesTable = pgTable('floatdesk_messages', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull(),
  senderType: text('sender_type').notNull(),
  senderName: text('sender_name'),
  body: text('body').notNull(),
  mediaUrl: text('media_url'),
  createdAt: text('created_at').notNull(),
});

const feedbackCallsTable = pgTable('floatdesk_feedback_calls', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  topic: text('topic').notNull(),
  status: text('status').notNull(),
  creditsAwarded: integer('credits_awarded'),
  createdAt: text('created_at').notNull(),
});

export interface PostgresAdapterOptions {
  /**
   * SSL config for the connection pool.
   * Pass `true` for standard SSL or `{ rejectUnauthorized: false }` for self-signed certs.
   * When omitted, auto-detected from the `?sslmode=` query parameter:
   *   - `sslmode=require`    → ssl: true
   *   - `sslmode=no-verify`  → ssl: { rejectUnauthorized: false }
   */
  ssl?: boolean | { rejectUnauthorized: boolean };
}

export class PostgresAdapter implements StorageAdapter {
  private db: NodePgDatabase;

  constructor(connectionString: string, options?: PostgresAdapterOptions) {
    let ssl = options?.ssl;
    if (ssl === undefined) {
      try {
        const mode = new URL(connectionString).searchParams.get('sslmode');
        if (mode === 'require')    ssl = true;
        if (mode === 'no-verify') ssl = { rejectUnauthorized: false };
      } catch { /* non-parseable URL, leave ssl undefined */ }
    }
    const pool = new pg.Pool({ connectionString, ssl });
    this.db = drizzle(pool);
  }

  async migrate(): Promise<void> {
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS floatdesk_tickets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        created_at TEXT NOT NULL,
        channel_refs JSONB NOT NULL DEFAULT '{}',
        media_url TEXT
      );
      CREATE TABLE IF NOT EXISTS floatdesk_messages (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES floatdesk_tickets(id),
        sender_type TEXT NOT NULL,
        sender_name TEXT,
        body TEXT NOT NULL,
        media_url TEXT,
        created_at TEXT NOT NULL
      );
      ALTER TABLE floatdesk_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
      CREATE TABLE IF NOT EXISTS floatdesk_feedback_calls (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        topic TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        credits_awarded INTEGER,
        created_at TEXT NOT NULL
      );
    `);
  }

  async createTicket(data: Omit<Ticket, 'id' | 'createdAt'>): Promise<Ticket> {
    const ticket: Ticket = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.db.insert(ticketsTable).values({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      type: ticket.type,
      url: ticket.url,
      userAgent: ticket.userAgent,
      createdAt: ticket.createdAt,
      channelRefs: ticket.channelRefs,
      mediaUrl: ticket.mediaUrl,
    });
    return ticket;
  }

  async getTicket(ticketId: string): Promise<Ticket | null> {
    const rows = await this.db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId));
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type as 'bug' | 'feature',
      url: row.url,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      channelRefs: row.channelRefs as Record<string, string>,
      mediaUrl: row.mediaUrl ?? undefined,
    };
  }

  async findTicketByChannelRef(channelRef: string): Promise<Ticket | null> {
    const allTickets = await this.db.select().from(ticketsTable);
    for (const t of allTickets) {
      const refs = t.channelRefs as Record<string, string>;
      if (Object.values(refs).includes(channelRef)) {
        return this.getTicket(t.id);
      }
    }
    return null;
  }

  async appendMessage(ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const message: Message = { ...msg, ticketId, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.db.insert(messagesTable).values({
      id: message.id,
      ticketId: message.ticketId,
      senderType: message.senderType,
      senderName: message.senderName,
      body: message.body,
      mediaUrl: message.mediaUrl,
      createdAt: message.createdAt,
    });
    return message;
  }

  async getMessages(ticketId: string): Promise<Message[]> {
    const rows = await this.db.select().from(messagesTable).where(eq(messagesTable.ticketId, ticketId));
    return rows.map((r) => ({
      id: r.id,
      ticketId: r.ticketId,
      senderType: r.senderType as 'user' | 'agent',
      senderName: r.senderName ?? undefined,
      body: r.body,
      mediaUrl: r.mediaUrl ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async createFeedbackCall(data: Omit<FeedbackCall, 'id' | 'createdAt'>): Promise<FeedbackCall> {
    const call: FeedbackCall = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.db.insert(feedbackCallsTable).values({
      id: call.id,
      email: call.email,
      topic: call.topic,
      status: call.status,
      creditsAwarded: call.creditsAwarded ?? null,
      createdAt: call.createdAt,
    });
    return call;
  }

  async getFeedbackCall(id: string): Promise<FeedbackCall | null> {
    const rows = await this.db.select().from(feedbackCallsTable).where(eq(feedbackCallsTable.id, id));
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      topic: row.topic,
      status: row.status as FeedbackCall['status'],
      creditsAwarded: row.creditsAwarded ?? undefined,
      createdAt: row.createdAt,
    };
  }

  async updateFeedbackCall(id: string, data: Partial<Pick<FeedbackCall, 'status' | 'creditsAwarded'>>): Promise<FeedbackCall> {
    await this.db.update(feedbackCallsTable)
      .set({
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.creditsAwarded !== undefined ? { creditsAwarded: data.creditsAwarded } : {}),
      })
      .where(eq(feedbackCallsTable.id, id));
    const updated = await this.getFeedbackCall(id);
    if (!updated) throw new Error(`FeedbackCall not found: ${id}`);
    return updated;
  }

  async getCredits(email: string): Promise<number> {
    const rows = await this.db.select({ creditsAwarded: feedbackCallsTable.creditsAwarded })
      .from(feedbackCallsTable)
      .where(eq(feedbackCallsTable.email, email));
    return rows.reduce((sum, r) => sum + (r.creditsAwarded ?? 0), 0);
  }
}
