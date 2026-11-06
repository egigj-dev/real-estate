import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import AppShellClient from '@/components/layout/AppShellClient'

export const metadata: Metadata = {
  title: 'Tirana Real Estate Explorer',
  description: 'Të dhëna konkrete, vlerësime ML, dhe analizë e zonave për tregun e pronave në Tiranë.',
}

const themeInitScript = `
(function() {
  try {
    var saved = window.localStorage.getItem('tirana-theme');
    var theme = (saved === 'light' || saved === 'dark') ? saved : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AppShellClient>{children}</AppShellClient>
        </ThemeProvider>
      </body>
    </html>
  )
}
