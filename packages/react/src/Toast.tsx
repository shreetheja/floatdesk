import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface ToastProps {
  senderName: string;
  body: string;
  onDismiss: () => void;
  onClick: () => void;
}

export function Toast({ senderName, body, onDismiss, onClick }: ToastProps) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
      style={{
        background: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '10px 14px',
        maxWidth: 260,
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b9a00', marginBottom: 3 }}>
        {senderName}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {body}
      </div>
    </motion.div>
  );
}
