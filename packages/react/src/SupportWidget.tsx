import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, X, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { TicketForm } from './TicketForm.js';
import { ThreadView } from './ThreadView.js';

interface Props {
  serverUrl: string;
}

interface StoredTicket {
  ticketId: string;
  title: string;
  type: 'bug' | 'feature';
  createdAt: string;
}

type View = 'list' | 'form' | 'thread';

const STORAGE_KEY = 'floatdesk_tickets';

function loadTickets(): StoredTicket[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredTicket[];
  } catch { return []; }
}

function persistTicket(t: StoredTicket) {
  const all = loadTickets();
  all.unshift(t);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SupportWidget({ serverUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('form');
  const [thread, setThread] = useState<{ ticketId: string; title: string } | null>(null);
  const [tickets, setTickets] = useState<StoredTicket[]>([]);
  const [mediaEnabled, setMediaEnabled] = useState(false);

  useEffect(() => {
    fetch(`${serverUrl}/health`)
      .then((r) => r.json())
      .then((d: { media?: boolean }) => setMediaEnabled(Boolean(d.media)))
      .catch(() => {});
  }, [serverUrl]);

  function handleOpen() {
    const saved = loadTickets();
    setTickets(saved);
    setView(saved.length > 0 ? 'list' : 'form');
    setOpen(true);
  }

  function handleSuccess(ticketId: string, title: string, type: 'bug' | 'feature') {
    const entry: StoredTicket = { ticketId, title, type, createdAt: new Date().toISOString() };
    persistTicket(entry);
    setTickets(loadTickets());
    setThread({ ticketId, title });
    setView('thread');
  }

  function openThread(t: StoredTicket) {
    setThread({ ticketId: t.ticketId, title: t.title });
    setView('thread');
  }

  function goBack() {
    setView(tickets.length > 0 ? 'list' : 'form');
  }

  const showBack = view === 'thread' || (view === 'form' && tickets.length > 0);

  const headerTitle =
    view === 'list'   ? 'Your Tickets' :
    view === 'thread' ? 'Support Thread' :
                        'Report an Issue';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
              {showBack ? (
                <button onClick={goBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6, flexShrink: 0 }}>
                  <ChevronLeft size={16} />
                </button>
              ) : (
                <Bug size={16} color="#6b9a00" style={{ flexShrink: 0 }} />
              )}

              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1 }}>{headerTitle}</span>

              {view === 'list' && (
                <button
                  onClick={() => setView('form')}
                  title="New ticket"
                  style={{ background: 'rgba(107,154,0,0.15)', border: '1px solid rgba(107,154,0,0.3)', borderRadius: 6, color: '#6b9a00', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}
                >
                  <Plus size={13} /> New
                </button>
              )}

              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', padding: 4, flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {view === 'list' && (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {tickets.length === 0 ? (
                    <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', padding: '32px 16px' }}>No tickets yet</p>
                  ) : tickets.map((t) => (
                    <button
                      key={t.ticketId}
                      onClick={() => openThread(t)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: t.type === 'bug' ? 'rgba(239,68,68,0.15)' : 'rgba(107,154,0,0.15)' }}>
                        {t.type === 'bug' ? <Bug size={13} color="#ef4444" /> : <Sparkles size={13} color="#6b9a00" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#e5e5e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{timeAgo(t.createdAt)}</span>
                      </span>
                      <ChevronRight size={14} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}

              {view === 'form' && (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <TicketForm serverUrl={serverUrl} onSuccess={handleSuccess} mediaEnabled={mediaEnabled} />
                </div>
              )}

              {view === 'thread' && thread && (
                <ThreadView serverUrl={serverUrl} ticketId={thread.ticketId} title={thread.title} mediaEnabled={mediaEnabled} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={() => { if (open) setOpen(false); else handleOpen(); }}
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
