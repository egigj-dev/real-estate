import type { ListingSummary } from './types'
import { median, medianInterval, ppsqm } from './stats'

/** Skanderbeg Square; the backend measures distance_from_center from the same point. */
export const CITY_CENTRE: [number, number] = [41.3275, 19.8187]

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const hasCoords = (l: ListingSummary) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude)

export const kmFromCentre = (l: ListingSummary) =>
  hasCoords(l) ? distanceKm(CITY_CENTRE[0], CITY_CENTRE[1], l.latitude as number, l.longitude as number) : NaN

/** Statistics shared by hexagons and zones. */
export interface AreaStats {
  n: number
  median: number
  /** Approximate 95% interval for the median; NaN when there are too few listings. */
  low: number
  high: number
}

function areaStats(values: number[]): AreaStats {
  const [low, high] = medianInterval(values)
  return { n: values.length, median: median(values), low, high }
}

// ── Hexagons ────────────────────────────────────────────────────────────────
//
// Pointy-top hexagons on a local flat projection centred on Tirana (metres).
// Size was chosen from the data (see docs/frontend-redesign/REFINEMENT_LOG.md):
// about 690 m across. Smaller cells mostly split clusters of listings that
// share one coordinate, and gain little; larger ones blur the centre.

/** Centre-to-corner radius in metres; the cell is √3 × this wide (≈ 690 m). */
export const HEX_RADIUS_M = 400
/** Cells with fewer listings than this are outlined but not coloured. */
export const MIN_HEX_LISTINGS = 8

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LON = 111_320 * Math.cos((CITY_CENTRE[0] * Math.PI) / 180)

const toXY = (lat: number, lon: number): [number, number] =>
  [(lon - CITY_CENTRE[1]) * M_PER_DEG_LON, (lat - CITY_CENTRE[0]) * M_PER_DEG_LAT]
const toLatLon = (x: number, y: number): [number, number] =>
  [CITY_CENTRE[0] + y / M_PER_DEG_LAT, CITY_CENTRE[1] + x / M_PER_DEG_LON]

/** Axial hex coordinates of a point, as "q:r". */
export function hexKey(lat: number, lon: number): string {
  const [x, y] = toXY(lat, lon)
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / HEX_RADIUS_M
  const r = ((2 / 3) * y) / HEX_RADIUS_M
  // Cube rounding.
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return `${rq}:${rr}`
}

/** Corners of hexagon "q:r" as [lat, lon]. */
export function hexPolygon(key: string): [number, number][] {
  const [q, r] = key.split(':').map(Number)
  const cx = HEX_RADIUS_M * Math.sqrt(3) * (q + r / 2)
  const cy = HEX_RADIUS_M * 1.5 * r
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30)
    return toLatLon(cx + HEX_RADIUS_M * Math.cos(a), cy + HEX_RADIUS_M * Math.sin(a))
  })
}

export interface HexCell extends AreaStats {
  key: string
  polygon: [number, number][]
  centre: [number, number]
  /** True when n is below MIN_HEX_LISTINGS: drawn, but no median is reported. */
  sparse: boolean
  /** The pricing zone most of the cell's listings belong to. */
  zone: string | null
}

export function hexCells(listings: ListingSummary[]): HexCell[] {
  const groups = new Map<string, ListingSummary[]>()
  for (const l of listings) {
    if (!hasCoords(l)) continue
    const key = hexKey(l.latitude as number, l.longitude as number)
    const list = groups.get(key)
    if (list) list.push(l)
    else groups.set(key, [l])
  }
  return [...groups].map(([key, ls]) => {
    const values = ls.map(ppsqm)
    const zoneCounts = new Map<string, number>()
    for (const l of ls) if (l.neighborhood) zoneCounts.set(l.neighborhood, (zoneCounts.get(l.neighborhood) ?? 0) + 1)
    const zone = [...zoneCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const polygon = hexPolygon(key)
    const centre: [number, number] = [
      polygon.reduce((s, p) => s + p[0], 0) / 6,
      polygon.reduce((s, p) => s + p[1], 0) / 6,
    ]
    return { key, polygon, centre, zone, sparse: values.length < MIN_HEX_LISTINGS, ...areaStats(values) }
  })
}

// ── Pricing zones ───────────────────────────────────────────────────────────
//
// The model's six zones are KMeans clusters on latitude/longitude, so each zone
// is exactly the region closer to its centre than to any other (a Voronoi
// cell). A KMeans centre is the mean of its members, and assigning every
// listing to the nearest such mean reproduces its zone label for all 4,148
// listings. The cells are clipped to the area the listings cover.

type Pt = [number, number] // [lat, lon]

/** Andrew's monotone chain convex hull. */
function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const cross = (o: Pt, a: Pt, b: Pt) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Keep the part of `poly` closer to `a` than to `b` (Sutherland–Hodgman against the bisector). */
function clipCloserTo(poly: Pt[], a: Pt, b: Pt): Pt[] {
  // f(p) < 0 when p is closer to a; KMeans used plain lat/lon distance.
  const f = (p: Pt) => (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 - ((p[0] - b[0]) ** 2 + (p[1] - b[1]) ** 2)
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const fp = f(p)
    const fq = f(q)
    if (fp <= 0) out.push(p)
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq)
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
    }
  }
  return out
}

export interface ZoneRegion extends AreaStats {
  zone: string
  polygon: Pt[]
}

export function zoneRegions(listings: ListingSummary[]): ZoneRegion[] {
  const located = listings.filter(l => hasCoords(l) && l.neighborhood)
  if (!located.length) return []
  const byZone = new Map<string, ListingSummary[]>()
  for (const l of located) byZone.set(l.neighborhood!, [...(byZone.get(l.neighborhood!) ?? []), l])
  const centres = new Map<string, Pt>(
    [...byZone].map(([z, ls]) => [z, [ls.reduce((s, l) => s + l.latitude!, 0) / ls.length, ls.reduce((s, l) => s + l.longitude!, 0) / ls.length]]),
  )
  // Clip to the hull of listings within the 99th percentile of distance from the centre,
  // so a handful of far-off listings don't stretch the zones across empty countryside.
  const dists = located.map(kmFromCentre).sort((a, b) => a - b)
  const cutoff = dists[Math.floor(dists.length * 0.99)]
  const hull = convexHull(located.filter(l => kmFromCentre(l) <= cutoff).map(l => [l.latitude!, l.longitude!] as Pt))

  return [...centres].map(([zone, c]) => {
    let poly = hull
    for (const [other, o] of centres) if (other !== zone) poly = clipCloserTo(poly, c, o)
    return { zone, polygon: poly, ...areaStats(byZone.get(zone)!.map(ppsqm)) }
  })
}

/** Whether an area's median differs clearly from a reference value (outside its 95% interval). */
export function differsFrom(stats: AreaStats, reference: number) {
  return Number.isFinite(stats.low) && (reference < stats.low || reference > stats.high)
}
