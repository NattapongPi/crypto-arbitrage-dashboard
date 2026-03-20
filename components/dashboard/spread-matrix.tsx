'use client'

import { formatPercent } from '@/lib/formatters'
import type { SpreadMatrixEntry } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Props {
  data: SpreadMatrixEntry[]
}

export function SpreadMatrix({ data }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Live Spread Matrix</h3>
      </div>
      {data.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground p-4">
          Waiting for futures data…
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-primary/30 hover:bg-transparent">
              <TableHead className="bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">Near Leg</TableHead>
              <TableHead className="bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">Far Leg</TableHead>
              <TableHead className="bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">Spread</TableHead>
              <TableHead className="bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">DTE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry, i) => (
              <TableRow key={i} className="border-border/50 hover:bg-muted/30">
                <TableCell className="py-2.5">
                  <span className="font-mono text-sm text-cyan-400">{entry.nearLeg}</span>
                </TableCell>
                <TableCell className="py-2.5">
                  <span className="font-mono text-sm text-cyan-400">{entry.farLeg}</span>
                </TableCell>
                <TableCell className="py-2.5">
                  <span className={`font-mono text-sm font-medium ${entry.spread >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPercent(entry.spread)}
                  </span>
                </TableCell>
                <TableCell className="py-2.5">
                  <span className="font-mono text-sm text-muted-foreground">{entry.dte}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
