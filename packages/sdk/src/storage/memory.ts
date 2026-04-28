import { randomUUID } from 'crypto';
import type { StorageAdapter, Ticket, Message } from '../types.js';

export class MemoryAdapter implements StorageAdapter {
  private tickets = new Map<string, Ticket>();
  private messages = new Map<string, Message[]>();

  async createTicket(data: Omit<Ticket, 'id' | 'createdAt'>): Promise<Ticket> {
    const ticket: Ticket = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    this.tickets.set(ticket.id, ticket);
    this.messages.set(ticket.id, []);
    return ticket;
  }

  async getTicket(ticketId: string): Promise<Ticket | null> {
    return this.tickets.get(ticketId) ?? null;
  }

  async findTicketByChannelRef(channelRef: string): Promise<Ticket | null> {
    for (const ticket of this.tickets.values()) {
      if (Object.values(ticket.channelRefs).includes(channelRef)) return ticket;
    }
    return null;
  }

  async appendMessage(ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const message: Message = { ...msg, id: randomUUID(), createdAt: new Date().toISOString() };
    const list = this.messages.get(ticketId) ?? [];
    list.push(message);
    this.messages.set(ticketId, list);
    return message;
  }

  async getMessages(ticketId: string): Promise<Message[]> {
    return this.messages.get(ticketId) ?? [];
  }
}
