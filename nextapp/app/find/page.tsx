"use client"
import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import {
  Bot, Send, Ruler, BedDouble, Bath, Building2, MapPin, ArrowUpDown,
  ParkingCircle, Check, AlertTriangle, Loader2, RotateCcw, Search as SearchIcon,
} from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { fetchSuggestions, fetchChatParse, fetchFilterOptions, formatPrice, listingLabel } from "@/lib/api"
import type { ChatParseResponse, SuggestResponse, SuggestionItem } from "@/lib/types"

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false })

const EXAMPLE_PROMPTS = [
  "Dua një apartament 2+1 në Bllok me ashensor, rreth 80 m²",
  "Kërkoj studio afër qendrës, çmim i ulët, kati i lartë",
  "Nevojitet vilë me garazh dhe kopsht në periferi, 4 dhoma",
  "Apartament i mobiluar me parking, Zona e Mesme",
]

interface FormState {
  sqm: string; floor: string; beds: string; baths: string
  has_elevator: boolean; has_parking_space: boolean; neighborhood: string; n: number
}
const EMPTY_FORM: FormState = { sqm: "", floor: "", beds: "", baths: "", has_elevator: false, has_parking_space: false, neighborhood: "", n: 10 }

function ChatBox({ onParsed }: { onParsed: (p: ChatParseResponse) => void }) {
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChatParseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (taRef.current) { taRef.current.style.height = "auto"; taRef.current.style.height = taRef.current.scrollHeight + "px" }
  }, [text])

  const submit = async (txt?: string) => {
    const t = (txt ?? text).trim()
    if (!t) return
    setText(t); setLoading(true); setError(null); setResult(null)
    try {
      const parsed = await fetchChatParse(t)
      setResult(parsed)
      onParsed(parsed)
    } catch {
      setError("Nuk u lidh me serverin. Provoni manualisht filtrat.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-5 border-primary/15 bg-primary/[0.03]">
      <CardContent className="p-5">
        <div className="mb-3.5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Përshkruaj pronën që dëshiron</div>
            <div className="text-xs text-muted-foreground">Shkruaj lirshëm — sistemi nxjerr karakteristikat automatikisht</div>
          </div>
        </div>

        <div className="relative mb-2.5">
          <Textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder="p.sh. Dua apartament 2+1 në Bllok me ashensor, rreth 80 m², kati i lartë…"
            rows={2}
            className="resize-none pr-12"
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
            disabled={loading || !text.trim()}
            onClick={() => submit()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => submit(p)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {p.length > 45 ? p.slice(0, 45) + "…" : p}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        {result && (
          <div className="mt-3.5 rounded-md border border-primary/20 bg-primary/5 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Check className="h-3.5 w-3.5" /> U kuptua — filtrat u përditësuan{result.method === "claude" ? " (Claude AI)" : " (keyword)"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.sqm && <Chip Icon={Ruler}>{result.sqm} m²</Chip>}
              {result.beds && <Chip Icon={BedDouble}>{result.beds} dhoma</Chip>}
              {result.baths && <Chip Icon={Bath}>{result.baths} banjo</Chip>}
              {result.floor && <Chip Icon={Building2}>Kati {result.floor}</Chip>}
              {result.neighborhood && <Chip Icon={MapPin}>{result.neighborhood}</Chip>}
              {result.has_elevator && <Chip Icon={ArrowUpDown}>Ashensor</Chip>}
              {result.has_parking_space && <Chip Icon={ParkingCircle}>Parking</Chip>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Chip({ Icon, children }: { Icon: typeof Ruler; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <Icon className="h-3 w-3" /> {children}
    </span>
  )
}

function MatchBadge({ score }: { score: number }) {
  const pct = Math.round(score)
  const variant = pct >= 75 ? "bg-primary/10 text-primary border-primary/25" : pct >= 50 ? "bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400" : "bg-muted text-muted-foreground border-border"
  return (
    <span className={`mb-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variant}`}>
      {pct}% përputhje
    </span>
  )
}

function SuggestionCard({ item, onClick }: { item: SuggestionItem; onClick: () => void }) {
  const meta = [
    item.sqm != null && `${item.sqm} m²`,
    item.beds != null && `${item.beds} dhoma`,
    item.baths != null && `${item.baths} banjo`,
    item.floor != null && `Kati ${item.floor}`,
    item.furnished && "Mobiluar",
  ].filter(Boolean) as string[]

  return (
    <Card onClick={onClick} className="cursor-pointer p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <MatchBadge score={item.match_score} />
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{item.property_type || "Pronë"}</div>
      <div className="mb-2 text-[15px] font-bold leading-snug text-foreground">{listingLabel(item)}</div>
      <div className="mb-3 text-xl font-bold text-foreground">{formatPrice(item.price)}</div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {meta.map((t) => <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}
      </div>
      {item.neighborhood && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {item.neighborhood}</div>
      )}
      {item.price_per_sqm != null && (
        <div className="mt-1 text-[11px] text-muted-foreground">{Math.round(item.price_per_sqm).toLocaleString()} €/m²</div>
      )}
    </Card>
  )
}

export default function FindPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [result, setResult] = useState<SuggestResponse | null>(null)
  const [zones, setZones] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    fetchFilterOptions().then((d) => setZones(d.area_names?.length ? d.area_names : d.neighborhoods)).catch(() => {})
  }, [])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleParsed = (parsed: ChatParseResponse) => {
    setForm((f) => ({
      ...f,
      ...(parsed.sqm != null ? { sqm: String(parsed.sqm) } : {}),
      ...(parsed.floor != null ? { floor: String(parsed.floor) } : {}),
      ...(parsed.beds != null ? { beds: String(parsed.beds) } : {}),
      ...(parsed.baths != null ? { baths: String(parsed.baths) } : {}),
      ...(parsed.has_elevator != null ? { has_elevator: parsed.has_elevator } : {}),
      ...(parsed.has_parking_space != null ? { has_parking_space: parsed.has_parking_space } : {}),
      ...(parsed.neighborhood != null ? { neighborhood: parsed.neighborhood } : {}),
    }))
  }

  const handleSubmit = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await fetchSuggestions({
        n: form.n,
        sqm: form.sqm ? Number(form.sqm) : undefined,
        floor: form.floor ? Number(form.floor) : undefined,
        beds: form.beds ? Number(form.beds) : undefined,
        baths: form.baths ? Number(form.baths) : undefined,
        has_elevator: form.has_elevator || undefined,
        has_parking_space: form.has_parking_space || undefined,
        neighborhood: form.neighborhood || undefined,
      })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => { setForm(EMPTY_FORM); setResult(null); setError(null) }
  const suggestions = result?.suggestions ?? []

  return (
    <>
      <PageHeader eyebrow="Gjej pronën ideale" title="Çfarë prone kërkoni?" subtitle="Shkruaj me fjalë të tua ose plotëso filtrat — sistemi gjen pronat më të ngjashme dhe vlerëson çmimin e drejtë." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div>
          <ChatBox onParsed={handleParsed} />

          <Card>
            <CardContent className="p-5">
              <div className="mb-3.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Ose plotëso manualisht</span>
                <Button variant="ghost" size="sm" onClick={handleReset}><RotateCcw className="h-3.5 w-3.5" /> Pastro</Button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <Label className="mb-1.5 block">Zona</Label>
                  <Select value={form.neighborhood || "__any"} onValueChange={(v) => set("neighborhood", v === "__any" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Çdo zonë" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Çdo zonë</SelectItem>
                      {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Sipërfaqja (m²)</Label>
                  <Input type="number" min={10} max={1000} value={form.sqm} onChange={(e) => set("sqm", e.target.value)} placeholder="p.sh. 80" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Kati</Label>
                  <Input type="number" min={0} max={30} value={form.floor} onChange={(e) => set("floor", e.target.value)} placeholder="p.sh. 3" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5 block">Dhoma</Label>
                    <Select value={form.beds || "__any"} onValueChange={(v) => set("beds", v === "__any" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Çdo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any">Çdo</SelectItem>
                        {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Banjo</Label>
                    <Select value={form.baths || "__any"} onValueChange={(v) => set("baths", v === "__any" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Çdo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any">Çdo</SelectItem>
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
                <div>
                  <Label className="mb-1.5 block">Numri i sugjerimeve</Label>
                  <Select value={String(form.n)} onValueChange={(v) => set("n", Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20].map((n) => <SelectItem key={n} value={String(n)}>{n} prona</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" disabled={loading} onClick={handleSubmit}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Duke kërkuar…</> : <><SearchIcon className="h-4 w-4" /> Gjej pronat</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {!result && !loading && !error && (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="mb-4 h-14 w-14 opacity-40" />
              <div className="mb-2 text-lg font-semibold text-foreground">Përshkruaj pronën me fjalë të tua</div>
              <div className="max-w-[360px] text-sm">Shkruaj si po i tregon dikujt — çfarë dëshiron, ku, me çfarë karakteristikash. Sistemi do ta kuptojë.</div>
            </div>
          )}

          {loading && (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-9 w-9 animate-spin" />
              <div>Duke analizuar {form.n} pronat më të ngjashme…</div>
            </div>
          )}

          {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {result && (
            <>
              <Card className="mb-5 border-primary/15 bg-primary/[0.04] p-5">
                <div className="mb-1 text-xs text-muted-foreground">Çmimi i vlerësuar</div>
                <div className="text-2xl font-bold text-primary">{formatPrice(result.estimated_price)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatPrice(result.range_low)} – {formatPrice(result.range_high)} <span className="ml-1">±{result.band_pct}%</span>
                </div>
              </Card>

              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground"><strong className="text-foreground">{suggestions.length}</strong> prona u gjetën</span>
                <Button variant={showMap ? "secondary" : "outline"} size="sm" onClick={() => setShowMap((m) => !m)}>
                  Harta
                </Button>
              </div>

              {showMap && suggestions.length > 0 && (
                <div className="mb-5">
                  <MapView items={suggestions} onSelect={(id) => router.push(`/listings/${id}`)} height={360} />
                </div>
              )}

              <div className="grid gap-3.5 sm:grid-cols-2">
                {suggestions.map((item) => (
                  <SuggestionCard key={item.id} item={item} onClick={() => router.push(`/listings/${item.id}`)} />
                ))}
              </div>

              {suggestions.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                  Nuk u gjetën prona me këto karakteristika.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
