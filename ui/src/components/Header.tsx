import { motion } from 'framer-motion'
import type { Phase } from '@/types'
import { PHASE_COLORS } from '@/types'

interface HeaderProps {
  sessionId?: string
  currentPhase?: Phase
  artifactCount: number
}

export function Header({ sessionId, currentPhase, artifactCount }: HeaderProps) {
  return (
    <header
      style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-purple))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          S
        </div>
        <div>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            SCC Artifact Viewer
          </h1>
          {sessionId && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {sessionId.length > 16 ? `${sessionId.slice(0, 12)}...` : sessionId}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {currentPhase && (
          <motion.div
            key={currentPhase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              background: `${PHASE_COLORS[currentPhase]}20`,
              border: `1px solid ${PHASE_COLORS[currentPhase]}40`,
              color: PHASE_COLORS[currentPhase],
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {currentPhase}
          </motion.div>
        )}
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 20,
            background: 'var(--bg-card)',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          {artifactCount} artifact{artifactCount !== 1 ? 's' : ''}
        </div>
      </div>
    </header>
  )
}
