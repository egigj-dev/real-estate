"use client"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Home as HomeIcon, Sparkles, FileText, MapPin, Layers, Loader2,
  CheckCircle2, XCircle, TrendingUp, TrendingDown, Check,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fetchHealth, fetchListing, fetchEstimate, fetchComps, formatPrice, listingLabel } from "@/lib/api"
import type { ListingDetail, EstimateResponse, CompItem } from "@/lib/types"

const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false })

function KvItem({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "yes" | "no" }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="mb-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${tone === "yes" ? "text-emerald-600 dark:text-emerald-400" : tone === "no" ? "text-destructive" : "text-foreground"}`}>
        {value ?? "—"}
      </div>
    </div>
  )
}

function BoolKv({ label, value }: { label: string; value: boolean | null | undefined }) {
  return (
    <KvItem
      label={label}
      tone={value === true ? "yes" : value === false ? "no" : undefined}
      value={
        <span className="flex items-center gap-1">
          {value === true ? <CheckCircle2 className="h-3.5 w-3.5" /> : value === false ? <XCircle className="h-3.5 w-3.5" /> : null}
          {value === true ? "Po" : value === false ? "Jo" : "—"}
        </span>
      }
    />
  )
}

function LabelBadge({ label }: { label: EstimateResponse["label"] }) {
  const config = {
    Fair: { cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400", Icon: Check, text: "Çmim i drejtë" },
    Overpriced: { cls: "bg-destructive/10 text-destructive border-destructive/25", Icon: TrendingUp, text: "Çmim i lartë" },
    Underpriced: { cls: "bg-primary/10 text-primary border-primary/25", Icon: TrendingDown, text: "Çmim i ulët" },
  }[label]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${config.cls}`}>
      <config.Icon className="h-3.5 w-3.5" /> {config.text}
    </span>
  )
}

function CompCard({ comp, onSelect }: { comp: CompItem; onSelect: () => void }) {
  return (
    <div onClick={onSelect} className="min-w-[200px] shrink-0 cursor-pointer rounded-lg border border-border p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="mb-1 text-lg font-bold text-foreground">{formatPrice(comp.price)}</div>
      <div className="mb-1.5 text-sm text-muted-foreground">{comp.sqm} m² · {comp.rooms} dhoma</div>
      <div className="mb-1 flex items-center gap-1 text-xs text-primary"><MapPin className="h-3 w-3" /> {comp.distance_label}</div>
      <div className="text-xs text-muted-foreground">{comp.similarity_reason}</div>
    </div>
  )
}

function PriceBar({ actual, low, high, estimated }: { actual: number; low: number; high: number; estimated: number }) {
  const pad = (high - low) * 0.3
  const min = low - pad, max = high + pad, range = max - min || 1
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100))
  const dotColor = actual > high ? "bg-destructive" : actual < low ? "bg-primary" : "bg-emerald-500"
  return (
    <div className="relative mt-2 h-7">
      <div className="absolute left-0 right-0 top-[11px] h-1.5 rounded-full bg-muted" />
      <div className="absolute top-[11px] h-1.5 rounded-full bg-emerald-500/25" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
      <div className="absolute top-1.5 w-0.5 -translate-x-1/2 rounded bg-primary" style={{ left: `${pct(estimated)}%`, height: 16 }} />
      <div className={`absolute top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-background ${dotColor}`} style={{ left: `${pct(actual)}%` }} />
    </div>
  )
}

export default function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [isDemo, setIsDemo] = useState(false)
  useEffect(() => { fetchHealth().then(h => setIsDemo(h.data_source === "demo")).catch(() => {}) }, [])
  const [item, setItem] = useState<ListingDetail | null>(null)
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null)
  const [comps, setComps] = useState<CompItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [estimateMessage, setEstimateMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return
    setEstimateMessage(null)
    setLoading(true); setError(null); setItem(null); setEstimate(null); setComps(null)
    Promise.all([
      fetchListing(id),
      fetchEstimate(id).catch(e => { setEstimateMessage(e.message); return null }),
      fetchComps(id).catch(() => null),
    ])
      .then(([listing, est, cmps]) => { setItem(listing); setEstimate(est); setComps(cmps?.comps ?? null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="mx-auto max-w-[900px] pb-10">
      <button onClick={() => router.back()} className="mb-5 flex items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Kthehu te listat
      </button>

      {isDemo && <p role="status">Të dhëna demo sintetike: prona fiktive, jo oferta reale.</p>}
      {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Duke ngarkuar…</p>}
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Nuk mund të ngarkohet prona {id}. {error}</div>}

      {item && (
        <>
          <Card className="mb-5">
            <CardContent className="p-6">
              <div className="mb-4">
                {item.property_type && (
                  <div className="mb-2 flex gap-2">
                    <Badge variant="secondary">{item.property_type}</Badge>
                    {item.neighborhood && <Badge variant="outline">{item.neighborhood}</Badge>}
                  </div>
                )}
                <h1 className="mb-2 text-xl font-bold text-foreground">{listingLabel(item)}</h1>
                <p className="text-[34px] font-bold leading-none text-foreground">{formatPrice(item.price)}</p>
                {item.price_per_sqm != null && (
                  <p className="mt-1.5 text-sm text-muted-foreground">{Math.round(item.price_per_sqm).toLocaleString()} €/m²</p>
                )}
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <HomeIcon className="h-4 w-4" /> Detajet Kryesore
              </div>
              <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                <KvItem label="Lloji" value={item.property_type} />
                <KvItem label="Kati" value={item.floor} />
                <KvItem label="Sipërfaqja" value={item.sqm != null ? `${item.sqm} m²` : null} />
                <KvItem label="Dhoma gjumi" value={item.beds} />
                <KvItem label="Banjo" value={item.baths} />
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4" /> Amenitete
              </div>
              <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <BoolKv label="Ashensor" value={item.has_elevator} />
                <BoolKv label="Tarracë" value={item.has_terrace} />
                <BoolKv label="Parking" value={item.has_parking_space} />
                <BoolKv label="Mobiluar" value={item.furnished} />
                <BoolKv label="Kopsht" value={item.has_garden} />
                <BoolKv label="Garazh" value={item.has_garage} />
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4" /> Përshkrimi
              </div>
              <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed text-foreground">
                {item.description || "(Nuk ka përshkrim)"}
              </div>
            </CardContent>
          </Card>

          {item.latitude != null && item.longitude != null && (
            <Card className="mb-5">
              <CardContent className="p-6">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPin className="h-4 w-4" /> Vendndodhja & Infrastruktura
                </div>
                <LocationMap item={item} />
              </CardContent>
            </Card>
          )}

          {estimateMessage && <p role="status">Vlerësimi nuk është i disponueshëm. {estimateMessage}</p>}
          {estimate && (
            <Card className="mb-5">
              <CardContent className="p-6">
                <div className="mb-4 text-sm font-semibold text-foreground">Vlerësimi i Çmimit</div>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-muted/30 p-4 text-center">
                    <div className="text-[11px] text-muted-foreground">Çmim i vlerësuar</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{formatPrice(estimate.estimated_price)}</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-4 text-center">
                    <div className="text-[11px] text-muted-foreground">Diapazoni i drejtë</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{formatPrice(estimate.range_low)} – {formatPrice(estimate.range_high)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">±{estimate.band_pct ?? 8}% rreth vlerës</div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-4 text-center">
                    <div className="text-[11px] text-muted-foreground">Vlerësimi</div>
                    <div className="mt-2"><LabelBadge label={estimate.label} /></div>
                    <div className="mt-2 text-[11px] text-muted-foreground">Çmimi real: {formatPrice(item.price)}</div>
                    {estimate.threshold_pct != null && <div className="mt-0.5 text-[11px] text-muted-foreground">Toleranca: ±{estimate.threshold_pct}%</div>}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 text-[11px] text-muted-foreground">Pozicioni i çmimit</div>
                  <PriceBar actual={item.price} low={estimate.range_low} high={estimate.range_high} estimated={estimate.estimated_price} />
                </div>
              </CardContent>
            </Card>
          )}

          {comps && comps.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Layers className="h-4 w-4" /> Prona të Ngjashme
                </div>
                <p className="mb-4 text-xs text-muted-foreground">5 pronat me ngjashmëri më të lartë — kliko për detaje.</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {comps.map((comp) => (
                    <CompCard key={comp.id} comp={comp} onSelect={() => router.push(`/listings/${comp.id}`)} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
