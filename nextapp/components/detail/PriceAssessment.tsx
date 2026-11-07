import Link from 'next/link'
import type { EstimateResponse } from '@/lib/types'
import { fmtEur, fmtEurPerSqm, fmtPct, fmtSignedEur, fmtSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Asking price against the model's held-out estimate.
 *
 * What the numbers mean (see ml.get_estimate):
 * - estimated_price: predicted asking price, from a model that never saw this listing.
 * - band_pct: the 75th percentile of relative error on held-out listings in this
 *   pricing zone (clipped to 8–35%). It describes past error, not a prediction interval.
 * - threshold_pct: the median relative error in the zone (at least 10%), used for the label.
 */
export default function PriceAssessment({ estimate, asking, sqm }: { estimate: EstimateResponse; asking: number; sqm: number }) {
  const est = estimate.estimated_price
  const diff = asking - est
  const ratio = asking / est - 1
  const band = (estimate.band_pct ?? 0) / 100
  const typical = (estimate.threshold_pct ?? 0) / 100
  const position = estimate.label === 'Overpriced' ? 'above' : estimate.label === 'Underpriced' ? 'below' : 'within'

  // Scale: cover the band and the asking price with some margin.
  const lo = Math.min(est * (1 - band), asking) * 0.92
  const hi = Math.max(est * (1 + band), asking) * 1.08
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100
  // Keep text labels inside the track so they don't spill past the edges.
  const labelPct = (v: number) => Math.min(88, Math.max(12, pct(v)))

  return (
    <div className="space-y-6">
      <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        <div className="bg-surface p-4">
          <dt className="text-sm text-ink-muted">Çmimi i kërkuar</dt>
          <dd className="num mt-1 text-2xl font-semibold text-ink">{fmtEur(asking)}</dd>
          <dd className="num text-sm text-ink-muted">{fmtEurPerSqm(asking / sqm)}</dd>
        </div>
        <div className="bg-surface p-4">
          <dt className="text-sm text-ink-muted">Vlerësimi i modelit</dt>
          <dd className="num mt-1 text-2xl font-semibold text-ink">{fmtEur(est)}</dd>
          <dd className="num text-sm text-ink-muted">{fmtEurPerSqm(est / sqm)}</dd>
        </div>
        <div className="bg-surface p-4">
          <dt className="text-sm text-ink-muted">Diferenca</dt>
          <dd className={cn('num mt-1 text-2xl font-semibold', position === 'above' ? 'text-above' : position === 'below' ? 'text-below' : 'text-ink')}>
            {fmtSignedPct(ratio)}
          </dd>
          <dd className="num text-sm text-ink-muted">{fmtSignedEur(diff)} {diff >= 0 ? 'mbi vlerësimin' : 'nën vlerësimin'}</dd>
        </div>
      </dl>

      <figure className="space-y-2">
        <div className="relative h-14" role="img" aria-label={`Vlerësimi ${fmtEur(est)}; brezi i gabimit ±${fmtPct(band)} shkon nga ${fmtEur(est * (1 - band))} deri ${fmtEur(est * (1 + band))}; çmimi i kërkuar ${fmtEur(asking)}.`}>
          <div className="absolute inset-x-0 top-6 h-2 rounded-full bg-surface-sunken" />
          <div className="absolute top-6 h-2 rounded-full bg-primary/25" style={{ left: `${pct(est * (1 - band))}%`, width: `${pct(est * (1 + band)) - pct(est * (1 - band))}%` }} />
          <div className="absolute top-4 h-6 w-0.5 -translate-x-1/2 bg-primary" style={{ left: `${pct(est)}%` }} />
          <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs text-ink-muted" style={{ left: `${labelPct(est)}%` }}>Vlerësimi</span>
          <div
            className={cn('absolute top-[18px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-surface', position === 'above' ? 'bg-above' : position === 'below' ? 'bg-below' : 'bg-ink')}
            style={{ left: `${pct(asking)}%` }}
          />
          <span className="absolute top-10 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-ink" style={{ left: `${labelPct(asking)}%` }}>Çmimi i kërkuar</span>
        </div>
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2 w-4 rounded-full bg-primary/25" />
            Brezi ±{fmtPct(band)}: në testim, për 3 nga 4 prona të kësaj zone vlerësimi nuk u largua më shumë se kaq nga
            çmimi i kërkuar. Gabimi tipik (mediana) është ±{fmtPct(typical)}.
          </span>
        </figcaption>
      </figure>

      <div className="max-w-prose space-y-3 text-base leading-relaxed text-ink">
        {position === 'within' && (
          <p>
            Çmimi i kërkuar është brenda gabimit tipik të modelit për këtë zonë (±{fmtPct(typical)}). Për modelin, kjo pronë
            kërkon afërsisht aq sa kërkojnë shitësit për prona me karakteristika të ngjashme.
          </p>
        )}
        {position === 'above' && (
          <p>
            Çmimi i kërkuar është {fmtPct(ratio)} mbi vlerësimin, më shumë se gabimi tipik i modelit për këtë zonë
            (±{fmtPct(typical)}). Kjo nuk do të thotë që çmimi është i gabuar: modeli nuk sheh gjendjen e apartamentit, pamjen,
            cilësinë e ndërtimit apo dokumentacionin. Por ia vlen të pyesësh se çfarë e justifikon diferencën.
          </p>
        )}
        {position === 'below' && (
          <p>
            Çmimi i kërkuar është {fmtPct(-ratio)} nën vlerësimin, më shumë se gabimi tipik i modelit për këtë zonë
            (±{fmtPct(typical)}). Mund të jetë një mundësi, ose mund të ketë arsye që modeli nuk i sheh, si gjendja e pronës,
            dokumentacioni ose një gabim në njoftim.
          </p>
        )}
        <p className="text-sm text-ink-muted">
          Vlerësimi është çmimi që kërkojnë zakonisht shitësit për prona të ngjashme, jo vlera e tregut dhe jo çmimi me të cilin
          do të shitet. Modeli që e llogariti nuk e ka parë këtë njoftim gjatë trajnimit.{' '}
          <Link href="/rreth-te-dhenave#modeli" className="text-primary underline-offset-4 hover:underline">Si llogaritet</Link>
        </p>
      </div>
    </div>
  )
}
