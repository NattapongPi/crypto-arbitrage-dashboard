'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: keyof T | string
  header: string
  className?: string
  mobileHidden?: boolean
  render?: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  title?: string
  headerAction?: React.ReactNode
  className?: string
  enableColumnToggle?: boolean
  defaultHiddenColumns?: string[]
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  title,
  headerAction,
  className,
  enableColumnToggle = false,
  defaultHiddenColumns = [],
}: DataTableProps<T>) {
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    new Set(defaultHiddenColumns)
  )
  const [pendingHiddenColumns, setPendingHiddenColumns] = useState<Set<string>>(
    new Set(defaultHiddenColumns)
  )
  const [isOpen, setIsOpen] = useState(false)

  const togglePendingColumn = (key: string) => {
    setPendingHiddenColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const applyChanges = () => {
    setHiddenColumns(new Set(pendingHiddenColumns))
    setIsOpen(false)
  }

  const cancelChanges = () => {
    setPendingHiddenColumns(new Set(hiddenColumns))
    setIsOpen(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Sync pending state with current state when opening
      setPendingHiddenColumns(new Set(hiddenColumns))
    }
    setIsOpen(open)
  }

  const visibleColumns = columns.filter(
    col => !hiddenColumns.has(String(col.key))
  )
  return (
    <div className={cn('rounded-xl border border-border bg-card', className)}>
      {(title || headerAction || enableColumnToggle) && (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {title && (
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            )}
            {enableColumnToggle && (
              <Popover open={isOpen} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2">
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="ml-1.5 text-xs">Columns</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="min-w-[180px] p-3">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {columns.map(col => (
                        <div key={String(col.key)} className="flex items-center space-x-2">
                          <Checkbox
                            id={`col-${String(col.key)}`}
                            checked={!pendingHiddenColumns.has(String(col.key))}
                            onCheckedChange={() => togglePendingColumn(String(col.key))}
                          />
                          <label
                            htmlFor={`col-${String(col.key)}`}
                            className="text-sm cursor-pointer select-none"
                          >
                            {col.header}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={cancelChanges}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={applyChanges}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {headerAction && (
            <div className="overflow-x-auto">{headerAction}</div>
          )}
        </div>
      )}
      {/* Horizontal scroll wrapper for tables on mobile */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-primary/30 hover:bg-transparent">
              {visibleColumns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={cn(
                    'bg-primary/10 text-xs font-semibold uppercase tracking-wider text-primary-foreground/80 whitespace-nowrap',
                    col.mobileHidden && 'hidden md:table-cell',
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
                {visibleColumns.map((col) => (
                  <TableCell
                    key={`${item.id}-${String(col.key)}`}
                    className={cn(
                      'py-3 text-sm whitespace-nowrap',
                      col.mobileHidden && 'hidden md:table-cell',
                      col.className
                    )}
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
    </div>
  )
}
