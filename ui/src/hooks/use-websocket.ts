import { useEffect, useRef, useCallback, useState } from 'react'
import type { WSMessage, SessionState, Artifact } from '@/types'

interface UseWebSocketReturn {
  state: SessionState | null
  artifacts: Artifact[]
  connected: boolean
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const destroyed = useRef(false)
  const [state, setState] = useState<SessionState | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    const rs = wsRef.current?.readyState
    if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = undefined
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        switch (msg.type) {
          case 'state':
            setState(msg.payload)
            break
          case 'artifact':
            setArtifacts((prev) => {
              const idx = prev.findIndex((a) => a.id === msg.payload.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = msg.payload
                return next
              }
              return [...prev, msg.payload]
            })
            break
          case 'artifacts':
            setArtifacts(msg.payload)
            break
          case 'phase-change':
            setState((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                currentPhase: msg.payload.phase,
                phases: prev.phases.map((p) =>
                  p.name === msg.payload.phase
                    ? { ...p, status: msg.payload.status }
                    : p,
                ),
              }
            })
            break
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }))
            break
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (!destroyed.current) {
        reconnectTimer.current = setTimeout(connect, 2000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [url])

  useEffect(() => {
    destroyed.current = false
    connect()
    return () => {
      destroyed.current = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { state, artifacts, connected }
}
