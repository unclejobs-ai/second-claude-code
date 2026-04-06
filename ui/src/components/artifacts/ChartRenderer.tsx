import { useMemo } from 'react'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveRadar } from '@nivo/radar'
import type { ChartType, ChartData } from '@/types'

interface ChartRendererProps {
  chartType: ChartType
  data: ChartData
}

// First 5 entries match PHASE_COLORS in types.ts / --accent-* in global.css
const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#f97316', '#14b8a6', '#a855f7', '#ef4444',
]

// Nivo themes require raw hex — CSS vars cannot be used here.
// Keep in sync with global.css custom properties.
const commonTheme = {
  text: { fill: '#94a3b8', fontSize: 11 },
  axis: {
    ticks: { text: { fill: '#64748b', fontSize: 10 } },
    legend: { text: { fill: '#94a3b8', fontSize: 11 } },
  },
  grid: { line: { stroke: '#2a2a4a', strokeWidth: 1 } },
  tooltip: {
    container: {
      background: '#1a1a2e',
      border: '1px solid #2a2a4a',
      borderRadius: 8,
      color: '#e2e8f0',
      fontSize: 12,
      padding: '8px 12px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    },
  },
  labels: { text: { fill: '#e2e8f0', fontSize: 11 } },
}

const baseLegend = {
  itemWidth: 100,
  itemHeight: 20,
  symbolSize: 10,
  symbolShape: 'circle' as const,
  itemTextColor: '#94a3b8',
}

function BarChart({ data }: { data: ChartData }) {
  const barData = useMemo(
    () =>
      data.labels.map((label, i) => {
        const entry: Record<string, string | number> = { label }
        data.datasets.forEach((ds) => {
          entry[ds.label] = ds.data[i] ?? 0
        })
        return entry
      }),
    [data],
  )

  const keys = data.datasets.map((ds) => ds.label)

  return (
    <div style={{ height: 300 }}>
      <ResponsiveBar
        data={barData}
        keys={keys}
        indexBy="label"
        margin={{ top: 20, right: 120, bottom: 50, left: 60 }}
        padding={0.3}
        groupMode="grouped"
        colors={CHART_COLORS}
        borderRadius={4}
        theme={commonTheme}
        axisBottom={{
          tickRotation: data.labels.length > 8 ? -45 : 0,
        }}
        labelSkipWidth={12}
        labelSkipHeight={12}
        legends={[
          {
            ...baseLegend,
            dataFrom: 'keys',
            anchor: 'bottom-right' as const,
            direction: 'column' as const,
            translateX: 120,
          },
        ]}
        animate={true}
        motionConfig="gentle"
      />
    </div>
  )
}

function LineChart({ data }: { data: ChartData }) {
  const lineData = useMemo(
    () =>
      data.datasets.map((ds, di) => ({
        id: ds.label,
        color: CHART_COLORS[di % CHART_COLORS.length],
        data: data.labels.map((label, i) => ({
          x: label,
          y: ds.data[i] ?? 0,
        })),
      })),
    [data],
  )

  return (
    <div style={{ height: 300 }}>
      <ResponsiveLine
        data={lineData}
        margin={{ top: 20, right: 120, bottom: 50, left: 60 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        colors={CHART_COLORS}
        pointSize={8}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        pointColor="var(--bg-card)"
        enableArea={true}
        areaOpacity={0.1}
        useMesh={true}
        theme={commonTheme}
        legends={[
          {
            ...baseLegend,
            anchor: 'bottom-right' as const,
            direction: 'column' as const,
            translateX: 120,
          },
        ]}
        animate={true}
        motionConfig="gentle"
      />
    </div>
  )
}

function PieChart({ data }: { data: ChartData }) {
  const pieData = useMemo(
    () =>
      data.labels.map((label, i) => ({
        id: label,
        label,
        value: data.datasets[0]?.data[i] ?? 0,
      })),
    [data],
  )

  return (
    <div style={{ height: 300 }}>
      <ResponsivePie
        data={pieData}
        margin={{ top: 20, right: 80, bottom: 40, left: 80 }}
        innerRadius={0.55}
        padAngle={1.5}
        cornerRadius={4}
        activeOuterRadiusOffset={8}
        colors={CHART_COLORS}
        borderWidth={0}
        arcLinkLabelsTextColor="#94a3b8"
        arcLinkLabelsColor={{ from: 'color' }}
        arcLinkLabelsThickness={2}
        arcLabelsTextColor="#e2e8f0"
        theme={commonTheme}
        animate={true}
        motionConfig="gentle"
      />
    </div>
  )
}

function RadarChart({ data }: { data: ChartData }) {
  const radarData = useMemo(
    () =>
      data.labels.map((label, i) => {
        const entry: Record<string, string | number> = { metric: label }
        data.datasets.forEach((ds) => {
          entry[ds.label] = ds.data[i] ?? 0
        })
        return entry
      }),
    [data],
  )

  const keys = data.datasets.map((ds) => ds.label)

  return (
    <div style={{ height: 340 }}>
      <ResponsiveRadar
        data={radarData}
        keys={keys}
        indexBy="metric"
        maxValue="auto"
        margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
        curve="linearClosed"
        borderWidth={2}
        borderColor={{ from: 'color' }}
        gridLevels={5}
        gridShape="circular"
        gridLabelOffset={16}
        dotSize={8}
        dotColor={{ theme: 'background' }}
        dotBorderWidth={2}
        dotBorderColor={{ from: 'color' }}
        colors={CHART_COLORS}
        fillOpacity={0.2}
        blendMode="normal"
        theme={commonTheme}
        legends={[
          {
            ...baseLegend,
            anchor: 'top-left' as const,
            direction: 'column' as const,
            translateX: -50,
            translateY: -40,
            itemWidth: 80,
          },
        ]}
        animate={true}
        motionConfig="gentle"
      />
    </div>
  )
}

export function ChartRenderer({ chartType, data }: ChartRendererProps) {
  switch (chartType) {
    case 'bar':
      return <BarChart data={data} />
    case 'line':
      return <LineChart data={data} />
    case 'pie':
      return <PieChart data={data} />
    case 'radar':
      return <RadarChart data={data} />
  }
}
