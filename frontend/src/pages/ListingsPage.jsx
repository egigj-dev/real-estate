import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap'
import Hero from '../components/Hero'
import FeatureBadges from '../components/FeatureBadges'
import ListingCard from '../components/ListingCard'
import SearchableList from '../components/SearchableList'
import { fetchListings } from '../api'

const MapView = lazy(() => import('../components/MapView'))

const ZONES = [
  { val: '',                 label: 'Të gjitha zonat'    },
  { val: 'Qendra & Blloku', label: '🏙️ Qendra & Blloku' },
  { val: 'Komuna e Parisit',label: '🌳 Komuna e Parisit' },
  { val: 'Periferia',       label: '🏘️ Periferia'        },
]

const DEFAULT_FILTERS = {
  q:                 '',
  per_page:          20,
  min_sqm:           30,
  max_sqm:           500,
  min_beds:          '',
  min_price:         '',
  max_price:         '',
  min_baths:         '',
  has_elevator:      false,
  has_garden:        false,
  has_parking_space: false,
  furnished:         '',
  neighborhood:      '',
  sort:              '',
}

function FancyCheck({ id, label, checked, onChange, icon }) {
  return (
    <label htmlFor={id} className={`fancy-check ${checked ? 'active' : ''}`}>
      <input id={id} type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      <span>{icon}</span> {label}
    </label>
  )
}

function ActiveFilters({ filters, onClear }) {
  const chips = []
  if (filters.neighborhood) chips.push(filters.neighborhood)
  if (filters.q)            chips.push(`"${filters.q}"`)
  if (filters.min_sqm !== 30 || filters.max_sqm !== 500)
    chips.push(`${filters.min_sqm}–${filters.max_sqm} m²`)
  if (filters.min_beds)   chips.push(`${filters.min_beds}+ dhoma`)
  if (filters.min_baths)  chips.push(`${filters.min_baths}+ banjo`)
  if (filters.min_price)  chips.push(`nga ${Number(filters.min_price).toLocaleString()} €`)
  if (filters.max_price)  chips.push(`deri ${Number(filters.max_price).toLocaleString()} €`)
  if (filters.has_elevator)       chips.push('Ashensor')
  if (filters.has_garden)         chips.push('Kopsht')
  if (filters.has_parking_space)  chips.push('Parking')
  if (filters.furnished === 'true')  chips.push('Mobiluar')
  if (filters.furnished === 'false') chips.push('Pa mobilim')
  if (filters.sort === 'price_asc')  chips.push('Çmim ↑')
  if (filters.sort === 'price_desc') chips.push('Çmim ↓')
  if (!chips.length) return null
  return (
    <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
      <small style={{ color: 'var(--muted)' }}>Filtra aktiv:</small>
      {chips.map(c => <span key={c} className="active-chip">{c}</span>)}
      <button className="clear-btn" onClick={onClear}>✕ Pastro</button>
    </div>
  )
}

export default function ListingsPage({ onSelect }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [draft,   setDraft]   = useState(DEFAULT_FILTERS)
  const [items,   setItems]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoad]    = useState(false)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('grid')    // 'grid' | 'list'
  const [showMap, setShowMap] = useState(true)      // map panel toggle

  const set = (key, val) => setDraft(d => ({ ...d, [key]: val }))

  const load = useCallback(async (f, p = 1) => {
    setLoad(true); setError(null)
    try {
      const data = await fetchListings({ ...f, page: p })
      setItems(data.listings ?? [])
      setTotal(data.total   ?? 0)
      setPages(data.pages   ?? 1)
      setPage(data.page     ?? 1)
    } catch (e) {
      setError(e.message); setItems([]); setTotal(0)
    } finally {
      setLoad(false)
    }
  }, [])

  useEffect(() => { load(DEFAULT_FILTERS, 1) }, [load])

  const handleSubmit = (e) => {
    e.preventDefault()
    setFilters(draft)
    load(draft, 1)
  }

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    load(DEFAULT_FILTERS, 1)
  }

  const goPage = (p) => load(filters, p)

  return (
    <>
      <Hero total={total} />
      <FeatureBadges />

      <Container fluid className="pb-5 px-3 px-lg-4">

        {/* ── Filter Panel ─────────────────────────────────────────────── */}
        <Card className="filter-panel mb-4">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 style={{ fontSize: 17, margin: 0 }}>🔍 Filtro Pronat</h2>
              <button className="clear-btn" onClick={handleReset}>↺ Reset</button>
            </div>

            <Form onSubmit={handleSubmit}>
              <Row className="g-2 mb-2">
                <Col xs={12} md={4}>
                  <div className="filter-label">Kërko</div>
                  <Form.Control className="filter-input" type="text"
                    value={draft.q} onChange={e => set('q', e.target.value)}
                    placeholder="rrugë, lagje, lloji…" />
                </Col>
                <Col xs={12} md={3}>
                  <div className="filter-label">Zona</div>
                  <Form.Select className="filter-input" value={draft.neighborhood}
                    onChange={e => set('neighborhood', e.target.value)}>
                    {ZONES.map(z => <option key={z.val} value={z.val}>{z.label}</option>)}
                  </Form.Select>
                </Col>
                <Col xs={6} md={3}>
                  <div className="filter-label">Rendit sipas</div>
                  <Form.Select className="filter-input" value={draft.sort}
                    onChange={e => set('sort', e.target.value)}>
                    <option value="">— Pa renditje —</option>
                    <option value="price_asc">Çmim ↑</option>
                    <option value="price_desc">Çmim ↓</option>
                  </Form.Select>
                </Col>
                <Col xs={6} md={2}>
                  <div className="filter-label">Rezultate</div>
                  <Form.Select className="filter-input" value={draft.per_page}
                    onChange={e => set('per_page', Number(e.target.value))}>
                    {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </Form.Select>
                </Col>
              </Row>

              <Row className="g-2 mb-2">
                <Col xs={12}>
                  <div className="filter-label">
                    Sipërfaqja: {draft.min_sqm}–{draft.max_sqm} m²
                  </div>
                  <div className="d-flex gap-3 align-items-center">
                    <div style={{ flex: 1 }}>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>Min</small>
                      <input type="range" className="range-slider"
                        min={10} max={500} step={10} value={draft.min_sqm}
                        onChange={e => {
                          const v = Number(e.target.value)
                          set('min_sqm', v > draft.max_sqm - 10 ? draft.max_sqm - 10 : v)
                        }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>Max</small>
                      <input type="range" className="range-slider"
                        min={10} max={500} step={10} value={draft.max_sqm}
                        onChange={e => {
                          const v = Number(e.target.value)
                          set('max_sqm', v < draft.min_sqm + 10 ? draft.min_sqm + 10 : v)
                        }} />
                    </div>
                    <div className="sqm-display">
                      <span>{draft.min_sqm}</span>
                      <span style={{ color: 'var(--muted)' }}>–</span>
                      <span>{draft.max_sqm} m²</span>
                    </div>
                  </div>
                </Col>
              </Row>

              <Row className="g-2 mb-2">
                <Col xs={6} sm={3}>
                  <div className="filter-label">Min dhoma</div>
                  <Form.Select className="filter-input" value={draft.min_beds}
                    onChange={e => set('min_beds', e.target.value)}>
                    <option value="">Të gjitha</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
                  </Form.Select>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="filter-label">Min banjo</div>
                  <Form.Select className="filter-input" value={draft.min_baths}
                    onChange={e => set('min_baths', e.target.value)}>
                    <option value="">Të gjitha</option>
                    {[1,2,3].map(n => <option key={n} value={n}>{n}+</option>)}
                  </Form.Select>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="filter-label">Çmim min (€)</div>
                  <Form.Control className="filter-input" type="number" placeholder="0"
                    value={draft.min_price} min={0}
                    onChange={e => set('min_price', e.target.value)} />
                </Col>
                <Col xs={6} sm={3}>
                  <div className="filter-label">Çmim max (€)</div>
                  <Form.Control className="filter-input" type="number" placeholder="∞"
                    value={draft.max_price} min={0}
                    onChange={e => set('max_price', e.target.value)} />
                </Col>
              </Row>

              <Row className="g-2 mb-3">
                <Col xs={12} md={6}>
                  <div className="filter-label mb-2">Amenitete</div>
                  <div className="d-flex flex-wrap gap-2">
                    <FancyCheck id="el" icon="🛗" label="Ashensor"
                      checked={draft.has_elevator} onChange={v => set('has_elevator', v)} />
                    <FancyCheck id="gd" icon="🌿" label="Kopsht"
                      checked={draft.has_garden} onChange={v => set('has_garden', v)} />
                    <FancyCheck id="pk" icon="🅿️" label="Parking"
                      checked={draft.has_parking_space} onChange={v => set('has_parking_space', v)} />
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="filter-label mb-2">Statusi i mobilimit</div>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { val: '',      label: 'Të gjitha'     },
                      { val: 'true',  label: '🪑 Mobiluar'   },
                      { val: 'false', label: '🚫 Pa mobilim' },
                    ].map(o => (
                      <button key={o.val} type="button"
                        className={`status-btn ${draft.furnished === o.val ? 'active' : ''}`}
                        onClick={() => set('furnished', o.val)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </Col>
              </Row>

              <Row className="g-2">
                <Col xs={12} md={4} className="ms-auto">
                  <Button type="submit" className="btn-search w-100">
                    ↗ Apliko Filtrat
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>

        {/* ── Status bar + view controls ────────────────────────────────── */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <small style={{ color: 'var(--muted)' }}>
            {loading
              ? <><span className="status-dot" /> Duke ngarkuar…</>
              : error
              ? <span style={{ color: 'var(--danger)' }}>Gabim</span>
              : `Duke shfaqur ${items.length} nga ${total} rezultate`}
          </small>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Map toggle */}
            <button
              className={`status-btn ${showMap ? 'active' : ''}`}
              onClick={() => setShowMap(m => !m)}
              title="Trego / fshih hartën"
            >
              🗺 {showMap ? 'Fshih hartën' : 'Trego hartën'}
            </button>

            {/* Grid / List toggle */}
            <div className="view-toggle">
              <button className={tab === 'grid' ? 'active' : ''} onClick={() => setTab('grid')}>
                ⊞ Grid
              </button>
              <button className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>
                ≡ Listë
              </button>
            </div>
          </div>
        </div>

        <ActiveFilters filters={filters} onClear={handleReset} />

        {error && (
          <div className="err-box mb-3">
            ⚠️ API nuk është aktiv në <code>http://127.0.0.1:8000</code>
            <br /><small>{error}</small>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="empty-box">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏙️</div>
            <div>Nuk u gjetën rezultate me këto filtra.</div>
            <button className="clear-btn mt-3" onClick={handleReset}>↺ Pastro filtrat</button>
          </div>
        )}

        {/* ── Split layout: listings + map side by side ─────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: showMap ? '1fr 420px' : '1fr',
          gap: 20,
          alignItems: 'start',
        }}>

          {/* Left — listings */}
          <div>
            {tab === 'grid' && (
              <Row xs={1} sm={showMap ? 1 : 2} md={showMap ? 2 : 3} className="g-3">
                {items.map((item, i) => (
                  <Col key={item.id}>
                    <ListingCard item={item} index={i} onClick={() => onSelect(item.id)} />
                  </Col>
                ))}
              </Row>
            )}

            {tab === 'list' && (
              <SearchableList items={items} onSelect={onSelect} />
            )}

            {/* Pagination */}
            {!loading && pages > 1 && (
              <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
                <button className="status-btn" disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                  style={{ opacity: page <= 1 ? 0.4 : 1 }}>
                  ← Para
                </button>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>
                  Faqja {page} nga {pages}
                </span>
                <button className="status-btn" disabled={page >= pages}
                  onClick={() => goPage(page + 1)}
                  style={{ opacity: page >= pages ? 0.4 : 1 }}>
                  Pas →
                </button>
              </div>
            )}
          </div>

          {/* Right — sticky map */}
          {showMap && (
            <div style={{ position: 'sticky', top: 80 }}>
              <Suspense fallback={
                <div style={{
                  height: 600, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--muted)', fontSize: 14,
                  border: '1px solid var(--border)', borderRadius: 16,
                }}>
                  <span className="status-dot" /> Duke ngarkuar hartën…
                </div>
              }>
                <MapView items={items} onSelect={onSelect} height={600} />
              </Suspense>
            </div>
          )}
        </div>

      </Container>
    </>
  )
}