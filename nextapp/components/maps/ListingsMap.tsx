'use client'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { ListingSummary } from '@/lib/types'
import { fmtEur, fmtEurPerSqm, fmtSqm } from '@/lib/format'
import { listingTitle } from '@/lib/listing'
import { rampClass } from '@/lib/ramp'
import { ppsqm } from '@/lib/stats'
import { TIRANA_CENTER, tileLayerProps, tokenColor, useThemeAttr } from './useTheme'

/** Zooms to the listings whenever the set changes. */
function FitToPoints({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.length ? `${points.length}:${points[0][0]}:${points[points.length - 1][1]}` : ''
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15)
    else if (points.length > 1) map.fitBounds(points, { padding: [24, 24], maxZoom: 15 })
    // Refit only when the set of points changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

/** Listings as points coloured by €/m² class. Canvas rendering keeps 4,000+ points responsive. */
export default function ListingsMap({ listings, breaks, hrefFor, height = 560 }: {
  listings: ListingSummary[]
  breaks: number[]
  hrefFor: (id: string) => string
  height?: number
}) {
  const theme = useThemeAttr()
  const colors = useMemo(
    () => [0, 1, 2, 3, 4, 5].map(i => tokenColor(`ramp-${i}`)),
    // Colours are read from CSS tokens, which change with the theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  )
  const stroke = useMemo(() => tokenColor('ink', 0.45), [theme]) // eslint-disable-line react-hooks/exhaustive-deps
  const points = listings.filter(l => Number.isFinite(l.latitude) && Number.isFinite(l.longitude))

  return (
    <div className="overflow-hidden rounded-lg border border-line" style={{ height }}>
      <MapContainer center={TIRANA_CENTER} zoom={12} scrollWheelZoom={false} preferCanvas className="h-full w-full">
        <TileLayer key={theme} {...tileLayerProps(theme)} />
        <FitToPoints points={points.map(l => [l.latitude as number, l.longitude as number])} />
        {points.map(l => {
          const cls = rampClass(ppsqm(l), breaks)
          return (
            <CircleMarker
              key={l.id}
              center={[l.latitude as number, l.longitude as number]}
              radius={4}
              pathOptions={{ color: stroke, weight: 0.5, fillColor: colors[Math.max(0, cls)], fillOpacity: 0.9 }}
            >
              <Popup>
                <p className="font-medium">{listingTitle(l)}</p>
                <p className="num">{fmtEur(l.price)} · {fmtSqm(l.sqm)}</p>
                <p className="num text-ink-muted">{fmtEurPerSqm(ppsqm(l))} · {l.neighborhood}</p>
                <Link href={hrefFor(l.id)} className="mt-1 inline-block font-medium text-primary underline">Shiko pronën</Link>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
