import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useWebSocket } from '@/hooks/use-websocket'
import { Header } from '@/components/Header'
import { Timeline } from '@/components/Timeline'
import { PhasePreview } from '@/components/PhasePreview'
import { ArtifactGrid } from '@/components/ArtifactGrid'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import type { Phase, Artifact } from '@/types'

function getWsUrl(): string {
  const params = new URLSearchParams(window.location.search)
  const port = params.get('port') || window.location.port || '3847'
  return `ws://localhost:${port}/ws`
}

export function App() {
  const { state, artifacts, connected } = useWebSocket(getWsUrl())
  const [selectedPhase, setSelectedPhase] = useState<Phase | 'all'>('all')

  const filteredArtifacts = useMemo<Artifact[]>(() => {
    if (selectedPhase === 'all') return artifacts
    return artifacts.filter((a) => a.phase === selectedPhase)
  }, [artifacts, selectedPhase])

  const artifactsByPhase = useMemo(() => {
    const grouped: Partial<Record<Phase, Artifact[]>> = {}
    for (const a of artifacts) {
      ;(grouped[a.phase] ??= []).push(a)
    }
    return grouped
  }, [artifacts])

  const phaseArtifactCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [phase, items] of Object.entries(artifactsByPhase)) {
      counts[phase] = items.length
    }
    return counts
  }, [artifactsByPhase])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        sessionId={state?.sessionId}
        currentPhase={state?.currentPhase}
        artifactCount={artifacts.length}
      />
      <ConnectionStatus connected={connected} />

      {state && (
        <>
          <Timeline
            phases={state.phases}
            currentPhase={state.currentPhase}
            selectedPhase={selectedPhase}
            onSelectPhase={setSelectedPhase}
            artifactCounts={phaseArtifactCounts}
          />
          <PhasePreview
            phases={state.phases}
            artifactsByPhase={artifactsByPhase}
            selectedPhase={selectedPhase}
          />
        </>
      )}

      <main style={{ flex: 1, padding: '0 24px 48px' }}>
        <AnimatePresence mode="popLayout">
          <ArtifactGrid artifacts={filteredArtifacts} />
        </AnimatePresence>
      </main>
    </div>
  )
}
