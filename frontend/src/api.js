export const API_BASE = 'http://127.0.0.1:8000'

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatPrice(value) {
  if (value === null || value === undefined) return 'N/A'
  try {
    return new Intl.NumberFormat('en-US').format(Math.round(value)) + ' €'
  } catch {
    return String(value) + ' €'
  }
}

export function formatBool(value) {
  if (value === true)  return { label: '✓ Po',  cls: 'yes' }
  if (value === false) return { label: '✗ Jo',  cls: 'no'  }
  return { label: '—', cls: '' }
}

/**
 * Build a human-readable location label for a listing.
 * Priority: real formatted address → city → property_type only
 * Never shows the internal "Cluster X" ML label.
 */
export function listingLabel(item) {
  // Use the real street/zone address if available
  if (item.address && item.address.trim()) {
    return item.address.trim()
  }
  // Fallback: property type + city
  const parts = []
  if (item.property_type) parts.push(
    item.property_type.charAt(0).toUpperCase() + item.property_type.slice(1)
  )
  if (item.city) parts.push(item.city)
  return parts.join(' · ') || 'Pronë'
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * GET /listings  — all param names match the backend exactly.
 *
 * Backend query params:
 *   q, per_page, page,
 *   min_price, max_price,
 *   min_beds, max_beds,
 *   min_baths, max_baths,
 *   min_sqm, max_sqm,
 *   furnished (bool),
 *   has_elevator, has_parking_space, has_garden (bool),
 *   neighborhood, property_type,
 *   sort ('price_asc' | 'price_desc')
 *
 * Returns: { total, page, per_page, pages, listings: [...] }
 */
export async function fetchListings({
  q                = '',
  per_page         = 20,
  page             = 1,
  min_price        = '',
  max_price        = '',
  min_beds         = '',
  max_beds         = '',
  min_baths        = '',
  max_baths        = '',
  min_sqm          = '',
  max_sqm          = '',
  furnished        = '',   // '' | 'true' | 'false'
  has_elevator     = false,
  has_parking_space = false,
  has_garden       = false,
  neighborhood     = '',
  property_type    = '',
  sort             = '',   // '' | 'price_asc' | 'price_desc'
} = {}) {
  const url = new URL(`${API_BASE}/listings`)

  const set = (k, v) => {
    if (v !== '' && v !== null && v !== undefined) {
      url.searchParams.set(k, String(v))
    }
  }

  set('per_page',  per_page)
  set('page',      page)
  set('q',         q.trim())
  set('min_price', min_price)
  set('max_price', max_price)
  set('min_beds',  min_beds)
  set('max_beds',  max_beds)
  set('min_baths', min_baths)
  set('max_baths', max_baths)
  set('min_sqm',   min_sqm)
  set('max_sqm',   max_sqm)
  set('sort',      sort)
  set('neighborhood',  neighborhood)
  set('property_type', property_type)

  // Boolean amenity filters — only send when true
  if (has_elevator)      url.searchParams.set('has_elevator',      'true')
  if (has_parking_space) url.searchParams.set('has_parking_space', 'true')
  if (has_garden)        url.searchParams.set('has_garden',        'true')

  // Furnished: '' = no filter, 'true' = furnished, 'false' = unfurnished
  if (furnished !== '') url.searchParams.set('furnished', furnished)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()   // { total, page, per_page, pages, listings: [...] }
}

/** GET /listings/:id */
export async function fetchListing(id) {
  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** GET /listings/:id/estimate → { listing_id, estimated_price, range_low, range_high, label } */
export async function fetchEstimate(id) {
  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(id)}/estimate`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** GET /listings/:id/comps → { listing_id, comps: [{id, price, sqm, rooms, distance_label, similarity_reason}] } */
export async function fetchComps(id) {
  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(id)}/comps`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}