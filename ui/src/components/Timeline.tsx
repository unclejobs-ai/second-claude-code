import { motion } from 'framer-motion'
import type { Phase, PhaseInfo, PhaseStatus } from '@/types'
import { PHASES, PHASE_LABELS, PHASE_COLORS } from '@/types'

interface TimelineProps {
  phases: PhaseInfo[]
  currentPhase: Phase
  selectedPhase: Phase | 'all'
  onSelectPhase: (phase: Phase | 'all') => void
  artifactCounts: Record<string, number>
}

function statusIcon(status: PhaseStatus): string {
  switch (status) {
    case 'completed': return '\u2713'
    case 'active': return '\u25CF'
    case 'skipped': return '\u2014'
    default: return '\u25CB'
  }
}

export function Timeline({
  phases,
  currentPhase,
  selectedPhase,
  onSelectPhase,
  artifactCounts,
}: TimelineProps) {
  const phaseMap = new Map(phases.map((p) => [p.name, p]))

  return (
    <nav
      style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <button
        onClick={() => onSelectPhase('all')}
        style={{
          padding: '6px 14px',
          borderRadius: 20,
          border: selectedPhase === 'all' ? '1px solid var(--accent-indigo)' : '1px solid var(--border)',
          background: selectedPhase === 'all' ? '#6366f120' : 'transparent',
          color: selectedPhase === 'all' ? '#6366f1' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        All
      </button>

      <div
        style={{
          width: 1,
          height: 20,
          background: 'var(--border)',
          flexShrink: 0,
        }}
      />

      {PHASES.map((phase, i) => {
        const info = phaseMap.get(phase)
        const status = info?.status || 'pending'
        const isActive = phase === currentPhase
        const isSelected = selectedPhase === phase
        const count = artifactCounts[phase] || 0
        const color = PHASE_COLORS[phase]

        return (
          <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && (
              <div
                style={{
                  width: 24,
                  height: 2,
                  background:
                    status === 'completed' || status === 'active'
                      ? color
                      : 'var(--border)',
                  borderRadius: 1,
                  transition: 'background var(--transition)',
                }}
              />
            )}
            <motion.button
              onClick={() => onSelectPhase(isSelected ? 'all' : phase)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: isSelected
                  ? `1px solid ${color}`
                  : isActive
                    ? `1px solid ${color}80`
                    : '1px solid var(--border)',
                background: isSelected
                  ? `${color}20`
                  : isActive
                    ? `${color}10`
                    : 'transparent',
                color: isSelected || isActive ? color : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all var(--transition)',
              }}
            >
              <span style={{ fontSize: 10 }}>{statusIcon(status)}</span>
              {PHASE_LABELS[phase]}
              {count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 10,
                    background: `${color}30`,
                    color,
                  }}
                >
                  {count}
                </span>
              )}
            </motion.button>
          </div>
        )
      })}
    </nav>
  )
}
