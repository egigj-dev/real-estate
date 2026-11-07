import type {
  PaginatedListings, ListingDetail, ListingSummary, EstimateResponse, CompsResponse,
  FilterOptions, HealthResponse, ChatParseResponse, PredictResponse, PredictRequest, ListingsQuery,
} from './types'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

/** Error carrying the HTTP status, so pages can tell "not found" and "unavailable" apart. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new ApiError('Shërbimi i të dhënave nuk po përgjigjet. Kontrollo që API-ja është në punë.', 0)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : `HTTP ${res.status}`
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === '' || v === null || v === undefined) continue
    usp.set(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

export const fetchListings = (query: ListingsQuery = {}) =>
  get<PaginatedListings>(`/listings${buildQuery({ per_page: 24, page: 1, ...query })}`)
export const fetchListing = (id: string) => get<ListingDetail>(`/listings/${encodeURIComponent(id)}`)
export const fetchEstimate = (id: string) => get<EstimateResponse>(`/listings/${encodeURIComponent(id)}/estimate`)
export const fetchComps = (id: string) => get<CompsResponse>(`/listings/${encodeURIComponent(id)}/comps`)
export const fetchFilterOptions = () => get<FilterOptions>('/filters/options')
export const fetchHealth = () => get<HealthResponse>('/health')
export const fetchChatParse = (text: string) => post<ChatParseResponse>('/chat/parse', { text })
export const fetchPredictByZone = (body: PredictRequest) => post<PredictResponse>('/predict/by-zone', body)

const MAX_PER_PAGE = 500

/**
 * Every listing matching `query`, fetched in pages of 500.
 * Statistics are computed from the full set rather than a sample.
 */
export async function fetchAllListings(query: ListingsQuery = {}): Promise<ListingSummary[]> {
  const first = await fetchListings({ ...query, per_page: MAX_PER_PAGE, page: 1 })
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) =>
      fetchListings({ ...query, per_page: MAX_PER_PAGE, page: i + 2 })),
  )
  return [first, ...rest].flatMap(p => p.listings)
}

// Session caches for data that doesn't change while the app is open.
let allListingsCache: Promise<ListingSummary[]> | null = null
let healthCache: Promise<HealthResponse> | null = null
let optionsCache: Promise<FilterOptions> | null = null

function cached<T>(get: () => Promise<T> | null, set: (p: Promise<T> | null) => void, load: () => Promise<T>) {
  const existing = get()
  if (existing) return existing
  const p = load().catch(err => { set(null); throw err })
  set(p)
  return p
}

export const getAllListings = () => cached(() => allListingsCache, p => { allListingsCache = p }, () => fetchAllListings())
export const getHealth = () => cached(() => healthCache, p => { healthCache = p }, fetchHealth)
export const getFilterOptions = () => cached(() => optionsCache, p => { optionsCache = p }, fetchFilterOptions)
