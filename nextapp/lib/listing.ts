import type { ListingSummary } from './types'

/** The dataset uses -1 (and sometimes null) for "not stated". */
export const known = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null

/** "Apartament me 3 dhoma gjumi" / "Garsonierë". Listings have no street addresses. */
export function listingTitle(l: Pick<ListingSummary, 'beds'>) {
  const beds = known(l.beds)
  if (beds === null) return 'Apartament'
  if (beds === 0) return 'Garsonierë'
  return `Apartament me ${beds} ${beds === 1 ? 'dhomë gjumi' : 'dhoma gjumi'}`
}

/** Floor numbering: 0 is the ground floor in Albanian listings. */
export function floorLabel(floor: number | null | undefined) {
  const f = known(floor)
  if (f === null) return null
  return f === 0 ? 'Përdhe' : `Kati ${f}`
}

export const FURNISHING_LABELS: Record<string, string> = {
  fully_furnished: 'E mobiluar plotësisht',
  partially_furnished: 'Pjesërisht e mobiluar',
  unfurnished: 'E pamobiluar',
  unknown: 'Nuk tregohet',
}

/**
 * Descriptions are scraped text and often include agents' phone numbers,
 * e-mail addresses and websites. They're hidden on display; the data is unchanged.
 */
export function cleanDescription(text: string | null | undefined): { text: string; redacted: boolean } {
  if (!text) return { text: '', redacted: false }
  let redacted = false
  const mark = () => { redacted = true; return '[kontakti u hoq]' }
  let t = text
    .replace(/^\s*description\s*/i, '')
    .replace(/[\t\r]+/g, ' ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, mark)
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, mark)
    // Albanian phone numbers: +355 / 00355 prefixes, mobiles (06x) and landlines (04x),
    // allowing spaces, dots and dashes. Prices like "12 000 000 lek" don't match.
    .replace(/(?:\+|00|\b)355[\s.-]?\(?0?\)?\d(?:[\s.-]?\d){7,8}/g, mark)
    .replace(/\+\d[\d\s.-]{8,16}\d/g, mark)
    .replace(/\b0[4-6]\d(?:[\s.-]?\d){6,7}(?!\d)/g, mark)
  t = t.replace(/[  ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { text: t, redacted }
}

// The comparables endpoint returns English phrases; these map them to Albanian.
const DISTANCE_LABELS: Record<string, string> = {
  '< 1 km': 'Nën 1 km',
  '1-3 km': '1–3 km',
  '3-7 km': '3–7 km',
  '> 7 km': 'Mbi 7 km',
  'Distance unavailable': 'Distanca nuk dihet',
}
const REASON_PARTS: Record<string, string> = {
  'same number of bedrooms': 'i njëjti numër dhomash gjumi',
  'similar bedroom count': 'numër i afërt dhomash gjumi',
  'very similar size': 'sipërfaqe pothuajse e njëjtë',
  'similar size': 'sipërfaqe e afërt',
  'same neighborhood cluster': 'e njëjta zonë çmimi',
  'comparable overall features': 'karakteristika të përafërta',
}
export const distanceLabel = (s: string) => DISTANCE_LABELS[s] ?? s
export function similarityReason(s: string) {
  const parts = s.toLowerCase().split(/,\s*/).map(p => REASON_PARTS[p] ?? p)
  const joined = parts.join(', ')
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

/** Labels for the model's features, keyed by the backend's feature name. */
export const FEATURE_LABELS: Record<string, string> = {
  area_sqm: 'Sipërfaqja',
  floor: 'Kati',
  bedrooms: 'Dhoma gjumi',
  bathrooms: 'Banjo',
  living_rooms: 'Dhoma ndenjeje',
  balconies: 'Ballkone',
  has_elevator: 'Ashensor',
  has_parking_space: 'Vend parkimi',
  has_terrace: 'Tarracë',
  has_garden: 'Kopsht',
  has_garage: 'Garazh',
  has_carport: 'Parkim i mbuluar',
  furn_fully_furnished: 'E mobiluar plotësisht',
  furn_partially_furnished: 'Pjesërisht e mobiluar',
  furn_unfurnished: 'E pamobiluar',
  furn_unknown: 'Mobilimi pa treguar',
  distance_from_center: 'Distanca nga qendra',
  total_rooms: 'Numri i ambienteve',
  zone_km: 'Distanca nga qendra e zonës',
}
