import { useState, useEffect } from 'react'
import { Container, Card, Row, Col } from 'react-bootstrap'
import { fetchListing, fetchEstimate, fetchComps, formatPrice, formatBool, listingLabel } from '../api'

// ── Small key-value tile ──────────────────────────────────────────────────────
function KvItem({ label, value, cls = '' }) {
  return (
    <div className="kv-item">
      <div className="kv-label">{label}</div>
      <div className={`kv-value ${cls}`}>{value ?? '—'}</div>
    </div>
  )
}

// ── ML estimate badge ─────────────────────────────────────────────────────────
function LabelBadge({ label }) {
  const config = {
    Fair:        { bg: 'rgba(105, 240, 174, 0.15)', border: 'rgba(105,240,174,0.35)', color: '#69f0ae', icon: '✓' },
    Overpriced:  { bg: 'rgba(239, 154, 154, 0.15)', border: 'rgba(239,154,154,0.35)', color: '#ef9a9a', icon: '↑' },
    Underpriced: { bg: 'rgba(79, 195, 247, 0.15)',  border: 'rgba(79,195,247,0.35)',  color: '#4fc3f7', icon: '↓' },
  }
  const c = config[label] || config.Fair
  const text = label === 'Fair' ? 'Çmim i drejtë' : label === 'Overpriced' ? 'Çmim i lartë' : 'Çmim i ulët'
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, borderRadius: 20, padding: '5px 14px',
      fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {c.icon} {text}
    </span>
  )
}

// ── Comp mini-card ────────────────────────────────────────────────────────────
function CompCard({ comp, onSelect }) {
  return (
    <div
      onClick={() => onSelect(comp.id)}
      style={{
        background: 'rgba(10,25,41,0.7)',
        border: '1px solid var(--border)',
        borderRadius: 12, padding: '14px 16px',
        cursor: 'pointer', minWidth: 200, flex: '0 0 auto',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(79,195,247,0.35)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ fontSize: 18, fontFamily: "'DM Serif Display', serif", color: 'var(--gold)', marginBottom: 4 }}>
        {formatPrice(comp.price)}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
        {comp.sqm} m² · {comp.rooms} dhoma
      </div>
      <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>
        📍 {comp.distance_label}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        {comp.similarity_reason}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DetailPage({ id, onBack, onSelect }) {
  const [item,     setItem]     = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [comps,    setComps]    = useState(null)
  const [loading,  setLoad]     = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!id) return
    setLoad(true); setError(null); setItem(null); setEstimate(null); setComps(null)

    // Load all three in parallel; estimate/comps failures are non-fatal
    Promise.all([
      fetchListing(id),
      fetchEstimate(id).catch(() => null),
      fetchComps(id).catch(() => null),
    ])
      .then(([listing, est, cmps]) => {
        setItem(listing)
        setEstimate(est)
        setComps(cmps?.comps ?? null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoad(false))
  }, [id])

  const bv = (v) => formatBool(v)

  return (
    <Container className="py-4 pb-5" style={{ maxWidth: 900 }}>
      <button className="back-btn mb-4" onClick={onBack}>
        ← Kthehu te listat
      </button>

      {loading && (
        <p style={{ color: 'var(--muted)' }}>
          <span className="status-dot" /> Duke ngarkuar…
        </p>
      )}

      {error && (
        <div className="err-box">
          ⚠️ Nuk mund të ngarkohet prona {id}. A është API aktiv?
          <br /><small>{error}</small>
        </div>
      )}

      {item && (
        <>
          {/* ── Header card ─────────────────────────────────────────────── */}
          <Card className="detail-panel mb-4">
            <Card.Body className="p-4">
              <div className="mb-4">
                {item.property_type && (
                  <div className="mb-2">
                    <span className="type-badge">{item.property_type}</span>
                    {item.neighborhood && (
                      <span className="type-badge ms-2" style={{ background: 'rgba(255,213,79,0.1)', borderColor: 'rgba(255,213,79,0.25)', color: 'var(--gold)' }}>
                        {item.neighborhood}
                      </span>
                    )}
                  </div>
                )}
                <h1 style={{ fontSize: 24, marginBottom: 8 }}>
                  {listingLabel(item)}
                </h1>
                <p className="detail-price">{formatPrice(item.price)}</p>
                {item.price_per_sqm != null && (
                  <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
                    {Math.round(item.price_per_sqm).toLocaleString()} €/m²
                  </p>
                )}
              </div>

              {/* Key details */}
              <div className="section-title mb-3">🏠 Detajet Kryesore</div>
              <Row xs={2} sm={3} lg={5} className="g-2 mb-4">
                <Col><KvItem label="Lloji"     value={item.property_type} /></Col>
                <Col><KvItem label="Kati"      value={item.floor} /></Col>
                <Col><KvItem label="Sipërfaqja" value={item.sqm != null ? `${item.sqm} m²` : null} /></Col>
                <Col><KvItem label="Dhoma gjumi" value={item.beds} /></Col>
                <Col><KvItem label="Banjo"     value={item.baths} /></Col>
              </Row>

              {/* Amenities */}
              <div className="section-title mb-3">✨ Amenitete</div>
              <Row xs={2} sm={4} className="g-2 mb-4">
                {[
                  { label: 'Ashensor',  v: item.has_elevator },
                  { label: 'Tarracë',   v: item.has_terrace },
                  { label: 'Parking',   v: item.has_parking_space },
                  { label: 'Mobiluar',  v: item.furnished },
                  { label: 'Kopsht',    v: item.has_garden },
                  { label: 'Garazh',    v: item.has_garage },
                ].map(({ label, v }) => {
                  const { label: txt, cls } = bv(v)
                  return <Col key={label}><KvItem label={label} value={txt} cls={cls} /></Col>
                })}
              </Row>

              {/* Location */}
              {(item.latitude != null || item.longitude != null) && (
                <>
                  <div className="section-title mb-3">📍 Koordinata GPS</div>
                  <Row xs={2} className="g-2 mb-4">
                    <Col><KvItem label="Gjerësia (Lat)" value={item.latitude} /></Col>
                    <Col><KvItem label="Gjatësia (Lng)" value={item.longitude} /></Col>
                  </Row>
                </>
              )}

              {/* Description */}
              <div className="section-title mb-3">📝 Përshkrimi</div>
              <div className="desc-box">
                {item.description || '(Nuk ka përshkrim)'}
              </div>
            </Card.Body>
          </Card>

          {/* ── ML Estimate card ─────────────────────────────────────────── */}
          {estimate && (
            <Card className="detail-panel mb-4">
              <Card.Body className="p-4">
                <div className="section-title mb-3" style={{ marginBottom: 16 }}>
                  🤖 Vlerësimi ML i Çmimit
                </div>

                <Row className="g-3 align-items-center">
                  {/* Estimated price */}
                  <Col xs={12} sm={4}>
                    <div className="kv-item text-center">
                      <div className="kv-label">Çmim i vlerësuar</div>
                      <div style={{ fontSize: 26, fontFamily: "'DM Serif Display',serif", color: 'var(--accent)', marginTop: 4 }}>
                        {formatPrice(estimate.estimated_price)}
                      </div>
                    </div>
                  </Col>

                  {/* Fair range */}
                  <Col xs={12} sm={4}>
                    <div className="kv-item text-center">
                      <div className="kv-label">Diapazoni i drejtë</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>
                        {formatPrice(estimate.range_low)}
                        <span style={{ color: 'var(--muted)', margin: '0 6px' }}>–</span>
                        {formatPrice(estimate.range_high)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>±8% rreth vlerës</div>
                    </div>
                  </Col>

                  {/* Label */}
                  <Col xs={12} sm={4}>
                    <div className="kv-item text-center">
                      <div className="kv-label">Vlerësimi</div>
                      <div style={{ marginTop: 8 }}>
                        <LabelBadge label={estimate.label} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                        Çmimi real: {formatPrice(item.price)}
                      </div>
                    </div>
                  </Col>
                </Row>

                {/* Inline price vs range bar */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                    Pozicioni i çmimit brenda diapazonit të drejtë
                  </div>
                  <PriceBar
                    actual={item.price}
                    low={estimate.range_low}
                    high={estimate.range_high}
                    estimated={estimate.estimated_price}
                  />
                </div>
              </Card.Body>
            </Card>
          )}

          {/* ── Comparable listings ───────────────────────────────────────── */}
          {comps && comps.length > 0 && (
            <Card className="detail-panel">
              <Card.Body className="p-4">
                <div className="section-title mb-1">🏘️ Prona të Ngjashme (Comps)</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                  5 pronat me ngjashmëri më të lartë sipas sipërfaqes, dhomave dhe zonës.
                  Kliko për të parë detajet.
                </p>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                  {comps.map(comp => (
                    <CompCard key={comp.id} comp={comp} onSelect={onSelect ?? onBack} />
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </Container>
  )
}

// ── Price bar visualisation ───────────────────────────────────────────────────
function PriceBar({ actual, low, high, estimated }) {
  // Map price to 0–100% within a padded range
  const pad   = (high - low) * 0.3
  const min   = low  - pad
  const max   = high + pad
  const range = max - min || 1

  const pct = (v) => Math.max(0, Math.min(100, ((v - min) / range) * 100))

  const estPct    = pct(estimated)
  const actualPct = pct(actual)
  const lowPct    = pct(low)
  const highPct   = pct(high)

  return (
    <div style={{ position: 'relative', height: 28, marginTop: 8 }}>
      {/* Background track */}
      <div style={{
        position: 'absolute', top: 11, left: 0, right: 0,
        height: 6, background: 'rgba(100,180,255,0.1)', borderRadius: 3,
      }} />
      {/* Fair range band */}
      <div style={{
        position: 'absolute', top: 11,
        left: `${lowPct}%`, width: `${highPct - lowPct}%`,
        height: 6, background: 'rgba(105,240,174,0.25)',
        borderRadius: 3, border: '1px solid rgba(105,240,174,0.3)',
      }} />
      {/* Estimated marker */}
      <div style={{
        position: 'absolute', top: 6,
        left: `${estPct}%`, transform: 'translateX(-50%)',
        width: 3, height: 16,
        background: 'var(--accent)', borderRadius: 2,
      }} title={`Vlerësim: ${Math.round(estimated).toLocaleString()} €`} />
      {/* Actual price marker */}
      <div style={{
        position: 'absolute', top: 4,
        left: `${actualPct}%`, transform: 'translateX(-50%)',
        width: 20, height: 20,
        background: actual > high ? 'var(--danger)' : actual < low ? 'var(--accent)' : 'var(--success)',
        borderRadius: '50%', border: '2px solid var(--bg)',
        boxShadow: '0 0 8px rgba(0,0,0,0.4)',
      }} title={`Çmimi real: ${Math.round(actual).toLocaleString()} €`} />
    </div>
  )
}