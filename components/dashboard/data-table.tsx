'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: keyof T | string
  header: string
  className?: string
  render?: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  title?: string
  headerAction?: React.ReactNode
  className?: string
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  title,
  headerAction,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('rounded-xl border border-border bg-card', className)}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          {title && (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          )}
          {headerAction}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="border-b-2 border-primary/30 hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={String(col.key)}
                className={cn(
                  'bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80',
                  col.className
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={item.id}
              className="border-border/50 hover:bg-muted/30"
            >
              {columns.map((col) => (
                <TableCell
                  key={`${item.id}-${String(col.key)}`}
                  className={cn('py-3 text-sm', col.className)}
                >
                  {col.render
                    ? col.render(item)
                    : String(item[col.key as keyof T] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
