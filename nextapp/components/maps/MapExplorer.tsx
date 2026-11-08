'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { ListingSummary } from '@/lib/types'
import { differsFrom, hexCells, MIN_HEX_LISTINGS, zoneRegions, type AreaStats } from '@/lib/geo'
import { EMPTY_FILTERS, filtersToSearch } from '@/lib/filters'
import { fmtEurPerSqm, fmtInt, fmtPct, plural } from '@/lib/format'
import { rampBreaks } from '@/lib/ramp'
import { median, ppsqm, quantile } from '@/lib/stats'
import { cn } from '@/lib/utils'
import RampLegend from './RampLegend'
import type { MapArea } from './PriceMap'
import { Select } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/states'

const PriceMap = dynamic(() => import('./PriceMap'), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> })

export type MapMode = 'hekzagone' | 'zonat'

interface Area extends MapArea, AreaStats {
  /** For hexagons, the pricing zone most of their listings belong to. */
  zone?: string | null
  title: string
  subtitle: string
  href: string
  linkLabel: string
}

/**
 * The home page map: median asking price per m², either in ~690 m hexagons or
 * in the model's six pricing zones, with a detail panel for the selected area.
 * Mode and selection are owned by the parent so they can live in the URL.
 */
export default function MapExplorer({ listings, mode, selected, onModeChange, onSelect }: {
  listings: ListingSummary[]
  mode: MapMode
  selected: string | null
  onModeChange: (m: MapMode) => void
  onSelect: (key: string | null) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  const model = useMemo(() => {
    const values = listings.map(ppsqm)
    const cityMedian = median(values)
    const breaks = rampBreaks(values)
    const hexes: Area[] = hexCells(listings).map(h => ({
      ...h,
      median: h.sparse ? Number.NaN : h.median,
      label: h.sparse ? `${h.n} njoftime, pa medianë` : `${fmtEurPerSqm(h.median)}, ${h.n} njoftime`,
      title: h.zone ? `Pjesë e zonës ${h.zone}` : 'Zonë pa emër',
      subtitle: 'Hekzagon rreth 690 m',
      href: `/pronat${filtersToSearch({ ...EMPTY_FILTERS, hex: h.key }, 'lista')}`,
      linkLabel: `Shiko ${plural(h.n, 'njoftimin', 'njoftimet')} këtu`,
    }))
    const zones: Area[] = zoneRegions(listings).map(z => ({
      ...z,
      key: z.zone,
      sparse: false,
      label: `${z.zone}: ${fmtEurPerSqm(z.median)}`,
      title: z.zone,
      subtitle: 'Zonë çmimi e modelit',
      href: `/pronat${filtersToSearch({ ...EMPTY_FILTERS, zona: z.zone }, 'lista')}`,
      linkLabel: `Shiko njoftimet në ${z.zone}`,
    }))
    const located = listings.filter(l => Number.isFinite(l.latitude) && Number.isFinite(l.longitude))
    const coloured = hexes.filter(h => !h.sparse)
    return { cityMedian, breaks, hexes, zones, coveredByColour: coloured.reduce((s, h) => s + h.n, 0), located: located.length }
  }, [listings])

  const areas = mode === 'zonat' ? model.zones : model.hexes
  const current = areas.find(a => a.key === selected) ?? null
  const preview = !current && hovered ? areas.find(a => a.key === hovered) ?? null : null
  // Frame the middle 95% of listings, so a few distant ones don't shrink the city.
  const bounds = useMemo(() => {
    const located = listings.filter(l => Number.isFinite(l.latitude) && Number.isFinite(l.longitude))
    if (!located.length) return null
    const lats = located.map(l => l.latitude!)
    const lons = located.map(l => l.longitude!)
    return [[quantile(lats, 0.025), quantile(lons, 0.025)], [quantile(lats, 0.975), quantile(lons, 0.975)]] as [[number, number], [number, number]]
  }, [listings])

  // Keyboard and screen-reader route to every area, ordered by price.
  const options = useMemo(
    () => [...areas].filter(a => !a.sparse).sort((a, b) => b.median - a.median),
    [areas],
  )

  if (model.located === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface-sunken p-4 text-sm text-ink">
        Njoftimet në këtë server nuk kanë koordinata, ndaj harta e çmimeve nuk mund të ndërtohet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Si të ndahet harta" className="inline-flex rounded border border-line-strong p-0.5">
          {([['hekzagone', 'Hollësisht'], ['zonat', 'Zonat e çmimit']] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => { onModeChange(m); setHovered(null) }}
              className={cn('h-8 rounded-sm px-3 text-sm', mode === m ? 'bg-primary text-primary-contrast' : 'text-ink-muted hover:text-ink')}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          {mode === 'hekzagone'
            ? `Hekzagonë rreth 690 m. Ngjyrosen ata me të paktën ${MIN_HEX_LISTINGS} njoftime.`
            : 'Gjashtë zonat ku modeli grupon njoftimet sipas vendndodhjes.'}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-line md:h-[560px]">
        <div className="h-[380px] md:h-full">
          <PriceMap
            areas={areas}
            breaks={model.breaks}
            selected={current?.key ?? null}
            hovered={hovered}
            onSelect={onSelect}
            onHover={setHovered}
            fitBounds={bounds}
            fitKey={mode}
          />
        </div>

        <aside
          aria-label="Detajet e zonës"
          aria-live="polite"
          className="border-t border-line bg-surface p-5 md:absolute md:right-4 md:top-4 md:z-[500] md:w-[300px] md:rounded-lg md:border md:shadow-overlay"
        >
          <AreaPanel area={current ?? preview} isSelection={Boolean(current)} cityMedian={model.cityMedian} onClear={() => onSelect(null)} />
          <label className="mt-4 block space-y-1.5 border-t border-line pt-4">
            <span className="text-xs text-ink-muted">Ose zgjidh nga lista</span>
            <Select value={current?.key ?? ''} onChange={e => onSelect(e.target.value || null)} className="h-9">
              <option value="">{mode === 'zonat' ? 'Zgjidh një zonë' : 'Zgjidh një hekzagon'}</option>
              {options.map(o => (
                <option key={o.key} value={o.key}>
                  {mode === 'zonat' ? o.title : `${o.zone ?? 'Pa zonë'} · ${fmtInt(o.median)} €/m² · ${o.n}`}
                </option>
              ))}
            </Select>
          </label>
        </aside>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <RampLegend
          breaks={model.breaks}
          caption="Mediana e çmimit të kërkuar, €/m²"
          missing={mode === 'hekzagone' ? `Më pak se ${MIN_HEX_LISTINGS} njoftime` : undefined}
        />
        {mode === 'hekzagone' && (
          <p className="text-xs text-ink-muted num">
            Ngjyrat përfshijnë {fmtInt(model.coveredByColour)} nga {fmtInt(listings.length)} njoftimet ({fmtPct(model.coveredByColour / listings.length)}).
          </p>
        )}
      </div>
    </div>
  )
}

interface PanelArea extends AreaStats {
  title: string
  subtitle: string
  sparse: boolean
  href: string
  linkLabel: string
}

function AreaPanel({ area, isSelection, cityMedian, onClear }: { area: PanelArea | null; isSelection: boolean; cityMedian: number; onClear: () => void }) {
  if (!area) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Zgjidh një zonë në hartë</p>
        <p className="text-sm text-ink-muted">Kalo me miun për një vështrim të shpejtë; kliko ose prek për detajet dhe njoftimet.</p>
        <p className="pt-2 text-sm text-ink-muted num">Mediana e qytetit: <span className="font-medium text-ink">{fmtEurPerSqm(cityMedian)}</span></p>
      </div>
    )
  }

  const gap = area.median / cityMedian - 1
  const clear = !area.sparse && differsFrom(area, cityMedian)

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">{area.subtitle}</p>
          <p className="text-base font-semibold text-ink">{area.title}</p>
        </div>
        {isSelection && (
          <button type="button" onClick={onClear} aria-label="Hiq zgjedhjen" className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {area.sparse ? (
        <p className="text-sm text-ink">
          Vetëm {plural(area.n, 'njoftim', 'njoftime')} këtu, shumë pak për një medianë të besueshme.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-ink-muted">Mediana, €/m²</dt>
              <dd className="num text-xl font-semibold text-ink">{fmtInt(area.median)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Njoftime</dt>
              <dd className="num text-xl font-semibold text-ink">{fmtInt(area.n)}</dd>
            </div>
          </dl>
          <p className="text-sm text-ink-muted">
            {clear
              ? <><span className="num font-medium text-ink">{fmtPct(Math.abs(gap))} {gap > 0 ? 'mbi' : 'nën'}</span> medianën e qytetit ({fmtInt(cityMedian)} €/m²).</>
              : <>Nuk dallon qartë nga mediana e qytetit ({fmtInt(cityMedian)} €/m²) me kaq njoftime.</>}
          </p>
        </>
      )}

      {isSelection ? (
        <Link href={area.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
          {area.linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <p className="text-xs text-ink-muted">Kliko për ta zgjedhur.</p>
      )}
    </div>
  )
}
