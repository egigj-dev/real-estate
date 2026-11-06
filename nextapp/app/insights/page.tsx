"use client"
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import Sparkline from "@/components/charts/Sparkline"
import { fetchMarketInsights } from "@/lib/api"
import type { MarketInsights } from "@/lib/types"

const ZoneBarChart = dynamic(() => import("@/components/charts/ZoneBarChart"), { ssr: false })

function PulseItem({ label, value, trend, deltaLabel, seed, placeholder }: {
  label: string; value: string; trend: "up" | "down"; deltaLabel: string; seed: string; placeholder?: boolean
}) {
  const Icon = trend === "up" ? TrendingUp : TrendingDown
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
        {label}
        {placeholder && <span className="text-muted-foreground/60" title="Vlerë ilustruese — lidhet me të dhëna reale së shpejti"> ●</span>}
      </div>
      <div className="text-[14.5px] font-bold text-foreground">{value}</div>
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-0.5 text-[10.5px] font-semibold ${trend === "up" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
          <Icon className="h-3 w-3" /> {deltaLabel}
        </span>
        <Sparkline seed={seed} trend={trend} width={56} height={20} />
      </div>
    </div>
  )
}

export default function InsightsPage() {
  const router = useRouter()
  const [data, setData] = useState<MarketInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchMarketInsights()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const sortedByPpsqm = useMemo(
    () => [...(data?.neighborhoods ?? [])].sort((a, b) => b.avg_price_per_sqm - a.avg_price_per_sqm),
    [data]
  )

  return (
    <>
      <PageHeader title="Tregu i Pronave" subtitle="Statistika çmimi sipas zonës ML, bazuar drejtpërdrejt në modelin e të dhënave." />

      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="py-16 text-center text-sm text-muted-foreground">Duke ngarkuar statistikat e tregut…</div>}

      {data && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Card className="p-4.5"><div className="text-xs text-muted-foreground">Çmimi Mesatar (median)</div><div className="mt-1.5 text-2xl font-bold text-foreground">{Math.round(data.overall_median_price).toLocaleString()} €</div></Card>
            <Card className="p-4.5"><div className="text-xs text-muted-foreground">Çmimi/m² (median)</div><div className="mt-1.5 text-2xl font-bold text-foreground">{Math.round(data.overall_median_price_per_sqm).toLocaleString()} €</div></Card>
            <Card className="p-4.5"><div className="text-xs text-muted-foreground">Zona ML të Analizuara</div><div className="mt-1.5 text-2xl font-bold text-foreground">{data.neighborhood_count}</div></Card>
          </div>

          <Card className="mb-5">
            <CardContent className="p-5">
              <div className="mb-3.5 text-[15px] font-semibold text-foreground">Pulsi i Tregut</div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <PulseItem label="Çmimi Mesatar" value={`${Math.round(data.overall_median_price_per_sqm).toLocaleString()} €/m²`} trend="up" deltaLabel="+4.6% në vit" seed="avg-price" placeholder />
                <PulseItem label="Rritja më e Lartë" value={sortedByPpsqm[0]?.neighborhood ?? "—"} trend="up" deltaLabel="+22.8% në vit" seed="growth" placeholder />
                <PulseItem label="Më e Nënvlerësuara" value={sortedByPpsqm[sortedByPpsqm.length - 1]?.neighborhood ?? "—"} trend="down" deltaLabel="-12% nën çmimin e drejtë" seed="undervalued" placeholder />
                <PulseItem label="Rendimenti më i Mirë" value={sortedByPpsqm[1]?.neighborhood ?? "—"} trend="up" deltaLabel="5.7% rendiment mesatar" seed="yield" placeholder />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-5">
            <CardContent className="p-5">
              <div className="mb-1 text-[15px] font-semibold text-foreground">Çmimi mesatar / m² sipas Zonës</div>
              <p className="mb-4 text-xs text-muted-foreground">Renditur nga më e lira tek më e shtrenjta</p>
              <ZoneBarChart data={sortedByPpsqm} height={Math.max(220, sortedByPpsqm.length * 38)} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-3.5 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="w-6" />
              <span className="flex-[1.4]">Zona</span>
              <span className="w-24 text-right">Çmimi mes.</span>
              <span className="w-20 text-right">Prona</span>
            </div>
            {sortedByPpsqm.map((n, i) => (
              <div
                key={n.neighborhood}
                onClick={() => router.push(`/explore?area=${encodeURIComponent(n.neighborhood)}`)}
                className="flex cursor-pointer items-center gap-3.5 border-b border-border px-5 py-3 transition-colors last:border-b-0 hover:bg-accent"
              >
                <span className="w-6 text-xs font-bold text-muted-foreground">{i + 1}</span>
                <span className="flex-[1.4] text-sm font-semibold text-foreground">{n.neighborhood}</span>
                <span className="w-24 text-right text-sm text-muted-foreground">{Math.round(n.avg_price).toLocaleString()} €</span>
                <span className="w-20 text-right text-sm text-muted-foreground">{n.listing_count.toLocaleString()}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}
