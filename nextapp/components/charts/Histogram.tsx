import { fmtInt } from '@/lib/format'

/** Vertical bars for binned counts; the median is marked. Includes a text summary for screen readers. */
export default function Histogram({ bins, median, unit, summary }: {
  bins: { from: number; to: number; count: number }[]
  median: number
  unit: string
  summary: string
}) {
  const max = Math.max(...bins.map(b => b.count), 1)
  const lo = bins[0].from
  const hi = bins[bins.length - 1].to
  const medianPct = ((median - lo) / (hi - lo)) * 100
  const labelEvery = Math.ceil(bins.length / 8)

  return (
    <figure className="space-y-2">
      <div className="relative" role="img" aria-label={summary}>
        <div className="flex h-48 items-end gap-px border-b border-line-strong">
          {bins.map(b => (
            <div
              key={b.from}
              className="flex-1 rounded-t-sm bg-ramp-3"
              style={{ height: `${(b.count / max) * 100}%` }}
              title={`${fmtInt(b.from)}–${fmtInt(b.to)} ${unit}: ${fmtInt(b.count)} njoftime`}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-px bg-primary" style={{ left: `${medianPct}%` }}>
          <span className="absolute -top-1 left-1.5 whitespace-nowrap rounded bg-surface px-1 text-xs text-ink">Mediana {fmtInt(median)}</span>
        </div>
      </div>
      <div className="relative h-4 text-xs text-ink-muted" aria-hidden>
        {bins.map((b, i) => i % labelEvery === 0 && (
          <span key={b.from} className="num absolute -translate-x-1/2" style={{ left: `${(i / bins.length) * 100}%` }}>{fmtInt(b.from)}</span>
        ))}
      </div>
    </figure>
  )
}
