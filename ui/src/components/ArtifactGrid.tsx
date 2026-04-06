import { motion } from 'framer-motion'
import type { Artifact } from '@/types'
import { ArtifactCard } from './artifacts/ArtifactCard'

interface ArtifactGridProps {
  artifacts: Artifact[]
}

export function ArtifactGrid({ artifacts }: ArtifactGridProps) {
  if (artifacts.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          color: 'var(--text-muted)',
          fontSize: 14,
        }}
      >
        Waiting for artifacts...
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
        gap: 16,
        paddingTop: 16,
      }}
    >
      {artifacts.map((artifact, index) => (
        <motion.div
          key={artifact.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.3 }}
          layout
          style={{
            gridColumn:
              artifact.type === 'dashboard' || artifact.type === 'flow'
                ? '1 / -1'
                : undefined,
          }}
        >
          <ArtifactCard artifact={artifact} />
        </motion.div>
      ))}
    </div>
  )
}
