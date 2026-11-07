import Link from 'next/link'
import type { ZonePrediction } from '@/lib/types'
import { fmtEur, fmtEurCompact, fmtEurPerSqm, fmtInt, fmtPct } from '@/lib/format'

/**
 * One row per pricing zone: the estimate as a point, with two bands of measured
 * error from held-out listings in that zone. The inner band is the median error
 * (half of test estimates were closer), the outer the 75th percentile.
 */
export default function ZoneEstimates({ zones, exploreHref }: { zones: ZonePrediction[]; exploreHref: (zone: string) => string }) {
  const sorted = [...zones].sort((a, b) => b.estimated_price - a.estimated_price)
  const lo = Math.min(...sorted.map(z => z.estimated_price * (1 - z.band_pct / 100)))
  const hi = Math.max(...sorted.map(z => z.estimated_price * (1 + z.band_pct / 100)))
  const pad = (hi - lo) * 0.04
  const min = lo - pad
  const max = hi + pad
  const x = (v: number) => ((v - min) / (max - min)) * 100
  const ticks = niceTicks(min, max, 4)

  return (
    <figure className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Vlerësimi i modelit për secilën zonë çmimi, me gabimin e matur</caption>
          <thead className="text-ink-muted">
            <tr className="border-b border-line">
              <th scope="col" className="w-40 py-2 pr-4 font-medium">Zona</th>
              <th scope="col" className="py-2 font-medium"><span className="sr-only">Grafiku</span></th>
              <th scope="col" className="w-36 py-2 pl-4 text-right font-medium">Vlerësimi</th>
              <th scope="col" className="w-28 py-2 pl-4 text-right font-medium">Gabimi tipik</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(z => {
              const typical = z.typical_error_pct / 100
              const band = z.band_pct / 100
              const e = z.estimated_price
              return (
                <tr key={z.cluster_id} className="border-b border-line">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    <Link href={exploreHref(z.zone_name)} className="font-medium text-ink underline-offset-4 hover:text-primary hover:underline">{z.zone_name}</Link>
                    <span className="block text-xs text-ink-muted num">{fmtInt(z.listing_count)} njoftime</span>
                  </th>
                  <td className="py-3" aria-hidden>
                    <div className="relative h-6">
                      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/15" style={{ left: `${x(e * (1 - band))}%`, width: `${x(e * (1 + band)) - x(e * (1 - band))}%` }} />
                      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/40" style={{ left: `${x(e * (1 - typical))}%`, width: `${x(e * (1 + typical)) - x(e * (1 - typical))}%` }} />
                      <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary" style={{ left: `${x(e)}%` }} />
                    </div>
                  </td>
                  <td className="num py-3 pl-4 text-right">
                    <span className="block font-semibold text-ink">{fmtEur(e)}</span>
                    <span className="block text-xs text-ink-muted">{fmtEurPerSqm(z.price_per_sqm)}</span>
                  </td>
                  <td className="num py-3 pl-4 text-right text-ink-muted">±{fmtPct(typical)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot aria-hidden>
            <tr>
              <td />
              <td className="relative h-6 text-xs text-ink-muted">
                {ticks.map(t => (
                  <span key={t} className="num absolute top-1 -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(t)}%` }}>{fmtEurCompact(t)}</span>
                ))}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-primary" /> Vlerësimi</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-5 rounded-full bg-primary/40" /> Gabimi tipik: gjysma e vlerësimeve në test ishin më afër</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-5 rounded-full bg-primary/15" /> 3 nga 4 vlerësime në test ishin brenda këtij brezi</span>
      </figcaption>
    </figure>
  )
}

/** Round tick values for a euro axis. */
function niceTicks(min: number, max: number, count: number) {
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v)
  return out
}
