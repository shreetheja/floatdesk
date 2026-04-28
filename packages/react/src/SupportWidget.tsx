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
