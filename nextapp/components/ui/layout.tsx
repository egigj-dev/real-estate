import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Page title block. Serif is reserved for page titles. */
export function PageIntro({ title, children, aside, className }: {
  title: ReactNode
  children?: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between', className)}>
      <div className="max-w-3xl space-y-2">
        <h1 className="font-serif text-3xl text-ink md:text-4xl">{title}</h1>
        {children && <div className="text-base text-ink-muted">{children}</div>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  )
}

export function Section({ title, description, action, children, className, id }: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={cn('min-w-0 space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="max-w-3xl space-y-1">
          <h2 id={headingId} className="text-xl font-semibold text-ink">{title}</h2>
          {description && <p className="text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A bordered surface. Most grouping uses this rather than shadows. */
export function Panel({ children, className, as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'aside' }) {
  return <Tag className={cn('rounded-lg border border-line bg-surface', className)}>{children}</Tag>
}

/** A labelled figure: the label above, the value large and tabular, an optional note below. */
export function Figure({ label, value, note, className }: { label: ReactNode; value: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="num text-2xl font-semibold text-ink">{value}</dd>
      {note && <dd className="text-xs text-ink-muted">{note}</dd>}
    </div>
  )
}
