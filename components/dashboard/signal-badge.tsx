import { cn } from '@/lib/utils'
import type { Signal, AlertStatus } from '@/lib/types'

const signalStyles: Record<Signal, { bg: string; text: string }> = {
  'BUY BASIS': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'LONG SPOT': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'ENTER': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'WATCH': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'INVERTED': { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  'SHORT OPP': { bg: 'bg-rose-500/20', text: 'text-rose-400' },
  'SKIP': { bg: 'bg-red-500/20', text: 'text-red-400' },
}

const statusStyles: Record<AlertStatus, { bg: string; text: string }> = {
  'ACTIVE': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  'WATCH': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'FADING': { bg: 'bg-rose-500/20', text: 'text-rose-400' },
}

interface SignalBadgeProps {
  signal: Signal
  className?: string
}

export function SignalBadge({ signal, className }: SignalBadgeProps) {
  const styles = signalStyles[signal]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold uppercase',
        styles.bg,
        styles.text,
        className
      )}
    >
      {signal}
    </span>
  )
}

interface StatusBadgeProps {
  status: AlertStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = statusStyles[status]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold uppercase',
        styles.bg,
        styles.text,
        className
      )}
    >
      {status}
    </span>
  )
}
