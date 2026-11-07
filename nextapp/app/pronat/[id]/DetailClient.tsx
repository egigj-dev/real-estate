'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ApiError, fetchComps, fetchEstimate, fetchListing } from '@/lib/api'
import { fmtDec, fmtEur, fmtEurPerSqm, fmtSqm } from '@/lib/format'
import { floorLabel, knownPositive, listingTitle } from '@/lib/listing'
import { useAsync } from '@/lib/useAsync'
import PriceAssessment from '@/components/detail/PriceAssessment'
import Comparables, { type Comparable } from '@/components/detail/Comparables'
import Characteristics from '@/components/detail/Characteristics'
import Description from '@/components/detail/Description'
import Nearby from '@/components/detail/Nearby'
import { ButtonLink } from '@/components/ui/button'
import { Section } from '@/components/ui/layout'
import { EmptyState, ErrorState, Loading, Skeleton } from '@/components/ui/states'

const LocationMap = dynamic(() => import('@/components/maps/LocationMap'), { ssr: false, loading: () => <Skeleton className="h-[320px] w-full" /> })

/** Session key holding the last Explore URL, written by the Explore page. */
export const LAST_RESULTS_KEY = 'prona:last-results'

function BackLink() {
  // Return to the exact results (filters, page, view) the visitor came from, if any.
  const [results, setResults] = useState<string | null>(null)
  useEffect(() => {
    try { setResults(sessionStorage.getItem(LAST_RESULTS_KEY)) } catch { /* storage unavailable */ }
  }, [])
  return (
    <Link href={results ?? '/pronat'} className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
      <ArrowLeft aria-hidden className="h-4 w-4" /> {results ? 'Kthehu te rezultatet' : 'Të gjitha pronat'}
    </Link>
  )
}

export default function DetailClient({ id }: { id: string }) {
  const listing = useAsync(() => fetchListing(id), [id])
  const estimate = useAsync(() => fetchEstimate(id), [id])
  const comps = useAsync(async (): Promise<Comparable[]> => {
    const res = await fetchComps(id)
    // Load each comparable's summary for its title and zone; a failure leaves that row with less detail.
    const summaries = await Promise.all(res.comps.map(c => fetchListing(c.id).catch(() => undefined)))
    return res.comps.map((c, i) => ({ ...c, summary: summaries[i] }))
  }, [id])

  useEffect(() => {
    if (listing.status === 'success') document.title = `${listingTitle(listing.data)}, ${listing.data.neighborhood ?? 'Tiranë'} · Prona në Tiranë`
  }, [listing])

  if (listing.status === 'loading') {
    return <Loading label="Duke ngarkuar pronën…"><div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-48 w-full" /></div></Loading>
  }
  if (listing.status === 'error') {
    if (listing.error instanceof ApiError && listing.error.status === 404) {
      return (
        <div className="space-y-6">
          <BackLink />
          <EmptyState title="Kjo pronë nuk u gjet" action={<ButtonLink href="/pronat" variant="secondary">Shko te pronat</ButtonLink>}>
            Lidhja mund të jetë e gabuar, ose prona nuk është më në të dhëna.
          </EmptyState>
        </div>
      )
    }
    return <div className="space-y-6"><BackLink /><ErrorState message={listing.error.message} onRetry={listing.retry} /></div>
  }

  const item = listing.data
  const ppsqm = item.price / item.sqm
  const baths = knownPositive(item.baths)
  const facts = [
    fmtSqm(item.sqm),
    baths !== null ? `${fmtDec(baths)} banjo` : null,
    floorLabel(item.floor),
    item.distance_from_center != null ? `${fmtDec(item.distance_from_center)} km nga sheshi Skënderbej` : null,
  ].filter(Boolean)
  const hasCoords = Number.isFinite(item.latitude) && Number.isFinite(item.longitude)

  return (
    <article className="space-y-12">
      <div className="space-y-6">
        <BackLink />
        <header className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-ink-muted">{item.neighborhood ?? 'Zonë e panjohur'} · Tiranë</p>
            <h1 className="font-serif text-3xl text-ink md:text-4xl">{listingTitle(item)}</h1>
            <p className="num text-base text-ink-muted">{facts.join(' · ')}</p>
          </div>
          <div className="md:text-right">
            <p className="text-sm text-ink-muted">Çmimi i kërkuar</p>
            <p className="num text-3xl font-semibold text-ink">{fmtEur(item.price)}</p>
            <p className="num text-sm text-brass-ink">{fmtEurPerSqm(ppsqm)}</p>
          </div>
        </header>
      </div>

      <Section id="vleresimi" title="A është çmimi i arsyeshëm?" description="Çmimi i kërkuar krahasuar me vlerësimin e modelit dhe me gabimin e tij të matur.">
        {estimate.status === 'loading' && <Loading label="Duke ngarkuar vlerësimin…"><Skeleton className="h-40 w-full" /></Loading>}
        {estimate.status === 'error' && (
          estimate.error instanceof ApiError && estimate.error.status === 503
            ? <p className="max-w-prose rounded-lg border border-line bg-surface-sunken p-4 text-sm text-ink">
                Vlerësimi nuk është i disponueshëm për këtë pronë: nuk ka model të instaluar ose vlerësim të ruajtur. Krahaso me pronat e ngjashme më poshtë.
              </p>
            : <ErrorState title="Vlerësimi nuk u ngarkua" message={estimate.error.message} onRetry={estimate.retry} />
        )}
        {estimate.status === 'success' && <PriceAssessment estimate={estimate.data} asking={item.price} sqm={item.sqm} />}
      </Section>

      <Section id="te-ngjashme" title="Prona të ngjashme" description="Pesë njoftimet më të afërta me këtë sipas karakteristikave.">
        {comps.status === 'loading' && <Loading label="Duke ngarkuar pronat e ngjashme…"><Skeleton className="h-56 w-full" /></Loading>}
        {comps.status === 'error' && <ErrorState title="Pronat e ngjashme nuk u ngarkuan" message={comps.error.message} onRetry={comps.retry} />}
        {comps.status === 'success' && (comps.data.length
          ? <Comparables comps={comps.data} subjectPpsqm={ppsqm} />
          : <p className="text-sm text-ink-muted">Nuk ka prona të ngjashme për të krahasuar.</p>)}
      </Section>

      <div className="grid gap-12 lg:grid-cols-2">
        <Section id="karakteristikat" title="Karakteristikat">
          <Characteristics item={item} />
        </Section>
        <Section id="vendndodhja" title="Vendndodhja" description="Pozicioni sipas njoftimit; rrethi shënon 500 m.">
          {hasCoords
            ? <><LocationMap lat={item.latitude!} lon={item.longitude!} /><Nearby lat={item.latitude!} lon={item.longitude!} /></>
            : <p className="text-sm text-ink-muted">Njoftimi nuk ka koordinata.</p>}
        </Section>
      </div>

      <Section id="pershkrimi" title="Përshkrimi i shitësit">
        <Description text={item.description} />
      </Section>
    </article>
  )
}
