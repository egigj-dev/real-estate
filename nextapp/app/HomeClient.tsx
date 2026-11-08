'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getAllListings } from '@/lib/api'
import { fmtEurPerSqm, fmtInt } from '@/lib/format'
import { median, ppsqm } from '@/lib/stats'
import { useAsync } from '@/lib/useAsync'
import MapExplorer, { type MapMode } from '@/components/maps/MapExplorer'
import { ButtonLink } from '@/components/ui/button'
import { ErrorState, Loading, Skeleton } from '@/components/ui/states'

export default function HomeClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const data = useAsync(getAllListings, [])

  // Map mode and selection live in the URL, so returning from the listings keeps them.
  const mode: MapMode = sp.get('harta') === 'zonat' ? 'zonat' : 'hekzagone'
  const selected = sp.get('zgjedhur')
  const setMapState = (next: { mode?: MapMode; selected?: string | null }) => {
    const params = new URLSearchParams(sp.toString())
    const m = next.mode ?? mode
    if (m === 'zonat') params.set('harta', 'zonat')
    else params.delete('harta')
    const sel = next.mode && next.mode !== mode ? null : next.selected !== undefined ? next.selected : selected
    if (sel) params.set('zgjedhur', sel)
    else params.delete('zgjedhur')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}#harta`, { scroll: false })
  }

  const all = data.data
  const cityMedian = all ? median(all.map(ppsqm)) : null

  return (
    <div className="space-y-14 md:space-y-16">
      <section aria-labelledby="hero-title" className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="max-w-2xl space-y-4">
          <h1 id="hero-title" className="font-serif text-[2.125rem] leading-[1.15] text-ink md:text-[2.75rem]">
            Njih çmimet në Tiranë, përpara se të blesh.
          </h1>
          <p className="text-lg leading-relaxed text-ink-muted">
            Shfleto apartamentet në shitje, krahaso çmimet sipas vendndodhjes dhe shiko nëse një çmim i kërkuar është i arsyeshëm.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/pronat" size="lg">Eksploro pronat</ButtonLink>
            <ButtonLink href="/vleresimi" size="lg" variant="secondary">Vlerëso pronën</ButtonLink>
          </div>
        </div>
        <dl className="flex gap-10 border-t border-line pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <div>
            <dt className="text-sm text-ink-muted">Mediana e çmimit të kërkuar</dt>
            <dd className="num mt-1 text-2xl font-semibold text-ink">{cityMedian ? fmtEurPerSqm(cityMedian) : '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Njoftime</dt>
            <dd className="num mt-1 text-2xl font-semibold text-ink">{all ? fmtInt(all.length) : '—'}</dd>
          </div>
        </dl>
      </section>

      <section id="harta" aria-labelledby="map-title" className="scroll-mt-24 space-y-4">
        <div className="max-w-2xl space-y-1">
          <h2 id="map-title" className="text-xl font-semibold text-ink">Ku kërkohet më shumë për m²</h2>
          <p className="text-sm text-ink-muted">Çdo ngjyrë tregon medianën e çmimit të kërkuar për m² të njoftimeve në atë pjesë të qytetit.</p>
        </div>
        {data.status === 'loading' && <Loading label="Duke ngarkuar hartën…"><Skeleton className="h-[560px] w-full" /></Loading>}
        {data.status === 'error' && <ErrorState message={data.error.message} onRetry={data.retry} />}
        {all && (
          <MapExplorer
            listings={all}
            mode={mode}
            selected={selected}
            onModeChange={m => setMapState({ mode: m })}
            onSelect={key => setMapState({ selected: key })}
          />
        )}
      </section>

      <aside aria-label="Për të dhënat" className="max-w-3xl border-t border-line pt-8 text-sm leading-relaxed text-ink-muted">
        <p>
          Të gjitha shifrat janë çmime të kërkuara nga shitësit, nga një fotografi e vetme e tregut, jo çmime shitjeje.{' '}
          <Link href="/rreth-te-dhenave" className="text-ink underline underline-offset-4">Si llogariten</Link>
          {' · '}
          <Link href="/tregu" className="text-ink underline underline-offset-4">Krahasimi i plotë i zonave</Link>
        </p>
      </aside>
    </div>
  )
}
