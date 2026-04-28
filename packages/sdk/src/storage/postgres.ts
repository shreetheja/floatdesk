import { randomUUID } from 'crypto';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import { eq, sql } from 'drizzle-orm';
import pg from 'pg';
import type { StorageAdapter, Ticket, Message } from '../types.js';

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
  createdAt: text('created_at').notNull(),
});

export class PostgresAdapter implements StorageAdapter {
  private db: NodePgDatabase;

  constructor(connectionString: string) {
    const pool = new pg.Pool({ connectionString });
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

  async appendMessage(_ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const message: Message = { ...msg, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.db.insert(messagesTable).values({
      id: message.id,
      ticketId: message.ticketId,
      senderType: message.senderType,
      senderName: message.senderName,
      body: message.body,
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
      createdAt: r.createdAt,
    }));
  }
}
