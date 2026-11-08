'use client'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo } from 'react'
import { MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import { rampClass } from '@/lib/ramp'
import { tileLayerProps, tokenColor, useThemeAttr } from './useTheme'

export interface MapArea {
  key: string
  polygon: [number, number][]
  /** Median €/m², or NaN when the area has too few listings to colour. */
  median: number
  sparse: boolean
  label: string
}

/** Fits the view once per change of `fitKey`. */
function Fit({ bounds, fitKey }: { bounds: LatLngBoundsExpression | null; fitKey: string }) {
  const map = useMap()
  useEffect(() => {
    // On wide screens the detail panel covers the right edge; keep the data clear of it.
    const wide = map.getContainer().clientWidth >= 768
    if (bounds) map.fitBounds(bounds, { paddingTopLeft: [16, 16], paddingBottomRight: [wide ? 330 : 16, 16], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map])
  return null
}

/**
 * Areas coloured by median asking price per m². Hover previews an area, click
 * or tap selects it; the selection stays outlined until cleared. Selection is
 * reported to the parent, which renders the detail panel.
 */
export default function PriceMap({ areas, breaks, selected, hovered, onSelect, onHover, fitBounds, fitKey }: {
  areas: MapArea[]
  breaks: number[]
  selected: string | null
  hovered: string | null
  onSelect: (key: string | null) => void
  onHover: (key: string | null) => void
  fitBounds: LatLngBoundsExpression | null
  fitKey: string
}) {
  const theme = useThemeAttr()
  const c = useMemo(
    () => ({
      ramp: [0, 1, 2, 3, 4].map(i => tokenColor(`ramp-${i}`)),
      edge: tokenColor('surface', 0.9),
      sparse: tokenColor('ink-subtle', 0.6),
      ink: tokenColor('ink'),
      muted: tokenColor('ink-muted'),
    }),
    // Token values change with the theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  )

  const selectedArea = areas.find(a => a.key === selected)

  return (
    <MapContainer
      center={[41.3275, 19.8187]}
      zoom={12}
      minZoom={11}
      maxZoom={16}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer key={theme} {...tileLayerProps(theme, true)} />
      <Fit bounds={fitBounds} fitKey={fitKey} />
      {areas.map(a => {
        const isSel = a.key === selected
        const isHover = a.key === hovered && !isSel
        const fill = a.sparse ? c.edge : c.ramp[Math.max(0, rampClass(a.median, breaks))]
        return (
          <Polygon
            key={`${a.key}-${theme}`}
            positions={a.polygon}
            pathOptions={{
              color: isSel ? c.ink : isHover ? c.muted : a.sparse ? c.sparse : c.edge,
              weight: isSel ? 2.5 : isHover ? 2 : 0.8,
              dashArray: a.sparse && !isSel ? '3 3' : undefined,
              fillColor: fill,
              fillOpacity: a.sparse ? 0.12 : 0.82,
            }}
            eventHandlers={{
              click: () => onSelect(isSel ? null : a.key),
              mouseover: () => onHover(a.key),
              mouseout: () => onHover(null),
              // Shapes stay out of the tab order; the panel's list is the keyboard route.
              add: e => e.target.getElement()?.setAttribute('aria-label', a.label),
            }}
          />
        )
      })}
      {/* The selection is redrawn on top so neighbouring shapes can't cover its outline. */}
      {selectedArea && (
        <Polygon
          key={`sel-${selectedArea.key}-${theme}`}
          positions={selectedArea.polygon}
          interactive={false}
          pathOptions={{ color: c.ink, weight: 2.5, fill: false }}
        />
      )}
    </MapContainer>
  )
}
