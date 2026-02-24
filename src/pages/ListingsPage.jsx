import { useState, useEffect, useCallback } from 'react'
import {
  Container, Row, Col, Card, Form, Button, Badge
} from 'react-bootstrap'
import Hero from '../components/Hero'
import FeatureBadges from '../components/FeatureBadges'
import ListingCard from '../components/ListingCard'
import SearchableList from '../components/SearchableList'
import { fetchListings } from '../api'

// ─── Default filter state ─────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
  query:     '',
  limit:     20,
  sqm_min:   30,
  sqm_max:   500,
  bedrooms:  '',
  price_min: '',
  price_max: '',
  baths:     '',
  elevator:  false,
  garden:    false,
  parking:   false,
  furnished: '',     // '' | 'furnished' | 'unfurnished' | 'partly_furnished'
  sort:      '',     // '' | 'price_asc' | 'price_desc'
  custom:    '',
}

// ─── Small reusable styled checkbox ──────────────────────────────────────────
function FancyCheck({ id, label, checked, onChange, icon }) {
  return (
    <label htmlFor={id} className={`fancy-check ${checked ? 'active' : ''}`}>
      <input
        id={id} type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      <span>{icon}</span> {label}
    </label>
  )
}

// ─── Active filter chips ──────────────────────────────────────────────────────
function ActiveFilters({ filters, onClear }) {
  const chips = []
  if (filters.sqm_min !== 30 || filters.sqm_max !== 500)
    chips.push(`${filters.sqm_min}–${filters.sqm_max} m²`)
  if (filters.bedrooms) chips.push(`${filters.bedrooms} dhoma`)
  if (filters.baths)    chips.push(`${filters.baths} banjo`)
  if (filters.price_min) chips.push(`nga ${filters.price_min} €`)
  if (filters.price_max) chips.push(`deri ${filters.price_max} €`)
  if (filters.elevator) chips.push('Ashensor')
  if (filters.garden)   chips.push('Kopsht')
  if (filters.parking)  chips.push('Parking')
  if (filters.furnished) chips.push(
    filters.furnished === 'furnished' ? 'Mobiluar' :
    filters.furnished === 'unfurnished' ? 'Pa mobilim' : 'Gjysmë mobiluar'
  )
  if (filters.sort) chips.push(filters.sort === 'price_asc' ? 'Çmim ↑' : 'Çmim ↓')
  if (filters.custom) chips.push(`"${filters.custom}"`)

  if (!chips.length) return null
  return (
    <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
      <small style={{ color: 'var(--muted)' }}>Filtra aktiv:</small>
      {chips.map(c => (
        <span key={c} className="active-chip">{c}</span>
      ))}
      <button className="clear-btn" onClick={onClear}>✕ Pastro</button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ListingsPage({ onSelect }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [draft,   setDraft]   = useState(DEFAULT_FILTERS)
  const [items,   setItems]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoad]    = useState(false)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('grid') // 'grid' | 'list'

  const set = (key, val) => setDraft(d => ({ ...d, [key]: val }))

  const load = useCallback(async (f) => {
    setLoad(true); setError(null)
    try {
      const data = await fetchListings({
        q:         f.query,
        limit:     f.limit,
        sqm_min:   f.sqm_min,
        sqm_max:   f.sqm_max,
        bedrooms:  f.bedrooms,
        price_min: f.price_min,
        price_max: f.price_max,
        baths:     f.baths,
        elevator:  f.elevator ? 'true' : '',
        garden:    f.garden   ? 'true' : '',
        parking:   f.parking  ? 'true' : '',
        furnished: f.furnished,
        sort:      f.sort,
        custom:    f.custom,
      })
      setItems(data.items || [])
      setTotal(data.total ?? (data.items || []).length)
    } catch (e) {
      setError(e.message); setItems([]); setTotal(0)
    } finally {
      setLoad(false)
    }
  }, [])

  useEffect(() => { load(DEFAULT_FILTERS) }, [load])

  const handleSubmit = (e) => {
    e.preventDefault()
    setFilters(draft)
    load(draft)
  }

  const handleReset = () => {
    setDraft(DEFAULT_FILTERS)
    setFilters(DEFAULT_FILTERS)
    load(DEFAULT_FILTERS)
  }

  return (
    <>
      <Hero total={total} />
      <FeatureBadges />

      <Container className="pb-5">
        {/* ── Filter Panel ─────────────────────────────────────────────── */}
        <Card className="filter-panel mb-4">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 style={{ fontSize: 17, margin: 0 }}>🔍 Filtro Pronat</h2>
              <button className="clear-btn" onClick={handleReset}>↺ Reset</button>
            </div>

            <Form onSubmit={handleSubmit}>
              {/* Row 1 — Search + Sort */}
              <Row className="g-2 mb-2">
                <Col xs={12} md={5}>
                  <div className="filter-label">Kërko adresë</div>
                  <Form.Control
                    className="filter-input"
                    type="text"
                    value={draft.query}
                    onChange={e => set('query', e.target.value)}
                    placeholder="p.sh. Kodra e Diellit…"
                  />
                </Col>
                <Col xs={6} md={3}>
                  <div className="filter-label">Rendit sipas</div>
                  <Form.Select
                    className="filter-input"
                    value={draft.sort}
                    onChange={e => set('sort', e.target.value)}
                  >
                    <option value="">— Pa renditje —</option>
                    <option value="price_asc">Çmim: i ulët → i lartë ↑</option>
                    <option value="price_desc">Çmim: i lartë → i ulët ↓</option>
                  </Form.Select>
                </Col>
                <Col xs={6} md={2}>
                  <div className="filter-label">Limit</div>
                  <Form.Control
                    className="filter-input"
                    type="number"
                    value={draft.limit}
                    min={1} max={100}
                    onChange={e => set('limit', Number(e.target.value))}
                  />
                </Col>
              </Row>

              {/* Row 2 — SQM range */}
              <Row className="g-2 mb-2">
                <Col xs={12}>
                  <div className="filter-label">
                    Sipërfaqja: {draft.sqm_min} m² — {draft.sqm_max} m²
                  </div>
                  <div className="d-flex gap-3 align-items-center">
                    <div style={{ flex: 1 }}>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>Min</small>
                      <input
                        type="range"
                        className="range-slider"
                        min={30} max={500} step={10}
                        value={draft.sqm_min}
                        onChange={e => {
                          const v = Number(e.target.value)
                          set('sqm_min', v > draft.sqm_max - 10 ? draft.sqm_max - 10 : v)
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>Max</small>
                      <input
                        type="range"
                        className="range-slider"
                        min={30} max={500} step={10}
                        value={draft.sqm_max}
                        onChange={e => {
                          const v = Number(e.target.value)
                          set('sqm_max', v < draft.sqm_min + 10 ? draft.sqm_min + 10 : v)
                        }}
                      />
                    </div>
                    <div className="sqm-display">
                      <span>{draft.sqm_min}</span>
                      <span style={{ color: 'var(--muted)' }}>–</span>
                      <span>{draft.sqm_max} m²</span>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Row 3 — Rooms / Baths / Price */}
              <Row className="g-2 mb-2">
                <Col xs={6} sm={3}>
                  <div className="filter-label">Dhoma</div>
                  <Form.Select className="filter-input" value={draft.bedrooms} onChange={e => set('bedrooms', e.target.value)}>
                    <option value="">Të gjitha</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
                  </Form.Select>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="filter-label">Banjo</div>
                  <Form.Select className="filter-input" value={draft.baths} onChange={e => set('baths', e.target.value)}>
                    <option value="">Të gjitha</option>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n}+</option>)}
                  </Form.Select>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="filter-label">Çmim min (€)</div>
                  <Form.Control
                    className="filter-input" type="number" placeholder="0"
                    value={draft.price_min} min={0}
                    onChange={e => set('price_min', e.target.value)}
                  />
                </Col>
                <Col xs={6} sm={3}>
                  <div className="filter-label">Çmim max (€)</div>
                  <Form.Control
                    className="filter-input" type="number" placeholder="∞"
                    value={draft.price_max} min={0}
                    onChange={e => set('price_max', e.target.value)}
                  />
                </Col>
              </Row>

              {/* Row 4 — Amenities + Status */}
              <Row className="g-2 mb-3">
                <Col xs={12} md={6}>
                  <div className="filter-label mb-2">Amenitete</div>
                  <div className="d-flex flex-wrap gap-2">
                    <FancyCheck id="el" icon="🛗" label="Ashensor" checked={draft.elevator} onChange={v => set('elevator', v)} />
                    <FancyCheck id="gd" icon="🌿" label="Kopsht"   checked={draft.garden}   onChange={v => set('garden', v)}   />
                    <FancyCheck id="pk" icon="🅿️" label="Parking"  checked={draft.parking}  onChange={v => set('parking', v)}  />
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div className="filter-label mb-2">Statusi i mobilimit</div>
                  <div className="d-flex flex-wrap gap-2">
                    {[
                      { val: '',                   label: 'Të gjitha'        },
                      { val: 'furnished',           label: '🪑 Mobiluar'     },
                      { val: 'unfurnished',         label: '🚫 Pa mobilim'   },
                      { val: 'partly_furnished',    label: '⚡ Gjysmë'      },
                    ].map(o => (
                      <button
                        key={o.val}
                        type="button"
                        className={`status-btn ${draft.furnished === o.val ? 'active' : ''}`}
                        onClick={() => set('furnished', o.val)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </Col>
              </Row>

              {/* Row 5 — Custom filter */}
              <Row className="g-2 mb-3">
                <Col xs={12} md={8}>
                  <div className="filter-label">🎛️ Filtër i personalizuar</div>
                  <Form.Control
                    className="filter-input"
                    type="text"
                    value={draft.custom}
                    onChange={e => set('custom', e.target.value)}
                    placeholder="Kërko çdo fushë… p.sh. 'duplex', 'penthouse', 'Blloku'"
                  />
                </Col>
                <Col xs={12} md={4} className="d-flex align-items-end">
                  <Button type="submit" className="btn-search w-100">
                    ↗ Apliko Filtrat
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>

        {/* ── Status bar + View toggle ──────────────────────────────────── */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <small style={{ color: 'var(--muted)' }}>
            {loading
              ? <><span className="status-dot" />Duke ngarkuar…</>
              : error
              ? <span style={{ color: 'var(--danger)' }}>Gabim gjatë ngarkimit</span>
              : `Duke shfaqur ${items.length} nga ${total} rezultate`
            }
          </small>
          <div className="view-toggle">
            <button
              className={tab === 'grid' ? 'active' : ''}
              onClick={() => setTab('grid')}
              title="Pamja grid"
            >⊞ Grid</button>
            <button
              className={tab === 'list' ? 'active' : ''}
              onClick={() => setTab('list')}
              title="Lista me kërkim"
            >≡ Listë</button>
          </div>
        </div>

        {/* ── Active filter chips ───────────────────────────────────────── */}
        <ActiveFilters filters={filters} onClear={handleReset} />

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="err-box mb-3">
            ⚠️ Nuk mund të ngarkohen listat. A është API aktiv?<br />
            <small>{error}</small>
          </div>
        )}

        {/* ── Empty ──────────────────────────────────────────────────────── */}
        {!loading && !error && items.length === 0 && (
          <div className="empty-box">
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏙️</div>
            <div>Nuk u gjetën rezultate.</div>
          </div>
        )}

        {/* ── Grid View ──────────────────────────────────────────────────── */}
        {tab === 'grid' && (
          <Row xs={1} sm={2} lg={3} className="g-3">
            {items.map((item, i) => (
              <Col key={item.id}>
                <ListingCard item={item} index={i} onClick={() => onSelect(item.id)} />
              </Col>
            ))}
          </Row>
        )}

        {/* ── Searchable List View ────────────────────────────────────────── */}
        {tab === 'list' && (
          <SearchableList items={items} onSelect={onSelect} />
        )}
      </Container>
    </>
  )
}

