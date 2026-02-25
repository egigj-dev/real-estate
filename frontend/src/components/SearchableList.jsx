import { useState, useMemo } from 'react'
import { Row, Col, Form } from 'react-bootstrap'
import { formatPrice, listingLabel } from '../api'

/**
 * SearchableList — client-side searchable table view.
 * Operates on the already-fetched `items` array, no extra API calls.
 * All field names match the backend response (price, beds, baths, sqm).
 */
export default function SearchableList({ items = [], onSelect }) {
  const [search,   setSearch]   = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minBeds,  setMinBeds]  = useState('')
  const [minBaths, setMinBaths] = useState('')
  const [minSqm,   setMinSqm]   = useState('')
  const [maxSqm,   setMaxSqm]   = useState('')

  const filtered = useMemo(() => {
    return items.filter(item => {
      // Text search: label (property_type + neighborhood + city)
      if (search) {
        const hay = listingLabel(item).toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      // Price  (backend field: price)
      if (minPrice !== '' && (item.price ?? 0)        < Number(minPrice)) return false
      if (maxPrice !== '' && (item.price ?? Infinity)  > Number(maxPrice)) return false
      // Beds   (backend field: beds)
      if (minBeds  !== '' && (item.beds  ?? 0)        < Number(minBeds))  return false
      // Baths  (backend field: baths)
      if (minBaths !== '' && (item.baths ?? 0)        < Number(minBaths)) return false
      // Sqm    (backend field: sqm)
      if (minSqm   !== '' && (item.sqm   ?? 0)        < Number(minSqm))   return false
      if (maxSqm   !== '' && (item.sqm   ?? Infinity)  > Number(maxSqm))   return false
      return true
    })
  }, [items, search, minPrice, maxPrice, minBeds, minBaths, minSqm, maxSqm])

  const clearAll = () => {
    setSearch(''); setMinPrice(''); setMaxPrice('')
    setMinBeds(''); setMinBaths(''); setMinSqm(''); setMaxSqm('')
  }

  return (
    <div className="searchable-list">
      {/* ── Inline filter bar ─────────────────────────────── */}
      <div className="sl-filters mb-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="filter-label" style={{ fontSize: 13, fontWeight: 700 }}>
            🔎 Kërko brenda rezultateve
          </span>
          <button className="clear-btn" onClick={clearAll}>✕ Pastro</button>
        </div>
        <Row className="g-2">
          <Col xs={12} md={4}>
            <div className="filter-label">Kërkim</div>
            <Form.Control
              className="filter-input" type="text"
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Lloji, zonë…"
            />
          </Col>
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
          <Col xs={6} md={1}>
            <div className="filter-label">Min dhoma</div>
            <Form.Select className="filter-input" value={minBeds} onChange={e => setMinBeds(e.target.value)}>
              <option value="">—</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
            </Form.Select>
          </Col>
          <Col xs={6} md={1}>
            <div className="filter-label">Min banjo</div>
            <Form.Select className="filter-input" value={minBaths} onChange={e => setMinBaths(e.target.value)}>
              <option value="">—</option>
              {[1,2,3].map(n => <option key={n} value={n}>{n}+</option>)}
            </Form.Select>
          </Col>
          <Col xs={6} md={1}>
            <div className="filter-label">Min m²</div>
            <Form.Control className="filter-input" type="number" placeholder="—"
              value={minSqm} min={0} onChange={e => setMinSqm(e.target.value)} />
          </Col>
          <Col xs={6} md={1}>
            <div className="filter-label">Max m²</div>
            <Form.Control className="filter-input" type="number" placeholder="—"
              value={maxSqm} min={0} onChange={e => setMaxSqm(e.target.value)} />
          </Col>
        </Row>
      </div>

      {/* ── Count ─────────────────────────────────────────── */}
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
                <th>Prona</th>
                <th>Lloji</th>
                <th>Çmimi</th>
                <th>m²</th>
                <th>€/m²</th>
                <th>Dhoma</th>
                <th>Banjo</th>
                <th>Kati</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} onClick={() => onSelect(item.id)} className="sl-row">
                  <td className="sl-addr">{listingLabel(item)}</td>
                  <td>
                    {item.property_type
                      ? <span className="type-badge">{item.property_type}</span>
                      : '—'}
                  </td>
                  <td className="sl-price">{formatPrice(item.price)}</td>
                  <td>{item.sqm ?? '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {item.price_per_sqm != null
                      ? `${Math.round(item.price_per_sqm).toLocaleString()}`
                      : '—'}
                  </td>
                  <td>{item.beds  ?? '—'}</td>
                  <td>{item.baths ?? '—'}</td>
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