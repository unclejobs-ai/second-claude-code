export type Phase = 'research' | 'write' | 'analyze' | 'review' | 'refine'

export const PHASES: Phase[] = ['research', 'write', 'analyze', 'review', 'refine']

export const PHASE_LABELS: Record<Phase, string> = {
  research: 'Research',
  write: 'Write',
  analyze: 'Analyze',
  review: 'Review',
  refine: 'Refine',
}

// Keep in sync with --accent-* values in global.css
export const PHASE_COLORS: Record<Phase, string> = {
  research: '#6366f1',
  write: '#8b5cf6',
  analyze: '#ec4899',
  review: '#f59e0b',
  refine: '#10b981',
}

export type PhaseStatus = 'pending' | 'active' | 'completed' | 'skipped'

export interface PhaseInfo {
  name: Phase
  status: PhaseStatus
  startedAt?: string
  duration?: number
}

export interface SessionState {
  sessionId: string
  currentPhase: Phase
  phases: PhaseInfo[]
}

// Artifact types
export type ArtifactType = 'markdown' | 'chart' | 'code' | 'flow' | 'dashboard' | 'kpi'

export type ChartType = 'bar' | 'line' | 'pie' | 'radar'

export interface BaseArtifact {
  id: string
  type: ArtifactType
  phase: Phase
  title: string
}

export interface MarkdownArtifact extends BaseArtifact {
  type: 'markdown'
  content: string
}

export interface ChartDataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string
}

export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface ChartArtifact extends BaseArtifact {
  type: 'chart'
  chartType: ChartType
  data: ChartData
}

export interface CodeArtifact extends BaseArtifact {
  type: 'code'
  language: string
  code: string
}

export interface FlowNode {
  id: string
  label: string
  x: number
  y: number
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
}

export interface FlowArtifact extends BaseArtifact {
  type: 'flow'
  nodes: FlowNode[]
  edges: FlowEdge[]
}

// v1.2.0 new types
export interface KpiValue {
  label: string
  value: number | string
  unit?: string
  change?: number       // percentage change, e.g., +12.5 or -3.2
  trend?: 'up' | 'down' | 'flat'
}

export interface KpiArtifact extends BaseArtifact {
  type: 'kpi'
  items: KpiValue[]
}

export type GridLayout = '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '1x3'

export interface DashboardSection {
  id: string
  artifact: Artifact
  span?: number  // grid column span (1-3)
}

export interface DashboardArtifact extends BaseArtifact {
  type: 'dashboard'
  layout: GridLayout
  sections: DashboardSection[]
}

export type Artifact =
  | MarkdownArtifact
  | ChartArtifact
  | CodeArtifact
  | FlowArtifact
  | KpiArtifact
  | DashboardArtifact

// WebSocket messages
export type WSMessage =
  | { type: 'state'; payload: SessionState }
  | { type: 'artifact'; payload: Artifact }
  | { type: 'artifacts'; payload: Artifact[] }
  | { type: 'phase-change'; payload: { phase: Phase; status: PhaseStatus } }
  | { type: 'ping' }
