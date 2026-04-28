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
