import { fmtInt } from '@/lib/format'

const STEPS = ['bg-ramp-0', 'bg-ramp-1', 'bg-ramp-2', 'bg-ramp-3', 'bg-ramp-4', 'bg-ramp-5']

/** Legend for the six €/m² classes; `breaks` are the five class boundaries. */
export default function RampLegend({ breaks, caption = '€ për m²' }: { breaks: number[]; caption?: string }) {
  if (breaks.length !== 5 || breaks.some(b => !Number.isFinite(b))) return null
  const labels = [`< ${fmtInt(breaks[0])}`, ...breaks.slice(0, 4).map((b, i) => `${fmtInt(b)}–${fmtInt(breaks[i + 1])}`), `> ${fmtInt(breaks[4])}`]
  return (
    <figure className="space-y-1.5">
      <figcaption className="text-xs text-ink-muted">{caption}</figcaption>
      <ol className="grid grid-cols-6 gap-px overflow-hidden rounded-sm">
        {STEPS.map((cls, i) => (
          <li key={cls} className="space-y-1">
            <span aria-hidden className={`block h-2 ${cls}`} />
            <span className="block text-[11px] leading-tight text-ink-muted num">{labels[i]}</span>
          </li>
        ))}
      </ol>
    </figure>
  )
}
