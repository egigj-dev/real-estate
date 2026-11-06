"use client"
import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { School, Stethoscope, TreePine, Bus, type LucideIcon } from "lucide-react"
import { formatPrice } from "@/lib/api"
import type { ListingDetail } from "@/lib/types"

const OVERPASS = "https://overpass-api.de/api/interpreter"

interface PoiType {
  key: "schools" | "hospitals" | "social" | "transport"
  label: string
  Icon: LucideIcon
  colorVar: string
  query: (r: number, lat: number, lon: number) => string
}

const POI_TYPES: PoiType[] = [
  { key: "schools", label: "Shkolla", Icon: School, colorVar: "#3b82f6",
    query: (r, lat, lon) => `node["amenity"~"school|kindergarten|college|university"](around:${r},${lat},${lon});way["amenity"~"school|kindergarten"](around:${r},${lat},${lon});` },
  { key: "hospitals", label: "Spitale / Klinika", Icon: Stethoscope, colorVar: "#ef4444",
    query: (r, lat, lon) => `node["amenity"~"hospital|clinic|pharmacy|dentist|doctors"](around:${r},${lat},${lon});` },
  { key: "social", label: "Parqe & Kulturë", Icon: TreePine, colorVar: "#22c55e",
    query: (r, lat, lon) => `node["leisure"~"park|playground|garden|fitness_centre|sports_centre"](around:${r},${lat},${lon});way["leisure"~"park|garden"](around:${r},${lat},${lon});node["amenity"~"theatre|cinema|arts_centre|community_centre"](around:${r},${lat},${lon});node["shop"~"mall|supermarket"](around:${r},${lat},${lon});` },
  { key: "transport", label: "Transport publik", Icon: Bus, colorVar: "#f59e0b",
    query: (r, lat, lon) => `node["highway"="bus_stop"](around:${r},${lat},${lon});node["public_transport"~"stop_position|platform"](around:${r},${lat},${lon});node["amenity"="taxi"](around:${r},${lat},${lon});` },
]

const POI_LABEL_MAP: Record<string, string> = {
  school: "Shkollë", kindergarten: "Kopësht fëmijësh", college: "Kolegj", university: "Universitet",
  hospital: "Spital", clinic: "Klinikë", pharmacy: "Farmaci", dentist: "Dentist", doctors: "Mjek",
  park: "Park", playground: "Lojëtore", garden: "Kopsht publik",
  fitness_centre: "Qendër fitness", sports_centre: "Qendër sportive",
  theatre: "Teatër", cinema: "Kinema", arts_centre: "Qendër artesh", community_centre: "Qendër komunitare",
  mall: "Qendër tregtare", supermarket: "Supermarket",
  bus_stop: "Stacion autobusi", taxi: "Stacion taksi", stop_position: "Stacion tranzit", platform: "Platformë tranziti",
}

interface PoiElement { tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }
interface PoiPoint { km: number; name: string; lat: number; lon: number }

function poiLabel(el: PoiElement): string {
  const t = el.tags || {}
  if (t.name && t.name.length > 1) return t.name
  const tag = t.amenity || t.leisure || t.shop || t.highway || t.public_transport || ""
  return POI_LABEL_MAP[tag] || tag
}

function classifyPOI(el: PoiElement): PoiType["key"] | null {
  const t = el.tags || {}
  if (["school", "kindergarten", "college", "university"].includes(t.amenity ?? "")) return "schools"
  if (["hospital", "clinic", "pharmacy", "dentist", "doctors"].includes(t.amenity ?? "")) return "hospitals"
  if (["park", "playground", "garden", "fitness_centre", "sports_centre"].includes(t.leisure ?? "")) return "social"
  if (["theatre", "cinema", "arts_centre", "community_centre"].includes(t.amenity ?? "")) return "social"
  if (["mall", "supermarket"].includes(t.shop ?? "")) return "social"
  if (t.highway === "bus_stop" || ["stop_position", "platform"].includes(t.public_transport ?? "") || t.amenity === "taxi") return "transport"
  return null
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, d2r = Math.PI / 180
  const dLat = (lat2 - lat1) * d2r, dLon = (lon2 - lon1) * d2r
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function deduplicatePOIs(items: PoiPoint[], thresholdKm = 0.03): PoiPoint[] {
  const kept: PoiPoint[] = []
  for (const item of items) {
    const twin = kept.find((k) => haversineKm(k.lat, k.lon, item.lat, item.lon) < thresholdKm)
    if (twin) { if (item.name.length > twin.name.length) twin.name = item.name }
    else kept.push({ ...item })
  }
  return kept
}

async function fetchAmenities(lat: number, lon: number, radius = 1200): Promise<PoiElement[]> {
  const parts = POI_TYPES.map((t) => t.query(radius, lat, lon)).join("")
  const body = `[out:json][timeout:15];(${parts});out center;`
  const res = await fetch(OVERPASS, { method: "POST", body: `data=${encodeURIComponent(body)}`, headers: { "Content-Type": "application/x-www-form-urlencoded" } })
  if (!res.ok) throw new Error("Overpass error")
  const data = await res.json()
  return data.elements || []
}

type ScoreMap = Record<PoiType["key"], { score: number; items: PoiPoint[] }>

function computeScores(elements: PoiElement[], lat: number, lon: number): ScoreMap {
  const counts: Record<PoiType["key"], PoiPoint[]> = { schools: [], hospitals: [], social: [], transport: [] }
  elements.forEach((el) => {
    const key = classifyPOI(el)
    if (!key) return
    const elLat = el.lat ?? el.center?.lat
    const elLon = el.lon ?? el.center?.lon
    if (!elLat || !elLon) return
    counts[key].push({ km: haversineKm(lat, lon, elLat, elLon), name: poiLabel(el), lat: elLat, lon: elLon })
  })
  ;(Object.keys(counts) as PoiType["key"][]).forEach((k) => {
    counts[k].sort((a, b) => a.km - b.km)
    counts[k] = deduplicatePOIs(counts[k])
  })
  function score(items: PoiPoint[], idealCount: number, idealDist: number) {
    if (!items.length) return 0
    const distScore = Math.max(0, 10 - (items[0].km / idealDist) * 5)
    const countScore = Math.min(10, (items.length / idealCount) * 5)
    return Math.round((distScore * 0.6 + countScore * 0.4) * 10) / 10
  }
  return {
    schools: { score: score(counts.schools, 3, 0.5), items: counts.schools.slice(0, 3) },
    hospitals: { score: score(counts.hospitals, 2, 0.8), items: counts.hospitals.slice(0, 3) },
    social: { score: score(counts.social, 4, 0.4), items: counts.social.slice(0, 3) },
    transport: { score: score(counts.transport, 5, 0.2), items: counts.transport.slice(0, 4) },
  }
}

function overallScore(scores: ScoreMap) {
  const w: Record<PoiType["key"], number> = { schools: 0.3, hospitals: 0.25, social: 0.2, transport: 0.25 }
  return Object.entries(w).reduce((s, [k, wt]) => s + (scores[k as PoiType["key"]]?.score ?? 0) * wt, 0)
}

function lifestyleLabel(score: number) {
  if (score >= 8) return { tone: "text-emerald-600 dark:text-emerald-400", text: "Shkëlqyeshëm për familje" }
  if (score >= 7) return { tone: "text-emerald-600 dark:text-emerald-400", text: "Shumë e mirë për familje" }
  if (score >= 6) return { tone: "text-amber-600 dark:text-amber-400", text: "E mirë — zonë me potencial" }
  if (score >= 4) return { tone: "text-amber-600 dark:text-amber-400", text: "Mesatare — shiko me kujdes" }
  return { tone: "text-destructive", text: "Infrastrukturë e kufizuar" }
}

function investmentLabel(score: number, transport: number) {
  if (transport >= 7 && score >= 6) return { tone: "text-emerald-600 dark:text-emerald-400", text: "Zonë investimi e mirë" }
  if (score >= 7) return { tone: "text-emerald-600 dark:text-emerald-400", text: "Potencial i lartë investimi" }
  if (score >= 5) return { tone: "text-amber-600 dark:text-amber-400", text: "Potencial mesatar investimi" }
  return { tone: "text-destructive", text: "Potencial i ulët investimi" }
}

export default function LocationMap({ item }: { item: ListingDetail }) {
  const lat = item.latitude as number, lon = item.longitude as number
  const [amenities, setAmenities] = useState<ScoreMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let alive = true
    fetchAmenities(lat, lon)
      .then((els) => { if (alive) setAmenities(computeScores(els, lat, lon)) })
      .catch(() => alive && setError("Nuk u morën të dhënat e ameniteteve"))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [lat, lon])

  const total = amenities ? overallScore(amenities) : null
  const lifestyle = total != null ? lifestyleLabel(total) : null
  const investment = total != null ? investmentLabel(total, amenities?.transport.score ?? 0) : null

  return (
    <div>
      <div className="mb-4 overflow-hidden rounded-lg border border-border">
        {mounted ? (
          <MapContainer center={[lat, lon]} zoom={15} style={{ height: 320, width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" maxZoom={19} />
            <CircleMarker center={[lat, lon]} radius={10} pathOptions={{ fillColor: "#0f172a", color: "#fff", weight: 2, fillOpacity: 1 }}>
              <Popup>{formatPrice(item.price)}</Popup>
            </CircleMarker>
            {amenities && POI_TYPES.flatMap((type) =>
              amenities[type.key].items.map((poi, i) => (
                <CircleMarker key={`${type.key}-${i}`} center={[poi.lat, poi.lon]} radius={6} pathOptions={{ fillColor: type.colorVar, color: "#1f2937", weight: 1.5, fillOpacity: 0.85 }}>
                  <Popup>{poi.name} · {(poi.km * 1000).toFixed(0)} m</Popup>
                </CircleMarker>
              ))
            )}
          </MapContainer>
        ) : <div style={{ height: 320 }} className="bg-muted" />}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Duke analizuar zonën…</div>}
      {error && <div className="text-sm text-muted-foreground">{error}</div>}

      {amenities && total != null && lifestyle && investment && (
        <>
          <div className="mb-4 flex flex-wrap gap-2.5">
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-2">
              <span className="text-lg font-bold text-foreground">{total.toFixed(1)}/10</span>
              <span className={`text-xs ${lifestyle.tone}`}>{lifestyle.text}</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-2">
              <span className="text-lg font-bold text-foreground">{amenities.transport.score.toFixed(1)}/10</span>
              <span className={`text-xs ${investment.tone}`}>{investment.text}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {POI_TYPES.map((type) => {
              const cat = amenities[type.key]
              return (
                <div key={type.key} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <type.Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">{type.label}</span>
                    <span className={`ml-auto text-sm font-bold ${cat.score >= 7 ? "text-emerald-600 dark:text-emerald-400" : cat.score >= 4 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>
                      {cat.score}/10
                    </span>
                  </div>
                  <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${cat.score * 10}%`, background: type.colorVar }} />
                  </div>
                  {cat.items.length > 0 ? cat.items.map((p, i) => (
                    <div key={i} className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{p.name.length > 28 ? p.name.slice(0, 28) + "…" : p.name}</span>
                      <span>{(p.km * 1000).toFixed(0)} m</span>
                    </div>
                  )) : <div className="text-[11px] text-muted-foreground">Asnjë brenda 1.2 km</div>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
