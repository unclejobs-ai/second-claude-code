import { motion, AnimatePresence } from 'framer-motion'
import type { Phase, PhaseInfo, Artifact } from '@/types'
import { PHASES, PHASE_LABELS, PHASE_COLORS } from '@/types'

interface PhasePreviewProps {
  phases: PhaseInfo[]
  artifactsByPhase: Partial<Record<Phase, Artifact[]>>
  selectedPhase: Phase | 'all'
}

function summarize(artifacts: Artifact[]): string {
  const types: Record<string, number> = {}
  for (const a of artifacts) {
    types[a.type] = (types[a.type] || 0) + 1
  }
  return Object.entries(types)
    .map(([t, c]) => `${c} ${t}`)
    .join(', ')
}

export function PhasePreview({ phases, artifactsByPhase, selectedPhase }: PhasePreviewProps) {
  if (selectedPhase !== 'all') return null

  const phaseMap = new Map(phases.map((p) => [p.name, p]))

  return (
    <div
      style={{
        padding: '12px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 10,
      }}
    >
      <AnimatePresence>
        {PHASES.map((phase) => {
          const info = phaseMap.get(phase)
          if (!info || info.status === 'pending') return null
          const phaseArtifacts = artifactsByPhase[phase] ?? []
          const color = PHASE_COLORS[phase]

          return (
            <motion.div
              key={phase}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${color}30`,
                background: `${color}08`,
                cursor: 'default',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {PHASE_LABELS[phase]}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: info.status === 'completed' ? 'var(--accent-green)' : color,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {info.status === 'completed'
                    ? '\u2713 done'
                    : info.status === 'active'
                      ? '\u25CF active'
                      : info.status}
                </span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {phaseArtifacts.length > 0
                  ? summarize(phaseArtifacts)
                  : 'No artifacts yet'}
              </div>

              {info.duration != null && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    marginTop: 4,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {Math.round(info.duration / 1000)}s
                </div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
