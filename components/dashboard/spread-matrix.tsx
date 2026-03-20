'use client'

import { spreadMatrix } from '@/lib/mock-data'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function SpreadMatrix() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Live Spread Matrix - BTC</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b-2 border-primary/30 hover:bg-transparent">
            <TableHead className="bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
              Near Leg
            </TableHead>
            <TableHead className="bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
              Far Leg
            </TableHead>
            <TableHead className="bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
              Spread
            </TableHead>
            <TableHead className="bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
              DTE
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {spreadMatrix.map((entry, i) => (
            <TableRow key={i} className="border-border/50 hover:bg-muted/30">
              <TableCell className="py-2.5">
                <span className="font-mono text-sm text-cyan-400">{entry.nearLeg}</span>
              </TableCell>
              <TableCell className="py-2.5">
                <span className="font-mono text-sm text-cyan-400">{entry.farLeg}</span>
              </TableCell>
              <TableCell className="py-2.5">
                <span className="font-mono text-sm font-medium text-emerald-400">{entry.spread}</span>
              </TableCell>
              <TableCell className="py-2.5">
                <span className="font-mono text-sm text-muted-foreground">{entry.dte}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
