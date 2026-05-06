import { useState, type FormEvent } from 'react';

interface Props {
  serverUrl: string;
}

const input: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#fff',
  outline: 'none',
  width: '100%',
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export function BookCallView({ serverUrl }: Props) {
  const [email, setEmail] = useState(() => localStorage.getItem('floatdesk_email') ?? '');
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !topic.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${serverUrl}/api/call/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), topic: topic.trim() }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = (await res.json()) as { bookingUrl: string };
      localStorage.setItem('floatdesk_email', email.trim());
      // Open Calendly immediately — no second click needed
      window.open(data.bookingUrl, '_blank');
      setDone(true);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '32px 24px', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(107,154,0,0.15)', border: '1px solid rgba(107,154,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          📅
        </div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fff' }}>Calendly opened!</p>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
          Pick a time there. Our team was notified on Slack.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          Great feedback earns credits 🎁
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={label}>Your email <span style={{ color: '#ff4444' }}>*</span></label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          style={input}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={label}>What do you want to discuss? <span style={{ color: '#ff4444' }}>*</span></label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Tell us what you'd like to cover on the call…"
          required
          rows={4}
          style={{ ...input, resize: 'none' }}
        />
      </div>

      {error && <p style={{ color: '#ff4444', fontSize: 13, margin: 0 }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting || !email.trim() || !topic.trim()}
        style={{ padding: '9px 0', borderRadius: 8, background: '#6b9a00', border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (submitting || !email.trim() || !topic.trim()) ? 0.5 : 1 }}
      >
        {submitting ? 'Opening Calendly…' : 'Book a Call →'}
      </button>
    </form>
  );
}
