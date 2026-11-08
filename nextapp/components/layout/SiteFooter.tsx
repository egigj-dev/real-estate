import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="container flex flex-col gap-2 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Prona në Tiranë · Çmime të kërkuara nga njoftimet, jo çmime shitjeje.</p>
        <nav aria-label="Lidhje të tjera" className="flex gap-5">
          <Link href="/rreth-te-dhenave" className="hover:text-ink hover:underline">Rreth të dhënave</Link>
          <a href="https://github.com/egigj-dev/real-estate" className="hover:text-ink hover:underline">GitHub</a>
        </nav>
      </div>
    </footer>
  )
}
