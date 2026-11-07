'use client'
import 'leaflet/dist/leaflet.css'
import { Circle, CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import { tileLayerProps, tokenColor, useThemeAttr } from './useTheme'

/** The listing's position with a 500 m reference circle. */
export default function LocationMap({ lat, lon }: { lat: number; lon: number }) {
  const theme = useThemeAttr()
  const primary = tokenColor('primary')
  return (
    <div className="h-[320px] overflow-hidden rounded-lg border border-line">
      <MapContainer center={[lat, lon]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer key={theme} {...tileLayerProps(theme)} />
        <Circle center={[lat, lon]} radius={500} pathOptions={{ color: primary, weight: 1, fillOpacity: 0.04, dashArray: '4 4' }} />
        <CircleMarker center={[lat, lon]} radius={8} pathOptions={{ color: tokenColor('surface'), weight: 2, fillColor: primary, fillOpacity: 1 }} />
      </MapContainer>
    </div>
  )
}
