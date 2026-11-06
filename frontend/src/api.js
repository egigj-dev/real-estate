export const API_BASE = import.meta.env?.VITE_API_BASE || 'http://127.0.0.1:8000'

export function formatPrice(value) {
  if (value === null || value === undefined) return 'N/A'
  try { return new Intl.NumberFormat('en-US').format(Math.round(value)) + ' €' }
  catch { return String(value) + ' €' }
}

export function formatBool(value) {
  if (value === true)  return { label: '✓ Po',  cls: 'yes' }
  if (value === false) return { label: '✗ Jo',  cls: 'no'  }
  return { label: '—', cls: '' }
}

export function listingLabel(item) {
  if (item.address && item.address.trim()) return item.address.trim()
  const parts = []
  if (item.property_type) parts.push(item.property_type.charAt(0).toUpperCase() + item.property_type.slice(1))
  if (item.city) parts.push(item.city)
  return parts.join(' · ') || 'Pronë'
}

export async function fetchListings({
  q = '', per_page = 20, page = 1,
  min_price = '', max_price = '',
  min_beds = '', max_beds = '',
  min_baths = '', max_baths = '',
  min_sqm = '', max_sqm = '',
  furnished = '',
  has_elevator = false, has_parking_space = false, has_garden = false,
  neighborhood = '', area_name = '', property_type = '',
  sort = '',
} = {}) {
  const url = new URL(`${API_BASE}/listings`)
  const set = (k, v) => { if (v !== '' && v !== null && v !== undefined) url.searchParams.set(k, String(v)) }
  set('per_page', per_page); set('page', page); set('q', q.trim())
  set('min_price', min_price); set('max_price', max_price)
  set('min_beds', min_beds); set('max_beds', max_beds)
  set('min_baths', min_baths); set('max_baths', max_baths)
  set('min_sqm', min_sqm); set('max_sqm', max_sqm)
  set('sort', sort); set('neighborhood', neighborhood)
  set('area_name', area_name); set('property_type', property_type)
  if (has_elevator)      url.searchParams.set('has_elevator',      'true')
  if (has_parking_space) url.searchParams.set('has_parking_space', 'true')
  if (has_garden)        url.searchParams.set('has_garden',        'true')
  if (furnished !== '')  url.searchParams.set('furnished', furnished)
  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchListing(id) {
  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(id)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchEstimate(id) {
  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(id)}/estimate`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchComps(id) {
  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(id)}/comps`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchSuggestions(features) {
  const res = await fetch(`${API_BASE}/suggest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(features),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchPredictByZone(features) {
  const res = await fetch(`${API_BASE}/predict/by-zone`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(features),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchChatParse(text) {
  const res = await fetch(`${API_BASE}/chat/parse`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Added for the dashboard redesign (Overview / Map / Insights pages) ────────
// No backend changes required — these just call endpoints that already exist.

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchFilterOptions() {
  const res = await fetch(`${API_BASE}/filters/options`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchAreas() {
  const res = await fetch(`${API_BASE}/areas`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchMarketInsights() {
  const res = await fetch(`${API_BASE}/market/insights`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// Pulls a large, single page of listings so the dashboard can compute
// per-area averages (price / m²) client-side. /market/insights groups by the
// ML "neighborhood" zone (3–6 clusters), not by the real OSM "area_name", so
// for the area-level price map we aggregate from raw listings instead.
// This is a SAMPLE (capped at the API's MAX_PER_PAGE), not the full dataset,
// when total listings exceed the cap — good enough for an at-a-glance map,
// not a substitute for a real backend aggregation-by-area endpoint.
export async function fetchListingsSample(per_page = 500) {
  return fetchListings({ per_page, page: 1 })
}