import { useEffect, useRef, useState } from 'react'

// Smoothly tweens `value` whenever it changes, instead of having numbers
// snap instantly when switching zones. Pure requestAnimationFrame, no deps.
export default function useAnimatedNumber(value: number, duration = 350): number {
  const [display, setDisplay] = useState(value ?? 0)
  const fromRef = useRef(value ?? 0)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (value == null || Number.isNaN(value)) return
    const from = fromRef.current
    const to = value
    if (from === to) return

    const start = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return display
}
