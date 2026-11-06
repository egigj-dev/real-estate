import type {
  PaginatedListings, ListingDetail, EstimateResponse, CompsResponse,
  MarketInsights, FilterOptions, Area, HealthResponse, ChatParseResponse,
  SuggestResponse, PredictResponse, PredictRequest, SuggestRequest, ListingsQuery,
} from './types'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status} on ${path}`)
  }
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status} on ${path}`)
  }
  return res.json() as Promise<T>
}

function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === '' || v === null || v === undefined) return
    usp.set(k, String(v))
  })
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A'
  try { return new Intl.NumberFormat('en-US').format(Math.round(value)) + ' €' }
  catch { return String(value) + ' €' }
}

export function listingLabel(item: { address?: string | null; property_type?: string | null; city?: string | null }): string {
  if (item.address && item.address.trim()) return item.address.trim()
  const parts: string[] = []
  if (item.property_type) parts.push(item.property_type.charAt(0).toUpperCase() + item.property_type.slice(1))
  if (item.city) parts.push(item.city)
  return parts.join(' · ') || 'Pronë'
}

export const fetchListings = (query: ListingsQuery = {}) =>
  get<PaginatedListings>(`/listings${buildQuery({ per_page: 20, page: 1, ...query })}`)

export const fetchListing = (id: string) => get<ListingDetail>(`/listings/${encodeURIComponent(id)}`)
export const fetchEstimate = (id: string) => get<EstimateResponse>(`/listings/${encodeURIComponent(id)}/estimate`)
export const fetchComps = (id: string) => get<CompsResponse>(`/listings/${encodeURIComponent(id)}/comps`)
export const fetchMarketInsights = () => get<MarketInsights>('/market/insights')
export const fetchFilterOptions = () => get<FilterOptions>('/filters/options')
export const fetchAreas = () => get<Area[]>('/areas')
export const fetchHealth = () => get<HealthResponse>('/health')
export const fetchChatParse = (text: string) => post<ChatParseResponse>('/chat/parse', { text })
export const fetchSuggestions = (body: SuggestRequest) => post<SuggestResponse>('/suggest', body)
export const fetchPredictByZone = (body: PredictRequest) => post<PredictResponse>('/predict/by-zone', body)

// Pulls a large single page of listings so the dashboard can compute
// per-area averages client-side. /market/insights groups by the ML
// "neighborhood" zone (3–6 clusters), not the real OSM "area_name", so for
// area-level aggregation we use raw listings instead. This is a SAMPLE
// (capped at the API's MAX_PER_PAGE), not the full dataset, when total
// listings exceed the cap.
export const fetchListingsSample = (per_page = 500) => fetchListings({ per_page, page: 1 })
