import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import DataNotice from '@/components/layout/DataNotice'

const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' })
const serif = Source_Serif_4({ subsets: ['latin', 'latin-ext'], variable: '--font-serif', weight: ['400', '600'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Prona në Tiranë', template: '%s · Prona në Tiranë' },
  description: 'Njoftime shitjeje apartamentesh në Tiranë, krahasuar me një model vlerësimi dhe me zonat e qytetit.',
}

// Applies the saved or system theme before first paint, so there's no flash.
const themeInit = `(function(){try{var t=localStorage.getItem('tirana-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow-overlay"
        >
          Kalo te përmbajtja
        </a>
        <SiteHeader />
        <DataNotice />
        <main id="main" tabIndex={-1} className="container flex-1 py-8 focus:outline-none md:py-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
