import { motion } from 'framer-motion'
import type { KpiValue } from '@/types'

interface KpiRendererProps {
  items: KpiValue[]
}

function trendColor(trend?: 'up' | 'down' | 'flat'): string {
  switch (trend) {
    case 'up': return 'var(--kpi-up)'
    case 'down': return 'var(--kpi-down)'
    default: return 'var(--kpi-flat)'
  }
}

function trendArrow(trend?: 'up' | 'down' | 'flat'): string {
  switch (trend) {
    case 'up': return '\u2191'
    case 'down': return '\u2193'
    default: return '\u2192'
  }
}

function formatValue(value: number | string): string {
  if (typeof value === 'string') return value
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

export function KpiRenderer({ items }: KpiRendererProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
        gap: 12,
      }}
    >
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          style={{
            padding: 16,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            {item.label}
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {formatValue(item.value)}
            {item.unit && (
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                  marginLeft: 4,
                }}
              >
                {item.unit}
              </span>
            )}
          </div>

          {item.change != null && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                fontWeight: 600,
                color: trendColor(item.trend),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span>{trendArrow(item.trend)}</span>
              <span>
                {item.change > 0 ? '+' : ''}
                {item.change.toFixed(1)}%
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
