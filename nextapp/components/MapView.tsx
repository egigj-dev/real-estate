"use client"
import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { formatPrice } from "@/lib/api"
import type { Area, ListingSummary } from "@/lib/types"

const CENTRE: [number, number] = [41.3275, 19.8187]

function FitBounds({ items }: { items: ListingSummary[] }) {
  const map = useMap()
  useEffect(() => {
    const valid = items.filter((i) => i.latitude != null && i.longitude != null)
    if (!valid.length) return
    try {
      const lats = valid.map((i) => i.latitude as number)
      const lngs = valid.map((i) => i.longitude as number)
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [40, 40], maxZoom: 15 }
      )
    } catch {
      map.setView(CENTRE, 13)
    }
  }, [items, map])
  return null
}

export default function MapView({
  items = [], onSelect, areaName = null, areas = [], height = 600,
}: {
  items: ListingSummary[]
  onSelect: (id: string) => void
  areaName?: string | null
  areas?: Area[]
  height?: number
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const selectedArea = useMemo(() => areas.find((a) => a.name === areaName), [areas, areaName])
  const count = items.filter((i) => i.latitude != null).length

  if (!mounted) {
    return <div className="rounded-xl border border-border bg-muted" style={{ height }} />
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <MapContainer center={CENTRE} zoom={13} style={{ height, width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" maxZoom={19} />

        {selectedArea && selectedArea.polygon?.length >= 3 && (
          <Polygon
            positions={selectedArea.polygon}
            pathOptions={{ color: "#f59e0b", weight: 3, fillColor: "#f59e0b", fillOpacity: 0.08, dashArray: "6 4" }}
          />
        )}

        {items
          .filter((i) => i.latitude != null && i.longitude != null)
          .map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.latitude as number, item.longitude as number]}
              radius={7}
              pathOptions={{ fillColor: "#0f172a", color: "#fff", weight: 2, fillOpacity: 0.85 }}
            >
              <Popup maxWidth={220}>
                <div className="min-w-[170px] font-sans">
                  <div className="mb-0.5 text-[11px] text-muted-foreground">
                    {item.area_name || item.neighborhood || item.property_type || "Pronë"}
                  </div>
                  <div className="mb-1.5 text-base font-bold text-foreground">{formatPrice(item.price)}</div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    {[
                      item.sqm != null ? `${item.sqm} m²` : null,
                      item.beds != null ? `${item.beds} dhoma` : null,
                      item.floor != null ? `Kati ${item.floor}` : null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  <button
                    onClick={() => onSelect(item.id)}
                    className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    Shiko detajet
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        <FitBounds items={items} />
      </MapContainer>

      <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-border bg-card/90 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur">
        {count} prona në hartë
        {areaName && <span className="ml-1.5 font-medium text-amber-600 dark:text-amber-400">· {areaName}</span>}
      </div>
    </div>
  )
}
