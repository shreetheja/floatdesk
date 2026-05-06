import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, X, ChevronLeft, ChevronRight, Plus, Sparkles, Phone, MessageCircle } from 'lucide-react';
import { TicketForm } from './TicketForm.js';
import { ThreadView } from './ThreadView.js';
import { BookCallView } from './BookCallView.js';
import { Toast } from './Toast.js';

interface LoginUser {
  id?: string;
  email?: string;
  name?: string;
}

interface Props {
  serverUrl: string;
  signupUser?: LoginUser;
  signupMessage?: string;
}

interface StoredTicket {
  ticketId: string;
  title: string;
  type: 'bug' | 'feature' | 'session';
  createdAt: string;
}

type View = 'list' | 'form' | 'thread' | 'call';

const STORAGE_KEY  = 'floatdesk_tickets';
const LAST_SEEN_KEY = 'floatdesk_last_seen';
const SESSION_KEY   = 'floatdesk_session';

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

function loadLastSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) ?? '{}') as Record<string, string>; }
  catch { return {}; }
}

function markSeen(ticketId: string) {
  const map = loadLastSeen();
  map[ticketId] = new Date().toISOString();
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
}

function markAllSeen(ticketIds: string[]) {
  const now = new Date().toISOString();
  const map = loadLastSeen();
  for (const id of ticketIds) map[id] = now;
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
}

interface SessionRecord { userId?: string; email?: string; ticketId: string; }

function loadSession(): SessionRecord | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as SessionRecord | null; }
  catch { return null; }
}

function saveSession(r: SessionRecord) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(r));
}

export function SupportWidget({ serverUrl, signupUser, signupMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('form');
  const [thread, setThread] = useState<{ ticketId: string; title: string } | null>(null);
  const [tickets, setTickets] = useState<StoredTicket[]>([]);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [callEnabled, setCallEnabled] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{ senderName: string; body: string; ticketId: string } | null>(null);
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const signupFiredRef = useRef(false);

  useEffect(() => {
    fetch(`${serverUrl}/health`)
      .then((r) => r.json())
      .then((d: { media?: boolean; call?: boolean }) => {
        setMediaEnabled(Boolean(d.media));
        setCallEnabled(Boolean(d.call));
      })
      .catch(() => {});
  }, [serverUrl]);

  // Signup session — fires once per new user identity
  useEffect(() => {
    if (!signupUser || !signupMessage) return;
    if (signupFiredRef.current) return;
    signupFiredRef.current = true;

    const existing = loadSession();
    const sameUser =
      (signupUser.id !== undefined && existing?.userId === signupUser.id) ||
      (signupUser.email !== undefined && existing?.email === signupUser.email);

    if (sameUser && existing?.ticketId) {
      const saved = loadTickets();
      if (!saved.find((t) => t.ticketId === existing.ticketId)) {
        const displayName = signupUser.name ?? signupUser.email ?? 'User';
        persistTicket({ ticketId: existing.ticketId, title: `Session: ${displayName}`, type: 'session', createdAt: new Date().toISOString() });
        setTickets(loadTickets());
      }
      return;
    }

    fetch(`${serverUrl}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: signupUser.id,
        email: signupUser.email,
        name: signupUser.name,
        signupMessage,
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    })
      .then((r) => r.json())
      .then((d: { ticketId: string }) => {
        saveSession({ userId: signupUser.id, email: signupUser.email, ticketId: d.ticketId });
        const displayName = signupUser.name ?? signupUser.email ?? 'User';
        persistTicket({ ticketId: d.ticketId, title: `Session: ${displayName}`, type: 'session', createdAt: new Date().toISOString() });
        setTickets(loadTickets());
      })
      .catch(() => { signupFiredRef.current = false; });
  }, [signupUser, signupMessage, serverUrl]);

  // Background polling for unread messages — runs whether widget is open or closed
  useEffect(() => {
    let active = true;

    async function pollAll() {
      const allTickets = loadTickets();
      if (allTickets.length === 0) return;
      const seenMap = loadLastSeen();

      for (const t of allTickets) {
        try {
          const res = await fetch(`${serverUrl}/api/ticket/${t.ticketId}/messages`);
          if (!res.ok || !active) continue;
          const msgs = (await res.json()) as Array<{ id: string; senderType: string; senderName?: string; body: string; createdAt: string }>;
          const seenAt = seenMap[t.ticketId];
          const newMsgs = msgs.filter((m) => m.senderType === 'agent' && (!seenAt || m.createdAt > seenAt));
          if (newMsgs.length > 0 && !open) {
            setUnreadCount((c) => c + newMsgs.length);
            const latest = newMsgs[newMsgs.length - 1]!;
            setToast({ senderName: latest.senderName ?? 'Agent', body: latest.body.slice(0, 80), ticketId: t.ticketId });
          }
        } catch { /* ignore */ }
      }
    }

    pollAll();
    const id = setInterval(pollAll, 15000);
    return () => { active = false; clearInterval(id); };
  }, [serverUrl, open]);

  function handleOpen() {
    const saved = loadTickets();
    setTickets(saved);
    setView(saved.length > 0 ? 'list' : 'form');
    setOpen(true);
    markAllSeen(saved.map((t) => t.ticketId));
    setUnreadCount(0);
    setToast(null);
    setLastSeen(loadLastSeen());

    const email = localStorage.getItem('floatdesk_email');
    if (email) {
      fetch(`${serverUrl}/api/credits/${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then((d: { balance: number }) => setCredits(d.balance > 0 ? d.balance : null))
        .catch(() => {});
    }
  }

  function handleSuccess(ticketId: string, title: string, type: 'bug' | 'feature') {
    const entry: StoredTicket = { ticketId, title, type, createdAt: new Date().toISOString() };
    persistTicket(entry);
    setTickets(loadTickets());
    setThread({ ticketId, title });
    setView('thread');
  }

  function openThread(t: StoredTicket) {
    markSeen(t.ticketId);
    setLastSeen((prev) => ({ ...prev, [t.ticketId]: new Date().toISOString() }));
    setThread({ ticketId: t.ticketId, title: t.title });
    setView('thread');
  }

  function goBack() {
    setView(tickets.length > 0 ? 'list' : 'form');
  }

  const showBack = view === 'thread' || view === 'call' || (view === 'form' && tickets.length > 0);

  const headerTitle =
    view === 'list'   ? 'Your Tickets' :
    view === 'thread' ? 'Support Thread' :
    view === 'call'   ? 'Book a Call' :
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

              {view === 'list' && credits !== null && (
                <span style={{ fontSize: 12, color: '#6b9a00', fontWeight: 600, background: 'rgba(107,154,0,0.12)', border: '1px solid rgba(107,154,0,0.25)', borderRadius: 6, padding: '2px 8px' }}>
                  🎁 {credits}
                </span>
              )}

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
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1 }}>
                    {tickets.length === 0 ? (
                      <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', padding: '32px 16px' }}>No tickets yet</p>
                    ) : tickets.map((t) => (
                      <button
                        key={t.ticketId}
                        onClick={() => openThread(t)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: t.type === 'bug' ? 'rgba(239,68,68,0.15)' : t.type === 'session' ? 'rgba(96,165,250,0.15)' : 'rgba(107,154,0,0.15)' }}>
                          {t.type === 'bug'     ? <Bug size={13} color="#ef4444" /> :
                           t.type === 'session' ? <MessageCircle size={13} color="#60a5fa" /> :
                                                  <Sparkles size={13} color="#6b9a00" />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#e5e5e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                          <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{timeAgo(t.createdAt)}</span>
                        </span>
                        <ChevronRight size={14} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                        {!lastSeen[t.ticketId] && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                        )}
                      </button>
                    ))}
                  </div>

                  {callEnabled && (
                    <button
                      onClick={() => setView('call')}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px', background: 'rgba(107,154,0,0.07)', border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'rgba(107,154,0,0.15)' }}>
                        <Phone size={13} color="#6b9a00" />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#e5e5e5' }}>Book a Feedback Call</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Earn credits for great feedback</span>
                      </span>
                      <ChevronRight size={14} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                    </button>
                  )}
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

              {view === 'call' && (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <BookCallView serverUrl={serverUrl} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast popup — shown when widget is closed and new agent message arrives */}
      <AnimatePresence>
        {toast && !open && (
          <Toast
            key={toast.ticketId}
            senderName={toast.senderName}
            body={toast.body}
            onDismiss={() => setToast(null)}
            onClick={() => {
              setToast(null);
              const t = loadTickets().find((t) => t.ticketId === toast.ticketId);
              if (t) { openThread(t); setOpen(true); } else handleOpen();
            }}
          />
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={() => { if (open) setOpen(false); else handleOpen(); }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        style={{ position: 'relative', width: 48, height: 48, borderRadius: '50%', background: '#6b9a00', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 20px rgba(107,154,0,0.4)' }}
        aria-label={open ? 'Close support' : 'Open support'}
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.12 }}><X size={20} /></motion.span>
            : <motion.span key="bug" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.12 }}><Bug size={20} /></motion.span>
          }
        </AnimatePresence>
        {/* Unread dot badge */}
        {unreadCount > 0 && !open && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            width: 12, height: 12, borderRadius: '50%',
            background: '#ef4444', border: '2px solid #101010',
            pointerEvents: 'none',
          }} />
        )}
      </motion.button>
    </div>
  );
}
