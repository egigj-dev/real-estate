import { quantile } from './stats'

/** Number of colour classes on maps and legends. */
export const RAMP_STEPS = 5

/** Class boundaries (quintiles): each class holds a fifth of the values. */
export function rampBreaks(values: number[]): number[] {
  return Array.from({ length: RAMP_STEPS - 1 }, (_, i) => quantile(values, (i + 1) / RAMP_STEPS))
}

export function rampClass(value: number, breaks: number[]): number {
  if (!Number.isFinite(value)) return -1
  let i = 0
  while (i < breaks.length && value > breaks[i]) i++
  return i
}
