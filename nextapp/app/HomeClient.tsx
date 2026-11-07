'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { getAllListings, getHealth } from '@/lib/api'
import { MIN_CELL_LISTINGS, priceGrid } from '@/lib/geo'
import { EMPTY_FILTERS, filtersToSearch } from '@/lib/filters'
import { fmtEur, fmtEurPerSqm, fmtInt, fmtPct } from '@/lib/format'
import { rampBreaks } from '@/lib/ramp'
import { groupBy, median, ppsqm, summarize } from '@/lib/stats'
import { useAsync } from '@/lib/useAsync'
import RampLegend from '@/components/maps/RampLegend'
import { ButtonLink } from '@/components/ui/button'
import { Figure, Section } from '@/components/ui/layout'
import { ErrorState, Loading, Note, Skeleton } from '@/components/ui/states'

const PriceGridMap = dynamic(() => import('@/components/maps/PriceGridMap'), { ssr: false, loading: () => <Skeleton className="h-[540px] w-full" /> })

const PATHS = [
  { href: '/pronat', title: 'Eksploro pronat', text: 'Filtro njoftimet sipas çmimit, sipërfaqes, dhomave dhe zonës, ose përshkruaj me fjalë çfarë kërkon.' },
  { href: '/vleresimi', title: 'Vlerëso një pronë', text: 'Jep karakteristikat e një apartamenti dhe shiko sa do të kërkohej për të në secilën zonë.' },
  { href: '/tregu', title: 'Analiza e tregut', text: 'Mediana dhe shpërndarja e çmimeve sipas zonës, sipërfaqes, dhomave dhe komoditeteve.' },
]

export default function HomeClient() {
  const data = useAsync(() => Promise.all([getAllListings(), getHealth().catch(() => null)]), [])

  const view = useMemo(() => {
    if (data.status !== 'success') return null
    const [all, health] = data.data
    const breaks = rampBreaks(all.map(ppsqm))
    const cells = priceGrid(all)
    const zones = [...groupBy(all, l => l.neighborhood)]
      .map(([zone, ls]) => ({ zone, n: ls.length, median: median(ls.map(ppsqm)) }))
      .sort((a, b) => b.median - a.median)
    const covered = cells.reduce((sum, c) => sum + c.n, 0)
    return { all, health, breaks, cells, covered, zones, summary: summarize(all) }
  }, [data])

  const listingError = view?.health?.model_metrics?.listing.median_ape_pct
  const maxZone = view ? Math.max(...view.zones.map(z => z.median)) : 1

  return (
    <div className="space-y-16">
      <section aria-labelledby="hero-title" className="grid gap-10 border-b border-line pb-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
        <div className="space-y-5">
          <h1 id="hero-title" className="font-serif text-4xl text-ink md:text-[3.25rem] md:leading-[1.1]">
            Çmimet e apartamenteve në Tiranë, të lexuara nga të dhënat
          </h1>
          <p className="max-w-xl text-lg text-ink-muted">
            Njoftime shitjeje, një model që vlerëson sa kërkohet zakonisht për një apartament, dhe krahasime mes zonave të qytetit.
            Çmimet janë ato që kërkojnë shitësit, jo ato me të cilat shiten pronat.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/pronat" size="lg">Eksploro pronat</ButtonLink>
            <ButtonLink href="/vleresimi" size="lg" variant="secondary">Vlerëso një pronë</ButtonLink>
          </div>
        </div>
        {data.status === 'loading' && <Loading label="Duke ngarkuar shifrat…"><Skeleton className="h-40 w-full" /></Loading>}
        {view && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6">
            <Figure label="Njoftime shitjeje" value={fmtInt(view.summary.n)} />
            <Figure label="Çmimi median i kërkuar" value={fmtEur(view.summary.medianPrice)} />
            <Figure label="Mediana e çmimit për m²" value={fmtEurPerSqm(view.summary.medianPpsqm)} />
            {listingError != null && (
              <Figure
                label="Gabimi tipik i vlerësimit"
                value={`±${fmtPct(listingError / 100)}`}
                note="Gjysma e vlerësimeve në test ishin më afër çmimit të kërkuar."
              />
            )}
          </dl>
        )}
      </section>

      {data.status === 'error' && <ErrorState message={data.error.message} onRetry={data.retry} />}

      {view && (
        <>
          <Section
            id="harta"
            title="Ku kërkohet më shumë për m²"
            description="Qyteti i ndarë në katrorë rreth 650 m. Ngjyra tregon medianën e çmimit të kërkuar për m² të njoftimeve brenda çdo katrori. Kalo me miun ose prek një katror për shifrat."
          >
            {view.cells.length === 0 ? (
              <p className="rounded-lg border border-line bg-surface-sunken p-4 text-sm text-ink">
                Njoftimet në këtë server nuk kanë koordinata të mjaftueshme, ndaj harta e çmimeve nuk mund të ndërtohet.
              </p>
            ) : (
              <PriceGridMap cells={view.cells} breaks={view.breaks} />
            )}
            <div className="grid gap-4 md:grid-cols-[minmax(0,440px)_1fr] md:items-end">
              <RampLegend breaks={view.breaks} caption="Mediana €/m²; kufijtë e grupeve ndajnë njoftimet në gjashtë pjesë të barabarta" />
              <Note className="md:text-right">
                Shfaqen vetëm katrorët me të paktën {MIN_CELL_LISTINGS} njoftime: {fmtInt(view.cells.length)} katrorë me {fmtInt(view.covered)} nga {fmtInt(view.all.length)} njoftimet.
              </Note>
            </div>
          </Section>

          <Section
            id="zonat"
            title="Zonat e çmimit"
            description="Modeli e ndan qytetin në gjashtë zona sipas vendndodhjes. Mediana e €/m² në secilën:"
            action={<Link href="/tregu#zonat" className="text-sm text-primary underline-offset-4 hover:underline">Më shumë në analizë</Link>}
          >
            <ul className="divide-y divide-line border-y border-line">
              {view.zones.map(z => (
                <li key={z.zone}>
                  <Link
                    href={`/pronat${filtersToSearch({ ...EMPTY_FILTERS, zona: z.zone }, 'lista')}`}
                    className="group grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-4 py-3 hover:bg-surface-sunken/60 sm:grid-cols-[200px_1fr_120px_120px]"
                  >
                    <span className="font-medium text-ink group-hover:text-primary">{z.zone}</span>
                    <span aria-hidden className="h-2 rounded-full bg-surface-sunken">
                      <span className="block h-2 rounded-full bg-ramp-4" style={{ width: `${(z.median / maxZone) * 100}%` }} />
                    </span>
                    <span className="num text-right font-semibold text-ink">{fmtEurPerSqm(z.median)}</span>
                    <span className="num hidden text-right text-sm text-ink-muted sm:block">{fmtInt(z.n)} njoftime</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <nav aria-label="Ku të fillosh" className="grid gap-8 border-t border-line pt-10 md:grid-cols-3">
        {PATHS.map(p => (
          <Link key={p.href} href={p.href} className="group space-y-2">
            <span className="flex items-center gap-2 text-lg font-semibold text-ink group-hover:text-primary">
              {p.title} <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="block text-sm leading-relaxed text-ink-muted">{p.text}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
