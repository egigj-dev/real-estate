"use client"
import { useCallback, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { SlidersHorizontal, LayoutGrid, List as ListIcon, Map as MapIcon, X, ChevronLeft, ChevronRight } from "lucide-react"
import PageHeader from "@/components/layout/PageHeader"
import ListingCard from "@/components/ListingCard"
import SearchableList from "@/components/SearchableList"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { fetchListings, fetchFilterOptions, fetchAreas } from "@/lib/api"
import type { ListingSummary, Area } from "@/lib/types"

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false })

interface Filters {
  q: string
  per_page: number
  sqm: [number, number]
  min_beds: string
  min_baths: string
  min_price: string
  max_price: string
  has_elevator: boolean
  has_garden: boolean
  has_parking_space: boolean
  furnished: string
  area_name: string
  sort: string
}

const DEFAULT_FILTERS: Filters = {
  q: "", per_page: 20, sqm: [30, 500], min_beds: "", min_baths: "",
  min_price: "", max_price: "", has_elevator: false, has_garden: false,
  has_parking_space: false, furnished: "", area_name: "", sort: "",
}

export default function ExploreContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initial: Filters = {
    ...DEFAULT_FILTERS,
    q: searchParams.get("q") ?? "",
    area_name: searchParams.get("area") ?? "",
  }

  const [draft, setDraft] = useState<Filters>(initial)
  const [filters, setFilters] = useState<Filters>(initial)
  const [areaNames, setAreaNames] = useState<string[]>([])
  const [items, setItems] = useState<ListingSummary[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"grid" | "list">("grid")
  const [showMap, setShowMap] = useState(true)

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const load = useCallback(async (f: Filters, p = 1) => {
    setLoading(true); setError(null)
    try {
      const data = await fetchListings({
        q: f.q, per_page: f.per_page, page: p,
        min_sqm: f.sqm[0], max_sqm: f.sqm[1],
        min_beds: f.min_beds, min_baths: f.min_baths,
        min_price: f.min_price, max_price: f.max_price,
        furnished: f.furnished,
        has_elevator: f.has_elevator || undefined,
        has_garden: f.has_garden || undefined,
        has_parking_space: f.has_parking_space || undefined,
        area_name: f.area_name, sort: f.sort,
      })
      setItems(data.listings ?? [])
      setTotal(data.total ?? 0)
      setPages(data.pages ?? 1)
      setPage(data.page ?? 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setItems([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(initial, 1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-applies when the URL's q/area params change via a later navigation to
  // this same route (e.g. searching again from the topbar while already on
  // /explore) — useSearchParams() is reactive across client-side navigation.
  const spKey = searchParams.toString()
  useEffect(() => {
    const q = searchParams.get("q") ?? ""
    const area = searchParams.get("area") ?? ""
    if (q === filters.q && area === filters.area_name) return
    const next = { ...DEFAULT_FILTERS, q, area_name: area }
    setDraft(next); setFilters(next); load(next, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey])

  useEffect(() => {
    fetchFilterOptions().then((d) => setAreaNames(d.area_names ?? [])).catch(() => {})
    fetchAreas().then(setAreas).catch(() => {})
  }, [])

  const handleApply = () => { setFilters(draft); load(draft, 1) }
  const handleReset = () => { setDraft(DEFAULT_FILTERS); setFilters(DEFAULT_FILTERS); load(DEFAULT_FILTERS, 1); router.replace("/explore") }
  const goPage = (p: number) => load(filters, p)

  const onSelectListing = (id: string) => router.push(`/listings/${id}`)

  return (
    <>
      <PageHeader
        title="Eksploro Pronat"
        subtitle={total > 0 ? `${total.toLocaleString()} prona të gatshme për shfletim` : "Filtro sipas çmimit, sipërfaqes, dhomave dhe zonës."}
      />

      {/* ── Compact enterprise filter grid ──────────────────────────────── */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              Filtro Pronat
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="h-3.5 w-3.5" /> Pastro
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-6">
            <div className="col-span-2">
              <Label className="mb-1.5 block">Kërko</Label>
              <Input value={draft.q} onChange={(e) => set("q", e.target.value)} placeholder="rrugë, lagje, lloji…" />
            </div>
            <div className="col-span-2">
              <Label className="mb-1.5 block">Zona</Label>
              <Select value={draft.area_name || "__all"} onValueChange={(v) => set("area_name", v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Të gjitha zonat" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Të gjitha zonat</SelectItem>
                  {areaNames.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Rendit sipas</Label>
              <Select value={draft.sort || "__none"} onValueChange={(v) => set("sort", v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Pa renditje</SelectItem>
                  <SelectItem value="price_asc">Çmim ↑</SelectItem>
                  <SelectItem value="price_desc">Çmim ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Rezultate</Label>
              <Select value={String(draft.per_page)} onValueChange={(v) => set("per_page", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 sm:col-span-3 md:col-span-3">
              <Label className="mb-2 block">Sipërfaqja: {draft.sqm[0]} – {draft.sqm[1]} m²</Label>
              <Slider value={draft.sqm} onValueChange={(v) => set("sqm", v as [number, number])} min={10} max={500} step={10} />
            </div>
            <div>
              <Label className="mb-1.5 block">Min dhoma</Label>
              <Select value={draft.min_beds || "__any"} onValueChange={(v) => set("min_beds", v === "__any" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Të gjitha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any">Të gjitha</SelectItem>
                  {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}+</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Min banjo</Label>
              <Select value={draft.min_baths || "__any"} onValueChange={(v) => set("min_baths", v === "__any" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Të gjitha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any">Të gjitha</SelectItem>
                  {[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}+</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Çmim min (€)</Label>
              <Input type="number" value={draft.min_price} onChange={(e) => set("min_price", e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="mb-1.5 block">Çmim max (€)</Label>
              <Input type="number" value={draft.max_price} onChange={(e) => set("max_price", e.target.value)} placeholder="∞" />
            </div>

            <div className="col-span-2 flex items-end gap-4 sm:col-span-3">
              {[
                { key: "has_elevator" as const, label: "Ashensor" },
                { key: "has_garden" as const, label: "Kopsht" },
                { key: "has_parking_space" as const, label: "Parking" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 pb-0.5 text-sm text-foreground">
                  <Checkbox checked={draft[key]} onCheckedChange={(v) => set(key, v === true)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="col-span-2 flex items-end sm:col-span-3 md:col-span-1">
              <Button className="w-full" onClick={handleApply}>Apliko Filtrat</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {loading ? "Duke ngarkuar…" : error ? <span className="text-destructive">Gabim</span> : (
            <><strong className="text-foreground">{items.length}</strong> nga <strong className="text-foreground">{total}</strong> rezultate</>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button variant={showMap ? "secondary" : "outline"} size="sm" onClick={() => setShowMap((m) => !m)}>
            <MapIcon className="h-3.5 w-3.5" /> Harta
          </Button>
          <div className="flex rounded-md border border-border">
            <Button variant={tab === "grid" ? "secondary" : "ghost"} size="sm" className="rounded-r-none" onClick={() => setTab("grid")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={tab === "list" ? "secondary" : "ghost"} size="sm" className="rounded-l-none" onClick={() => setTab("list")}>
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Nuk u gjetën rezultate me këto filtra.
          <div className="mt-3"><Button variant="outline" size="sm" onClick={handleReset}>Pastro filtrat</Button></div>
        </div>
      )}

      <div className={showMap ? "grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]" : ""}>
        <div>
          {tab === "grid" ? (
            <div className={`grid gap-3.5 ${showMap ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
              {items.map((item, i) => (
                <ListingCard key={item.id} item={item} index={i} onClick={() => onSelectListing(item.id)} />
              ))}
            </div>
          ) : (
            <SearchableList items={items} onSelect={onSelectListing} />
          )}

          {!loading && pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Para
              </Button>
              <span className="text-sm text-muted-foreground">
                Faqja <strong className="text-foreground">{page}</strong> nga <strong className="text-foreground">{pages}</strong>
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => goPage(page + 1)}>
                Pas <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {showMap && (
          <div className="sticky top-[88px] h-fit">
            <MapView items={items} onSelect={onSelectListing} areas={areas} areaName={filters.area_name || null} height={600} />
          </div>
        )}
      </div>
    </>
  )
}
