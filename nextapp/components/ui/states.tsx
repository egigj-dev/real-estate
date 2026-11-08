import type { ReactNode } from 'react'
import { AlertCircle, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded bg-surface-sunken', className)} />
}

/** Announces loading to screen readers while showing a placeholder shape. */
export function Loading({ label = 'Duke ngarkuar…', children }: { label?: string; children?: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children ?? <Skeleton className="h-40 w-full" />}
    </div>
  )
}

export function ErrorState({ title = 'Të dhënat nuk u ngarkuan', message, onRetry }: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm">
      <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <div className="space-y-1">
        <p className="font-medium text-ink">{title}</p>
        {message && <p className="text-ink-muted">{message}</p>}
        {onRetry && <Button variant="link" onClick={onRetry} className="text-sm">Provo përsëri</Button>}
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <SearchX aria-hidden className="mb-3 h-6 w-6 text-ink-muted" />
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Quiet explanatory note, used for data caveats next to the figures they qualify. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-xs leading-relaxed text-ink-muted', className)}>{children}</p>
}
