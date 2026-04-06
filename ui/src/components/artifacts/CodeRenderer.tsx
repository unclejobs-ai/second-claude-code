import { useMemo } from 'react'
import { useShiki } from '@/hooks/use-shiki'

interface CodeRendererProps {
  language: string
  code: string
}

export function CodeRenderer({ language, code }: CodeRendererProps) {
  const highlighter = useShiki()

  const html = useMemo(() => {
    if (!highlighter) return null
    try {
      return highlighter.codeToHtml(code, {
        lang: language,
        theme: 'github-dark',
      })
    } catch {
      return null
    }
  }, [highlighter, code, language])

  if (!html) {
    return (
      <pre
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          padding: 12,
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'auto',
          color: 'var(--text-secondary)',
        }}
      >
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      style={{
        borderRadius: 'var(--radius-sm)',
        overflow: 'auto',
        fontSize: 12,
        lineHeight: 1.6,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
