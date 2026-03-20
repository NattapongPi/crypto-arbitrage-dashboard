import { cn } from '@/lib/utils'

export type StatCardVariant = 'green' | 'cyan' | 'purple' | 'yellow' | 'red' | 'orange'

interface StatCardProps {
  label: string
  value: string | number
  variant?: StatCardVariant
  className?: string
}

const variantStyles: Record<StatCardVariant, { bg: string; border: string; text: string; label: string }> = {
  green: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    label: 'text-emerald-300/80',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    label: 'text-cyan-300/80',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-300',
    label: 'text-purple-300/80',
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    label: 'text-yellow-300/80',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    label: 'text-red-300/80',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    label: 'text-orange-300/80',
  },
}

export function StatCard({ label, value, variant = 'cyan', className }: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border px-6 py-4',
        styles.bg,
        styles.border,
        className
      )}
    >
      <span className={cn('text-xs font-medium uppercase tracking-wide', styles.label)}>
        {label}
      </span>
      <span className={cn('mt-1 text-2xl font-bold tabular-nums', styles.text)}>
        {value}
      </span>
    </div>
  )
}

export function StatCardRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
      {children}
    </div>
  )
}
