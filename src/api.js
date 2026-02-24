export const API_BASE = 'http://localhost:8000'

export function formatPrice(value) {
  if (value === null || value === undefined) return 'N/A'
  try {
    return new Intl.NumberFormat('en-US').format(value) + ' €'
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
 * Fetch listings using the native Fetch API.
 * All active filters are appended as URL query params.
 */
export async function fetchListings({
  q         = '',
  limit     = 20,
  sqm_min   = '',
  sqm_max   = '',
  bedrooms  = '',
  price_min = '',
  price_max = '',
  baths     = '',
  elevator  = '',
  garden    = '',
  parking   = '',
  furnished = '',   // 'furnished' | 'unfurnished' | 'partly_furnished' | ''
  sort      = '',   // 'price_asc' | 'price_desc' | ''
  custom    = '',   // free-text custom filter
} = {}) {
  const url = new URL(`${API_BASE}/listings`)

  const append = (key, val) => {
    if (val !== '' && val !== null && val !== undefined) {
      url.searchParams.set(key, String(val))
    }
  }

  append('limit',     isNaN(Number(limit)) ? 20 : limit)
  append('q',         q.trim())
  append('sqm_min',   sqm_min)
  append('sqm_max',   sqm_max)
  append('bedrooms',  bedrooms)
  append('price_min', price_min)
  append('price_max', price_max)
  append('baths',     baths)
  append('elevator',  elevator)
  append('garden',    garden)
  append('parking',   parking)
  append('furnished', furnished)
  append('sort',      sort)
  append('custom',    custom.trim())

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchListing(id) {
  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
