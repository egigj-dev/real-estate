import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} })

function getInitialTheme() {
  try {
    const saved = window.localStorage.getItem('tirana-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to default
  }
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { window.localStorage.setItem('tirana-theme', theme) } catch { /* ignore */ }
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
