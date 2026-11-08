'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const NAV = [
  { href: '/', label: 'Përmbledhje' },
  { href: '/pronat', label: 'Eksploro pronat' },
  { href: '/vleresimi', label: 'Vlerëso pronën' },
  { href: '/tregu', label: 'Analiza e tregut' },
] as const

const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

function ThemeToggle() {
  // The inline script in the root layout sets data-theme before paint; read it after mount.
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('tirana-theme', next) } catch { /* storage unavailable */ }
    setTheme(next)
  }
  const label = theme === 'dark' ? 'Kalo në pamjen e çelët' : 'Kalo në pamjen e errët'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded text-ink-muted hover:bg-surface-sunken hover:text-ink"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  )
}

export default function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="sticky top-0 z-[1100] border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
      <div className="container flex h-16 items-center gap-8">
        <Link href="/" className="flex shrink-0 items-baseline gap-2 rounded" aria-label="Prona në Tiranë, faqja kryesore">
          <span className="font-serif text-xl text-ink">Prona në Tiranë</span>
        </Link>

        <nav aria-label="Navigimi kryesor" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {NAV.map(item => {
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex h-16 items-center px-3 text-sm transition-colors',
                      active ? 'font-medium text-ink' : 'text-ink-muted hover:text-ink',
                      active && 'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded text-ink hover:bg-surface-sunken md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Mbyll menunë' : 'Hap menunë'}
            onClick={() => setOpen(o => !o)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Navigimi kryesor" className="border-t border-line bg-canvas md:hidden">
          <ul className="container py-2">
            {NAV.map(item => {
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn('block rounded px-2 py-3 text-base', active ? 'font-medium text-ink' : 'text-ink-muted')}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </header>
  )
}
