'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { fetchAllListings, fetchListings, getAllListings, getFilterOptions } from '@/lib/api'
import type { PaginatedListings } from '@/lib/types'
import { activeFilterChips, EMPTY_FILTERS, filtersToQuery, filtersToSearch, parseFilters, SORT_OPTIONS, type Filters, type View } from '@/lib/filters'
import { fmtInt } from '@/lib/format'
import { hasCoords, hexKey, hexPolygon } from '@/lib/geo'
import { rampBreaks } from '@/lib/ramp'
import { ppsqm } from '@/lib/stats'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/utils'
import ListingCard from '@/components/listings/ListingCard'
import FilterPanel from '@/components/listings/FilterPanel'
import DescribeSearch from '@/components/listings/DescribeSearch'
import RampLegend from '@/components/maps/RampLegend'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/field'
import { PageIntro } from '@/components/ui/layout'
import { EmptyState, ErrorState, Loading, Note, Skeleton } from '@/components/ui/states'

const ListingsMap = dynamic(() => import('@/components/maps/ListingsMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-[560px] w-full" />,
})

const PER_PAGE = 24

export default function ExploreClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const filters = useMemo(() => parseFilters(new URLSearchParams(sp.toString())), [sp])
  const view: View = sp.get('pamja') === 'harta' ? 'harta' : 'lista'
  const [describeOpen, setDescribeOpen] = useState(sp.get('pershkrim') === '1')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Remember these results so a listing's page can link straight back to them.
  useEffect(() => {
    try { sessionStorage.setItem('prona:last-results', `${pathname}${sp.toString() ? `?${sp.toString()}` : ''}`) } catch { /* storage unavailable */ }
  }, [pathname, sp])

  const go = (next: Filters, nextView: View = view) => router.push(`${pathname}${filtersToSearch(next, nextView)}`, { scroll: false })
  const update = (patch: Partial<Filters>) => go({ ...filters, ...patch, faqja: patch.faqja ?? 1 })

  const queryKey = filtersToSearch({ ...filters, faqja: 1 }, 'lista')
  const options = useAsync(getFilterOptions, [])
  const zones = options.data?.neighborhoods ?? []

  // A hexagon chosen on the home map has no API filter: fetch every listing matching
  // the other filters once, keep those inside the hexagon, and page in the browser.
  const hexListings = useMemo(
    () => (filters.hex
      ? fetchAllListings(filtersToQuery(filters)).then(ls => ls.filter(l => hasCoords(l) && hexKey(l.latitude!, l.longitude!) === filters.hex))
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryKey],
  )
  const page = useAsync(async (): Promise<PaginatedListings> => {
    if (hexListings) {
      const ls = await hexListings
      const start = (filters.faqja - 1) * PER_PAGE
      return { total: ls.length, page: filters.faqja, per_page: PER_PAGE, pages: Math.ceil(ls.length / PER_PAGE), listings: ls.slice(start, start + PER_PAGE) }
    }
    return fetchListings({ ...filtersToQuery(filters), page: filters.faqja, per_page: PER_PAGE })
  }, [queryKey, filters.faqja])
  const mapData = useAsync(
    () => (view !== 'harta' ? Promise.resolve([]) : hexListings ?? fetchAllListings(filtersToQuery(filters))),
    [queryKey, view],
  )
  // Colour classes come from the whole dataset, so colours mean the same thing under any filter.
  const breaks = useAsync(() => getAllListings().then(all => rampBreaks(all.map(ppsqm))), [])

  const chips = activeFilterChips(filters)
  const total = page.data?.total
  const pages = page.data?.pages ?? 1
  const hrefFor = (id: string) => `/pronat/${encodeURIComponent(id)}`
  const pageHref = (n: number) => `${pathname}${filtersToSearch({ ...filters, faqja: n }, view)}`

  return (
    <div className="space-y-8">
      <PageIntro
        title="Eksploro pronat"
        aside={
          <Button variant="secondary" aria-expanded={describeOpen} aria-controls="describe-panel" onClick={() => setDescribeOpen(o => !o)}>
            {describeOpen ? 'Mbyll përshkrimin' : 'Përshkruaj çfarë kërkon'}
          </Button>
        }
      >
        Apartamente në shitje në Tiranë, me çmimet e kërkuara nga shitësit. Filtro, rendit, ose shiko ku ndodhen në hartë.
      </PageIntro>

      {describeOpen && (
        <section id="describe-panel" aria-label="Kërkim me përshkrim" className="max-w-2xl">
          <DescribeSearch zones={zones} onApply={f => { go(f); setDescribeOpen(false) }} />
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside aria-label="Filtrat" className="lg:sticky lg:top-24 lg:self-start">
          <Button variant="secondary" className="w-full lg:hidden" aria-expanded={filtersOpen} aria-controls="filter-panel" onClick={() => setFiltersOpen(o => !o)}>
            <SlidersHorizontal aria-hidden /> Filtrat{chips.length ? ` (${chips.length})` : ''}
          </Button>
          <div id="filter-panel" className={cn('mt-4 lg:mt-0 lg:block', filtersOpen ? 'block' : 'hidden')}>
            <FilterPanel filters={filters} zones={zones} onChange={update} />
          </div>
        </aside>

        <section aria-labelledby="results-title" className="min-w-0 space-y-5">
          <h2 id="results-title" className="sr-only">Rezultatet</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <p className="text-sm text-ink" aria-live="polite">
              {page.status === 'success'
                ? <><span className="num font-semibold">{fmtInt(total)}</span> {total === 1 ? 'pronë përputhet' : 'prona përputhen'}</>
                : page.status === 'loading' ? 'Duke kërkuar…' : null}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <span>Rendit</span>
                <Select value={filters.rendit} onChange={e => update({ rendit: e.target.value as Filters['rendit'] })} className="h-9 w-56">
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </label>
              <div role="group" aria-label="Pamja" className="flex rounded border border-line-strong p-0.5">
                {(['lista', 'harta'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => go(filters, v)}
                    className={cn('h-8 rounded-sm px-3 text-sm', view === v ? 'bg-primary text-primary-contrast' : 'text-ink-muted hover:text-ink')}
                  >
                    {v === 'lista' ? 'Lista' : 'Harta'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Filtrat aktivë">
              {chips.map(c => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => update(c.clear)}
                    className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1 text-sm text-ink hover:border-line-strong"
                    aria-label={`Hiq filtrin: ${c.label}`}
                  >
                    {c.label} <X aria-hidden className="h-3.5 w-3.5 text-ink-muted" />
                  </button>
                </li>
              ))}
              <li><Button variant="link" className="text-sm" onClick={() => go(EMPTY_FILTERS)}>Hiqi të gjithë</Button></li>
            </ul>
          )}

          {page.status === 'error' && <ErrorState message={page.error.message} onRetry={page.retry} />}

          {page.status === 'success' && total === 0 && (
            <EmptyState
              title="Asnjë pronë nuk i plotëson këta filtra"
              action={chips.length > 0 ? <Button variant="secondary" onClick={() => go(EMPTY_FILTERS)}>Hiq filtrat</Button> : undefined}
            >
              Provo të zgjerosh çmimin ose sipërfaqen, ose hiq një nga kërkesat.
            </EmptyState>
          )}

          {view === 'lista' && (
            <>
              {page.status === 'loading' && (
                <Loading label="Duke ngarkuar pronat…">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44" />)}
                  </div>
                </Loading>
              )}
              {page.status === 'success' && total! > 0 && (
                <>
                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {page.data.listings.map(l => <li key={l.id}><ListingCard listing={l} href={hrefFor(l.id)} /></li>)}
                  </ul>
                  {pages > 1 && (
                    <nav aria-label="Faqet e rezultateve" className="flex items-center justify-between gap-4 border-t border-line pt-4">
                      {filters.faqja > 1
                        ? <Link href={pageHref(filters.faqja - 1)} scroll className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ChevronLeft aria-hidden className="h-4 w-4" /> E mëparshmja</Link>
                        : <span />}
                      <span className="text-sm text-ink-muted num">Faqja {fmtInt(filters.faqja)} nga {fmtInt(pages)}</span>
                      {filters.faqja < pages
                        ? <Link href={pageHref(filters.faqja + 1)} scroll className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Tjetra <ChevronRight aria-hidden className="h-4 w-4" /></Link>
                        : <span />}
                    </nav>
                  )}
                </>
              )}
            </>
          )}

          {view === 'harta' && total !== 0 && (
            <div className="space-y-3">
              {mapData.status === 'error' && <ErrorState message={mapData.error.message} onRetry={mapData.retry} />}
              {mapData.status === 'loading' && <Loading label="Duke ngarkuar hartën…"><Skeleton className="h-[560px] w-full" /></Loading>}
              {mapData.status === 'success' && !mapData.data.some(hasCoords) && (
                <p className="rounded-lg border border-line bg-surface-sunken p-4 text-sm text-ink">Këto njoftime nuk kanë koordinata, ndaj nuk mund të shfaqen në hartë.</p>
              )}
              {mapData.status === 'success' && breaks.data && mapData.data.some(hasCoords) && (
                <>
                  <ListingsMap listings={mapData.data} breaks={breaks.data} hrefFor={hrefFor} outline={filters.hex ? hexPolygon(filters.hex) : undefined} />
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-end">
                    <RampLegend breaks={breaks.data} caption="Çmimi i kërkuar për m² i çdo njoftimi" />
                    <Note className="md:text-right">
                      Vendndodhjet janë ato të njoftimeve dhe mund të jenë të përafërta; shumë njoftime ndajnë të njëjtën pikë, ndaj
                      pikat mbivendosen. Kliko një pikë për detajet.
                    </Note>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
