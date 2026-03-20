'use client'

import { cn } from '@/lib/utils'
import type { TermStructurePoint } from '@/lib/types'

interface Props {
  data: TermStructurePoint[]
  asset: string
  availableAssets: string[]
  onAssetChange: (asset: string) => void
}

export function TermStructureChart({ data, asset, availableAssets, onAssetChange }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Futures Term Structure</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Price across expiry dates — contango = far leg at premium</p>
        </div>
        {availableAssets.length > 0 && (
          <div className="flex items-center gap-1">
            {availableAssets.slice(0, 6).map((a) => (
              <button
                key={a}
                onClick={() => onAssetChange(a)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                  asset === a
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {data.length < 2 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Waiting for futures data…
        </div>
      ) : (
        <ChartBody data={data} />
      )}
    </div>
  )
}

function ChartBody({ data }: { data: TermStructurePoint[] }) {
  const prices = data.map((p) => p.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const padding = (maxPrice - minPrice) * 0.15 || maxPrice * 0.01
  const yMin = minPrice - padding
  const yMax = maxPrice + padding
  const yRange = yMax - yMin

  const W = 500
  const H = 220
  const pad = { top: 24, right: 20, bottom: 32, left: 56 }
  const cw = W - pad.left - pad.right
  const ch = H - pad.top - pad.bottom

  const px = (i: number) => pad.left + (i / (data.length - 1)) * cw
  const py = (price: number) => pad.top + ch - ((price - yMin) / yRange) * ch

  const points = data.map((d, i) => ({ x: px(i), y: py(d.price), ...d }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},${pad.top + ch} L${points[0].x},${pad.top + ch}Z`

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    y: pad.top + ch * r,
    value: yMax - r * yRange,
  }))

  const formatK = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`

  return (
    <div className="p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-64">
        <defs>
          <linearGradient id="tsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} y1={t.y} x2={W - pad.right} y2={t.y}
              stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} />
            <text x={pad.left - 6} y={t.y + 3.5} fontSize={8} fill="currentColor"
              fillOpacity={0.45} textAnchor="end">
              {formatK(t.value)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#tsGradient)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="rgb(16,185,129)" strokeWidth={1.5}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Points + labels */}
        {points.map((p, i) => {
          const pctVsFirst = i > 0 ? ((p.price / data[0].price - 1) * 100) : null
          const labelAbove = p.y > pad.top + 20
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={3.5} fill="rgb(16,185,129)"
                stroke="rgb(6,78,59)" strokeWidth={1} />
              {pctVsFirst !== null && (
                <text x={p.x} y={labelAbove ? p.y - 8 : p.y + 14}
                  fontSize={7.5} fill="rgb(16,185,129)" textAnchor="middle" fontWeight="500">
                  {pctVsFirst >= 0 ? '+' : ''}{pctVsFirst.toFixed(2)}%
                </text>
              )}
              <text x={p.x} y={H - pad.bottom + 12} fontSize={8.5}
                fill="currentColor" fillOpacity={0.7} textAnchor="middle">
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
