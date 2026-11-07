import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="container grid gap-6 py-10 text-sm text-ink-muted md:grid-cols-[1fr_auto]">
        <p className="max-w-2xl leading-relaxed">
          Të dhënat janë çmime të kërkuara në njoftime shitjeje apartamentesh në Tiranë, të mbledhura një herë në një
          datë që nuk dihet saktë. Nuk janë çmime transaksionesh. Vlerësimet e modelit kanë gabim; shih sa dhe si matet.
        </p>
        <nav aria-label="Lidhje të tjera" className="flex flex-col gap-2 md:items-end">
          <Link href="/rreth-te-dhenave" className="text-ink hover:underline">Rreth të dhënave dhe modelit</Link>
          <a href="https://github.com/egigj-dev/real-estate" className="hover:text-ink hover:underline">Kodi në GitHub</a>
        </nav>
      </div>
    </footer>
  )
}
