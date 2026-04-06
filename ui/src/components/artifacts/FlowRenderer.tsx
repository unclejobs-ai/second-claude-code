import { useMemo } from 'react'
import type { FlowNode, FlowEdge } from '@/types'

interface FlowRendererProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

const NODE_WIDTH = 140
const NODE_HEIGHT = 44
const ARROW_SIZE = 6

function getNodeCenter(node: FlowNode) {
  return { cx: node.x + NODE_WIDTH / 2, cy: node.y + NODE_HEIGHT / 2 }
}

export function FlowRenderer({ nodes, edges }: FlowRendererProps) {
  const { width, height } = useMemo(() => {
    const maxX = nodes.reduce((max, n) => Math.max(max, n.x + NODE_WIDTH), 400)
    const maxY = nodes.reduce((max, n) => Math.max(max, n.y + NODE_HEIGHT), 200)
    return { width: maxX + 40, height: maxY + 40 }
  }, [nodes])

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  )

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: 400,
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          refX={ARROW_SIZE}
          refY={ARROW_SIZE / 2}
          orient="auto"
        >
          <polygon
            points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`}
            fill="#64748b"
          />
        </marker>
        <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {edges.map((edge) => {
        const fromNode = nodeMap.get(edge.from)
        const toNode = nodeMap.get(edge.to)
        if (!fromNode || !toNode) return null

        const from = getNodeCenter(fromNode)
        const to = getNodeCenter(toNode)

        const dx = to.cx - from.cx
        const dy = to.cy - from.cy
        const len = Math.sqrt(dx * dx + dy * dy)
        const ux = dx / len
        const uy = dy / len

        const startX = from.cx + ux * (NODE_WIDTH / 2 + 2)
        const startY = from.cy + uy * (NODE_HEIGHT / 2 + 2)
        const endX = to.cx - ux * (NODE_WIDTH / 2 + ARROW_SIZE + 2)
        const endY = to.cy - uy * (NODE_HEIGHT / 2 + ARROW_SIZE + 2)

        const midX = (startX + endX) / 2
        const midY = (startY + endY) / 2

        return (
          <g key={`${edge.from}->${edge.to}`}>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#475569"
              strokeWidth={1.5}
              markerEnd="url(#arrowhead)"
            />
            {edge.label && (
              <text
                x={midX}
                y={midY - 6}
                textAnchor="middle"
                fill="#64748b"
                fontSize={9}
                fontFamily="var(--font-sans)"
              >
                {edge.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Nodes */}
      {nodes.map((node) => (
        <g key={node.id}>
          <rect
            x={node.x}
            y={node.y}
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            rx={8}
            ry={8}
            fill="url(#nodeGradient)"
            stroke="#334155"
            strokeWidth={1}
          />
          <text
            x={node.x + NODE_WIDTH / 2}
            y={node.y + NODE_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#e2e8f0"
            fontSize={11}
            fontWeight={500}
            fontFamily="var(--font-sans)"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
