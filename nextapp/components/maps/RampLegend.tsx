import { fmtInt } from '@/lib/format'
import { RAMP_STEPS } from '@/lib/ramp'

const STEPS = ['bg-ramp-0', 'bg-ramp-1', 'bg-ramp-2', 'bg-ramp-3', 'bg-ramp-4']

/**
 * Legend for the €/m² classes, with explicit values. `missing` adds a key for
 * areas drawn without colour because they have too few listings.
 */
export default function RampLegend({ breaks, caption, missing }: { breaks: number[]; caption: string; missing?: string }) {
  if (breaks.length !== RAMP_STEPS - 1 || breaks.some(b => !Number.isFinite(b))) return null
  const labels = [
    `deri ${fmtInt(breaks[0])}`,
    ...breaks.slice(0, -1).map((b, i) => `${fmtInt(b)}–${fmtInt(breaks[i + 1])}`),
    `mbi ${fmtInt(breaks[breaks.length - 1])}`,
  ]
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-medium text-ink">{caption}</figcaption>
      <ol className="flex flex-wrap gap-x-4 gap-y-1.5">
        {STEPS.map((cls, i) => (
          <li key={cls} className="flex items-center gap-1.5 text-xs text-ink-muted num">
            <span aria-hidden className={`h-3 w-5 rounded-sm ${cls}`} />
            {labels[i]}
          </li>
        ))}
        {missing && (
          <li className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span aria-hidden className="h-3 w-5 rounded-sm border border-dashed border-ink-subtle" />
            {missing}
          </li>
        )}
      </ol>
    </figure>
  )
}
