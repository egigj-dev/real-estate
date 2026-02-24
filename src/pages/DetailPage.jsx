import { useState, useEffect } from 'react'
import { Container, Card, Row, Col } from 'react-bootstrap'
import { fetchListing, formatPrice, formatBool } from '../api'

function KvItem({ label, value, cls = '' }) {
  return (
    <div className="kv-item">
      <div className="kv-label">{label}</div>
      <div className={`kv-value ${cls}`}>{value}</div>
    </div>
  )
}

export default function DetailPage({ id, onBack }) {
  const [item, setItem]   = useState(null)
  const [loading, setLoad] = useState(true)
  const [error, setError]  = useState(null)

  useEffect(() => {
    setLoad(true); setError(null); setItem(null)
    fetchListing(id)
      .then(setItem)
      .catch((e) => setError(e.message))
      .finally(() => setLoad(false))
  }, [id])

  const bv = (v) => formatBool(v)

  return (
    <Container className="py-4 pb-5" style={{ maxWidth: 860 }}>
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
        <Card className="detail-panel">
          <Card.Body className="p-4">
            {/* Header */}
            <div className="mb-4">
              {item.main_property_property_type && (
                <div className="mb-2">
                  <span className="type-badge">{item.main_property_property_type}</span>
                </div>
              )}
              <h1 style={{ fontSize: 26, marginBottom: 8 }}>
                {item.main_property_location_city_zone_formatted_address || 'Adresë e panjohur'}
              </h1>
              <p className="detail-price">{formatPrice(item.price_in_euro)}</p>
            </div>

            {/* Key details */}
            <div className="section-title mb-3">🏠 Detajet Kryesore</div>
            <Row xs={2} sm={3} className="g-2 mb-4">
              <Col><KvItem label="Lloji"           value={item.main_property_property_type || '—'} /></Col>
              <Col><KvItem label="Kati"            value={item.main_property_floor ?? '—'} /></Col>
              <Col><KvItem label="Sipërfaqja (m²)" value={item.main_property_property_square ?? '—'} /></Col>
              <Col><KvItem label="Dhoma gjumi"     value={item.main_property_property_composition_bedrooms ?? '—'} /></Col>
              <Col><KvItem label="Banjo"           value={item.main_property_property_composition_bathrooms ?? '—'} /></Col>
            </Row>

            {/* Amenities */}
            <div className="section-title mb-3">✨ Amenitete</div>
            <Row xs={2} sm={4} className="g-2 mb-4">
              {[
                { label: 'Ashensor', v: item.main_property_has_elevator },
                { label: 'Tarracë',  v: item.main_property_has_terrace },
                { label: 'Parking',  v: item.main_property_has_parking },
                { label: 'Mobiluar', v: item.main_property_is_furnished },
              ].map(({ label, v }) => {
                const { label: txt, cls } = bv(v)
                return <Col key={label}><KvItem label={label} value={txt} cls={cls} /></Col>
              })}
            </Row>

            {/* Location */}
            {(item.main_property_location_city_zone_lat != null ||
              item.main_property_location_city_zone_lng != null) && (
              <>
                <div className="section-title mb-3">📍 Koordinata GPS</div>
                <Row xs={2} className="g-2 mb-4">
                  <Col>
                    <KvItem label="Gjerësia (Lat)" value={item.main_property_location_city_zone_lat ?? '—'} />
                  </Col>
                  <Col>
                    <KvItem label="Gjatësia (Lng)" value={item.main_property_location_city_zone_lng ?? '—'} />
                  </Col>
                </Row>
              </>
            )}

            {/* Description */}
            <div className="section-title mb-3">📝 Përshkrimi</div>
            <div className="desc-box">
              {item.main_property_description_text_content_original_text || '(Nuk ka përshkrim)'}
            </div>
          </Card.Body>
        </Card>
      )}
    </Container>
  )
}
