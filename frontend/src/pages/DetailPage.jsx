import { useState, useEffect, useRef } from 'react'
import { Container, Card, Row, Col } from 'react-bootstrap'
import { fetchListing, fetchEstimate, fetchComps, formatPrice, formatBool, listingLabel } from '../api'

// ── Leaflet CDN ───────────────────────────────────────────────────────────────
const L_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const L_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href
  document.head.appendChild(l)
}
function loadScript(src) {
  return new Promise(res => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return }
    const s = document.createElement('script'); s.src = src; s.onload = res
    document.head.appendChild(s)
  })
}

// ── Overpass API — fetch nearby POIs ─────────────────────────────────────────
const OVERPASS = 'https://overpass-api.de/api/interpreter'

const POI_TYPES = [
  { key: 'schools',   label: 'Shkolla',          icon: '🏫', color: '#4fc3f7',
    query: (r, lat, lon) => `node["amenity"~"school|kindergarten|college|university"](around:${r},${lat},${lon});way["amenity"~"school|kindergarten"](around:${r},${lat},${lon});` },
  { key: 'hospitals', label: 'Spitale / Klinika', icon: '🏥', color: '#ef9a9a',
    query: (r, lat, lon) => `node["amenity"~"hospital|clinic|pharmacy|dentist|doctors"](around:${r},${lat},${lon});` },
  { key: 'social',    label: 'Parqe & Kulturë',  icon: '🌳', color: '#81c784',
    query: (r, lat, lon) => `node["leisure"~"park|playground|garden|fitness_centre|sports_centre"](around:${r},${lat},${lon});way["leisure"~"park|garden"](around:${r},${lat},${lon});node["amenity"~"theatre|cinema|arts_centre|community_centre"](around:${r},${lat},${lon});node["shop"~"mall|supermarket"](around:${r},${lat},${lon});` },
  { key: 'transport', label: 'Transport publik',  icon: '🚌', color: '#ffb74d',
    query: (r, lat, lon) => `node["highway"="bus_stop"](around:${r},${lat},${lon});node["public_transport"~"stop_position|platform"](around:${r},${lat},${lon});node["amenity"="taxi"](around:${r},${lat},${lon});` },
]

async function fetchAmenities(lat, lon, radius = 1200) {
  const parts = POI_TYPES.map(t => t.query(radius, lat, lon)).join('')
  const body  = `[out:json][timeout:15];(${parts});out center;`
  const res   = await fetch(OVERPASS, {
    method: 'POST',
    body:   `data=${encodeURIComponent(body)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) throw new Error('Overpass error')
  const data = await res.json()
  return data.elements || []
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, d2r = Math.PI / 180
  const dLat = (lat2 - lat1) * d2r, dLon = (lon2 - lon1) * d2r
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Human-readable labels for OSM tags
const POI_LABEL_MAP = {
  // schools
  school: 'Shkollë', kindergarten: 'Kopësht fëmijësh', college: 'Kolegj', university: 'Universitet',
  // hospitals
  hospital: 'Spital', clinic: 'Klinikë', pharmacy: 'Farmaci', dentist: 'Dentist', doctors: 'Mjek',
  // social
  park: 'Park', playground: 'Lojëtore', garden: 'Kopsht publik',
  fitness_centre: 'Qendër fitness', sports_centre: 'Qendër sportive',
  theatre: 'Teatër', cinema: 'Kinema', arts_centre: 'Qendër artesh',
  community_centre: 'Qendër komunitare',
  mall: 'Qendër tregtare', supermarket: 'Supermarket',
  // transport
  bus_stop: 'Stacion autobusi', taxi: 'Stacion taksi', stop_position: 'Stacion tranzit',
  platform: 'Platformë tranziti',
}

function poiLabel(el) {
  const t = el.tags || {}
  // Named POI: use its real name
  if (t.name && t.name.length > 1) return t.name
  // Fallback: translate the OSM tag
  const tag = t.amenity || t.leisure || t.shop || t.highway || t.public_transport || ''
  return POI_LABEL_MAP[tag] || tag
}

function classifyPOI(el) {
  const t = el.tags || {}
  if (['school','kindergarten','college','university'].includes(t.amenity)) return 'schools'
  if (['hospital','clinic','pharmacy','dentist','doctors'].includes(t.amenity)) return 'hospitals'
  if (['park','playground','garden','fitness_centre','sports_centre'].includes(t.leisure)) return 'social'
  if (['theatre','cinema','arts_centre','community_centre'].includes(t.amenity)) return 'social'
  if (['mall','supermarket'].includes(t.shop)) return 'social'
  if (t.highway === 'bus_stop' || ['stop_position','platform'].includes(t.public_transport) || t.amenity === 'taxi') return 'transport'
  return null
}

// Deduplicate POIs that are within `thresholdKm` of each other in the same category.
// Keeps the entry with the more descriptive name (longer = better).
// This removes node+way duplicates and re-registered OSM entries.
function deduplicatePOIs(items, thresholdKm = 0.030) {
  const kept = []
  for (const item of items) {
    const twin = kept.find(k => haversineKm(k.lat, k.lon, item.lat, item.lon) < thresholdKm)
    if (twin) {
      // Keep the one with the longer (more descriptive) name
      if (item.name.length > twin.name.length) twin.name = item.name
    } else {
      kept.push({ ...item })
    }
  }
  return kept
}

function computeScores(elements, lat, lon) {
  const counts = { schools: [], hospitals: [], social: [], transport: [] }

  elements.forEach(el => {
    const key = classifyPOI(el)
    if (!key) return
    const elLat = el.lat ?? el.center?.lat
    const elLon = el.lon ?? el.center?.lon
    if (!elLat || !elLon) return
    const km = haversineKm(lat, lon, elLat, elLon)
    counts[key].push({ km, name: poiLabel(el), lat: elLat, lon: elLon })
  })

  // Sort by distance then deduplicate within each category
  Object.keys(counts).forEach(k => {
    counts[k].sort((a, b) => a.km - b.km)
    counts[k] = deduplicatePOIs(counts[k])
  })

  // Score each category 0-10
  function score(items, idealCount = 3, idealDist = 0.5) {
    if (!items.length) return 0
    const nearest = items[0].km
    const distScore  = Math.max(0, 10 - (nearest / idealDist) * 5)
    const countScore = Math.min(10, (items.length / idealCount) * 5)
    return Math.round((distScore * 0.6 + countScore * 0.4) * 10) / 10
  }

  return {
    schools:   { score: score(counts.schools,   3, 0.5), items: counts.schools.slice(0, 3)   },
    hospitals: { score: score(counts.hospitals, 2, 0.8), items: counts.hospitals.slice(0, 3) },
    social:    { score: score(counts.social,    4, 0.4), items: counts.social.slice(0, 3)    },
    transport: { score: score(counts.transport, 5, 0.2), items: counts.transport.slice(0, 4) },
  }
}

function overallScore(scores) {
  const w = { schools: 0.3, hospitals: 0.25, social: 0.2, transport: 0.25 }
  return Object.entries(w).reduce((s, [k, wt]) => s + (scores[k]?.score ?? 0) * wt, 0)
}

function lifestyleLabel(score) {
  if (score >= 8) return { emoji: '🟢', text: 'Shkëlqyeshëm për familje' }
  if (score >= 7) return { emoji: '🟢', text: 'Shumë e mirë për familje' }
  if (score >= 6) return { emoji: '🟡', text: 'E mirë — zonë me potencial' }
  if (score >= 4) return { emoji: '🟡', text: 'Mesatare — shiko me kujdes' }
  return           { emoji: '🔴', text: 'Infrastrukturë e kufizuar' }
}

function investmentLabel(score, transport) {
  if (transport >= 7 && score >= 6) return { emoji: '🟢', text: 'Zonë investimi e mirë' }
  if (score >= 7)                   return { emoji: '🟢', text: 'Potencial i lartë investimi' }
  if (score >= 5)                   return { emoji: '🟡', text: 'Potencial mesatar investimi' }
  return                              { emoji: '🔴', text: 'Potencial i ulët investimi' }
}

// ── Location map + amenities component ───────────────────────────────────────
function LocationMap({ item }) {
  const lat = item.latitude, lon = item.longitude
  const divRef    = useRef(null)
  const mapRef    = useRef(null)
  const [amenities, setAmenities] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  // Boot map
  useEffect(() => {
    let alive = true
    async function init() {
      loadCss(L_CSS)
      await loadScript(L_JS)
      if (!alive || !divRef.current || mapRef.current) return
      const L   = window.L
      const map = L.map(divRef.current, { center: [lat, lon], zoom: 15 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)

      // Highlighted pin for the listing itself
      L.circleMarker([lat, lon], {
        radius: 10, fillColor: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#C2703D',
        color: '#fff', weight: 2, fillOpacity: 1,
      }).bindPopup(`<b>${listingLabel(item)}</b><br/>${formatPrice(item.price)}`).addTo(map)

      mapRef.current = map

      // Fetch amenities
      try {
        const els  = await fetchAmenities(lat, lon)
        const scos = computeScores(els, lat, lon)
        if (!alive) return
        setAmenities(scos)

        // Add POI markers
        POI_TYPES.forEach(type => {
          scos[type.key]?.items?.forEach(poi => {
            L.circleMarker([poi.lat, poi.lon], {
              radius: 6, fillColor: type.color, color: '#1B1F1C',
              weight: 1.5, fillOpacity: 0.85,
            }).bindPopup(`${type.icon} <b>${poi.name}</b><br/>${(poi.km * 1000).toFixed(0)} m`)
            .addTo(map)
          })
        })
      } catch (e) {
        if (alive) setError('Nuk u morën të dhënat e ameniteteve')
      } finally {
        if (alive) setLoading(false)
      }
    }
    init()
    return () => {
      alive = false
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [lat, lon])

  const total = amenities ? overallScore(amenities) : null
  const lifestyle  = total != null ? lifestyleLabel(total) : null
  const investment = total != null ? investmentLabel(total, amenities?.transport?.score ?? 0) : null

  return (
    <div>
      {/* Map */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }}>
        <div ref={divRef} style={{ height: 320, width: '100%', background: 'var(--bg)' }} />
      </div>

      {/* Lifestyle scores */}
      {loading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>⏳ Duke analizuar zonën…</div>}
      {error   && <div style={{ color: 'var(--muted)', fontSize: 13 }}>⚠️ {error}</div>}

      {amenities && (
        <>
          {/* Summary badges */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <ScoreBadge emoji={lifestyle.emoji}  label={`${total.toFixed(1)}/10`} sub={lifestyle.text}  />
            <ScoreBadge emoji={investment.emoji} label={`${amenities.transport.score.toFixed(1)}/10`} sub={investment.text} />
          </div>

          {/* Per-category breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {POI_TYPES.map(type => {
              const cat = amenities[type.key]
              return (
                <div key={type.key} style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span>{type.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{type.label}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 13, fontWeight: 800,
                      color: cat.score >= 7 ? 'var(--success)' : cat.score >= 4 ? 'var(--gold)' : 'var(--danger)',
                    }}>{cat.score}/10</span>
                  </div>
                  {/* Mini bar */}
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${cat.score * 10}%`, borderRadius: 2, background: type.color }} />
                  </div>
                  {cat.items.length > 0 ? (
                    cat.items.map((p, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        📍 {p.name.length > 28 ? p.name.slice(0, 28) + '…' : p.name}
                        <span style={{ float: 'right' }}>{(p.km * 1000).toFixed(0)} m</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Asnjë brenda 1.2 km</div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function ScoreBadge({ emoji, label, sub }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function KvItem({ label, value, cls = '' }) {
  return (
    <div className="kv-item">
      <div className="kv-label">{label}</div>
      <div className={`kv-value ${cls}`}>{value ?? '—'}</div>
    </div>
  )
}

function LabelBadge({ label }) {
  const tone = label === 'Fair' ? 'var(--success)' : label === 'Overpriced' ? 'var(--danger)' : 'var(--gold)'
  const c = {
    bg:     `color-mix(in srgb, ${tone} 15%, transparent)`,
    border: `color-mix(in srgb, ${tone} 40%, transparent)`,
    color:  tone,
    icon:   label === 'Fair' ? '✓' : label === 'Overpriced' ? '↑' : '↓',
  }
  const text = label === 'Fair' ? 'Çmim i drejtë' : label === 'Overpriced' ? 'Çmim i lartë' : 'Çmim i ulët'
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      borderRadius: 20, padding: '5px 14px', fontSize: 13, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {c.icon} {text}
    </span>
  )
}

function CompCard({ comp, onSelect }) {
  return (
    <div onClick={() => onSelect(comp.id)} style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
      minWidth: 200, flex: '0 0 auto', transition: 'border-color 0.15s, transform 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none' }}
    >
      <div style={{ fontSize: 18, color: 'var(--gold)', marginBottom: 4 }}>{formatPrice(comp.price)}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{comp.sqm} m² · {comp.rooms} dhoma</div>
      <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>📍 {comp.distance_label}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{comp.similarity_reason}</div>
    </div>
  )
}

function PriceBar({ actual, low, high, estimated }) {
  const pad = (high - low) * 0.3
  const min = low - pad, max = high + pad, range = max - min || 1
  const pct = v => Math.max(0, Math.min(100, ((v - min) / range) * 100))
  return (
    <div style={{ position: 'relative', height: 28, marginTop: 8 }}>
      <div style={{ position:'absolute', top:11, left:0, right:0, height:6,
        background:'var(--border)', borderRadius:3 }} />
      <div style={{ position:'absolute', top:11, left:`${pct(low)}%`, width:`${pct(high)-pct(low)}%`,
        height:6, background:'color-mix(in srgb, var(--success) 30%, transparent)', borderRadius:3 }} />
      <div style={{ position:'absolute', top:6, left:`${pct(estimated)}%`, transform:'translateX(-50%)',
        width:3, height:16, background:'var(--accent)', borderRadius:2 }} />
      <div style={{ position:'absolute', top:4, left:`${pct(actual)}%`, transform:'translateX(-50%)',
        width:20, height:20, borderRadius:'50%', border:'2px solid var(--bg)',
        background: actual > high ? 'var(--danger)' : actual < low ? 'var(--accent)' : 'var(--success)' }} />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DetailPage({ id, onBack, onSelect }) {
  const [item,     setItem]     = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [comps,    setComps]    = useState(null)
  const [loading,  setLoad]     = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!id) return
    setLoad(true); setError(null); setItem(null); setEstimate(null); setComps(null)
    Promise.all([
      fetchListing(id),
      fetchEstimate(id).catch(() => null),
      fetchComps(id).catch(() => null),
    ])
    .then(([listing, est, cmps]) => {
      setItem(listing); setEstimate(est); setComps(cmps?.comps ?? null)
    })
    .catch(e => setError(e.message))
    .finally(() => setLoad(false))
  }, [id])

  const bv = v => formatBool(v)

  return (
    <Container className="py-4 pb-5" style={{ maxWidth: 900 }}>
      <button className="back-btn mb-4" onClick={onBack}>← Kthehu te listat</button>

      {loading && <p style={{ color: 'var(--muted)' }}><span className="status-dot" /> Duke ngarkuar…</p>}
      {error   && <div className="err-box">⚠️ Nuk mund të ngarkohet prona {id}.<br/><small>{error}</small></div>}

      {item && (
        <>
          {/* Header */}
          <Card className="detail-panel mb-4">
            <Card.Body className="p-4">
              <div className="mb-4">
                {item.property_type && (
                  <div className="mb-2">
                    <span className="type-badge">{item.property_type}</span>
                    {item.neighborhood && (
                      <span className="type-badge ms-2" style={{
                        background:'color-mix(in srgb, var(--gold) 12%, transparent)',
                        borderColor:'color-mix(in srgb, var(--gold) 30%, transparent)', color:'var(--gold)'
                      }}>{item.neighborhood}</span>
                    )}
                  </div>
                )}
                <h1 style={{ fontSize: 24, marginBottom: 8 }}>{listingLabel(item)}</h1>
                <p className="detail-price">{formatPrice(item.price)}</p>
                {item.price_per_sqm != null && (
                  <p style={{ color:'var(--muted)', fontSize:14, margin:0 }}>
                    {Math.round(item.price_per_sqm).toLocaleString()} €/m²
                  </p>
                )}
              </div>

              <div className="section-title mb-3">🏠 Detajet Kryesore</div>
              <Row xs={2} sm={3} lg={5} className="g-2 mb-4">
                <Col><KvItem label="Lloji"       value={item.property_type} /></Col>
                <Col><KvItem label="Kati"        value={item.floor} /></Col>
                <Col><KvItem label="Sipërfaqja"  value={item.sqm != null ? `${item.sqm} m²` : null} /></Col>
                <Col><KvItem label="Dhoma gjumi" value={item.beds} /></Col>
                <Col><KvItem label="Banjo"       value={item.baths} /></Col>
              </Row>

              <div className="section-title mb-3">✨ Amenitete</div>
              <Row xs={2} sm={4} className="g-2 mb-4">
                {[
                  { label:'Ashensor', v:item.has_elevator },
                  { label:'Tarracë',  v:item.has_terrace },
                  { label:'Parking',  v:item.has_parking_space },
                  { label:'Mobiluar', v:item.furnished },
                  { label:'Kopsht',   v:item.has_garden },
                  { label:'Garazh',   v:item.has_garage },
                ].map(({ label, v }) => {
                  const { label: txt, cls } = bv(v)
                  return <Col key={label}><KvItem label={label} value={txt} cls={cls} /></Col>
                })}
              </Row>

              <div className="section-title mb-3">📝 Përshkrimi</div>
              <div className="desc-box">{item.description || '(Nuk ka përshkrim)'}</div>
            </Card.Body>
          </Card>

          {/* Location map + amenity scores */}
          {item.latitude != null && item.longitude != null && (
            <Card className="detail-panel mb-4">
              <Card.Body className="p-4">
                <div className="section-title mb-3">📍 Vendndodhja & Infrastruktura</div>
                <LocationMap item={item} />
              </Card.Body>
            </Card>
          )}

          {/* ML Estimate */}
          {estimate && (
            <Card className="detail-panel mb-4">
              <Card.Body className="p-4">
                <div className="section-title mb-3">Vlerësimi i Çmimit</div>
                <Row className="g-3 align-items-center">
                  <Col xs={12} sm={4}>
                    <div className="kv-item text-center">
                      <div className="kv-label">Çmim i vlerësuar</div>
                      <div style={{ fontSize:26, fontFamily:"'DM Serif Display',serif", color:'var(--accent)', marginTop:4 }}>
                        {formatPrice(estimate.estimated_price)}
                      </div>
                    </div>
                  </Col>
                  <Col xs={12} sm={4}>
                    <div className="kv-item text-center">
                      <div className="kv-label">Diapazoni i drejtë</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'var(--text)', marginTop:4 }}>
                        {formatPrice(estimate.range_low)} <span style={{color:'var(--muted)'}}>–</span> {formatPrice(estimate.range_high)}
                      </div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>±{estimate.band_pct ?? 8}% rreth vlerës</div>
                    </div>
                  </Col>
                  <Col xs={12} sm={4}>
                    <div className="kv-item text-center">
                      <div className="kv-label">Vlerësimi</div>
                      <div style={{ marginTop:8 }}><LabelBadge label={estimate.label} /></div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:8 }}>
                        Çmimi real: {formatPrice(item.price)}
                      </div>
                      {estimate.threshold_pct != null && (
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>
                          Toleranca e zonës: ±{estimate.threshold_pct}%
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
                <div style={{ marginTop:16 }}>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>Pozicioni i çmimit</div>
                  <PriceBar actual={item.price} low={estimate.range_low}
                    high={estimate.range_high} estimated={estimate.estimated_price} />
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Comps */}
          {comps && comps.length > 0 && (
            <Card className="detail-panel">
              <Card.Body className="p-4">
                <div className="section-title mb-1">🏘️ Prona të Ngjashme</div>
                <p style={{ fontSize:13, color:'var(--muted)', marginBottom:16 }}>
                  5 pronat me ngjashmëri më të lartë — kliko për detaje.
                </p>
                <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8 }}>
                  {comps.map(comp => <CompCard key={comp.id} comp={comp} onSelect={onSelect ?? onBack} />)}
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </Container>
  )
}