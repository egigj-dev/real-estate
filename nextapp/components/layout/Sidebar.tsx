"use client"
import Link from "next/link"
import { Building2, LayoutDashboard, Compass, Map, Search, Target, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import Sparkline from "../charts/Sparkline"

const NAV_ITEMS = [
  { href: "/",          label: "Përmbledhje",          Icon: LayoutDashboard },
  { href: "/explore",   label: "Eksploro",              Icon: Compass },
  { href: "/map",       label: "Harta",                 Icon: Map },
  { href: "/find",      label: "Gjej Pronën",           Icon: Search },
  { href: "/predict",   label: "Parashiko sipas Zonës", Icon: Target },
  { href: "/insights",  label: "Tregu",                 Icon: BarChart3 },
]

export default function Sidebar({ pathname, listingsCount }: { pathname: string; listingsCount: number | null }) {
  return (
    <aside className="flex h-screen w-[258px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-4 py-5">
      <Link href="/" className="mb-5 flex items-center gap-2.5 rounded-md px-1.5 py-1 text-left">
        <Building2 className="h-5 w-5 text-foreground" />
        <div>
          <div className="text-[15px] font-bold leading-tight text-foreground">Tirana</div>
          <div className="text-[9.5px] font-semibold tracking-wider text-muted-foreground">
            REAL ESTATE EXPLORER
          </div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-accent font-semibold text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground">Tregu u përditësua</span>
            <Sparkline seed="footer-card" trend="up" width={56} height={20} />
          </div>
          <div className="text-[11px] text-muted-foreground">Modeli: XGBoost</div>
          <div className="text-[11px] text-muted-foreground">
            {listingsCount != null ? listingsCount.toLocaleString() : "—"} prona u analizuan
          </div>
        </div>
      </div>
    </aside>
  )
}
