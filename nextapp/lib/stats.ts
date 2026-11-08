import type { ListingSummary } from './types'

/** Linear-interpolated quantile of an unsorted array (q in 0..1). */
export function quantile(values: number[], q: number): number {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!xs.length) return NaN
  const pos = (xs.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)
}

export const median = (values: number[]) => quantile(values, 0.5)

/**
 * Approximate 95% confidence interval for the median, from order statistics
 * (normal approximation to the binomial). Needs at least 8 values.
 */
export function medianInterval(values: number[]): [number, number] {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b)
  const n = xs.length
  if (n < 8) return [NaN, NaN]
  const half = 1.96 * Math.sqrt(n) / 2
  const lo = Math.max(0, Math.floor(n / 2 - half))
  const hi = Math.min(n - 1, Math.ceil(n / 2 + half) - 1)
  return [xs[lo], xs[hi]]
}

export interface Summary {
  n: number
  medianPrice: number
  medianPpsqm: number
  p25Ppsqm: number
  p75Ppsqm: number
  medianSqm: number
}

export const ppsqm = (l: ListingSummary) =>
  l.price_per_sqm != null && Number.isFinite(l.price_per_sqm) ? l.price_per_sqm : l.sqm > 0 ? l.price / l.sqm : NaN

export function summarize(listings: ListingSummary[]): Summary {
  const p = listings.map(ppsqm)
  return {
    n: listings.length,
    medianPrice: median(listings.map(l => l.price)),
    medianPpsqm: median(p),
    p25Ppsqm: quantile(p, 0.25),
    p75Ppsqm: quantile(p, 0.75),
    medianSqm: median(listings.map(l => l.sqm)),
  }
}

export function groupBy<T>(items: T[], key: (t: T) => string | null | undefined): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (k == null) continue
    const list = out.get(k)
    if (list) list.push(item)
    else out.set(k, [item])
  }
  return out
}

/** Equal-width histogram bins between lo and hi; values outside are clamped into the end bins. */
export function histogram(values: number[], lo: number, hi: number, bins: number) {
  const width = (hi - lo) / bins
  const counts = new Array(bins).fill(0)
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / width)))
    counts[i]++
  }
  return counts.map((count, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count }))
}
