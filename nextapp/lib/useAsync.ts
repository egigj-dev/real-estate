'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }

/**
 * Runs `load` whenever `deps` change. Stale responses (from an earlier
 * dependency set) are ignored, so quick filter changes can't render out of order.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    loadRef.current().then(
      data => { if (current) setState({ status: 'success', data }) },
      error => { if (current) setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }) },
    )
    return () => { current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  const retry = useCallback(() => setAttempt(a => a + 1), [])
  return { ...state, retry }
}
