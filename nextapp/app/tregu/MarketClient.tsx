'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { fetchAllListings, getAllListings } from '@/lib/api'
import { kmFromCentre } from '@/lib/geo'
import { fmtEur, fmtEurPerSqm, fmtInt, fmtSignedPct, fmtSqm } from '@/lib/format'
import { EMPTY_FILTERS, filtersToSearch } from '@/lib/filters'
import { groupBy, histogram, median, ppsqm, quantile, summarize } from '@/lib/stats'
import type { ListingSummary } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import Histogram from '@/components/charts/Histogram'
import SpreadRows, { type SpreadRow } from '@/components/charts/SpreadRows'
import { Select } from '@/components/ui/field'
import { Figure, PageIntro, Section } from '@/components/ui/layout'
import { ErrorState, Loading, Note, Skeleton } from '@/components/ui/states'

function spread(key: string, label: React.ReactNode, ls: ListingSummary[], extra?: React.ReactNode): SpreadRow {
  const p = ls.map(ppsqm)
  return { key, label, n: ls.length, p25: quantile(p, 0.25), median: median(p), p75: quantile(p, 0.75), extra }
}

const DISTANCE_BANDS: [string, number, number][] = [
  ['Deri 1 km', 0, 1], ['1–2 km', 1, 2], ['2–3 km', 2, 3], ['3–5 km', 3, 5], ['5 km e më shumë', 5, Infinity],
]

const SIZE_BANDS: [string, number, number][] = [
  ['Deri 60 m²', 0, 60], ['60–89 m²', 60, 90], ['90–119 m²', 90, 120], ['120–159 m²', 120, 160], ['160 m² e më shumë', 160, Infinity],
]

export default function MarketClient() {
  const data = useAsync(getAllListings, [])
  const [histZone, setHistZone] = useState('')

  const view = useMemo(() => {
    if (data.status !== 'success') return null
    const all = data.data
    const overall = summarize(all)
    const zones = [...groupBy(all, l => l.neighborhood)]
      .map(([z, ls]) => spread(z, <Link href={`/pronat${filtersToSearch({ ...EMPTY_FILTERS, zona: z }, 'lista')}`} className="font-medium underline-offset-4 hover:text-primary hover:underline">{z}</Link>, ls, fmtEur(median(ls.map(l => l.price)))))
      .sort((a, b) => b.median - a.median)
    const beds = [0, 1, 2, 3, 4].map(b => {
      const ls = all.filter(l => (b === 4 ? l.beds >= 4 : l.beds === b))
      return spread(`b${b}`, b === 0 ? 'Garsonierë' : b === 4 ? '4 dhoma gjumi e më shumë' : `${b} ${b === 1 ? 'dhomë' : 'dhoma'} gjumi`, ls, fmtEur(median(ls.map(l => l.price))))
    }).filter(r => r.n > 0)
    const sizes = SIZE_BANDS.map(([label, lo, hi]) => {
      const ls = all.filter(l => l.sqm >= lo && l.sqm < hi)
      return spread(label, label, ls, fmtEur(median(ls.map(l => l.price))))
    })
    const distances = DISTANCE_BANDS.map(([label, lo, hi]) => {
      const ls = all.filter(l => { const d = kmFromCentre(l); return d >= lo && d < hi })
      return spread(label, label, ls, fmtSqm(median(ls.map(l => l.sqm))))
    }).filter(r => r.n > 0)
    return { all, overall, zones, beds, sizes, distances, zoneNames: zones.map(z => z.key) }
  }, [data])

  const hist = useMemo(() => {
    if (!view) return null
    const ls = histZone ? view.all.filter(l => l.neighborhood === histZone) : view.all
    const p = ls.map(ppsqm)
    return { bins: histogram(p, 0, 4500, 18), median: median(p), n: ls.length, over: p.filter(v => v >= 4500).length }
  }, [view, histZone])

  return (
    <div className="space-y-12">
      <PageIntro title="Analiza e tregut">
        Ku janë çmimet më të larta dhe sa ndryshojnë brenda një zone. Të gjitha shifrat llogariten nga {view ? fmtInt(view.all.length) : 'të gjitha'} njoftimet
        e shitjes dhe janë çmime të kërkuara në një moment të vetëm, jo çmime shitjeje dhe jo prirje në kohë.
      </PageIntro>

      {data.status === 'loading' && <Loading label="Duke llogaritur statistikat…"><Skeleton className="h-96 w-full" /></Loading>}
      {data.status === 'error' && <ErrorState message={data.error.message} onRetry={data.retry} />}

      {view && hist && (
        <>
          <dl className="grid gap-6 border-b border-line pb-10 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Njoftime" value={fmtInt(view.overall.n)} />
            <Figure label="Çmimi median i kërkuar" value={fmtEur(view.overall.medianPrice)} note="Gjysma e njoftimeve kërkojnë më pak" />
            <Figure label="Mediana e çmimit për m²" value={fmtEurPerSqm(view.overall.medianPpsqm)} />
            <Figure label="Gjysma e mesme, €/m²" value={`${fmtInt(view.overall.p25Ppsqm)}–${fmtInt(view.overall.p75Ppsqm)}`} note="Nga përqindëshi 25 te 75" />
          </dl>

          <Section
            id="zonat"
            title="Zonat e çmimit"
            description="Gjashtë zonat që përdor modeli, të krijuara duke grupuar njoftimet sipas vendndodhjes. Nuk janë kufij zyrtarë. Vija tregon medianën; shiriti, gjysmën e mesme të njoftimeve."
          >
            <SpreadRows rows={view.zones} caption="Çmimi për m² sipas zonës së çmimit" extraHeader="Çmimi median" />
          </Section>

          <Section
            id="shperndarja"
            title="Si shpërndahen çmimet për m²"
            action={
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <span>Zona</span>
                <Select value={histZone} onChange={e => setHistZone(e.target.value)} className="h-9 w-52">
                  <option value="">Të gjitha</option>
                  {view.zoneNames.map(z => <option key={z} value={z}>{z}</option>)}
                </Select>
              </label>
            }
          >
            <Histogram
              bins={hist.bins}
              median={hist.median}
              unit="€/m²"
              summary={`Shpërndarja e çmimit për m² për ${fmtInt(hist.n)} njoftime${histZone ? ` në ${histZone}` : ''}; mediana ${fmtEurPerSqm(hist.median)}.`}
            />
            <Note>
              {fmtInt(hist.n)} njoftime, në grupe nga 250 €/m².{hist.over > 0 && ` ${fmtInt(hist.over)} njoftime mbi 4 500 €/m² përfshihen te shiriti i fundit.`}
            </Note>
          </Section>

          <div className="grid gap-12 xl:grid-cols-2">
            <Section id="dhomat" title="Sipas dhomave të gjumit">
              <SpreadRows rows={view.beds} caption="Çmimi për m² sipas numrit të dhomave të gjumit" extraHeader="Çmimi median" />
            </Section>
            <Section id="siperfaqja" title="Sipas sipërfaqes">
              <SpreadRows rows={view.sizes} caption="Çmimi për m² sipas sipërfaqes" extraHeader="Çmimi median" />
            </Section>
          </div>

          <Section
            id="komoditetet"
            title="Me dhe pa komoditete"
            description="Dallime të thjeshta mes grupeve, jo efekti i vetë komoditetit: apartamentet me parkim, p.sh., janë shpesh edhe më të reja ose në zona të tjera."
          >
            <AmenityTable all={view.all} />
          </Section>

          <Section
            id="distanca"
            title="Sipas distancës nga qendra"
            description="Distanca në vijë ajrore nga sheshi Skënderbej, sipas koordinatave të njoftimit."
            action={<Link href="/#harta" className="text-sm text-primary underline-offset-4 hover:underline">Shiko hartën</Link>}
          >
            <SpreadRows rows={view.distances} caption="Çmimi për m² sipas distancës nga sheshi Skënderbej" extraHeader="Sipërfaqja mediane" />
          </Section>
        </>
      )}
    </div>
  )
}

function AmenityTable({ all }: { all: ListingSummary[] }) {
  // Listing summaries don't carry amenity flags, so the groups come from the API's own filters.
  const rows = useAmenityRows(all)
  if (rows.status === 'loading') return <Loading><Skeleton className="h-32 w-full" /></Loading>
  if (rows.status === 'error') return <ErrorState message={rows.error.message} onRetry={rows.retry} />
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={'Tabela e komoditeteve'}>
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">Mediana e çmimit për m² me dhe pa komoditete</caption>
        <thead className="text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-4 font-medium">Komoditeti</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Me të (njoftime)</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Pa të (njoftime)</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Dallimi</th>
          </tr>
        </thead>
        <tbody>
          {rows.data.map(r => (
            <tr key={r.label} className="border-b border-line">
              <th scope="row" className="py-3 pr-4 font-normal text-ink">{r.label}</th>
              <td className="num whitespace-nowrap py-3 pl-4 text-right text-ink">{fmtEurPerSqm(r.withMed)} <span className="text-ink-muted">({fmtInt(r.withN)})</span></td>
              <td className="num whitespace-nowrap py-3 pl-4 text-right text-ink">{fmtEurPerSqm(r.withoutMed)} <span className="text-ink-muted">({fmtInt(r.withoutN)})</span></td>
              <td className="num whitespace-nowrap py-3 pl-4 text-right text-ink">{fmtSignedPct(r.withMed / r.withoutMed - 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Note className="mt-2">Mediana e çmimit për m²; në kllapa, numri i njoftimeve. Grupet e vogla, si kopshti, japin shifra më pak të qëndrueshme.</Note>
    </div>
  )
}

/** Medians with and without each amenity, using the API's own filters so definitions match Explore. */
function useAmenityRows(all: ListingSummary[]) {
  return useAsync(async () => {
    const defs = [
      { label: 'Ashensor', q: { has_elevator: true } },
      { label: 'Vend parkimi', q: { has_parking_space: true } },
      { label: 'Kopsht', q: { has_garden: true } },
      { label: 'E mobiluar', q: { furnished: true } },
    ] as const
    return Promise.all(defs.map(async d => {
      const withL = await fetchAllListings(d.q)
      const ids = new Set(withL.map(l => l.id))
      const withoutL = all.filter(l => !ids.has(l.id))
      return {
        label: d.label,
        withN: withL.length, withMed: median(withL.map(ppsqm)),
        withoutN: withoutL.length, withoutMed: median(withoutL.map(ppsqm)),
      }
    }))
  }, [all.length])
}
