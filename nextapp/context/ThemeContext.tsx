"use client"
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  // IMPORTANT: this must start as 'light' on every render path, server or
  // client — the server has no `document` at all, so it can only ever
  // render assuming 'light'. Reading the live data-theme attribute (set by
  // the inline script in app/layout.tsx) here during the initial render
  // would make the client's first pass diverge from what the server sent,
  // which is exactly a React hydration mismatch.
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Runs only after hydration completes — safe to diverge from the
  // server-rendered value here, this is a normal post-mount update, not
  // part of the hydration reconciliation.
  useEffect(() => {
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'dark' || attr === 'light') setTheme(attr)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.setAttribute('data-theme', theme)
    try { window.localStorage.setItem('tirana-theme', theme) } catch { /* ignore */ }
  }, [theme, mounted])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
