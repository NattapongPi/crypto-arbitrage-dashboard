'use client'

import { termStructure } from '@/lib/mock-data'

export function TermStructureChart() {
  const minPrice = Math.min(...termStructure.map(p => p.price)) - 200
  const maxPrice = Math.max(...termStructure.map(p => p.price)) + 200
  const priceRange = maxPrice - minPrice

  // Chart dimensions
  const width = 100
  const height = 100
  const padding = { top: 15, right: 10, bottom: 20, left: 15 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Calculate points
  const points = termStructure.map((point, i) => ({
    x: padding.left + (i / (termStructure.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight,
    ...point,
  }))

  // Create path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Live Term Structure</h3>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={padding.left}
              y1={padding.top + chartHeight * ratio}
              x2={width - padding.right}
              y2={padding.top + chartHeight * ratio}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={0.2}
            />
          ))}

          {/* Price labels */}
          <text
            x={padding.left - 2}
            y={padding.top + 2}
            fontSize={4}
            fill="currentColor"
            opacity={0.5}
            textAnchor="end"
          >
            ${(maxPrice / 1000).toFixed(1)}k
          </text>
          <text
            x={padding.left - 2}
            y={padding.top + chartHeight}
            fontSize={4}
            fill="currentColor"
            opacity={0.5}
            textAnchor="end"
          >
            ${(minPrice / 1000).toFixed(1)}k
          </text>

          {/* Area fill */}
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`}
            fill="url(#areaGradient)"
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke="rgb(16, 185, 129)"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points and labels */}
          {points.map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r={2}
                fill="rgb(16, 185, 129)"
                stroke="rgb(6, 78, 59)"
                strokeWidth={0.5}
              />
              <text
                x={point.x}
                y={point.y - 5}
                fontSize={3.5}
                fill="rgb(16, 185, 129)"
                textAnchor="middle"
              >
                {i > 0 && `+${((point.price / termStructure[0].price - 1) * 100).toFixed(2)}%`}
              </text>
              <text
                x={point.x}
                y={padding.top + chartHeight + 8}
                fontSize={4}
                fill="currentColor"
                opacity={0.7}
                textAnchor="middle"
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
