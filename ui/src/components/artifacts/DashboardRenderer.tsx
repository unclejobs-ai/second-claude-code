import type { GridLayout, DashboardSection } from '@/types'
import { ArtifactCard } from './ArtifactCard'

interface DashboardRendererProps {
  layout: GridLayout
  sections: DashboardSection[]
}

function layoutColumns(layout: GridLayout): string {
  switch (layout) {
    case '1x1': return '1fr'
    case '2x1': return '1fr 1fr'
    case '1x2': return '1fr'
    case '2x2': return '1fr 1fr'
    case '3x1': return '1fr 1fr 1fr'
    case '1x3': return '1fr'
    default: return '1fr 1fr'
  }
}

export function DashboardRenderer({ layout, sections }: DashboardRendererProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: layoutColumns(layout),
        gap: 12,
      }}
    >
      {sections.map((section) => (
        <div
          key={section.id}
          style={{
            gridColumn: section.span ? `span ${section.span}` : undefined,
          }}
        >
          <ArtifactCard artifact={section.artifact} compact />
        </div>
      ))}
    </div>
  )
}
