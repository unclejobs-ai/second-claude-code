import { motion, AnimatePresence } from 'framer-motion'

interface ConnectionStatusProps {
  connected: boolean
}

export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return (
    <AnimatePresence>
      {!connected && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{
            background: '#f59e0b15',
            borderBottom: '1px solid #f59e0b30',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--accent-amber)',
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              {'\u25CF'}
            </motion.span>
            Connecting to server...
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
