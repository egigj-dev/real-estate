import { useState, useMemo } from 'react'
import { Row, Col, Form } from 'react-bootstrap'
import { formatPrice } from '../api'

/**
 * SearchableList — client-side searchable & filterable table/list view.
 * Operates on the already-fetched `items` array, no extra API calls.
 * Provides: text search, price range, beds, baths, sqm, custom field.
 */
export default function SearchableList({ items = [], onSelect }) {
  const [search,    setSearch]    = useState('')
  const [minPrice,  setMinPrice]  = useState('')
  const [maxPrice,  setMaxPrice]  = useState('')
  const [minBeds,   setMinBeds]   = useState('')
  const [minBaths,  setMinBaths]  = useState('')
  const [minSqm,    setMinSqm]    = useState('')
  const [maxSqm,    setMaxSqm]    = useState('')
  const [custom,    setCustom]    = useState('')

  const filtered = useMemo(() => {
    return items.filter(item => {
      // Text search across address + type
      if (search) {
        const hay = `${item.address || ''} ${item.property_type || ''}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      // Price
      if (minPrice !== '' && (item.price_in_euro ?? 0) < Number(minPrice)) return false
      if (maxPrice !== '' && (item.price_in_euro ?? Infinity) > Number(maxPrice)) return false
      // Beds
      if (minBeds !== '' && (item.bedrooms ?? 0) < Number(minBeds)) return false
      // Baths
      if (minBaths !== '' && (item.bathrooms ?? 0) < Number(minBaths)) return false
      // Sqm
      if (minSqm !== '' && (item.sqm ?? 0) < Number(minSqm)) return false
      if (maxSqm !== '' && (item.sqm ?? Infinity) > Number(maxSqm)) return false
      // Custom free text across all string fields
      if (custom) {
        const allText = JSON.stringify(item).toLowerCase()
        if (!allText.includes(custom.toLowerCase())) return false
      }
      return true
    })
  }, [items, search, minPrice, maxPrice, minBeds, minBaths, minSqm, maxSqm, custom])

  const clearAll = () => {
    setSearch(''); setMinPrice(''); setMaxPrice('')
    setMinBeds(''); setMinBaths(''); setMinSqm(''); setMaxSqm(''); setCustom('')
  }

  return (
    <div className="searchable-list">
      {/* ── Inline filter bar ─────────────────────────────── */}
      <div className="sl-filters mb-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="filter-label" style={{ fontSize: 13, fontWeight: 700 }}>
            🔎 Kërko & filtro në listë
          </span>
          <button className="clear-btn" onClick={clearAll}>✕ Pastro</button>
        </div>
        <Row className="g-2">
          {/* Search */}
          <Col xs={12} md={4}>
            <div className="filter-label">Kërkim</div>
            <Form.Control
              className="filter-input"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Adresë, lloji…"
            />
          </Col>
          {/* Price range */}
          <Col xs={6} md={2}>
            <div className="filter-label">Çmim min €</div>
            <Form.Control className="filter-input" type="number" placeholder="0"
              value={minPrice} min={0} onChange={e => setMinPrice(e.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <div className="filter-label">Çmim max €</div>
            <Form.Control className="filter-input" type="number" placeholder="∞"
              value={maxPrice} min={0} onChange={e => setMaxPrice(e.target.value)} />
          </Col>
          {/* Beds / Baths */}
          <Col xs={6} md={2}>
            <div className="filter-label">Min dhoma</div>
            <Form.Select className="filter-input" value={minBeds} onChange={e => setMinBeds(e.target.value)}>
              <option value="">Të gjitha</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <div className="filter-label">Min banjo</div>
            <Form.Select className="filter-input" value={minBaths} onChange={e => setMinBaths(e.target.value)}>
              <option value="">Të gjitha</option>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n}+</option>)}
            </Form.Select>
          </Col>
          {/* Sqm range */}
          <Col xs={6} md={2}>
            <div className="filter-label">Min m²</div>
            <Form.Control className="filter-input" type="number" placeholder="30"
              value={minSqm} min={0} onChange={e => setMinSqm(e.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <div className="filter-label">Max m²</div>
            <Form.Control className="filter-input" type="number" placeholder="500"
              value={maxSqm} min={0} onChange={e => setMaxSqm(e.target.value)} />
          </Col>
          {/* Custom */}
          <Col xs={12} md={8}>
            <div className="filter-label">🎛️ Filtër i personalizuar (kërko çdo fushë)</div>
            <Form.Control
              className="filter-input"
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="p.sh. 'penthouse', 'duplex', 'Blloku'…"
            />
          </Col>
        </Row>
      </div>

      {/* ── Results count ─────────────────────────────────── */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <small style={{ color: 'var(--muted)' }}>
          {filtered.length} nga {items.length} prona
        </small>
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="empty-box">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div>Asnjë rezultat me këto filtra.</div>
        </div>
      ) : (
        <div className="sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
                <th>Adresa</th>
                <th>Lloji</th>
                <th>Çmimi</th>
                <th>m²</th>
                <th>Dhoma</th>
                <th>Banjo</th>
                <th>Kati</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item.id)} className="sl-row">
                  <td className="sl-addr">{item.address || '—'}</td>
                  <td>
                    {item.property_type
                      ? <span className="type-badge">{item.property_type}</span>
                      : '—'}
                  </td>
                  <td className="sl-price">{formatPrice(item.price_in_euro)}</td>
                  <td>{item.sqm ?? '—'}</td>
                  <td>{item.bedrooms ?? '—'}</td>
                  <td>{item.bathrooms ?? '—'}</td>
                  <td>{item.floor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
