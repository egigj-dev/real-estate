'use client'
import 'leaflet/dist/leaflet.css'
import { useMemo } from 'react'
import { MapContainer, Rectangle, TileLayer, Tooltip } from 'react-leaflet'
import type { GridCell } from '@/lib/geo'
import { fmtEurPerSqm, fmtInt } from '@/lib/format'
import { rampClass } from '@/lib/ramp'
import { TIRANA_CENTER, tileLayerProps, tokenColor, useThemeAttr } from './useTheme'

/** Grid cells shaded by median €/m² of the listings inside them. */
export default function PriceGridMap({ cells, breaks }: { cells: GridCell[]; breaks: number[] }) {
  const theme = useThemeAttr()
  const palette = useMemo(
    () => ({ ramp: [0, 1, 2, 3, 4, 5].map(i => tokenColor(`ramp-${i}`)), line: tokenColor('surface') }),
    // Token values change with the theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  )

  return (
    <div className="h-[440px] overflow-hidden rounded-lg border border-line md:h-[540px]">
      <MapContainer center={TIRANA_CENTER} zoom={13} minZoom={11} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer key={theme} {...tileLayerProps(theme)} />
        {cells.map(c => (
          <Rectangle
            key={`${c.bounds[0].join()}-${theme}`}
            bounds={c.bounds}
            pathOptions={{ color: palette.line, weight: 1, fillColor: palette.ramp[Math.max(0, rampClass(c.median, breaks))], fillOpacity: 0.85 }}
          >
            <Tooltip sticky>
              <span className="num block font-medium">{fmtEurPerSqm(c.median)}</span>
              <span className="num">mediana e {fmtInt(c.n)} njoftimeve në këtë katror</span>
            </Tooltip>
          </Rectangle>
        ))}
      </MapContainer>
    </div>
  )
}
