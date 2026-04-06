import ReactMarkdown from 'react-markdown'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div
      className="markdown-body"
      style={{
        fontSize: 13,
        lineHeight: 1.7,
        color: 'var(--text-primary)',
      }}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '16px 0 8px', letterSpacing: '-0.02em' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '14px 0 6px', letterSpacing: '-0.01em' }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: '12px 0 4px' }}>{children}</h3>
          ),
          p: ({ children }) => (
            <p style={{ margin: '8px 0', color: 'var(--text-secondary)' }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: '6px 0', paddingLeft: 20 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: '6px 0', paddingLeft: 20 }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ margin: '3px 0', color: 'var(--text-secondary)' }}>{children}</li>
          ),
          strong: ({ children }) => (
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.startsWith('language-')
            if (isBlock) {
              return (
                <pre
                  style={{
                    background: 'var(--bg-primary)',
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'auto',
                    margin: '8px 0',
                    border: '1px solid var(--border)',
                  }}
                >
                  <code
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {children}
                  </code>
                </pre>
              )
            }
            return (
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9em',
                  background: 'var(--bg-primary)',
                  padding: '1px 5px',
                  borderRadius: 4,
                  color: 'var(--accent-purple)',
                }}
              >
                {children}
              </code>
            )
          },
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '8px 0' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                }}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th
              style={{
                padding: '8px 12px',
                textAlign: 'left',
                borderBottom: '2px solid var(--border)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              style={{
                padding: '6px 12px',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: '3px solid var(--accent-indigo)',
                padding: '4px 16px',
                margin: '8px 0',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
