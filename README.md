# FloatDesk

A standalone, multi-provider support ticket SDK with a plug-in storage adapter pattern, three channel integrations, AWS S3 media uploads, and a ready-to-drop-in React widget.

## Packages

| Package | Description |
|---------|-------------|
| [`@floatdesk/sdk`](./packages/sdk) | Express server factory + storage adapters + channel adapters |
| [`@floatdesk/react`](./packages/react) | `<SupportWidget>` React component |

## Quick Start

### 1. Install

```bash
pnpm add @floatdesk/sdk @floatdesk/react
```

### 2. Start a support server

```typescript
import { createSupportServer, SlackChannel, PostgresAdapter, S3MediaProvider } from '@floatdesk/sdk';

const storage = new PostgresAdapter(process.env.DATABASE_URL);
await storage.migrate();

const app = createSupportServer({
  storage,
  channels: [
    new SlackChannel({
      botToken: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      channelId: process.env.SLACK_CHANNEL_ID,
    }),
  ],
  media: new S3MediaProvider({
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }),
});

app.listen(3002, () => console.log('FloatDesk running on :3002'));
```

### 3. Add the widget to your React app

```tsx
import { SupportWidget } from '@floatdesk/react';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <SupportWidget serverUrl="http://localhost:3002" />
    </>
  );
}
```

## Development

```bash
pnpm install
pnpm build       # build all packages
pnpm test        # run all tests
pnpm typecheck   # typecheck all packages
```

## Publishing

```bash
pnpm changeset add   # describe your changes
pnpm release         # build + publish to npm
```

## Architecture

```
floatdesk/
├── packages/
│   ├── sdk/      @floatdesk/sdk  — Express server factory, adapters
│   └── react/    @floatdesk/react — SupportWidget React component
```

Consumers call `createSupportServer({ storage, channels, media })` and get back an Express app. The React widget is configured with the server's base URL and works regardless of which backend providers are chosen.
