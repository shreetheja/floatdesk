import { randomUUID } from 'crypto';
import mongoose, { Schema, type Document } from 'mongoose';
import type { StorageAdapter, Ticket, Message, FeedbackCall } from '../types.js';

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
  mediaUrl?: string;
  createdAt: string;
}

interface FeedbackCallDoc {
  _id: string;
  email: string;
  topic: string;
  status: string;
  creditsAwarded?: number;
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
    mediaUrl: { type: String },
    createdAt: { type: String, required: true },
  },
  { _id: false }
);

const FeedbackCallSchema = new Schema<FeedbackCallDoc>(
  {
    _id: { type: String },
    email: { type: String, required: true, index: true },
    topic: { type: String, required: true },
    status: { type: String, required: true, default: 'pending' },
    creditsAwarded: { type: Number },
    createdAt: { type: String, required: true },
  },
  { _id: false }
);

function getModels(connection: mongoose.Connection) {
  const TicketModel = connection.models['FloatDeskTicket'] as mongoose.Model<TicketDoc> |
    undefined ?? connection.model<TicketDoc>('FloatDeskTicket', TicketSchema);
  const MessageModel = connection.models['FloatDeskMessage'] as mongoose.Model<MessageDoc> |
    undefined ?? connection.model<MessageDoc>('FloatDeskMessage', MessageSchema);
  const FeedbackCallModel = connection.models['FloatDeskFeedbackCall'] as mongoose.Model<FeedbackCallDoc> |
    undefined ?? connection.model<FeedbackCallDoc>('FloatDeskFeedbackCall', FeedbackCallSchema);
  return { TicketModel, MessageModel, FeedbackCallModel };
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
      mediaUrl: doc.mediaUrl,
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
      mediaUrl: d.mediaUrl,
      createdAt: d.createdAt,
    }));
  }

  async createFeedbackCall(data: Omit<FeedbackCall, 'id' | 'createdAt'>): Promise<FeedbackCall> {
    const { FeedbackCallModel } = getModels(this.connection);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const doc = await FeedbackCallModel.create({ _id: id, ...data, createdAt });
    return this.docToFeedbackCall(doc);
  }

  async getFeedbackCall(id: string): Promise<FeedbackCall | null> {
    const { FeedbackCallModel } = getModels(this.connection);
    const doc = await FeedbackCallModel.findById(id);
    return doc ? this.docToFeedbackCall(doc) : null;
  }

  async updateFeedbackCall(id: string, data: Partial<Pick<FeedbackCall, 'status' | 'creditsAwarded'>>): Promise<FeedbackCall> {
    const { FeedbackCallModel } = getModels(this.connection);
    const doc = await FeedbackCallModel.findByIdAndUpdate(id, { $set: data }, { new: true });
    if (!doc) throw new Error(`FeedbackCall not found: ${id}`);
    return this.docToFeedbackCall(doc);
  }

  async getCredits(email: string): Promise<number> {
    const { FeedbackCallModel } = getModels(this.connection);
    const docs = await FeedbackCallModel.find({ email, status: 'credited' });
    return docs.reduce((sum, d) => sum + (d.creditsAwarded ?? 0), 0);
  }

  private docToFeedbackCall(doc: FeedbackCallDoc): FeedbackCall {
    return {
      id: String(doc._id),
      email: doc.email,
      topic: doc.topic,
      status: doc.status as FeedbackCall['status'],
      creditsAwarded: doc.creditsAwarded,
      createdAt: doc.createdAt,
    };
  }
}
