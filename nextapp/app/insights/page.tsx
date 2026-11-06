"use client"
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Minus } from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { fetchMarketInsights } from "@/lib/api"
import type { MarketInsights } from "@/lib/types"

const ZoneBarChart = dynamic(() => import("@/components/charts/ZoneBarChart"), { ssr: false })

function StatItem({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className="text-[14.5px] font-bold text-foreground">{value}</div>
      <div className="text-[10.5px] text-muted-foreground">{note}</div>
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
  const top = sortedByPpsqm[0]
  const bottom = sortedByPpsqm[sortedByPpsqm.length - 1]

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
                <StatItem label="Çmimi Mesatar" value={`${Math.round(data.overall_median_price_per_sqm).toLocaleString()} €/m²`} note="mediana e të gjitha pronave" />
                <StatItem label="Zona më e Shtrenjtë" value={top?.neighborhood ?? "—"} note={top ? `${Math.round(top.avg_price_per_sqm).toLocaleString()} €/m² mesatarisht` : ""} />
                <StatItem label="Zona më e Lirë" value={bottom?.neighborhood ?? "—"} note={bottom ? `${Math.round(bottom.avg_price_per_sqm).toLocaleString()} €/m² mesatarisht` : ""} />
                <StatItem label="Diferenca e Çmimit" value={top && bottom ? `×${(top.avg_price_per_sqm / bottom.avg_price_per_sqm).toFixed(1)}` : "—"} note="€/m²: zona më e shtrenjtë ndaj më të lirës" />
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
