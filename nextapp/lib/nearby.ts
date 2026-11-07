/**
 * Nearby places from OpenStreetMap via the public Overpass API. Only distances
 * and names are reported; there's no scoring. Results depend on how complete
 * OpenStreetMap is around the listing.
 */
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const RADIUS_M = 1000

export type NearbyKind = 'school' | 'health' | 'park' | 'transit' | 'shop'

export const NEARBY_LABELS: Record<NearbyKind, string> = {
  school: 'Shkolla dhe kopshte',
  health: 'Shëndetësi',
  park: 'Parqe dhe lojëra',
  transit: 'Stacione autobusi',
  shop: 'Supermarkete',
}

const TAG_NAMES: Record<string, string> = {
  school: 'Shkollë', kindergarten: 'Kopsht fëmijësh', college: 'Kolegj', university: 'Universitet',
  hospital: 'Spital', clinic: 'Klinikë', pharmacy: 'Farmaci', doctors: 'Mjek', dentist: 'Dentist',
  park: 'Park', playground: 'Kënd lojërash', bus_stop: 'Stacion autobusi', supermarket: 'Supermarket',
}

export interface NearbyPlace { name: string; km: number }

interface OsmElement { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

function classify(t: Record<string, string>): NearbyKind | null {
  if (['school', 'kindergarten', 'college', 'university'].includes(t.amenity)) return 'school'
  if (['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist'].includes(t.amenity)) return 'health'
  if (['park', 'playground'].includes(t.leisure)) return 'park'
  if (t.highway === 'bus_stop') return 'transit'
  if (t.shop === 'supermarket') return 'shop'
  return null
}

function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function fetchNearby(lat: number, lon: number, signal?: AbortSignal): Promise<Record<NearbyKind, NearbyPlace[]>> {
  const around = `(around:${RADIUS_M},${lat},${lon})`
  const query = `[out:json][timeout:15];(` +
    `nwr["amenity"~"^(school|kindergarten|college|university|hospital|clinic|pharmacy|doctors|dentist)$"]${around};` +
    `nwr["leisure"~"^(park|playground)$"]${around};node["highway"="bus_stop"]${around};nwr["shop"="supermarket"]${around};` +
    `);out center tags;`
  const res = await fetch(OVERPASS, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal,
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}`)
  const data = (await res.json()) as { elements?: OsmElement[] }

  const out: Record<NearbyKind, NearbyPlace[]> = { school: [], health: [], park: [], transit: [], shop: [] }
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {}
    const kind = classify(t)
    const la = el.lat ?? el.center?.lat
    const lo = el.lon ?? el.center?.lon
    if (!kind || la == null || lo == null) continue
    const tag = t.amenity ?? t.leisure ?? t.highway ?? t.shop
    const name = t.name && t.name.trim().length > 1 ? t.name.trim() : TAG_NAMES[tag] ?? tag
    out[kind].push({ name, km: km(lat, lon, la, lo) })
  }
  for (const k of Object.keys(out) as NearbyKind[]) {
    // Sort by distance and drop duplicates (the same place mapped as node and area).
    const seen = new Set<string>()
    out[k] = out[k].sort((a, b) => a.km - b.km).filter(p => {
      const key = `${p.name}:${p.km.toFixed(2)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  return out
}

export const NEARBY_RADIUS_M = RADIUS_M
