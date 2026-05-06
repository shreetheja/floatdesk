import { z } from 'zod';
import type { StorageAdapter, ChannelAdapter, CallConfig } from '../types.js';
import type { SlackChannel } from '../channels/slack.js';

const schema = z.object({
  email: z.string().email(),
  topic: z.string().min(1),
});

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export async function requestFeedbackCall(
  body: unknown,
  storage: StorageAdapter,
  channels: ChannelAdapter[],
  callConfig: CallConfig,
): Promise<Result<{ bookingUrl: string }>> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { email, topic } = parsed.data;
  const call = await storage.createFeedbackCall({ email, topic, status: 'pending' });

  const slack = channels.find((c) => c.name === 'slack') as SlackChannel | undefined;
  if (slack) {
    try {
      await slack.postCallRequest(call, callConfig);
    } catch (err) {
      console.error('[call-service] Slack notification failed:', err);
    }
  }

  return { ok: true, bookingUrl: callConfig.bookingUrl };
}
