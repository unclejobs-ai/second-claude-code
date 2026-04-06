import { useState } from 'react'
import type { Artifact } from '@/types'
import { PHASE_COLORS } from '@/types'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ChartRenderer } from './ChartRenderer'
import { CodeRenderer } from './CodeRenderer'
import { FlowRenderer } from './FlowRenderer'
import { KpiRenderer } from './KpiRenderer'
import { DashboardRenderer } from './DashboardRenderer'

interface ArtifactCardProps {
  artifact: Artifact
  compact?: boolean
}

function typeIcon(type: string): string {
  switch (type) {
    case 'markdown': return '\u{1F4DD}'
    case 'chart': return '\u{1F4CA}'
    case 'code': return '\u{1F4BB}'
    case 'flow': return '\u{1F500}'
    case 'kpi': return '\u{1F4C8}'
    case 'dashboard': return '\u{1F3AF}'
    default: return '\u{1F4C4}'
  }
}

function renderContent(artifact: Artifact) {
  switch (artifact.type) {
    case 'markdown':
      return <MarkdownRenderer content={artifact.content} />
    case 'chart':
      return <ChartRenderer chartType={artifact.chartType} data={artifact.data} />
    case 'code':
      return <CodeRenderer language={artifact.language} code={artifact.code} />
    case 'flow':
      return <FlowRenderer nodes={artifact.nodes} edges={artifact.edges} />
    case 'kpi':
      return <KpiRenderer items={artifact.items} />
    case 'dashboard':
      return <DashboardRenderer layout={artifact.layout} sections={artifact.sections} />
  }
}

export function ArtifactCard({ artifact, compact }: ArtifactCardProps) {
  const color = PHASE_COLORS[artifact.phase]
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 'var(--radius)',
        border: `1px solid ${hovered ? `${color}60` : 'var(--border)'}`,
        background: 'var(--bg-card)',
        overflow: 'hidden',
        boxShadow: hovered ? `0 0 20px ${color}10` : 'none',
        transition: 'border-color var(--transition), box-shadow var(--transition)',
      }}
    >
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>{typeIcon(artifact.type)}</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {artifact.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 10,
              background: `${color}20`,
              color,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {artifact.phase}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {artifact.type}
          </span>
        </div>
      </div>

      <div
        style={{
          padding: compact ? 12 : 16,
          maxHeight: compact ? 200 : 600,
          overflowY: 'auto',
        }}
      >
        {renderContent(artifact)}
      </div>
    </div>
  )
}
