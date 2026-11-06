"use client"
import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { TreePine, Building2, Home as HomeIcon, TrendingUp, Gem, ArrowRight } from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"
import ZoneInfoPanel, { type ZoneData, type ZoneInsight } from "@/components/ZoneInfoPanel"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchHealth, fetchAreas, fetchMarketInsights, fetchListingsSample } from "@/lib/api"
import type { Area, ListingSummary, HealthResponse } from "@/lib/types"

const ZoneMap = dynamic(() => import("@/components/ZoneMap"), { ssr: false })

const TIRANA_CENTER: [number, number] = [41.3275, 19.8187]

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, d2r = Math.PI / 180
  const dLat = (lat2 - lat1) * d2r, dLon = (lon2 - lon1) * d2r
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildInsights({ distanceKm, avgBeds, deltaPct }: { distanceKm: number | null; avgBeds: number | null; deltaPct: number | null }): ZoneInsight[] {
  const out: ZoneInsight[] = []
  if (distanceKm != null) {
    if (distanceKm > 6) out.push({ Icon: TreePine, text: "Zonë e gjelbër, larg zhurmës së qendrës" })
    else if (distanceKm > 3) out.push({ Icon: Building2, text: "Zonë periferike dhe e qetë" })
    else out.push({ Icon: Building2, text: "Zonë qendrore, jetë urbane aktive" })
  }
  if (avgBeds != null) {
    if (avgBeds >= 2.4) out.push({ Icon: HomeIcon, text: "Kryesisht banesa familjare" })
    else if (avgBeds <= 1.4) out.push({ Icon: Building2, text: "Kryesisht studio dhe apartamente të vogla" })
  }
  if (deltaPct != null) {
    if (deltaPct < -10) out.push({ Icon: TrendingUp, text: "Çmim nën mesataren e qytetit — potencial investimi" })
    else if (deltaPct > 25) out.push({ Icon: Gem, text: "Zonë premium, e qëndrueshme në kërkesë" })
  }
  return out.slice(0, 3)
}

function buildZoneData(areas: Area[], sample: ListingSummary[], overallMedianPpsqm: number | null): ZoneData[] {
  type Bucket = { sumPpsqm: number; countPpsqm: number; sumSqm: number; countSqm: number; sumBeds: number; countBeds: number; count: number }
  const buckets: Record<string, Bucket> = {}

  sample.forEach((l) => {
    const name = l.area_name
    if (!name || name === "E panjohur") return
    if (!buckets[name]) buckets[name] = { sumPpsqm: 0, countPpsqm: 0, sumSqm: 0, countSqm: 0, sumBeds: 0, countBeds: 0, count: 0 }
    const b = buckets[name]
    b.count += 1
    if (l.price_per_sqm != null && isFinite(l.price_per_sqm)) { b.sumPpsqm += l.price_per_sqm; b.countPpsqm += 1 }
    if (l.sqm != null && isFinite(l.sqm)) { b.sumSqm += l.sqm; b.countSqm += 1 }
    if (l.beds != null && isFinite(l.beds)) { b.sumBeds += l.beds; b.countBeds += 1 }
  })

  const counts = Object.values(buckets).map((b) => b.count)
  const maxCount = Math.max(1, ...counts)
  const minCount = counts.length ? Math.min(...counts) : 0

  const areaByName: Record<string, Area> = {}
  areas.forEach((a) => { areaByName[a.name] = a })

  return Object.entries(buckets).map(([name, b]) => {
    const price = b.countPpsqm ? b.sumPpsqm / b.countPpsqm : null
    const avgSqm = b.countSqm ? b.sumSqm / b.countSqm : null
    const avgBeds = b.countBeds ? b.sumBeds / b.countBeds : null
    const deltaPct = price != null && overallMedianPpsqm ? ((price - overallMedianPpsqm) / overallMedianPpsqm) * 100 : null

    const bbox = areaByName[name]?.bbox
    const distanceKm = bbox
      ? haversineKm(TIRANA_CENTER[0], TIRANA_CENTER[1], (bbox.min_lat + bbox.max_lat) / 2, (bbox.min_lon + bbox.max_lon) / 2)
      : null

    const activityScore = maxCount > minCount ? ((b.count - minCount) / (maxCount - minCount)) * 10 : 5

    return {
      name, price, listingCount: b.count, avgSqm, avgBeds, deltaPct, activityScore,
      insights: buildInsights({ distanceKm, avgBeds, deltaPct }),
    }
  })
}

function NeighborhoodCard({ name, price, count, rank, onClick }: { name: string; price: number; count: number; rank: number; onClick: () => void }) {
  const hue = 215 - Math.min(rank, 5) * 8
  return (
    <Card onClick={onClick} className="cursor-pointer overflow-hidden transition-transform hover:-translate-y-0.5 hover:border-primary/40">
      <div
        className="flex h-20 items-center justify-center text-white/85"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 25% 30%), hsl(${hue + 8} 18% 46%))` }}
      >
        <Building2 className="h-6 w-6" />
      </div>
      <CardContent className="p-3">
        <div className="text-sm font-semibold text-foreground">{name}</div>
        <div className="text-sm font-bold text-primary">{Math.round(price).toLocaleString()} €/m²</div>
        <div className="text-[10.5px] text-muted-foreground">{count} prona në kampion</div>
      </CardContent>
    </Card>
  )
}

export default function OverviewPage() {
  const router = useRouter()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [insights, setInsights] = useState<{ overall_median_price_per_sqm: number } | null>(null)
  const [sample, setSample] = useState<ListingSummary[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hoveredArea, setHoveredArea] = useState<string | null>(null)
  const [pinnedArea, setPinnedArea] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetchHealth().catch(() => null),
      fetchAreas().catch(() => []),
      fetchMarketInsights().catch(() => null),
      fetchListingsSample(500).catch(() => null),
    ]).then(([h, a, mi, sampleRes]) => {
      if (!alive) return
      setHealth(h)
      setAreas(a || [])
      setInsights(mi)
      setSample(sampleRes?.listings ?? [])
    }).catch((e) => alive && setLoadError(e.message))
    return () => { alive = false }
  }, [])

  const avgPricePerSqm = insights?.overall_median_price_per_sqm ?? null
  const zoneData = useMemo(() => buildZoneData(areas, sample, avgPricePerSqm), [areas, sample, avgPricePerSqm])

  const priceByArea = useMemo(() => {
    const m: Record<string, number> = {}
    zoneData.forEach((z) => { if (z.price != null) m[z.name] = z.price })
    return m
  }, [zoneData])

  const topNeighborhoods = useMemo(
    () => [...zoneData].sort((a, b) => b.listingCount - a.listingCount).slice(0, 4),
    [zoneData]
  )

  useEffect(() => {
    if (pinnedArea == null && topNeighborhoods.length > 0) setPinnedArea(topNeighborhoods[0].name)
  }, [topNeighborhoods, pinnedArea])

  const displayedAreaName = hoveredArea ?? pinnedArea
  const displayedZone = zoneData.find((z) => z.name === displayedAreaName) ?? null

  const listingsAnalyzed = health?.listings_loaded ?? sample.length ?? null
  const priceZones = areas.length || null

  return (
    <>
      <PageHeader title="Përmbledhje" />
      {health && !health.model_loaded && <p role="status">Vlerësimi nuk është i disponueshëm: nuk është instaluar model i trajnuar.</p>}
      {health?.data_source === "demo" && <p role="status">Të dhëna demo sintetike: prona fiktive, jo oferta reale.</p>}


      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="flex flex-col gap-5 p-7">
          <div>
            <h1 className="text-[28px] font-bold leading-tight text-foreground">
              Kupto tregun e pronave në Tiranë para se të blesh.
            </h1>
            <p className="mt-2.5 text-sm text-muted-foreground">
              Të dhëna konkrete, vlerësime ML, dhe analizë e zonave — gjithçka në një vend.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => router.push("/explore")}>
              Kërko Prona <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => router.push("/predict")}>
              Parashiko Vlerën
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-lg border border-border bg-muted p-3 text-center">
              <div className="text-lg font-bold text-foreground">{listingsAnalyzed != null ? listingsAnalyzed.toLocaleString() : "—"}</div>
              <div className="text-[10.5px] text-muted-foreground">Prona të Analizuara</div>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 text-center">
              <div className="text-lg font-bold text-foreground">{priceZones ?? "—"}</div>
              <div className="text-[10.5px] text-muted-foreground">Zona Çmimi</div>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3 text-center">
              <div className="text-lg font-bold text-foreground">{health?.model_metrics?.listing?.median_ape_pct != null ? `±${Math.round(health.model_metrics.listing.median_ape_pct)}%` : "—"}</div>
              <div className="text-[10.5px] text-muted-foreground">Gabimi tipik</div>
              <div className="text-[9px] text-muted-foreground/70">në prona të patestuara</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[15px] font-semibold text-foreground">Çmimi sipas Zonës</span>
            <span className="text-xs text-muted-foreground">kalo me miun ose kliko një zonë</span>
          </div>
          {loadError && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</div>}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
            <ZoneMap
              areas={areas}
              priceByArea={priceByArea}
              height={380}
              activeArea={displayedAreaName}
              onHoverArea={setHoveredArea}
              onSelectArea={setPinnedArea}
            />
            <ZoneInfoPanel zone={displayedZone} onExplore={(name) => router.push(`/explore?area=${encodeURIComponent(name)}`)} />
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3.5 flex items-baseline justify-between">
            <span className="text-[15px] font-semibold text-foreground">Lagjet Kryesore</span>
            <button onClick={() => router.push("/map")} className="text-xs font-medium text-primary hover:underline">
              Shiko hartën →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
            {topNeighborhoods.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Duke ngarkuar lagjet…</div>
            )}
            {topNeighborhoods.map((n, i) => (
              <NeighborhoodCard
                key={n.name} rank={i} name={n.name} price={n.price ?? 0} count={n.listingCount}
                onClick={() => router.push(`/explore?area=${encodeURIComponent(n.name)}`)}
              />
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
