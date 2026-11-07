import type { ListingsQuery } from './types'
import { fmtEur } from './format'

/**
 * Explore filters as they appear in the URL. Keys are short Albanian words so
 * shared links stay readable: /pronat?zona=Qendra+A&dhoma=2&cmax=150000
 */
export interface Filters {
  q: string
  zona: string
  cmin: number | null
  cmax: number | null
  smin: number | null
  smax: number | null
  dhoma: number | null   // minimum bedrooms
  banjo: number | null   // minimum bathrooms
  ashensor: boolean
  parkim: boolean
  kopsht: boolean
  mobilim: 'po' | 'jo' | ''
  rendit: Sort
  faqja: number
}

export type Sort = '' | 'cmimi-rrites' | 'cmimi-zbrites'
export type View = 'lista' | 'harta'

export const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: '', label: 'Renditja e të dhënave' },
  { value: 'cmimi-rrites', label: 'Çmimi: nga më i ulëti' },
  { value: 'cmimi-zbrites', label: 'Çmimi: nga më i larti' },
]

export const EMPTY_FILTERS: Filters = {
  q: '', zona: '', cmin: null, cmax: null, smin: null, smax: null, dhoma: null, banjo: null,
  ashensor: false, parkim: false, kopsht: false, mobilim: '', rendit: '', faqja: 1,
}

const num = (v: string | null) => {
  if (v === null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function parseFilters(sp: URLSearchParams): Filters {
  const rendit = sp.get('rendit')
  const mobilim = sp.get('mobilim')
  return {
    q: sp.get('q') ?? '',
    zona: sp.get('zona') ?? '',
    cmin: num(sp.get('cmin')),
    cmax: num(sp.get('cmax')),
    smin: num(sp.get('smin')),
    smax: num(sp.get('smax')),
    dhoma: num(sp.get('dhoma')),
    banjo: num(sp.get('banjo')),
    ashensor: sp.get('ashensor') === '1',
    parkim: sp.get('parkim') === '1',
    kopsht: sp.get('kopsht') === '1',
    mobilim: mobilim === 'po' || mobilim === 'jo' ? mobilim : '',
    rendit: rendit === 'cmimi-rrites' || rendit === 'cmimi-zbrites' ? rendit : '',
    faqja: Math.max(1, Math.floor(num(sp.get('faqja')) ?? 1)),
  }
}

/** Serialise filters (plus view) back to a query string, omitting defaults. */
export function filtersToSearch(f: Filters, view: View): string {
  const sp = new URLSearchParams()
  if (f.q.trim()) sp.set('q', f.q.trim())
  if (f.zona) sp.set('zona', f.zona)
  for (const k of ['cmin', 'cmax', 'smin', 'smax', 'dhoma', 'banjo'] as const) {
    const v = f[k]
    if (v !== null) sp.set(k, String(v))
  }
  if (f.ashensor) sp.set('ashensor', '1')
  if (f.parkim) sp.set('parkim', '1')
  if (f.kopsht) sp.set('kopsht', '1')
  if (f.mobilim) sp.set('mobilim', f.mobilim)
  if (f.rendit) sp.set('rendit', f.rendit)
  if (f.faqja > 1) sp.set('faqja', String(f.faqja))
  if (view === 'harta') sp.set('pamja', 'harta')
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** Map URL filters to the API's query parameters. Unchecked amenities mean "any", not "without". */
export function filtersToQuery(f: Filters): ListingsQuery {
  return {
    q: f.q.trim() || undefined,
    neighborhood: f.zona || undefined,
    min_price: f.cmin ?? undefined,
    max_price: f.cmax ?? undefined,
    min_sqm: f.smin ?? undefined,
    max_sqm: f.smax ?? undefined,
    min_beds: f.dhoma ?? undefined,
    min_baths: f.banjo ?? undefined,
    has_elevator: f.ashensor || undefined,
    has_parking_space: f.parkim || undefined,
    has_garden: f.kopsht || undefined,
    furnished: f.mobilim === 'po' ? true : f.mobilim === 'jo' ? false : undefined,
    sort: f.rendit === 'cmimi-rrites' ? 'price_asc' : f.rendit === 'cmimi-zbrites' ? 'price_desc' : undefined,
  }
}

/** Human-readable chips for the active filters, each with the change that removes it. */
export function activeFilterChips(f: Filters): { key: string; label: string; clear: Partial<Filters> }[] {
  const eur = (v: number) => fmtEur(v)
  const chips: { key: string; label: string; clear: Partial<Filters> }[] = []
  if (f.q.trim()) chips.push({ key: 'q', label: `Përshkrimi përmban “${f.q.trim()}”`, clear: { q: '' } })
  if (f.zona) chips.push({ key: 'zona', label: f.zona, clear: { zona: '' } })
  if (f.cmin !== null || f.cmax !== null) {
    const label = f.cmin !== null && f.cmax !== null ? `${eur(f.cmin)} – ${eur(f.cmax)}` : f.cmin !== null ? `Nga ${eur(f.cmin)}` : `Deri ${eur(f.cmax!)}`
    chips.push({ key: 'cmimi', label, clear: { cmin: null, cmax: null } })
  }
  if (f.smin !== null || f.smax !== null) {
    const label = f.smin !== null && f.smax !== null ? `${f.smin}–${f.smax} m²` : f.smin !== null ? `Nga ${f.smin} m²` : `Deri ${f.smax} m²`
    chips.push({ key: 'siperfaqja', label, clear: { smin: null, smax: null } })
  }
  if (f.dhoma !== null) chips.push({ key: 'dhoma', label: `${f.dhoma}+ dhoma gjumi`, clear: { dhoma: null } })
  if (f.banjo !== null) chips.push({ key: 'banjo', label: `${f.banjo}+ banjo`, clear: { banjo: null } })
  if (f.ashensor) chips.push({ key: 'ashensor', label: 'Me ashensor', clear: { ashensor: false } })
  if (f.parkim) chips.push({ key: 'parkim', label: 'Me vend parkimi', clear: { parkim: false } })
  if (f.kopsht) chips.push({ key: 'kopsht', label: 'Me kopsht', clear: { kopsht: false } })
  if (f.mobilim) chips.push({ key: 'mobilim', label: f.mobilim === 'po' ? 'E mobiluar' : 'Jo e mobiluar ose pa informacion', clear: { mobilim: '' } })
  return chips
}
