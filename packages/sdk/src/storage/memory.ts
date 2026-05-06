import { randomUUID } from 'crypto';
import type { StorageAdapter, Ticket, Message, FeedbackCall } from '../types.js';

export class MemoryAdapter implements StorageAdapter {
  private tickets = new Map<string, Ticket>();
  private messages = new Map<string, Message[]>();
  private feedbackCalls = new Map<string, FeedbackCall>();

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

  async createFeedbackCall(data: Omit<FeedbackCall, 'id' | 'createdAt'>): Promise<FeedbackCall> {
    const call: FeedbackCall = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    this.feedbackCalls.set(call.id, call);
    return call;
  }

  async getFeedbackCall(id: string): Promise<FeedbackCall | null> {
    return this.feedbackCalls.get(id) ?? null;
  }

  async updateFeedbackCall(id: string, data: Partial<Pick<FeedbackCall, 'status' | 'creditsAwarded'>>): Promise<FeedbackCall> {
    const call = this.feedbackCalls.get(id);
    if (!call) throw new Error(`FeedbackCall not found: ${id}`);
    const updated = { ...call, ...data };
    this.feedbackCalls.set(id, updated);
    return updated;
  }

  async getCredits(email: string): Promise<number> {
    let total = 0;
    for (const call of this.feedbackCalls.values()) {
      if (call.email === email && call.creditsAwarded) total += call.creditsAwarded;
    }
    return total;
  }
}
