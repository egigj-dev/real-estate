'use client'
import { useEffect, useState } from 'react'
import { fetchNearby, NEARBY_LABELS, NEARBY_RADIUS_M, type NearbyKind, type NearbyPlace } from '@/lib/nearby'
import { fmtDec, fmtInt } from '@/lib/format'
import { Note, Skeleton } from '@/components/ui/states'

const fmtDistance = (km: number) => (km < 1 ? `${fmtInt(Math.round(km * 100) * 10)} m` : `${fmtDec(km)} km`)

/** Closest places of each kind within 1 km. Loaded after the page, and optional: failures are stated, not hidden. */
export default function Nearby({ lat, lon }: { lat: number; lon: number }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'done'; data: Record<NearbyKind, NearbyPlace[]> }>({ status: 'loading' })

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading' })
    fetchNearby(lat, lon, ctrl.signal)
      .then(data => setState({ status: 'done', data }))
      .catch(() => { if (!ctrl.signal.aborted) setState({ status: 'error' }) })
    return () => ctrl.abort()
  }, [lat, lon])

  if (state.status === 'loading') {
    return (
      <div role="status" aria-live="polite" className="space-y-2">
        <span className="sr-only">Duke kërkuar vendet përreth…</span>
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}
      </div>
    )
  }
  if (state.status === 'error') {
    return <p className="text-sm text-ink-muted">Vendet përreth nuk u ngarkuan. Shërbimi publik i OpenStreetMap mund të jetë i ngarkuar; provo më vonë.</p>
  }

  return (
    <div className="space-y-3">
      <dl className="divide-y divide-line">
        {(Object.keys(NEARBY_LABELS) as NearbyKind[]).map(kind => {
          const places = state.data[kind]
          return (
            <div key={kind} className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr]">
              <dt className="text-sm text-ink-muted">{NEARBY_LABELS[kind]}</dt>
              <dd className="text-sm text-ink">
                {places.length === 0
                  ? <span className="text-ink-muted">Asnjë brenda {fmtInt(NEARBY_RADIUS_M)} m</span>
                  : (
                    <>
                      <span className="num">{places[0].name}, {fmtDistance(places[0].km)}</span>
                      {places.length > 1 && <span className="text-ink-muted"> · {places.length} gjithsej brenda {fmtInt(NEARBY_RADIUS_M)} m</span>}
                    </>
                  )}
              </dd>
            </div>
          )
        })}
      </dl>
      <Note>Nga OpenStreetMap, në vijë ajrore. Harta mund të jetë e paplotë, ndaj mungesa e një vendi këtu nuk do të thotë që nuk ekziston.</Note>
    </div>
  )
}
