"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import PageHeader from "@/components/layout/PageHeader"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fetchAreas, fetchListings } from "@/lib/api"
import type { Area, ListingSummary } from "@/lib/types"

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false })

export default function MapPage() {
  const router = useRouter()
  const [areas, setAreas] = useState<Area[]>([])
  const [areaName, setAreaName] = useState("")
  const [items, setItems] = useState<ListingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchAreas().then(setAreas).catch(() => setAreas([])) }, [])

  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    fetchListings({ area_name: areaName || "", per_page: 300 })
      .then((d) => { if (alive) setItems(d.listings ?? []) })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [areaName])

  return (
    <>
      <PageHeader title="Harta e Zonave" subtitle="Zgjedh një zonë për ta filtruar hartën, ose eksploro lirisht të gjitha pronat." />
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="max-h-[76vh] overflow-y-auto p-3.5">
          <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Zonat ({areas.length})
          </div>
          <Button
            variant="ghost"
            className={cn("mb-0.5 w-full justify-start", !areaName && "bg-accent font-semibold")}
            onClick={() => setAreaName("")}
          >
            Të gjitha zonat
          </Button>
          {areas.map((a) => (
            <Button
              key={a.name}
              variant="ghost"
              className={cn("mb-0.5 w-full justify-start", areaName === a.name && "bg-accent font-semibold")}
              onClick={() => setAreaName(a.name)}
            >
              {a.name}
            </Button>
          ))}
        </Card>

        <div>
          <MapView items={items} onSelect={(id) => router.push(`/listings/${id}`)} areas={areas} areaName={areaName || null} height={620} />
          <div className="mt-2.5 text-xs text-muted-foreground">
            {loading ? "Duke ngarkuar pronat…" : `${items.length} prona ${areaName ? `në ${areaName}` : "gjithsej (kampion deri 300)"}`}
          </div>
        </div>
      </div>
    </>
  )
}
