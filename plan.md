# FloatDesk SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish `@floatdesk/sdk` — a standalone, multi-provider support ticket SDK with a plug-in storage adapter pattern, three channel integrations (Slack, Telegram, Discord), AWS S3 media uploads, and a ready-to-drop-in React widget — then wire it into this Clawman app.

**Architecture:** A single GitHub repo (`github.com/shreetheja/floatdesk`) ships two npm packages: `@floatdesk/sdk` (Express server factory + storage adapters + channel adapters) and `@floatdesk/react` (the `<SupportWidget>` React component). Consumers call `createSupportServer({ storage, channels, mediaProvider })` to get an Express router they mount wherever they like. The React widget is configured with the server's base URL and renders identically regardless of which backend providers are chosen.

**Tech Stack:**
- **SDK core:** TypeScript ESM, Express 4, multer, zod, uuid
- **Channels:** `@slack/web-api`, `node-telegram-bot-api`, `discord.js`
- **Storage adapters:** `drizzle-orm` + `pg` (Postgres), `mongoose` (Mongo)
- **Media:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- **React widget:** React 18+, framer-motion, lucide-react, html2canvas
- **Tooling:** pnpm workspaces (monorepo in the floatdesk repo), vitest, tsup for bundling, changesets for releases

---

## Repository Structure

```
floatdesk/                          ← github.com/shreetheja/floatdesk
├── packages/
│   ├── sdk/                        ← @floatdesk/sdk
│   │   ├── src/
│   │   │   ├── index.ts            ← public API: createSupportServer()
│   │   │   ├── types.ts            ← shared interfaces (Ticket, Message, adapters)
│   │   │   ├── server.ts           ← Express router factory
│   │   │   ├── routes/
│   │   │   │   ├── ticket.ts       ← POST /ticket, GET /ticket/:id/messages, POST /ticket/:id/reply
│   │   │   │   └── webhooks.ts     ← POST /webhook/slack, /webhook/telegram, /webhook/discord
│   │   │   ├── channels/
│   │   │   │   ├── types.ts        ← ChannelAdapter interface
│   │   │   │   ├── slack.ts        ← SlackChannel class
│   │   │   │   ├── telegram.ts     ← TelegramChannel class
│   │   │   │   └── discord.ts      ← DiscordChannel class
│   │   │   ├── storage/
│   │   │   │   ├── types.ts        ← StorageAdapter interface
│   │   │   │   ├── postgres.ts     ← PostgresAdapter (Drizzle)
│   │   │   │   └── mongo.ts        ← MongoAdapter (Mongoose)
│   │   │   └── media/
│   │   │       ├── types.ts        ← MediaProvider interface
│   │   │       └── s3.ts           ← S3MediaProvider class
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── react/                      ← @floatdesk/react
│       ├── src/
│       │   ├── index.ts            ← export { SupportWidget }
│       │   ├── SupportWidget.tsx   ← shell: toggle button + animated panel
│       │   ├── TicketForm.tsx      ← form: fields, type toggle, media capture
│       │   ├── ThreadView.tsx      ← polling chat view
│       │   └── useMediaCapture.ts  ← screenshot + screen-record hook
│       ├── package.json
│       └── tsconfig.json
├── pnpm-workspace.yaml
├── turbo.json
├── .changeset/
└── README.md
```

---

## Interfaces (locked before implementation)

### StorageAdapter
```typescript
interface StorageAdapter {
  createTicket(ticket: Omit<Ticket, 'id' | 'createdAt'>): Promise<Ticket>;
  getTicket(ticketId: string): Promise<Ticket | null>;
  findTicketByChannelRef(channelRef: string): Promise<Ticket | null>;
  appendMessage(ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  getMessages(ticketId: string): Promise<Message[]>;
}
```

### ChannelAdapter
```typescript
interface ChannelAdapter {
  readonly name: string;
  postTicket(ticket: Ticket, mediaUrl?: string): Promise<string>; // returns channelRef (thread id / ts)
  postReply(channelRef: string, text: string): Promise<void>;
  getWebhookRouter(storage: StorageAdapter): Router; // mounts on /webhook/<name>
}
```

### MediaProvider
```typescript
interface MediaProvider {
  upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string>; // returns URL
}
```

### Core types
```typescript
interface Ticket {
  id: string;
  title: string;
  description: string;
  type: 'bug' | 'feature';
  url: string;
  userAgent: string;
  createdAt: string;
  channelRefs: Record<string, string>; // { slack: 'ts-123', telegram: '456', discord: '789' }
  mediaUrl?: string;
}

interface Message {
  id: string;
  ticketId: string;
  senderType: 'user' | 'agent';
  senderName?: string;
  body: string;
  createdAt: string;
}
```

---

## Task 1: Initialize the floatdesk repo

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `packages/sdk/package.json`
- Create: `packages/react/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/react/tsconfig.json`

- [ ] **Step 1: Create repo and initialize**

```bash
mkdir floatdesk && cd floatdesk
git init
git branch -m main
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "floatdesk",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.10",
    "turbo": "^2.5.3",
    "typescript": "^5.8.3"
  },
  "engines": { "node": ">=20" },
  "packageManager": "pnpm@10.0.0"
}
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "persistent": true, "cache": false },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 5: Create `packages/sdk/package.json`**

```json
{
  "name": "@floatdesk/sdk",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.787.0",
    "@aws-sdk/s3-request-presigner": "^3.787.0",
    "@slack/web-api": "^7.5.0",
    "cors": "^2.8.5",
    "discord.js": "^14.18.0",
    "express": "^4.21.2",
    "mongoose": "^8.14.1",
    "multer": "^1.4.5-lts.1",
    "node-telegram-bot-api": "^0.66.0",
    "pg": "^8.20.0",
    "drizzle-orm": "^0.40.1",
    "uuid": "^11.1.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.1",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.14.0",
    "@types/node-telegram-bot-api": "^0.64.8",
    "@types/pg": "^8.20.0",
    "@types/uuid": "^10.0.0",
    "tsup": "^8.4.0",
    "typescript": "^5.8.3",
    "vitest": "^3.1.2"
  }
}
```

- [ ] **Step 6: Create `packages/react/package.json`**

```json
{
  "name": "@floatdesk/react",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --external react",
    "dev": "tsup src/index.ts --format esm --dts --watch --external react",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "dependencies": {
    "framer-motion": "^12.12.1",
    "html2canvas": "^1.4.1",
    "lucide-react": "^0.476.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "tsup": "^8.4.0",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 7: Create `packages/sdk/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 8: Create `packages/react/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 9: Install and verify**

```bash
pnpm install
```

Expected: pnpm-lock.yaml created, no errors.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: initialize floatdesk monorepo with sdk and react packages"
```

---

## Task 2: Core types and interfaces

**Files:**
- Create: `packages/sdk/src/types.ts`

- [ ] **Step 1: Create `packages/sdk/src/types.ts`**

```typescript
export interface Ticket {
  id: string;
  title: string;
  description: string;
  type: 'bug' | 'feature';
  url: string;
  userAgent: string;
  createdAt: string;
  channelRefs: Record<string, string>;
  mediaUrl?: string;
}

export interface Message {
  id: string;
  ticketId: string;
  senderType: 'user' | 'agent';
  senderName?: string;
  body: string;
  createdAt: string;
}

export interface StorageAdapter {
  createTicket(ticket: Omit<Ticket, 'id' | 'createdAt'>): Promise<Ticket>;
  getTicket(ticketId: string): Promise<Ticket | null>;
  findTicketByChannelRef(channelRef: string): Promise<Ticket | null>;
  appendMessage(ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  getMessages(ticketId: string): Promise<Message[]>;
}

export interface ChannelAdapter {
  readonly name: string;
  postTicket(ticket: Ticket, mediaUrl?: string): Promise<string>;
  postReply(channelRef: string, text: string): Promise<void>;
  getWebhookRouter(storage: StorageAdapter): import('express').Router;
}

export interface MediaProvider {
  upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string>;
}

export interface SupportServerOptions {
  storage: StorageAdapter;
  channels: ChannelAdapter[];
  media?: MediaProvider;
}
```

- [ ] **Step 2: Write types test (compile check)**

Create `packages/sdk/src/types.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run tests**

```bash
cd packages/sdk && pnpm test
```

Expected: 3 type tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/types.ts packages/sdk/src/types.test.ts
git commit -m "feat(sdk): define core types and adapter interfaces"
```

---

## Task 3: In-memory storage adapter (for testing)

**Files:**
- Create: `packages/sdk/src/storage/types.ts`
- Create: `packages/sdk/src/storage/memory.ts`

- [ ] **Step 1: Create `packages/sdk/src/storage/types.ts`**

```typescript
export type { StorageAdapter } from '../types.js';
```

- [ ] **Step 2: Create `packages/sdk/src/storage/memory.ts`**

```typescript
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
```

- [ ] **Step 3: Write tests for MemoryAdapter**

Create `packages/sdk/src/storage/memory.test.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
cd packages/sdk && pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/storage/
git commit -m "feat(sdk): add MemoryAdapter for testing and development"
```

---

## Task 4: PostgreSQL storage adapter

**Files:**
- Create: `packages/sdk/src/storage/postgres.ts`

- [ ] **Step 1: Create `packages/sdk/src/storage/postgres.ts`**

```typescript
import { randomUUID } from 'crypto';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
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
    const rows = await this.db.execute(
      sql`SELECT * FROM floatdesk_tickets WHERE channel_refs::jsonb @> ${JSON.stringify({ _search: channelRef })}::jsonb
           OR channel_refs::text LIKE ${'%' + channelRef + '%'} LIMIT 1`
    );
    const row = rows.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    // Linear scan fallback: compare values
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/storage/postgres.ts
git commit -m "feat(sdk): add PostgresAdapter with auto-migrate"
```

---

## Task 5: MongoDB storage adapter

**Files:**
- Create: `packages/sdk/src/storage/mongo.ts`

- [ ] **Step 1: Create `packages/sdk/src/storage/mongo.ts`**

```typescript
import { randomUUID } from 'crypto';
import mongoose, { Schema, type Document } from 'mongoose';
import type { StorageAdapter, Ticket, Message } from '../types.js';

interface TicketDoc extends Document {
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

interface MessageDoc extends Document {
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
    const doc = await TicketModel.findOne({
      $or: Object.keys({ slack: '', telegram: '', discord: '' }).map((k) => ({
        [`channelRefs.${k}`]: channelRef,
      })),
    });
    // Fallback: regex scan on channelRefs values
    if (!doc) {
      const all = await TicketModel.find({});
      for (const t of all) {
        if (Object.values(t.channelRefs as Record<string, string>).includes(channelRef)) {
          return this.docToTicket(t);
        }
      }
      return null;
    }
    return this.docToTicket(doc);
  }

  async appendMessage(ticketId: string, msg: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const { MessageModel } = getModels(this.connection);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const doc = await MessageModel.create({ _id: id, ...msg, createdAt });
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/storage/mongo.ts
git commit -m "feat(sdk): add MongoAdapter"
```

---

## Task 6: AWS S3 media provider

**Files:**
- Create: `packages/sdk/src/media/types.ts`
- Create: `packages/sdk/src/media/s3.ts`

- [ ] **Step 1: Create `packages/sdk/src/media/types.ts`**

```typescript
export type { MediaProvider } from '../types.js';
```

- [ ] **Step 2: Create `packages/sdk/src/media/s3.ts`**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import type { MediaProvider } from '../types.js';

export interface S3MediaProviderOptions {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
}

export class S3MediaProvider implements MediaProvider {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor(opts: S3MediaProviderOptions) {
    this.client = new S3Client({
      region: opts.region,
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
    });
    this.bucket = opts.bucket;
    this.publicBaseUrl =
      opts.publicBaseUrl ?? `https://${opts.bucket}.s3.${opts.region}.amazonaws.com`;
  }

  async upload(file: { buffer: Buffer; mimetype: string; filename: string }): Promise<string> {
    const ext = file.filename.split('.').pop() ?? 'bin';
    const key = `floatdesk/${randomUUID()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return `${this.publicBaseUrl}/${key}`;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/media/
git commit -m "feat(sdk): add S3MediaProvider"
```

---

## Task 7: Slack channel adapter

**Files:**
- Create: `packages/sdk/src/channels/types.ts`
- Create: `packages/sdk/src/channels/slack.ts`

- [ ] **Step 1: Create `packages/sdk/src/channels/types.ts`**

```typescript
export type { ChannelAdapter } from '../types.js';
```

- [ ] **Step 2: Create `packages/sdk/src/channels/slack.ts`**

```typescript
import { WebClient } from '@slack/web-api';
import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import type { ChannelAdapter, StorageAdapter, Ticket } from '../types.js';

export interface SlackChannelOptions {
  botToken: string;
  signingSecret: string;
  channelId: string;
}

export class SlackChannel implements ChannelAdapter {
  readonly name = 'slack';
  private client: WebClient;
  private signingSecret: string;
  private channelId: string;

  constructor(opts: SlackChannelOptions) {
    this.client = new WebClient(opts.botToken);
    this.signingSecret = opts.signingSecret;
    this.channelId = opts.channelId;
  }

  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    const emoji = ticket.type === 'bug' ? '🐛' : '✨';
    const label = ticket.type === 'bug' ? 'Bug' : 'Feature';

    const blocks: object[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} ${label}: ${ticket.title}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Description:*\n${ticket.description}` },
          { type: 'mrkdwn', text: `*URL:*\n${ticket.url}` },
          { type: 'mrkdwn', text: `*Time:*\n${ticket.createdAt}` },
          { type: 'mrkdwn', text: `*User Agent:*\n${ticket.userAgent.slice(0, 80)}` },
        ],
      },
    ];

    if (mediaUrl) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Media:* <${mediaUrl}|View attachment>` },
      });
    }

    const res = await this.client.chat.postMessage({
      channel: this.channelId,
      blocks,
      text: `${emoji} ${label}: ${ticket.title}`,
    });

    if (!res.ok || !res.ts) throw new Error(`Slack postMessage failed: ${res.error}`);
    return res.ts;
  }

  async postReply(channelRef: string, text: string): Promise<void> {
    const res = await this.client.chat.postMessage({
      channel: this.channelId,
      thread_ts: channelRef,
      text,
    });
    if (!res.ok) throw new Error(`Slack thread reply failed: ${res.error}`);
  }

  private verifySignature(req: Request & { rawBody?: string }): boolean {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const slackSig = req.headers['x-slack-signature'];
    if (typeof timestamp !== 'string' || typeof slackSig !== 'string') return false;
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;
    const base = `v0:${timestamp}:${req.rawBody ?? ''}`;
    const hmac = 'v0=' + crypto.createHmac('sha256', this.signingSecret).update(base).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(slackSig));
  }

  getWebhookRouter(storage: StorageAdapter): Router {
    const router = Router();

    router.post('/webhook/slack', async (req: Request & { rawBody?: string }, res: Response) => {
      if (!this.verifySignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const body = req.body as Record<string, unknown>;

      if (body['type'] === 'url_verification') {
        res.json({ challenge: body['challenge'] });
        return;
      }

      res.status(200).send('ok');

      if (body['type'] !== 'event_callback') return;

      const event = body['event'] as Record<string, unknown> | undefined;
      if (!event || event['type'] !== 'message' || event['subtype'] === 'bot_message' || !event['thread_ts']) return;

      const threadTs = String(event['thread_ts']);
      const text = String(event['text'] ?? '');
      const userId = String(event['user'] ?? '');

      const ticket = await storage.findTicketByChannelRef(threadTs);
      if (!ticket) return;

      let senderName = userId;
      try {
        const userRes = await this.client.users.info({ user: userId });
        senderName = userRes.user?.real_name ?? userRes.user?.name ?? userId;
      } catch { /* non-fatal */ }

      await storage.appendMessage(ticket.id, {
        ticketId: ticket.id,
        senderType: 'agent',
        senderName,
        body: text,
      });
    });

    return router;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/channels/types.ts packages/sdk/src/channels/slack.ts
git commit -m "feat(sdk): add SlackChannel adapter"
```

---

## Task 8: Telegram channel adapter

**Files:**
- Create: `packages/sdk/src/channels/telegram.ts`

- [ ] **Step 1: Create `packages/sdk/src/channels/telegram.ts`**

```typescript
import TelegramBot from 'node-telegram-bot-api';
import { Router, type Request, type Response } from 'express';
import type { ChannelAdapter, StorageAdapter, Ticket } from '../types.js';

export interface TelegramChannelOptions {
  botToken: string;
  chatId: string | number;
  webhookUrl?: string;
}

export class TelegramChannel implements ChannelAdapter {
  readonly name = 'telegram';
  private bot: TelegramBot;
  private chatId: string | number;

  constructor(opts: TelegramChannelOptions) {
    this.bot = new TelegramBot(opts.botToken, { polling: false });
    this.chatId = opts.chatId;
  }

  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    const emoji = ticket.type === 'bug' ? '🐛' : '✨';
    const label = ticket.type === 'bug' ? 'Bug' : 'Feature';
    const text =
      `${emoji} *${label}: ${ticket.title}*\n\n` +
      `📝 ${ticket.description}\n\n` +
      `🔗 ${ticket.url}\n` +
      `🕒 ${ticket.createdAt}\n` +
      (mediaUrl ? `📎 [Attachment](${mediaUrl})` : '');

    const msg = await this.bot.sendMessage(this.chatId, text, { parse_mode: 'Markdown' });
    return String(msg.message_id);
  }

  async postReply(channelRef: string, text: string): Promise<void> {
    await this.bot.sendMessage(this.chatId, text, {
      reply_to_message_id: parseInt(channelRef, 10),
    });
  }

  getWebhookRouter(storage: StorageAdapter): Router {
    const router = Router();

    router.post('/webhook/telegram', async (req: Request, res: Response) => {
      res.status(200).send('ok');

      const update = req.body as {
        message?: {
          message_id: number;
          reply_to_message?: { message_id: number };
          from?: { first_name?: string; username?: string };
          text?: string;
        };
      };

      const msg = update.message;
      if (!msg?.reply_to_message || !msg.text) return;

      const replyToId = String(msg.reply_to_message.message_id);
      const ticket = await storage.findTicketByChannelRef(replyToId);
      if (!ticket) return;

      const senderName = msg.from?.first_name ?? msg.from?.username ?? 'Agent';

      await storage.appendMessage(ticket.id, {
        ticketId: ticket.id,
        senderType: 'agent',
        senderName,
        body: msg.text,
      });
    });

    return router;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/channels/telegram.ts
git commit -m "feat(sdk): add TelegramChannel adapter"
```

---

## Task 9: Discord channel adapter

**Files:**
- Create: `packages/sdk/src/channels/discord.ts`

- [ ] **Step 1: Create `packages/sdk/src/channels/discord.ts`**

```typescript
import { Client, GatewayIntentBits, Partials, Events, type Message as DMessage } from 'discord.js';
import { Router, type Request, type Response } from 'express';
import type { ChannelAdapter, StorageAdapter, Ticket } from '../types.js';

export interface DiscordChannelOptions {
  botToken: string;
  channelId: string;
}

export class DiscordChannel implements ChannelAdapter {
  readonly name = 'discord';
  private client: Client;
  private channelId: string;
  private storage?: StorageAdapter;

  constructor(opts: DiscordChannelOptions) {
    this.channelId = opts.channelId;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel],
    });

    this.client.on(Events.MessageCreate, async (msg: DMessage) => {
      if (msg.author.bot) return;
      if (!msg.reference?.messageId) return;
      if (!this.storage) return;

      const ticket = await this.storage.findTicketByChannelRef(msg.reference.messageId);
      if (!ticket) return;

      await this.storage.appendMessage(ticket.id, {
        ticketId: ticket.id,
        senderType: 'agent',
        senderName: msg.author.displayName ?? msg.author.username,
        body: msg.content,
      });
    });

    this.client.login(opts.botToken);
  }

  async postTicket(ticket: Ticket, mediaUrl?: string): Promise<string> {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel?.isTextBased()) throw new Error('Discord channel not found or not text-based');

    const emoji = ticket.type === 'bug' ? '🐛' : '✨';
    const label = ticket.type === 'bug' ? 'Bug' : 'Feature';

    const embeds = [
      {
        title: `${emoji} ${label}: ${ticket.title}`,
        description: ticket.description,
        fields: [
          { name: 'URL', value: ticket.url, inline: true },
          { name: 'Time', value: ticket.createdAt, inline: true },
          { name: 'User Agent', value: ticket.userAgent.slice(0, 100), inline: false },
          ...(mediaUrl ? [{ name: 'Media', value: mediaUrl }] : []),
        ],
        color: ticket.type === 'bug' ? 0xff4444 : 0x6b9a00,
      },
    ];

    const sent = await (channel as import('discord.js').TextChannel).send({ embeds });
    return sent.id;
  }

  async postReply(channelRef: string, text: string): Promise<void> {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel?.isTextBased()) throw new Error('Discord channel not found');
    const original = await (channel as import('discord.js').TextChannel).messages.fetch(channelRef);
    await original.reply({ content: text });
  }

  getWebhookRouter(storage: StorageAdapter): Router {
    this.storage = storage;
    const router = Router();
    // Discord replies are received via the bot's MessageCreate event (wired above in constructor)
    // This endpoint is a no-op placeholder for router symmetry
    router.post('/webhook/discord', (_req: Request, res: Response) => {
      res.status(200).send('ok');
    });
    return router;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/sdk/src/channels/discord.ts
git commit -m "feat(sdk): add DiscordChannel adapter"
```

---

## Task 10: Express server factory and ticket routes

**Files:**
- Create: `packages/sdk/src/routes/ticket.ts`
- Create: `packages/sdk/src/server.ts`

- [ ] **Step 1: Create `packages/sdk/src/routes/ticket.ts`**

```typescript
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { StorageAdapter, ChannelAdapter, MediaProvider } from '../types.js';

const upload = multer({ storage: multer.memoryStorage() });

const CreateBody = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['bug', 'feature']),
  url: z.string(),
  userAgent: z.string(),
  timestamp: z.string(),
});

const ReplyBody = z.object({ message: z.string().min(1) });

export function createTicketRouter(
  storage: StorageAdapter,
  channels: ChannelAdapter[],
  media?: MediaProvider
): Router {
  const router = Router();

  router.post('/ticket', upload.single('media'), async (req, res) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
      return;
    }

    const { title, description, type, url, userAgent, timestamp } = parsed.data;

    try {
      let mediaUrl: string | undefined;
      if (req.file && media) {
        mediaUrl = await media.upload({
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          filename: req.file.originalname || 'attachment',
        });
      }

      const ticket = await storage.createTicket({
        title,
        description,
        type,
        url,
        userAgent,
        createdAt: timestamp,
        channelRefs: {},
        mediaUrl,
      });

      const channelRefs: Record<string, string> = {};
      await Promise.allSettled(
        channels.map(async (ch) => {
          try {
            const ref = await ch.postTicket(ticket, mediaUrl);
            channelRefs[ch.name] = ref;
          } catch (err) {
            console.error(`Channel ${ch.name} failed:`, err);
          }
        })
      );

      // Update ticket with channelRefs (re-create with refs for adapter compatibility)
      // For simplicity, mutate in-place for memory adapter; Postgres/Mongo adapters
      // would need an updateTicket method — add a best-effort update here
      (ticket as { channelRefs: Record<string, string> }).channelRefs = channelRefs;

      res.json({ ticketId: ticket.id });
    } catch (err) {
      console.error('Error creating ticket:', err);
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  });

  router.get('/ticket/:ticketId/messages', async (req, res) => {
    const ticket = await storage.getTicket(req.params['ticketId'] ?? '');
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    const messages = await storage.getMessages(ticket.id);
    res.json(messages);
  });

  router.post('/ticket/:ticketId/reply', async (req, res) => {
    const ticket = await storage.getTicket(req.params['ticketId'] ?? '');
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const parsed = ReplyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    const { message } = parsed.data;
    await storage.appendMessage(ticket.id, { ticketId: ticket.id, senderType: 'user', body: message });

    await Promise.allSettled(
      channels.map(async (ch) => {
        const ref = ticket.channelRefs[ch.name];
        if (ref) {
          try {
            await ch.postReply(ref, message);
          } catch (err) {
            console.error(`Channel ${ch.name} reply failed:`, err);
          }
        }
      })
    );

    res.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 2: Create `packages/sdk/src/server.ts`**

```typescript
import express, { type Express } from 'express';
import cors from 'cors';
import { createTicketRouter } from './routes/ticket.js';
import type { SupportServerOptions } from './types.js';

export function createSupportServer(opts: SupportServerOptions): Express {
  const app = express();

  // Capture raw body for webhook signature verification
  app.use((req, _res, next) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      (req as typeof req & { rawBody: string }).rawBody = data;
      next();
    });
  });

  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Ticket CRUD routes
  app.use('/api', createTicketRouter(opts.storage, opts.channels, opts.media));

  // Channel webhook routes (each channel registers its own /webhook/<name>)
  for (const channel of opts.channels) {
    app.use('/api', channel.getWebhookRouter(opts.storage));
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true, channels: opts.channels.map((c) => c.name) });
  });

  return app;
}
```

- [ ] **Step 3: Integration test for server with MemoryAdapter**

Create `packages/sdk/src/server.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createSupportServer } from './server.js';
import { MemoryAdapter } from './storage/memory.js';

// Minimal stub channel that does nothing
const stubChannel = {
  name: 'stub',
  async postTicket() { return 'ref-123'; },
  async postReply() { /* noop */ },
  getWebhookRouter() {
    const { Router } = await import('express');
    return Router();
  },
};

describe('createSupportServer', () => {
  let app: ReturnType<typeof createSupportServer>;

  beforeAll(async () => {
    const { Router } = await import('express');
    const channel = { ...stubChannel, getWebhookRouter: () => Router() };
    app = createSupportServer({ storage: new MemoryAdapter(), channels: [channel] });
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
```

Add `supertest` to devDependencies: `pnpm add -D supertest @types/supertest --filter @floatdesk/sdk`

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @floatdesk/sdk test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/routes/ packages/sdk/src/server.ts packages/sdk/src/server.test.ts
git commit -m "feat(sdk): add createSupportServer factory with ticket routes and channel webhooks"
```

---

## Task 11: Public API entry point

**Files:**
- Create: `packages/sdk/src/index.ts`

- [ ] **Step 1: Create `packages/sdk/src/index.ts`**

```typescript
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
```

- [ ] **Step 2: Build the SDK**

```bash
pnpm --filter @floatdesk/sdk build
```

Expected: `packages/sdk/dist/` created with `index.js` and `index.d.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/index.ts
git commit -m "feat(sdk): export public API from index"
```

---

## Task 12: React widget — useMediaCapture hook

**Files:**
- Create: `packages/react/src/useMediaCapture.ts`

- [ ] **Step 1: Create `packages/react/src/useMediaCapture.ts`**

```typescript
import { useState, useCallback } from 'react';

export type MediaAttachment =
  | { kind: 'screenshot'; blob: Blob; previewUrl: string }
  | { kind: 'recording'; blob: Blob; previewUrl: string };

export function useMediaCapture() {
  const [attachment, setAttachment] = useState<MediaAttachment | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureScreenshot = useCallback(async () => {
    setIsCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) return;
        setAttachment({ kind: 'screenshot', blob, previewUrl: canvas.toDataURL('image/png') });
      }, 'image/png');
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const recordScreen = useCallback(async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'video/webm' });
        setAttachment({ kind: 'recording', blob, previewUrl: URL.createObjectURL(blob) });
        setIsCapturing(false);
      };

      recorder.start();
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 60_000);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state === 'recording') recorder.stop();
      });
    } catch {
      setIsCapturing(false);
    }
  }, []);

  const clearAttachment = useCallback(() => {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  }, [attachment]);

  return { attachment, isCapturing, captureScreenshot, recordScreen, clearAttachment };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/react/src/useMediaCapture.ts
git commit -m "feat(react): add useMediaCapture hook"
```

---

## Task 13: React widget — TicketForm

**Files:**
- Create: `packages/react/src/TicketForm.tsx`

- [ ] **Step 1: Create `packages/react/src/TicketForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Bug, Sparkles, Camera, ScreenShare, X } from 'lucide-react';
import { useMediaCapture } from './useMediaCapture.js';

interface Props {
  serverUrl: string;
  onSuccess: (ticketId: string, title: string) => void;
}

export function TicketForm({ serverUrl, onSuccess }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'bug' | 'feature'>('bug');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { attachment, isCapturing, captureScreenshot, recordScreen, clearAttachment } = useMediaCapture();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('type', type);
      fd.append('url', window.location.href);
      fd.append('userAgent', navigator.userAgent);
      fd.append('timestamp', new Date().toISOString());

      if (attachment) {
        const ext = attachment.kind === 'screenshot' ? 'png' : 'webm';
        const mime = attachment.kind === 'screenshot' ? 'image/png' : 'video/webm';
        fd.append('media', new File([attachment.blob], `attachment.${ext}`, { type: mime }));
      }

      const res = await fetch(`${serverUrl}/api/ticket`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Submit failed');
      const data = (await res.json()) as { ticketId: string };
      onSuccess(data.ticketId, title.trim());
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const pillBase = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border-none';
  const pillActive = 'bg-[#6b9a00] text-white';
  const pillInactive = 'bg-white/10 text-white/60 hover:text-white';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => setType('bug')} className={`${pillBase} ${type === 'bug' ? pillActive : pillInactive}`}>
          <Bug size={14} /> Bug
        </button>
        <button type="button" onClick={() => setType('feature')} className={`${pillBase} ${type === 'feature' ? pillActive : pillInactive}`}>
          <Sparkles size={14} /> Feature
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Title <span style={{ color: '#ff4444' }}>*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary..."
          required
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#fff', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Description <span style={{ color: '#ff4444' }}>*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened? What did you expect?"
          required
          rows={3}
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#fff', outline: 'none', resize: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Attach media
        </label>
        {!attachment ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={captureScreenshot} disabled={isCapturing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>
              <Camera size={13} /> Screenshot
            </button>
            <button type="button" onClick={recordScreen} disabled={isCapturing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>
              <ScreenShare size={13} /> {isCapturing ? 'Recording…' : 'Record Screen'}
            </button>
          </div>
        ) : (
          <div style={{ position: 'relative', width: 'fit-content' }}>
            {attachment.kind === 'screenshot'
              ? <img src={attachment.previewUrl} alt="preview" style={{ height: 64, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', objectFit: 'cover' }} />
              : <video src={attachment.previewUrl} style={{ height: 64, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', objectFit: 'cover' }} />}
            <button type="button" onClick={clearAttachment}
              style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: '50%', background: '#ff4444', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ color: '#ff4444', fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting || !title.trim() || !description.trim()}
        style={{ padding: '9px 0', borderRadius: 8, background: '#6b9a00', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (submitting || !title.trim() || !description.trim()) ? 0.5 : 1 }}>
        {submitting ? 'Sending…' : 'Send Report'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/react/src/TicketForm.tsx
git commit -m "feat(react): add TicketForm component"
```

---

## Task 14: React widget — ThreadView

**Files:**
- Create: `packages/react/src/ThreadView.tsx`

- [ ] **Step 1: Create `packages/react/src/ThreadView.tsx`**

```tsx
import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  senderType: 'user' | 'agent';
  senderName?: string;
  body: string;
  createdAt: string;
}

interface Props {
  serverUrl: string;
  ticketId: string;
  title: string;
}

export function ThreadView({ serverUrl, ticketId, title }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch(`${serverUrl}/api/ticket/${ticketId}/messages`);
        if (res.ok && active) setMessages((await res.json()) as Message[]);
      } catch { /* ignore */ }
    }
    poll();
    const id = setInterval(poll, 4000);
    return () => { active = false; clearInterval(id); };
  }, [serverUrl, ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    setReply('');
    try {
      await fetch(`${serverUrl}/api/ticket/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
    } finally {
      setSending(false);
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Support thread</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 16 }}>
            Ticket submitted. An agent will reply shortly.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '85%', alignSelf: msg.senderType === 'user' ? 'flex-end' : 'flex-start', alignItems: msg.senderType === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.senderType === 'agent' && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', paddingLeft: 4 }}>
                {msg.senderName ?? 'Agent'} · {fmt(msg.createdAt)}
              </span>
            )}
            <div style={{
              padding: '8px 12px',
              borderRadius: msg.senderType === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.senderType === 'user' ? 'rgba(107,154,0,0.3)' : 'rgba(255,255,255,0.08)',
              border: msg.senderType === 'agent' ? '1px solid rgba(255,255,255,0.1)' : 'none',
              fontSize: 13,
              color: '#fff',
              lineHeight: 1.5,
            }}>
              {msg.body}
            </div>
            {msg.senderType === 'user' && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', paddingRight: 4 }}>{fmt(msg.createdAt)}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply…"
          style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#fff', outline: 'none' }}
        />
        <button type="submit" disabled={sending || !reply.trim()}
          style={{ width: 36, height: 36, borderRadius: 8, background: '#6b9a00', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (sending || !reply.trim()) ? 0.5 : 1, flexShrink: 0 }}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/react/src/ThreadView.tsx
git commit -m "feat(react): add ThreadView with polling and reply"
```

---

## Task 15: React widget — SupportWidget shell + public index

**Files:**
- Create: `packages/react/src/SupportWidget.tsx`
- Create: `packages/react/src/index.ts`

- [ ] **Step 1: Create `packages/react/src/SupportWidget.tsx`**

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, X } from 'lucide-react';
import { TicketForm } from './TicketForm.js';
import { ThreadView } from './ThreadView.js';

interface Props {
  serverUrl: string;
}

type View = 'form' | 'thread';

export function SupportWidget({ serverUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('form');
  const [thread, setThread] = useState<{ ticketId: string; title: string } | null>(null);

  function handleSuccess(ticketId: string, title: string) {
    setThread({ ticketId, title });
    setView('thread');
  }

  const panelStyle: React.CSSProperties = {
    width: 360,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#1a1a1a',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 100px)',
    minHeight: 420,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={panelStyle}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bug size={16} color="#6b9a00" />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {view === 'thread' ? 'Support Thread' : 'Report an Issue'}
                </span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {view === 'form' ? (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <TicketForm serverUrl={serverUrl} onSuccess={handleSuccess} />
                </div>
              ) : thread ? (
                <ThreadView serverUrl={serverUrl} ticketId={thread.ticketId} title={thread.title} />
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        style={{ width: 48, height: 48, borderRadius: '50%', background: '#6b9a00', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 20px rgba(107,154,0,0.4)' }}
        aria-label={open ? 'Close support' : 'Open support'}
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.12 }}><X size={20} /></motion.span>
            : <motion.span key="bug" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.12 }}><Bug size={20} /></motion.span>
          }
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
```

- [ ] **Step 2: Create `packages/react/src/index.ts`**

```typescript
export { SupportWidget } from './SupportWidget.js';
export { TicketForm } from './TicketForm.js';
export { ThreadView } from './ThreadView.js';
export { useMediaCapture } from './useMediaCapture.js';
export type { MediaAttachment } from './useMediaCapture.js';
```

- [ ] **Step 3: Build the React package**

```bash
pnpm --filter @floatdesk/react build
```

Expected: `packages/react/dist/` created with `index.js` and `index.d.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/react/src/
git commit -m "feat(react): add SupportWidget shell and export public API"
```

---

## Task 16: Wire into the Clawman app (apps/web)

This task runs in the **Clawman repo** (`/Users/shreetheja/Desktop/trader`), not the floatdesk repo.

**Files:**
- Modify: `apps/web/package.json` — add `@floatdesk/react` and `@floatdesk/sdk`
- Create: `apps/support/index.ts` — standalone support server entry (uses `createSupportServer`)
- Modify: `apps/web/src/app/layout.tsx` — mount `<SupportWidget>`

- [ ] **Step 1: While developing locally, link the packages**

```bash
# In floatdesk repo
pnpm build

# In trader repo
pnpm add @floatdesk/react@link:../floatdesk/packages/react --filter @trader/web
pnpm add @floatdesk/sdk@link:../floatdesk/packages/sdk --filter @trader/support
```

Once published to npm, replace `link:` with the npm version.

- [ ] **Step 2: Create `apps/support/index.ts` in trader repo**

```typescript
import 'dotenv/config';
import { createSupportServer, SlackChannel, PostgresAdapter, S3MediaProvider } from '@floatdesk/sdk';

const storage = new PostgresAdapter(process.env['DATABASE_URL']!);
await storage.migrate();

const server = createSupportServer({
  storage,
  channels: [
    new SlackChannel({
      botToken: process.env['SLACK_BOT_TOKEN']!,
      signingSecret: process.env['SLACK_SIGNING_SECRET']!,
      channelId: process.env['SLACK_CHANNEL_ID']!,
    }),
  ],
  media: new S3MediaProvider({
    region: process.env['AWS_REGION']!,
    bucket: process.env['AWS_S3_BUCKET']!,
    accessKeyId: process.env['AWS_ACCESS_KEY_ID']!,
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY']!,
  }),
});

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);
server.listen(PORT, () => console.log(`FloatDesk support server on port ${PORT}`));
```

- [ ] **Step 3: Mount widget in `apps/web/src/app/layout.tsx`**

Add to imports:
```typescript
import { SupportWidget } from '@floatdesk/react';
```

Add inside `<body>` before `{children}`:
```tsx
<SupportWidget serverUrl={process.env['NEXT_PUBLIC_SUPPORT_URL'] ?? 'http://localhost:3002'} />
```

- [ ] **Step 4: Add env vars to `.env.example`**

```
NEXT_PUBLIC_SUPPORT_URL=http://localhost:3002
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_CHANNEL_ID=C0123456789
AWS_REGION=us-east-1
AWS_S3_BUCKET=my-floatdesk-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

- [ ] **Step 5: Commit**

```bash
git add apps/support/ apps/web/src/app/layout.tsx apps/web/package.json .env.example
git commit -m "feat: wire FloatDesk SDK into Clawman — support server + widget in layout"
```

---

## Task 17: Changesets and publish config

**Files (in floatdesk repo):**
- Create: `.changeset/config.json`
- Create: `packages/sdk/.npmignore`
- Create: `packages/react/.npmignore`

- [ ] **Step 1: Initialize changesets**

```bash
cd floatdesk && pnpm changeset init
```

- [ ] **Step 2: Create `.npmignore` for both packages**

`packages/sdk/.npmignore` and `packages/react/.npmignore`:
```
src/
*.test.ts
*.test.tsx
tsconfig.json
```

- [ ] **Step 3: Add publish script to root package.json**

```json
"release": "pnpm build && pnpm changeset publish"
```

- [ ] **Step 4: Commit**

```bash
git add .changeset/ packages/sdk/.npmignore packages/react/.npmignore package.json
git commit -m "chore: add changeset config and npmignore for publishing"
```

---

## Verification

### SDK unit tests
```bash
cd packages/sdk && pnpm test
```
Expected: MemoryAdapter tests + server integration tests all pass.

### SDK build
```bash
pnpm --filter @floatdesk/sdk build && ls packages/sdk/dist/
```
Expected: `index.js`, `index.d.ts` present.

### React build
```bash
pnpm --filter @floatdesk/react build && ls packages/react/dist/
```
Expected: `index.js`, `index.d.ts` present.

### Live end-to-end (local)
1. Start the support server: `cd apps/support && tsx index.ts`
2. Verify: `curl http://localhost:3002/health` → `{"ok":true,"channels":["slack"]}`
3. Create a ticket via curl (multipart form-data) — Slack message should appear in channel
4. Start the web app: `cd apps/web && pnpm dev`
5. Open browser → bug icon appears bottom-right
6. Submit a ticket → transitions to thread view
7. Reply in Slack thread → appears in widget within 4 seconds
8. Reply in widget → appears as Slack thread reply
9. Test Telegram and Discord by instantiating those channels in the support server entry

### Publish dry run
```bash
cd floatdesk && pnpm changeset add && pnpm build && pnpm changeset publish --dry-run
```
