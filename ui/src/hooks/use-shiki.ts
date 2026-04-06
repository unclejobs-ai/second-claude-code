import { useEffect, useState } from 'react'
import type { Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((m) =>
      m.createHighlighter({
        themes: ['github-dark'],
        langs: ['typescript', 'javascript', 'python', 'json', 'bash', 'markdown', 'html', 'css', 'yaml', 'toml'],
      }),
    )
  }
  return highlighterPromise
}

export function useShiki() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  useEffect(() => {
    let cancelled = false
    getHighlighter()
      .then((h) => { if (!cancelled) setHighlighter(h) })
      .catch(() => { /* shiki load failure — fall back to plain text */ })
    return () => { cancelled = true }
  }, [])

  return highlighter
}
