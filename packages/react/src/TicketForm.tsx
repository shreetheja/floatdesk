import { useState, type FormEvent } from 'react';
import { Camera, ChevronDown, ScreenShare, X } from 'lucide-react';
import { useMediaCapture } from './useMediaCapture.js';

interface Props {
  serverUrl: string;
  onSuccess: (ticketId: string, title: string, type: 'bug' | 'feature') => void;
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
      onSuccess(data.ticketId, title.trim(), type);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {/* Type dropdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={label}>Type <span style={{ color: '#ff4444' }}>*</span></label>
        <div style={{ position: 'relative' }}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'bug' | 'feature')}
            style={{ ...input, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}
          >
            <option value="bug">🐛  Bug Report</option>
            <option value="feature">✨  Feature Request</option>
          </select>
          <ChevronDown size={14} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={label}>Title <span style={{ color: '#ff4444' }}>*</span></label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary…"
          required
          style={input}
        />
      </div>

      {/* Description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={label}>Description <span style={{ color: '#ff4444' }}>*</span></label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened? What did you expect?"
          required
          rows={3}
          style={{ ...input, resize: 'none' }}
        />
      </div>

      {/* Attach media */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={label}>Attach media</label>
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
