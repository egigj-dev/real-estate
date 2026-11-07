import type { ListingSummary } from './types'
import { median, ppsqm } from './stats'

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

/** Grid cells of about 650 m, sized for Tirana's latitude. */
const CELL_LAT = 0.006
const CELL_LON = 0.008
/** Cells with fewer listings than this aren't shown. */
export const MIN_CELL_LISTINGS = 5

export interface GridCell { bounds: [[number, number], [number, number]]; n: number; median: number }

/**
 * Median €/m² per grid cell. Uses each listing's own coordinates, so there's
 * no dependence on administrative boundaries.
 */
export function priceGrid(listings: ListingSummary[]): GridCell[] {
  const cells = new Map<string, { i: number; j: number; values: number[] }>()
  for (const l of listings) {
    if (!hasCoords(l)) continue
    const i = Math.floor((l.latitude as number) / CELL_LAT)
    const j = Math.floor((l.longitude as number) / CELL_LON)
    const key = `${i}:${j}`
    const cell = cells.get(key) ?? { i, j, values: [] }
    cell.values.push(ppsqm(l))
    cells.set(key, cell)
  }
  return [...cells.values()]
    .filter(c => c.values.length >= MIN_CELL_LISTINGS)
    .map(c => ({
      bounds: [[c.i * CELL_LAT, c.j * CELL_LON], [(c.i + 1) * CELL_LAT, (c.j + 1) * CELL_LON]],
      n: c.values.length,
      median: median(c.values),
    }))
}
