"use client"
import { useState } from "react"
import {
  SlidersHorizontal, BarChart3, Lightbulb, Scale, Info, ChevronRight,
  ArrowUp, ArrowDown, Minus, Loader2, RotateCcw,
} from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { formatPrice } from "@/lib/api"
import { fetchPredictByZone } from "@/lib/api"
import type { PredictResponse, ZonePrediction, FeatureInsight } from "@/lib/types"
import { cn } from "@/lib/utils"

const ZONE_TIERS = ["var(--zone-0)", "var(--zone-1)", "var(--zone-2)", "var(--zone-3)", "var(--zone-4)"]

interface FormState { sqm: string; floor: string; beds: string; baths: string; has_elevator: boolean; has_parking_space: boolean }
const DEFAULT: FormState = { sqm: "", floor: "", beds: "", baths: "", has_elevator: false, has_parking_space: false }

function FeatureBar({ insight, maxImp }: { insight: FeatureInsight; maxImp: number }) {
  const barWidth = maxImp > 0 ? (insight.importance_pct / maxImp) * 100 : 0
  const Icon = insight.direction === "up" ? ArrowUp : insight.direction === "down" ? ArrowDown : Minus
  const colorClass = insight.direction === "up" ? "text-emerald-600 dark:text-emerald-400" : insight.direction === "down" ? "text-destructive" : "text-muted-foreground"

  return (
    <div className="mb-3.5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", colorClass)} />
          <span className="text-sm font-medium text-foreground">{insight.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-right text-xs text-muted-foreground sm:block">{insight.insight}</span>
          <span className="w-11 shrink-0 text-right text-sm font-bold text-primary">{insight.importance_pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  )
}

function CommonInsights({ insights }: { insights: FeatureInsight[] }) {
  if (!insights.length) return null
  const maxImp = insights[0].importance_pct
  return (
    <Card className="mb-5">
      <CardContent className="p-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="h-4 w-4" /> Faktorët që drejtojnë çmimin
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Rëndësia e çdo karakteristike bazuar në modelin XGBoost (feature importance — gain). I njëjtë për të gjitha zonat.
        </p>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          {insights.map((ins) => <FeatureBar key={ins.feature} insight={ins} maxImp={maxImp} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /> rrit çmimin krahasuar me mesataren e zonës</span>
          <span className="flex items-center gap-1"><ArrowDown className="h-3 w-3" /> ul çmimin</span>
        </div>
      </CardContent>
    </Card>
  )
}

function TimelineBar({ label, price, maxPrice, color, dim, growth, growthRate }: {
  label: string; price: number; maxPrice: number; color: string; dim?: boolean; growth?: number; growthRate?: number
}) {
  const heightPct = maxPrice > 0 ? Math.max(20, (price / maxPrice) * 100) : 30
  return (
    <div className="flex h-full flex-1 flex-col items-center">
      <div className="mb-1 text-center text-[10px] leading-tight text-muted-foreground">
        {formatPrice(price)}
        {growth != null && <div className="font-bold text-emerald-600 dark:text-emerald-400">+{growth}%</div>}
        {growthRate != null && <div className="text-[9px] text-muted-foreground">{growthRate}%/vit</div>}
      </div>
      <div className="flex w-full flex-1 items-end">
        <div className="w-full rounded-t" style={{ height: `${heightPct}%`, minHeight: 10, background: color, opacity: dim ? 0.4 : 1 }} />
      </div>
      <div className="mt-1 text-center text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function ZoneCard({ zone, color, rank, expanded, onToggle }: {
  zone: ZonePrediction; color: string; rank: number; expanded: boolean; onToggle: () => void
}) {
  const maxPrice = Math.max(...zone.future_prices.map((f) => f.price), zone.estimated_price)
  return (
    <Card className={cn("mb-3 overflow-hidden transition-colors", expanded && "border-primary/30")}>
      <div onClick={onToggle} className="flex cursor-pointer items-center gap-4 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
          #{rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-foreground">{zone.zone_name}</div>
          <div className="text-xs text-muted-foreground">{zone.listing_count.toLocaleString()} prona · {zone.price_per_sqm.toLocaleString()} €/m²</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold" style={{ color }}>{formatPrice(zone.estimated_price)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">±{zone.band_pct}%</div>
        </div>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </div>

      {expanded && (
        <div className="border-t border-border p-4 pt-4">
          {zone.future_prices.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <BarChart3 className="h-3.5 w-3.5" /> Parashikim i çmimit në të ardhmen
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                <div className="flex h-[90px] items-end gap-2">
                  <TimelineBar label="Sot" price={zone.estimated_price} maxPrice={maxPrice} color={color} dim />
                  <div className="pb-6 text-muted-foreground">→</div>
                  {zone.future_prices.map((fp) => (
                    <TimelineBar
                      key={fp.years} label={`+${fp.years} vit${fp.years > 1 ? "e" : ""}`}
                      price={fp.price} maxPrice={maxPrice} color={color}
                      growth={Math.round(((fp.price - zone.estimated_price) / zone.estimated_price) * 100)}
                      growthRate={fp.growth_rate}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {zone.future_prices.map((fp) => (
                    <div key={fp.years} className="flex-1 rounded-md border border-border p-2.5 text-center" style={{ minWidth: 120, background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
                      <div className="mb-1 text-[11px] text-muted-foreground">Pas {fp.years} vitesh</div>
                      <div className="text-lg font-bold" style={{ color }}>{formatPrice(fp.price)}</div>
                      <div className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                        +{formatPrice(fp.price - zone.estimated_price)}
                        <span className="ml-1 text-muted-foreground">({fp.growth_rate}%/vit)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Scale className="h-3.5 w-3.5" /> Krahasim me mesataren e zonës
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                { label: "Çmimi juaj", value: formatPrice(zone.estimated_price), cls: "" },
                { label: "Media e zonës", value: formatPrice(zone.avg_zone_price), cls: "text-muted-foreground" },
                {
                  label: "Diferenca",
                  value: `${zone.estimated_price > zone.avg_zone_price ? "+" : ""}${formatPrice(zone.estimated_price - zone.avg_zone_price)}`,
                  cls: zone.estimated_price > zone.avg_zone_price ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                },
                { label: "€/m² juaj", value: `${zone.price_per_sqm.toLocaleString()} €`, cls: "" },
                { label: "€/m² zona", value: `${zone.avg_zone_price_per_sqm.toLocaleString()} €`, cls: "text-muted-foreground" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="min-w-[110px] rounded-md border border-border bg-muted/30 p-2.5">
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                  <div className={cn("text-sm font-bold text-foreground", cls)}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function ComparisonSummary({ zones }: { zones: ZonePrediction[] }) {
  if (zones.length < 2) return null
  const cheapest = zones[0], mostExp = zones[zones.length - 1]
  const diff = mostExp.estimated_price - cheapest.estimated_price
  const pct = cheapest.estimated_price > 0 ? Math.round((diff / cheapest.estimated_price) * 100) : 0
  return (
    <Card className="mb-5 border-primary/15 bg-primary/[0.04] p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Krahasim i shpejtë</div>
      <div className="flex flex-wrap gap-5">
        {[
          { label: "Zona më e lirë", value: cheapest.zone_name },
          { label: "Çmimi i saj", value: formatPrice(cheapest.estimated_price) },
          { label: "Zona më e shtrenjtë", value: mostExp.zone_name },
          { label: "Çmimi i saj", value: formatPrice(mostExp.estimated_price) },
          { label: "Diferenca", value: `${formatPrice(diff)} (+${pct}%)` },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-sm font-bold text-foreground">{value}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function PredictPage() {
  const [form, setForm] = useState<FormState>(DEFAULT)
  const [result, setResult] = useState<PredictResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setLoading(true); setError(null); setResult(null); setExpanded(null)
    try {
      const data = await fetchPredictByZone({
        sqm: form.sqm ? Number(form.sqm) : undefined,
        floor: form.floor ? Number(form.floor) : undefined,
        beds: form.beds ? Number(form.beds) : undefined,
        baths: form.baths ? Number(form.baths) : undefined,
        has_elevator: form.has_elevator || undefined,
        has_parking_space: form.has_parking_space || undefined,
      })
      setResult(data)
      if (data.zones.length) setExpanded(data.zones[0].cluster_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => { setForm(DEFAULT); setResult(null); setError(null); setExpanded(null) }
  const zones = result?.zones ?? []

  return (
    <>
      <PageHeader eyebrow="Parashikim çmimi" title="Sa kushton & si rritet çmimi?" subtitle="Modeli XGBoost parashikon çmimin në çdo zonë, shpjegon faktorët, dhe projekton rritjen pas 2 dhe 5 vitesh." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><SlidersHorizontal className="h-4 w-4" /> Karakteristikat</span>
              <Button variant="ghost" size="sm" onClick={handleReset}><RotateCcw className="h-3.5 w-3.5" /> Pastro</Button>
            </div>

            <div className="space-y-3.5">
              <div>
                <Label className="mb-1.5 block">Sipërfaqja (m²)</Label>
                <Input type="number" min={10} max={1000} value={form.sqm} onChange={(e) => set("sqm", e.target.value)} placeholder="p.sh. 80" />
                <div className="mt-1 text-[11px] text-muted-foreground">Bosh = mesatarja e zonës (≈80 m²)</div>
              </div>
              <div>
                <Label className="mb-1.5 block">Kati</Label>
                <Input type="number" min={0} max={30} value={form.floor} onChange={(e) => set("floor", e.target.value)} placeholder="p.sh. 3" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block">Dhoma gjumi</Label>
                  <Select value={form.beds || "__avg"} onValueChange={(v) => set("beds", v === "__avg" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Mesatare" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__avg">Mesatare</SelectItem>
                      {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Banjo</Label>
                  <Select value={form.baths || "__avg"} onValueChange={(v) => set("baths", v === "__avg" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Mesatare" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__avg">Mesatare</SelectItem>
                      {[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={form.has_elevator} onCheckedChange={(v) => set("has_elevator", v === true)} /> Ashensor
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={form.has_parking_space} onCheckedChange={(v) => set("has_parking_space", v === true)} /> Parking
                </label>
              </div>

              <Button className="w-full" disabled={loading} onClick={handleSubmit}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Duke parashikuar…</> : <><BarChart3 className="h-4 w-4" /> Parashiko çmimin</>}
              </Button>
            </div>

            {!result && !loading && (
              <div className="mt-5 flex gap-2.5 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <Lightbulb className="h-4 w-4 shrink-0" />
                <div>
                  Pas parashikimit do të shohësh çmimin në secilën zonë, faktorët e modelit, dhe projeksionin e investimit pas 2 dhe 5 vitesh.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          {!result && !loading && !error && (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-muted-foreground">
              <BarChart3 className="mb-4 h-14 w-14 opacity-40" />
              <div className="mb-2 text-lg font-semibold text-foreground">Shiko çmimin sipas zonës</div>
              <div className="max-w-[400px] text-sm">E njëjta pronë — çmime të ndryshme sipas zonës. Plotëso karakteristikat dhe sistemi llogarit çmimin në çdo zonë.</div>
            </div>
          )}

          {loading && (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-9 w-9 animate-spin" />
              <div>Duke ekzekutuar modelin XGBoost për çdo zonë…</div>
            </div>
          )}

          {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {result && zones.length > 0 && (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Parashikim për <strong className="text-foreground">{result.sqm} m²{form.beds ? `, ${form.beds} dhoma` : ""}{form.floor ? `, Kati ${form.floor}` : ""}</strong> · kliko çdo zonë për projeksionin
              </div>

              <ComparisonSummary zones={zones} />

              {zones.map((zone, i) => (
                <ZoneCard
                  key={zone.cluster_id} zone={zone} color={ZONE_TIERS[i % ZONE_TIERS.length]} rank={i + 1}
                  expanded={expanded === zone.cluster_id} onToggle={() => setExpanded(expanded === zone.cluster_id ? null : zone.cluster_id)}
                />
              ))}

              <CommonInsights insights={result.feature_insights} />

              {result.growth_note && (
                <div className="mt-2 flex gap-2.5 rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0" />
                  <div><strong className="text-foreground">Normat e rritjes:</strong> {result.growth_note}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
