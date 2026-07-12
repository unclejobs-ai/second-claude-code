import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

/**
 * Isolates a render failure to one artifact card. Without this, a single
 * malformed artifact (e.g. a missing field) throws during render and React
 * unmounts the whole tree, blanking the entire viewer.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Failed to render ${this.props.label ?? 'artifact'}:`, error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          padding: 16,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-primary)',
          border: '1px solid var(--kpi-down, #f85149)',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        <div style={{ color: 'var(--kpi-down, #f85149)', fontWeight: 600, marginBottom: 6 }}>
          Could not render {this.props.label ?? 'this artifact'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-word' }}>
          {error.message}
        </div>
      </div>
    )
  }
}
