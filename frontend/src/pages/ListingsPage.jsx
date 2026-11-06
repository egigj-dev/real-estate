import { useState, useEffect, useCallback } from 'react'
import {
  SlidersHorizontal, RotateCcw, Search, Map as MapIcon, LayoutGrid, List,
  X, ArrowUpDown, Trees, SquareParking, AlertTriangle, SearchX,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import ListingCard from '../components/ListingCard'
import SearchableList from '../components/SearchableList'
import MapView from '../components/MapView'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Slider } from '../components/ui/slider'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select'
import { fetchListings } from '../api'

const ALL = '__all__' // Radix Select forbids empty-string item values; sentinel for "no filter"

const DEFAULT_FILTERS = {
  q: '', per_page: 20, min_sqm: 30, max_sqm: 500,
  min_beds: '', min_price: '', max_price: '', min_baths: '',
  has_elevator: false, has_garden: false, has_parking_space: false,
  furnished: '', area_name: '', neighborhood: '', sort: '',
}

const AMENITIES = [
  { key: 'has_elevator',      icon: ArrowUpDown,    label: 'Ashensor' },
  { key: 'has_garden',        icon: Trees,          label: 'Kopsht' },
  { key: 'has_parking_space', icon: SquareParking,  label: 'Parking' },
]

// A labelled filter cell — Label + control, consistent spacing.
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ActiveFilters({ filters, onClear }) {
  const chips = []
  if (filters.area_name) chips.push(filters.area_name)
  if (filters.q) chips.push(`"${filters.q}"`)
  if (filters.min_sqm !== 30 || filters.max_sqm !== 500) chips.push(`${filters.min_sqm}–${filters.max_sqm} m²`)
  if (filters.min_beds) chips.push(`${filters.min_beds}+ dhoma`)
  if (filters.min_baths) chips.push(`${filters.min_baths}+ banjo`)
  if (filters.min_price) chips.push(`nga ${Number(filters.min_price).toLocaleString()} €`)
  if (filters.max_price) chips.push(`deri ${Number(filters.max_price).toLocaleString()} €`)
  if (filters.has_elevator) chips.push('Ashensor')
  if (filters.has_garden) chips.push('Kopsht')
  if (filters.has_parking_space) chips.push('Parking')
  if (filters.furnished === 'true') chips.push('Mobiluar')
  if (filters.furnished === 'false') chips.push('Pa mobilim')
  if (filters.sort === 'price_asc') chips.push('Çmim rritës')
  if (filters.sort === 'price_desc') chips.push('Çmim zbritës')
  if (!chips.length) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 font-sans">
      <span className="text-xs text-muted-foreground">Filtra aktiv:</span>
      {chips.map(c => <Badge key={c} variant="secondary" className="font-normal">{c}</Badge>)}
      <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-muted-foreground">
        <X /> Pastro
      </Button>
    </div>
  )
}

export default function ListingsPage({ onSelect, initialAreaName = '', initialQuery = '' }) {
  const initialFilters = (initialAreaName || initialQuery)
    ? { ...DEFAULT_FILTERS, area_name: initialAreaName, q: initialQuery }
    : DEFAULT_FILTERS

  const [filters, setFilters] = useState(initialFilters)
  const [zones, setZones] = useState([])
  const [draft, setDraft] = useState(initialFilters)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoad] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('grid')
  const [showMap, setShowMap] = useState(true)

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const load = useCallback(async (f, p = 1) => {
    setLoad(true); setError(null)
    try {
      const data = await fetchListings({ ...f, page: p })
      setItems(data.listings ?? [])
      setTotal(data.total ?? 0)
      setPages(data.pages ?? 1)
      setPage(data.page ?? 1)
    } catch (e) {
      setError(e.message); setItems([]); setTotal(0)
    } finally {
      setLoad(false)
    }
  }, [])

  useEffect(() => { load(initialFilters, 1) }, [load])
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/filters/options`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.area_names?.length) setZones(d.area_names)
                   else if (d?.neighborhoods) setZones(d.neighborhoods) })
      .catch(() => {})
  }, [])

  const handleSubmit = (e) => { e.preventDefault(); setFilters(draft); load(draft, 1) }
  const handleReset = () => { setDraft(DEFAULT_FILTERS); setFilters(DEFAULT_FILTERS); load(DEFAULT_FILTERS, 1) }
  const goPage = (p) => load(filters, p)

  return (
    <>
      <PageHeader
        title="Eksploro Pronat"
        subtitle={total > 0
          ? `${total.toLocaleString()} prona të gatshme për shfletim`
          : 'Filtro sipas çmimit, sipërfaqes, dhomave dhe zonës.'}
      />

      <div className="mx-auto w-full px-0 pb-5 font-sans" style={{ maxWidth: 1400 }}>

        {/* ── FILTER PANEL ── */}
        <Card className="mb-6">
          <CardContent className="p-5 sm:p-6">

            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                <SlidersHorizontal className="size-4 text-muted-foreground" />
                Filtro Pronat
              </h2>
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                <RotateCcw /> Reset
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Kërko">
                  <Input value={draft.q} onChange={e => set('q', e.target.value)} placeholder="rrugë, lagje, lloji…" />
                </Field>
                <Field label="Zona">
                  <Select value={draft.area_name || ALL} onValueChange={v => set('area_name', v === ALL ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Të gjitha zonat" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Të gjitha zonat</SelectItem>
                      {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Rendit sipas">
                  <Select value={draft.sort || ALL} onValueChange={v => set('sort', v === ALL ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Pa renditje</SelectItem>
                      <SelectItem value="price_asc">Çmim rritës</SelectItem>
                      <SelectItem value="price_desc">Çmim zbritës</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Rezultate / faqe">
                  <Select value={String(draft.per_page)} onValueChange={v => set('per_page', Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Row 2 — surface area range */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Sipërfaqja</Label>
                  <span className="text-xs font-medium text-foreground">{draft.min_sqm} – {draft.max_sqm} m²</span>
                </div>
                <Slider
                  min={10} max={500} step={10}
                  value={[draft.min_sqm, draft.max_sqm]}
                  onValueChange={([min, max]) => setDraft(d => ({ ...d, min_sqm: min, max_sqm: max }))}
                  className="py-1"
                />
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="Min dhoma">
                  <Select value={draft.min_beds || ALL} onValueChange={v => set('min_beds', v === ALL ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Të gjitha" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Të gjitha</SelectItem>
                      {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n}+</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Min banjo">
                  <Select value={draft.min_baths || ALL} onValueChange={v => set('min_baths', v === ALL ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Të gjitha" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Të gjitha</SelectItem>
                      {[1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{n}+</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Çmim min (€)">
                  <Input type="number" min={0} placeholder="0" value={draft.min_price}
                    onChange={e => set('min_price', e.target.value)} />
                </Field>
                <Field label="Çmim max (€)">
                  <Input type="number" min={0} placeholder="—" value={draft.max_price}
                    onChange={e => set('max_price', e.target.value)} />
                </Field>
              </div>

              {/* Row 4 — amenities · furnished · apply */}
              <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <Label>Amenitete</Label>
                  <div className="flex flex-wrap gap-2">
                    {AMENITIES.map(({ key, icon: Icon, label }) => (
                      <Button key={key} type="button" size="sm"
                        variant={draft[key] ? 'default' : 'outline'}
                        onClick={() => set(key, !draft[key])}>
                        <Icon /> {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Field label="Statusi i mobilimit">
                  <Select value={draft.furnished || ALL} onValueChange={v => set('furnished', v === ALL ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Të gjitha</SelectItem>
                      <SelectItem value="true">Mobiluar</SelectItem>
                      <SelectItem value="false">Pa mobilim</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="submit" className="w-full">
                  <Search /> Apliko Filtrat
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── TOOLBAR ── */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {loading
              ? 'Duke ngarkuar…'
              : error
              ? <span className="text-destructive">Gabim</span>
              : <><strong className="text-foreground">{items.length}</strong> nga <strong className="text-foreground">{total}</strong> rezultate</>}
          </span>

          <div className="flex items-center gap-2">
            <Button variant={showMap ? 'default' : 'outline'} size="sm" onClick={() => setShowMap(m => !m)}>
              <MapIcon /> {showMap ? 'Fshih hartën' : 'Trego hartën'}
            </Button>
            <div className="flex overflow-hidden rounded-md border border-input">
              <Button variant={tab === 'grid' ? 'secondary' : 'ghost'} size="sm" className="rounded-none border-0"
                onClick={() => setTab('grid')}>
                <LayoutGrid /> Grid
              </Button>
              <Button variant={tab === 'list' ? 'secondary' : 'ghost'} size="sm" className="rounded-none border-0"
                onClick={() => setTab('list')}>
                <List /> Listë
              </Button>
            </div>
          </div>
        </div>

        <ActiveFilters filters={filters} onClear={handleReset} />

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              API nuk është aktiv në <code>http://localhost:8000</code>
              <div className="text-xs opacity-80">{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-14 text-center text-muted-foreground">
            <SearchX className="size-9 opacity-50" />
            <div>Nuk u gjetën rezultate me këto filtra.</div>
            <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw /> Pastro filtrat</Button>
          </div>
        )}

        {/* ── SPLIT LAYOUT ── */}
        <div className="grid items-start gap-6" style={{ gridTemplateColumns: showMap ? '1fr 400px' : '1fr' }}>
          <div>
            {tab === 'grid' && (
              <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${showMap ? '' : 'lg:grid-cols-3'}`}>
                {items.map((item, i) => (
                  <ListingCard key={item.id} item={item} index={i} onClick={() => onSelect(item.id)} />
                ))}
              </div>
            )}

            {tab === 'list' && <SearchableList items={items} onSelect={onSelect} />}

            {!loading && pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
                  <ChevronLeft /> Para
                </Button>
                <span className="text-sm text-muted-foreground">
                  Faqja <strong className="text-foreground">{page}</strong> nga <strong className="text-foreground">{pages}</strong>
                </span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => goPage(page + 1)}>
                  Pas <ChevronRight />
                </Button>
              </div>
            )}
          </div>

          {showMap && (
            <div className="sticky" style={{ top: 76 }}>
              <MapView items={items} onSelect={onSelect} areaName={filters.area_name || null} height={600} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}