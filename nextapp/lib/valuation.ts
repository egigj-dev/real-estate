import type { PredictRequest } from './types'

/**
 * Valuation inputs, mirrored in the URL so a result can be shared or revisited.
 * Defaults match the values the backend assumes when a field is missing
 * (ml._input_row), so what the form shows is exactly what the model receives.
 */
export interface ValuationInput {
  sqm: number
  beds: number
  baths: number
  floor: number
  living_rooms: number
  balconies: number
  furnishing_status: 'fully_furnished' | 'partially_furnished' | 'unfurnished' | 'unknown'
  has_elevator: boolean
  has_parking_space: boolean
  has_carport: boolean
  has_garage: boolean
  has_terrace: boolean
  has_garden: boolean
}

export const DEFAULT_INPUT: ValuationInput = {
  sqm: 80, beds: 2, baths: 1, floor: 3, living_rooms: 1, balconies: 0, furnishing_status: 'unknown',
  has_elevator: false, has_parking_space: false, has_carport: false, has_garage: false, has_terrace: false, has_garden: false,
}

/** Allowed ranges, roughly the span of the training data. */
export const LIMITS = {
  sqm: { min: 25, max: 300 },
  beds: { min: 0, max: 6 },
  baths: { min: 1, max: 4 },
  floor: { min: 0, max: 25 },
  living_rooms: { min: 0, max: 3 },
  balconies: { min: 0, max: 4 },
} as const

type NumKey = keyof typeof LIMITS
const NUM_KEYS = Object.keys(LIMITS) as NumKey[]
const BOOL_KEYS = ['has_elevator', 'has_parking_space', 'has_carport', 'has_garage', 'has_terrace', 'has_garden'] as const
const URL_KEYS: Record<keyof ValuationInput, string> = {
  sqm: 's', beds: 'd', baths: 'b', floor: 'k', living_rooms: 'n', balconies: 'bl', furnishing_status: 'm',
  has_elevator: 'ashensor', has_parking_space: 'parkim', has_carport: 'mbuluar', has_garage: 'garazh', has_terrace: 'tarrace', has_garden: 'kopsht',
}

export function validate(input: ValuationInput): Partial<Record<NumKey, string>> {
  const errors: Partial<Record<NumKey, string>> = {}
  for (const k of NUM_KEYS) {
    const v = input[k]
    const { min, max } = LIMITS[k]
    if (!Number.isFinite(v)) errors[k] = 'Vendos një numër.'
    else if (v < min || v > max) errors[k] = `Duhet të jetë nga ${min} deri ${max}.`
    else if (k !== 'sqm' && !Number.isInteger(v)) errors[k] = 'Duhet të jetë numër i plotë.'
  }
  return errors
}

/** Parse from the URL; returns null when no valuation has been requested yet. */
export function parseInput(sp: URLSearchParams): ValuationInput | null {
  if (!sp.has(URL_KEYS.sqm)) return null
  const out: ValuationInput = { ...DEFAULT_INPUT }
  for (const k of NUM_KEYS) {
    const raw = sp.get(URL_KEYS[k])
    if (raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw))) out[k] = Number(raw)
  }
  const m = sp.get(URL_KEYS.furnishing_status)
  if (m === 'fully_furnished' || m === 'partially_furnished' || m === 'unfurnished') out.furnishing_status = m
  for (const k of BOOL_KEYS) out[k] = sp.get(URL_KEYS[k]) === '1'
  return out
}

export function inputToSearch(input: ValuationInput): string {
  const sp = new URLSearchParams()
  for (const k of NUM_KEYS) sp.set(URL_KEYS[k], String(input[k]))
  if (input.furnishing_status !== 'unknown') sp.set(URL_KEYS.furnishing_status, input.furnishing_status)
  for (const k of BOOL_KEYS) if (input[k]) sp.set(URL_KEYS[k], '1')
  return `?${sp.toString()}`
}

export const toRequest = (input: ValuationInput): PredictRequest => ({ ...input })

/** One-line description of the input, used as the results heading. */
export function describeInput(i: ValuationInput) {
  const parts = [
    `${i.sqm} m²`,
    i.beds === 0 ? 'garsonierë' : `${i.beds} ${i.beds === 1 ? 'dhomë' : 'dhoma'} gjumi`,
    `${i.baths} banjo`,
    i.floor === 0 ? 'përdhe' : `kati ${i.floor}`,
  ]
  const extras = [
    i.has_elevator && 'ashensor', i.has_parking_space && 'parkim', i.has_carport && 'parkim i mbuluar',
    i.has_garage && 'garazh', i.has_terrace && 'tarracë', i.has_garden && 'kopsht',
  ].filter(Boolean)
  return `${parts.join(', ')}${extras.length ? `, me ${extras.join(', ')}` : ''}`
}
