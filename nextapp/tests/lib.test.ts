import { describe, expect, it } from 'vitest'
import { fmtEur, fmtEurCompact, fmtPct, fmtSignedPct, fmtSqm } from '@/lib/format'
import { activeFilterChips, EMPTY_FILTERS, filtersToQuery, filtersToSearch, parseFilters } from '@/lib/filters'
import { cleanDescription, distanceLabel, knownPositive, listingTitle, similarityReason } from '@/lib/listing'
import { median, quantile } from '@/lib/stats'
import { DEFAULT_INPUT, inputToSearch, parseInput, validate } from '@/lib/valuation'
import { MIN_CELL_LISTINGS, priceGrid } from '@/lib/geo'
import { rampBreaks, rampClass } from '@/lib/ramp'
import type { ListingSummary } from '@/lib/types'

const NNBSP = ' '

describe('format', () => {
  it('groups thousands with a narrow space and uses a decimal comma', () => {
    expect(fmtEur(483000)).toBe(`483${NNBSP}000 €`)
    expect(fmtSqm(88.14)).toBe('88,1 m²')
    expect(fmtPct(0.134, 1)).toBe('13,4%')
    expect(fmtSignedPct(-0.52)).toBe('−52%')
    expect(fmtEurCompact(1_250_000)).toBe('1,3 mln €')
  })
  it('shows a dash for missing values', () => {
    expect(fmtEur(null)).toBe('—')
    expect(fmtEur(Number.NaN)).toBe('—')
  })
})

describe('filters', () => {
  it('round-trips through the URL', () => {
    const f = { ...EMPTY_FILTERS, zona: 'Qendra A', cmax: 150000, dhoma: 2, ashensor: true, rendit: 'cmimi-rrites' as const, faqja: 3 }
    const search = filtersToSearch(f, 'harta')
    const sp = new URLSearchParams(search)
    expect(sp.get('pamja')).toBe('harta')
    expect(parseFilters(sp)).toEqual(f)
  })
  it('treats unchecked amenities as "any", not "without"', () => {
    const q = filtersToQuery(EMPTY_FILTERS)
    expect(q.has_elevator).toBeUndefined()
    expect(q.furnished).toBeUndefined()
    expect(filtersToQuery({ ...EMPTY_FILTERS, mobilim: 'jo' }).furnished).toBe(false)
  })
  it('ignores invalid numbers in the URL', () => {
    const f = parseFilters(new URLSearchParams('cmin=abc&smax=-5&faqja=0'))
    expect(f.cmin).toBeNull()
    expect(f.smax).toBeNull()
    expect(f.faqja).toBe(1)
  })
  it('describes each active filter once', () => {
    const chips = activeFilterChips({ ...EMPTY_FILTERS, cmin: 50000, cmax: 100000, parkim: true })
    expect(chips.map(c => c.key)).toEqual(['cmimi', 'parkim'])
  })
})

describe('listing text', () => {
  it('removes phone numbers, e-mail addresses and websites', () => {
    const { text, redacted } = cleanDescription(
      'Description\tShitet apartament. Kontakt: 069 427 3672, +355 68 30 10 137, info@agjensia.al, www.pronareger.com',
    )
    expect(redacted).toBe(true)
    expect(text).not.toMatch(/\d{3}\s?\d{3}\s?\d{4}|@|www\./)
    expect(text.startsWith('Shitet')).toBe(true)
  })
  it('keeps prices and areas', () => {
    const { text, redacted } = cleanDescription('Çmimi 12 000 000 lek, 151 m², 3200 €/m²')
    expect(redacted).toBe(false)
    expect(text).toContain('12 000 000 lek')
  })
  it('titles studios and treats zero bathrooms as unknown', () => {
    expect(listingTitle({ beds: 0 })).toBe('Garsonierë')
    expect(listingTitle({ beds: 1 })).toBe('Apartament me 1 dhomë gjumi')
    expect(knownPositive(0)).toBeNull()
    expect(knownPositive(-1)).toBeNull()
    expect(knownPositive(2)).toBe(2)
  })
  it('translates comparable reasons from the API', () => {
    expect(similarityReason('Similar bedroom count, very similar size')).toBe('Numër i afërt dhomash gjumi, sipërfaqe pothuajse e njëjtë')
    expect(distanceLabel('Distance unavailable')).toBe('Distanca nuk dihet')
  })
})

describe('valuation input', () => {
  it('round-trips through the URL and validates ranges', () => {
    const input = { ...DEFAULT_INPUT, sqm: 92.5, has_elevator: true, furnishing_status: 'unfurnished' as const }
    expect(parseInput(new URLSearchParams(inputToSearch(input)))).toEqual(input)
    expect(parseInput(new URLSearchParams(''))).toBeNull()
    expect(validate(input)).toEqual({})
    expect(Object.keys(validate({ ...input, sqm: 5, beds: 1.5 }))).toEqual(['sqm', 'beds'])
  })
})

describe('statistics', () => {
  it('computes interpolated quantiles', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75)
    expect(Number.isNaN(median([]))).toBe(true)
  })
  it('classes values into six ramp steps', () => {
    const breaks = rampBreaks(Array.from({ length: 600 }, (_, i) => i))
    expect(breaks).toHaveLength(5)
    expect(rampClass(-1, breaks)).toBe(0)
    expect(rampClass(10_000, breaks)).toBe(5)
  })
  it('only reports grid cells with enough listings', () => {
    const at = (lat: number, lon: number, i: number): ListingSummary =>
      ({ id: String(i), price: 100_000, sqm: 100, beds: 2, furnished: false, latitude: lat, longitude: lon, price_per_sqm: 1000 + i })
    const dense = Array.from({ length: MIN_CELL_LISTINGS }, (_, i) => at(41.3301, 19.8201, i))
    const sparse = Array.from({ length: MIN_CELL_LISTINGS - 1 }, (_, i) => at(41.4001, 19.9001, i))
    const cells = priceGrid([...dense, ...sparse])
    expect(cells).toHaveLength(1)
    expect(cells[0].n).toBe(MIN_CELL_LISTINGS)
    expect(cells[0].median).toBe(1002)
  })
})
