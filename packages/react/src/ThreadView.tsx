import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Send, Camera, ScreenShare, X } from 'lucide-react';
import { useMediaCapture } from './useMediaCapture.js';

interface Message {
  id: string;
  senderType: 'user' | 'agent';
  senderName?: string;
  body: string;
  mediaUrl?: string;
  createdAt: string;
}

interface Props {
  serverUrl: string;
  ticketId: string;
  title: string;
  mediaEnabled?: boolean;
}

export function ThreadView({ serverUrl, ticketId, title, mediaEnabled = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { attachment, isCapturing, captureScreenshot, recordScreen, clearAttachment, pasteImage } = useMediaCapture();

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
      if (attachment) {
        const fd = new FormData();
        fd.append('message', text);
        const ext = attachment.kind === 'screenshot' ? 'png' : 'webm';
        const mime = attachment.kind === 'screenshot' ? 'image/png' : 'video/webm';
        fd.append('media', new File([attachment.blob], `reply.${ext}`, { type: mime }));
        await fetch(`${serverUrl}/api/ticket/${ticketId}/reply`, { method: 'POST', body: fd });
        clearAttachment();
      } else {
        await fetch(`${serverUrl}/api/ticket/${ticketId}/reply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
      }
    } finally {
      setSending(false);
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const btnStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 6,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer',
  };

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
              fontSize: 13, color: '#fff', lineHeight: 1.5,
            }}>
              {msg.body}
              {msg.mediaUrl && (
                <div style={{ marginTop: 8 }}>
                  {/\.(mp4|webm|mov)$/i.test(msg.mediaUrl)
                    ? <video src={msg.mediaUrl} controls style={{ maxWidth: '100%', borderRadius: 6, maxHeight: 160 }} />
                    : <img src={msg.mediaUrl} alt="attachment" style={{ maxWidth: '100%', borderRadius: 6, maxHeight: 160, objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(msg.mediaUrl, '_blank')} />
                  }
                </div>
              )}
            </div>
            {msg.senderType === 'user' && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', paddingRight: 4 }}>{fmt(msg.createdAt)}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Attachment preview */}
        {attachment && (
          <div style={{ padding: '8px 16px 0', position: 'relative', width: 'fit-content' }}>
            {attachment.kind === 'screenshot'
              ? <img src={attachment.previewUrl} alt="preview" style={{ height: 56, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', objectFit: 'cover' }} />
              : <video src={attachment.previewUrl} style={{ height: 56, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }} />}
            <button type="button" onClick={clearAttachment} style={{ position: 'absolute', top: 2, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#ff4444', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={10} />
            </button>
          </div>
        )}

        {/* Media capture buttons */}
        {mediaEnabled && !attachment && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px 0' }}>
            <button type="button" onClick={captureScreenshot} disabled={isCapturing} style={btnStyle}>
              <Camera size={12} /> Screenshot
            </button>
            <button type="button" onClick={recordScreen} disabled={isCapturing} style={btnStyle}>
              <ScreenShare size={12} /> {isCapturing ? 'Recording…' : 'Record'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, padding: '8px 16px 12px' }}>
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onPaste={pasteImage}
            placeholder="Reply…"
            style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#fff', outline: 'none' }}
          />
          <button type="submit" disabled={sending || !reply.trim()}
            style={{ width: 36, height: 36, borderRadius: 8, background: '#6b9a00', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (sending || !reply.trim()) ? 0.5 : 1, flexShrink: 0 }}>
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
