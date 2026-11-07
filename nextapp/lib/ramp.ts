import { quantile } from './stats'

/** Six-step class breaks (quintile-like) for €/m², shared by maps and legends. */
export function rampBreaks(values: number[]): number[] {
  return [1, 2, 3, 4, 5].map(i => quantile(values, i / 6))
}

export function rampClass(value: number, breaks: number[]): number {
  if (!Number.isFinite(value)) return -1
  let i = 0
  while (i < breaks.length && value > breaks[i]) i++
  return i
}
