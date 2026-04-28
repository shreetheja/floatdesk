import { randomUUID } from 'crypto';
import mongoose, { Schema, type Document } from 'mongoose';
import type { StorageAdapter, Ticket, Message } from '../types.js';

interface TicketDoc {
  _id: string;
  title: string;
  description: string;
  type: string;
  url: string;
  userAgent: string;
  createdAt: string;
  channelRefs: Record<string, string>;
  mediaUrl?: string;
}

interface MessageDoc {
  _id: string;
  ticketId: string;
  senderType: string;
  senderName?: string;
  body: string;
  createdAt: string;
}

const TicketSchema = new Schema<TicketDoc>(
  {
    _id: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, required: true },
    url: { type: String, required: true },
    userAgent: { type: String, required: true },
    createdAt: { type: String, required: true },
    channelRefs: { type: Schema.Types.Mixed, default: {} },
    mediaUrl: { type: String },
  },
  { _id: false }
);

const MessageSchema = new Schema<MessageDoc>(
  {
    _id: { type: String },
    ticketId: { type: String, required: true, index: true },
    senderType: { type: String, required: true },
    senderName: { type: String },
    body: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  { _id: false }
);

function getModels(connection: mongoose.Connection) {
  const TicketModel = connection.models['FloatDeskTicket'] as mongoose.Model<TicketDoc> |
    undefined ?? connection.model<TicketDoc>('FloatDeskTicket', TicketSchema);
  const MessageModel = connection.models['FloatDeskMessage'] as mongoose.Model<MessageDoc> |
    undefined ?? connection.model<MessageDoc>('FloatDeskMessage', MessageSchema);
  return { TicketModel, MessageModel };
}

export class MongoAdapter implements StorageAdapter {
  private connection: mongoose.Connection;

  constructor(connectionString: string) {
    this.connection = mongoose.createConnection(connectionString);
  }

  private docToTicket(doc: TicketDoc): Ticket {
    return {
      id: String(doc._id),
      title: doc.title,
      description: doc.description,
      type: doc.type as 'bug' | 'feature',
      url: doc.url,
      userAgent: doc.userAgent,
      createdAt: doc.createdAt,
      channelRefs: doc.channelRefs as Record<string, string>,
      mediaUrl: doc.mediaUrl,
    };
  }

  async createTicket(data: Omit<Ticket, 'id' | 'createdAt'>): Promise<Ticket> {
    const { TicketModel } = getModels(this.connection);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const doc = await TicketModel.create({ _id: id, ...data, createdAt });
    return this.docToTicket(doc);
  }

  async getTicket(ticketId: string): Promise<Ticket | null> {
    const { TicketModel } = getModels(this.connection);
    const doc = await TicketModel.findById(ticketId);
    return doc ? this.docToTicket(doc) : null;
  }

  async findTicketByChannelRef(channelRef: string): Promise<Ticket | null> {
    const { TicketModel } = getModels(this.connection);
    const all = await TicketModel.find({});
    for (const t of all) {
      if (Object.values(t.channelRefs as Record<string, string>).includes(channelRef)) {
        return this.docToTicket(t);
      }
    }
    return null;
  }

  async appendMessage(ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const { MessageModel } = getModels(this.connection);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const doc = await MessageModel.create({ _id: id, ...msg, ticketId, createdAt });
    return {
      id: String(doc._id),
      ticketId: doc.ticketId,
      senderType: doc.senderType as 'user' | 'agent',
      senderName: doc.senderName,
      body: doc.body,
      createdAt: doc.createdAt,
    };
  }

  async getMessages(ticketId: string): Promise<Message[]> {
    const { MessageModel } = getModels(this.connection);
    const docs = await MessageModel.find({ ticketId }).sort({ createdAt: 1 });
    return docs.map((d) => ({
      id: String(d._id),
      ticketId: d.ticketId,
      senderType: d.senderType as 'user' | 'agent',
      senderName: d.senderName,
      body: d.body,
      createdAt: d.createdAt,
    }));
  }
}
