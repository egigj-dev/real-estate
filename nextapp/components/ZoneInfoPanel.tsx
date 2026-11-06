"use client"
import { MapPin, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import useAnimatedNumber from "@/hooks/useAnimatedNumber"

export interface ZoneInsight {
  Icon: typeof TrendingUp
  text: string
}

export interface ZoneData {
  name: string
  price: number | null
  listingCount: number
  avgSqm: number | null
  avgBeds: number | null
  deltaPct: number | null
  activityScore: number | null
  insights: ZoneInsight[]
}

function DeltaLine({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct == null || !isFinite(deltaPct)) return null
  const dir = deltaPct > 1.5 ? "up" : deltaPct < -1.5 ? "down" : "flat"
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus
  const colorClass = dir === "up" ? "text-destructive" : dir === "down" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
  const text = dir === "flat"
    ? "rreth mesatares së qytetit"
    : `${Math.abs(Math.round(deltaPct))}% ${dir === "up" ? "mbi" : "nën"} mesataren e qytetit`
  return (
    <div className={`mt-1.5 flex items-center gap-1 text-[13px] ${colorClass}`}>
      <Icon className="h-3.5 w-3.5" />
      {text}
    </div>
  )
}

export default function ZoneInfoPanel({ zone, onExplore }: { zone: ZoneData | null; onExplore?: (name: string) => void }) {
  const animatedPrice = useAnimatedNumber(zone?.price ?? 0)

  if (!zone) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        Zgjedh një zonë në hartë…
      </div>
    )
  }

  return (
    <div key={zone.name} className="flex h-full flex-col zone-panel-fade">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <MapPin className="h-3.5 w-3.5" />
        {zone.name}
      </div>

      <div className="mt-1 text-[40px] font-bold leading-none tracking-tight text-foreground">
        {Math.round(animatedPrice).toLocaleString()}
        <span className="ml-1 text-base font-medium text-muted-foreground">€/m²</span>
      </div>

      <DeltaLine deltaPct={zone.deltaPct} />

      {zone.insights.length > 0 && (
        <div className="my-4 flex flex-col gap-2">
          {zone.insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-foreground">
              <ins.Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      <Separator className="mb-4" />

      <div className="mt-auto grid grid-cols-2 gap-2.5">
        <div className="rounded-md bg-muted p-2.5">
          <div className="text-[15px] font-bold text-foreground">{zone.listingCount}</div>
          <div className="text-[10.5px] text-muted-foreground">Prona në kampion</div>
        </div>
        <div className="rounded-md bg-muted p-2.5">
          <div className="text-[15px] font-bold text-foreground">{zone.avgSqm != null ? `${Math.round(zone.avgSqm)} m²` : "—"}</div>
          <div className="text-[10.5px] text-muted-foreground">Sipërfaqja mesatare</div>
        </div>
        <div className="rounded-md bg-muted p-2.5">
          <div className="text-[15px] font-bold text-foreground">{zone.avgBeds != null ? zone.avgBeds.toFixed(1) : "—"}</div>
          <div className="text-[10.5px] text-muted-foreground">Dhoma gjumi mesatare</div>
        </div>
        <div className="rounded-md bg-muted p-2.5">
          <div className="text-[15px] font-bold text-foreground">{zone.activityScore != null ? `${zone.activityScore.toFixed(1)}/10` : "—"}</div>
          <div className="text-[10.5px] text-muted-foreground">Aktiviteti i Tregut</div>
        </div>
      </div>

      {onExplore && (
        <Button variant="outline" className="mt-3.5 w-full" onClick={() => onExplore(zone.name)}>
          Shiko pronat në {zone.name}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
