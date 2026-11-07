import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const control =
  'w-full rounded border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle ' +
  'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props }, ref,
) {
  return <input ref={ref} className={cn(control, 'h-10 num', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props }, ref,
) {
  return <textarea ref={ref} className={cn(control, 'min-h-[88px] py-2.5 leading-relaxed', className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props }, ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-10 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  )
})

/** Label + control + optional hint/error, wired together with ids. */
export function Field({
  label, hint, error, children, className, id: fixedId,
}: {
  /** Use when the control needs a known id (e.g. to move focus to it). */
  id?: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}) {
  const generated = useId()
  const id = fixedId ?? generated
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && <p id={hintId} className="text-xs text-ink-muted">{hint}</p>}
      {error && <p id={errorId} className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm text-ink', className)}>
      <input type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer rounded-sm border-line-strong accent-[rgb(var(--primary))]" {...props} />
      <span>{label}</span>
    </label>
  )
}

/** Mutually exclusive options as a row of buttons (aria-pressed), e.g. "1+ 2+ 3+". */
export function Segmented<T extends string | number>({
  value, options, onChange, label,
}: {
  value: T | null
  options: { value: T | null; label: string }[]
  onChange: (v: T | null) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-9 min-w-[44px] rounded border px-3 text-sm num transition-colors',
              active ? 'border-primary bg-primary text-primary-contrast' : 'border-line-strong bg-surface text-ink hover:bg-surface-sunken',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
