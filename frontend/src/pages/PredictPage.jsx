import { useState } from 'react'
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap'
import PageHeader from '../components/layout/PageHeader'
import { fetchPredictByZone, formatPrice } from '../api'

const ZONE_COLORS = ['#2F8F51', '#C2703D', '#3E8FA6', '#B5566B', '#8B6FB0']

const DEFAULT = {
  sqm: '', floor: '', beds: '', baths: '',
  has_elevator: false, has_parking_space: false,
}

function Toggle({ id, label, icon, checked, onChange }) {
  return (
    <label htmlFor={id} className={`fancy-check ${checked ? 'active' : ''}`}>
      <input id={id} type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      <span>{icon}</span> {label}
    </label>
  )
}

// ── Common Feature Importance (one section for all zones) ─────────────────────
function FeatureBar({ insight, maxImp }) {
  const barWidth = maxImp > 0 ? (insight.importance_pct / maxImp) * 100 : 0
  const dirColor = insight.direction === 'up'
    ? 'var(--success)' : insight.direction === 'down' ? 'var(--danger)' : 'var(--muted)'
  const dirArrow = insight.direction === 'up' ? '▲' : insight.direction === 'down' ? '▼' : '●'

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: dirColor, fontWeight: 800, minWidth: 14 }}>{dirArrow}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{insight.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 260, textAlign: 'right' }}>
            {insight.insight}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 800, color: 'var(--accent)',
            minWidth: 40, textAlign: 'right',
          }}>{insight.importance_pct.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${barWidth}%`, borderRadius: 3,
          background: `linear-gradient(90deg, color-mix(in srgb, ${dirColor} 55%, transparent), ${dirColor})`,
          transition: 'width .6s ease',
        }} />
      </div>
    </div>
  )
}

function CommonInsights({ insights, growthNote }) {
  if (!insights || !insights.length) return null
  const maxImp = insights[0].importance_pct

  return (
    <Card className="detail-panel mb-4">
      <Card.Body className="p-4">
        <div className="section-title mb-1" style={{ fontSize: 14 }}>
          📊 Faktorët që drejtojnë çmimin
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
          Rëndësia e çdo karakteristike bazuar në modelin XGBoost
          (feature importance — gain). Ky shpjegim është i njëjtë për të gjitha zonat,
          sepse modeli është i vetëm — vetëm vlerat mesatare ndryshojnë sipas zonës.
        </p>

        <div style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '18px 20px',
        }}>
          {insights.map(ins => (
            <FeatureBar key={ins.feature} insight={ins} maxImp={maxImp} />
          ))}
        </div>

        <div style={{
          marginTop: 12, fontSize: 11, color: 'var(--muted)',
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <span>▲ rrit çmimin krahasuar me mesataren e zonës</span>
          <span>▼ ul çmimin</span>
          <span>% = rëndësia e faktorit në model (gain)</span>
        </div>
      </Card.Body>
    </Card>
  )
}

// ── Future price timeline ─────────────────────────────────────────────────────
function FutureTimeline({ current, future, color }) {
  const maxPrice = Math.max(...future.map(f => f.price), current)
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        Parashikim (bazuar në tendencën historike të tregut të Tiranës 2018–2024)
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
        <TimelineBar label="Sot" price={current} maxPrice={maxPrice} color={color} dim />
        <div style={{ color: 'var(--muted)', fontSize: 16, paddingBottom: 24, flexShrink: 0 }}>→</div>
        {future.map(fp => (
          <TimelineBar key={fp.years}
            label={`+${fp.years} vit${fp.years > 1 ? 'e' : ''}`}
            price={fp.price} maxPrice={maxPrice} color={color}
            growth={Math.round(((fp.price - current) / current) * 100)}
            growthRate={fp.growth_rate}
          />
        ))}
      </div>
    </div>
  )
}

function TimelineBar({ label, price, maxPrice, color, dim, growth, growthRate }) {
  const heightPct = maxPrice > 0 ? Math.max(20, (price / maxPrice) * 100) : 30
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, textAlign: 'center', lineHeight: 1.3 }}>
        {formatPrice(price)}
        {growth != null && (
          <div style={{ color: 'var(--success)', fontWeight: 700 }}>+{growth}%</div>
        )}
        {growthRate != null && (
          <div style={{ color: 'var(--muted)', fontSize: 9 }}>{growthRate}%/vit</div>
        )}
      </div>
      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{
          width: '100%', height: `${heightPct}%`, minHeight: 10,
          background: color, opacity: dim ? 0.45 : 1, borderRadius: '4px 4px 0 0',
        }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>{label}</div>
    </div>
  )
}

// ── Zone card ─────────────────────────────────────────────────────────────────
function ZoneCard({ zone, color, rank, expanded, onToggle }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      border: `1px solid ${expanded ? color + '55' : 'var(--border)'}`,
      borderRadius: 16, marginBottom: 12, overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      {/* Header row — always visible */}
      <div onClick={onToggle} style={{
        padding: '18px 20px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {/* Rank circle */}
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: `${color}22`, border: `1px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color,
        }}>#{rank}</div>

        {/* Zone meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
            {zone.zone_name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {zone.listing_count.toLocaleString()} prona · {zone.price_per_sqm.toLocaleString()} €/m²
          </div>
        </div>

        {/* Price */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{formatPrice(zone.estimated_price)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            ±{zone.band_pct}% · {formatPrice(zone.range_low)} – {formatPrice(zone.range_high)}
          </div>
        </div>

        {/* Chevron */}
        <div style={{ color: 'var(--muted)', fontSize: 18, flexShrink: 0,
          transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</div>
      </div>

      {/* Progress fill bar */}
      <div style={{ height: 3, margin: '0 20px 16px',
        background: `${color}33`, borderRadius: 2 }}>
        <div style={{ height: '100%', background: color, borderRadius: 2, opacity: 0.7, width: '100%' }} />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '4px 20px 20px', borderTop: `1px solid ${color}22` }}>

          {/* ── Future price projection ───────────────────────────────── */}
          {zone.future_prices?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1,
                color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>
                📈 Parashikim i çmimit në të ardhmen
              </div>
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <FutureTimeline current={zone.estimated_price} future={zone.future_prices} color={color} />

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                  {zone.future_prices.map(fp => (
                    <div key={fp.years} style={{
                      flex: 1, minWidth: 120,
                      background: `${color}11`, border: `1px solid ${color}33`,
                      borderRadius: 10, padding: '10px 14px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                        Pas {fp.years} vitesh
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color }}>
                        {formatPrice(fp.price)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 3 }}>
                        +{formatPrice(fp.price - zone.estimated_price)}
                        <span style={{ color: 'var(--muted)', marginLeft: 4 }}>
                          ({fp.growth_rate}%/vit)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Zone vs avg ───────────────────────────────────────────── */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1,
              color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
              ⚖️ Krahasim me mesataren e zonës
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Çmimi juaj',     value: formatPrice(zone.estimated_price), color },
                { label: 'Media e zonës',  value: formatPrice(zone.avg_zone_price), color: 'var(--muted)' },
                {
                  label: 'Diferenca',
                  value: `${zone.estimated_price > zone.avg_zone_price ? '+' : ''}${formatPrice(zone.estimated_price - zone.avg_zone_price)}`,
                  color: zone.estimated_price > zone.avg_zone_price ? 'var(--danger)' : 'var(--success)',
                },
                { label: '€/m² juaj',     value: `${zone.price_per_sqm.toLocaleString()} €`, color },
                { label: '€/m² zona',     value: `${zone.avg_zone_price_per_sqm.toLocaleString()} €`, color: 'var(--muted)' },
              ].map(({ label, value, color: c }) => (
                <div key={label} style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '8px 14px', minWidth: 110,
                }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase',
                    letterSpacing: 1, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quick comparison ──────────────────────────────────────────────────────────
function ComparisonSummary({ zones }) {
  if (zones.length < 2) return null
  const cheapest = zones[0], mostExp = zones[zones.length - 1]
  const diff = mostExp.estimated_price - cheapest.estimated_price
  const pct  = cheapest.estimated_price > 0
    ? Math.round((diff / cheapest.estimated_price) * 100) : 0
  return (
    <div style={{
      background: 'var(--accent-soft)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px 20px', marginBottom: 20,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1,
        color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 12 }}>
        Krahasim i shpejtë
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {[
          { label: 'Zona më e lirë',         value: cheapest.zone_name },
          { label: 'Çmimi i saj',             value: formatPrice(cheapest.estimated_price) },
          { label: 'Zona më e shtrenjtë',     value: mostExp.zone_name },
          { label: 'Çmimi i saj',             value: formatPrice(mostExp.estimated_price) },
          { label: 'Diferenca',               value: `${formatPrice(diff)} (+${pct}%)` },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase',
              letterSpacing: 1, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PredictPage() {
  const [form,     setForm]     = useState(DEFAULT)
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [expanded, setExpanded] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null); setResult(null); setExpanded(null)

    const payload = {}
    if (form.sqm)               payload.sqm               = Number(form.sqm)
    if (form.floor)             payload.floor             = Number(form.floor)
    if (form.beds)              payload.beds              = Number(form.beds)
    if (form.baths)             payload.baths             = Number(form.baths)
    if (form.has_elevator)      payload.has_elevator      = true
    if (form.has_parking_space) payload.has_parking_space = true

    try {
      const data = await fetchPredictByZone(payload)
      setResult(data)
      if (data.zones.length) setExpanded(data.zones[0].cluster_id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => { setForm(DEFAULT); setResult(null); setError(null); setExpanded(null) }
  const zones = result?.zones ?? []

  return (
    <div style={{ minHeight: '100vh' }}>

      <PageHeader
        eyebrow="Parashikim çmimi"
        title="Sa kushton & si rritet çmimi?"
        subtitle="Modeli XGBoost parashikon çmimin në çdo zonë, shpjegon cilët faktorë e drejtojnë atë çmim, dhe projekton rritjen e investimit pas 2 dhe 5 vitesh."
      />

      <Container className="pb-5 px-0">
        <Row className="g-4">

          {/* Form */}
          <Col xs={12} lg={4}>
            <div style={{ position: 'sticky', top: 80 }}>
              <Card className="filter-panel">
                <Card.Body>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <h2 style={{ fontSize: 16, margin: 0 }}>🏗️ Karakteristikat</h2>
                    <button className="clear-btn" onClick={handleReset}>↺ Pastro</button>
                  </div>
                  <Form onSubmit={handleSubmit}>

                    <div className="mb-3">
                      <div className="filter-label mb-1">Sipërfaqja (m²)</div>
                      <Form.Control className="filter-input" type="number"
                        placeholder="p.sh. 80" min={10} max={1000}
                        value={form.sqm} onChange={e => set('sqm', e.target.value)} />
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        Bosh = mesatarja e zonës (≈80 m²)
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="filter-label mb-1">Kati</div>
                      <Form.Control className="filter-input" type="number"
                        placeholder="p.sh. 3" min={0} max={30}
                        value={form.floor} onChange={e => set('floor', e.target.value)} />
                    </div>

                    <Row className="g-2 mb-3">
                      <Col>
                        <div className="filter-label mb-1">Dhoma gjumi</div>
                        <Form.Select className="filter-input" value={form.beds}
                          onChange={e => set('beds', e.target.value)}>
                          <option value="">Mesatare</option>
                          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                        </Form.Select>
                      </Col>
                      <Col>
                        <div className="filter-label mb-1">Banjo</div>
                        <Form.Select className="filter-input" value={form.baths}
                          onChange={e => set('baths', e.target.value)}>
                          <option value="">Mesatare</option>
                          {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                        </Form.Select>
                      </Col>
                    </Row>

                    <div className="mb-4">
                      <div className="filter-label mb-2">Amenitete</div>
                      <div className="d-flex flex-wrap gap-2">
                        <Toggle id="p-el" icon="🛗" label="Ashensor"
                          checked={form.has_elevator} onChange={v => set('has_elevator', v)} />
                        <Toggle id="p-pk" icon="🅿️" label="Parking"
                          checked={form.has_parking_space} onChange={v => set('has_parking_space', v)} />
                      </div>
                    </div>

                    <Button type="submit" className="btn-search w-100" disabled={loading}>
                      {loading ? '⏳ Duke parashikuar…' : '📊 Parashiko çmimin'}
                    </Button>
                  </Form>

                  {!result && !loading && (
                    <div style={{ marginTop: 20, padding: '12px 16px',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                      💡 Pas parashikimit do të shohësh:<br/>
                      · Çmimin në secilën zonë të Tiranës<br/>
                      · Faktorët e modelit — i njëjti shpjegim për të gjitha zonat<br/>
                      · Projeksionin e investimit pas 2 dhe 5 vitesh
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          </Col>

          {/* Results */}
          <Col xs={12} lg={8}>

            {/* Empty state */}
            {!result && !loading && !error && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', minHeight: 420, textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                  Shiko çmimin sipas zonës
                </div>
                <div style={{ maxWidth: 400, fontSize: 14, lineHeight: 1.7 }}>
                  E njëjta pronë — çmime të ndryshme sipas zonës. Plotëso
                  karakteristikat dhe sistemi llogarit çmimin në Qendra, Komuna dhe Periferi.
                </div>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', minHeight: 420, color: 'var(--muted)', gap: 16 }}>
                <div style={{ fontSize: 48 }}>⏳</div>
                <div>Duke ekzekutuar modelin XGBoost për çdo zonë…</div>
              </div>
            )}

            {error && (
              <div className="err-box mb-4">⚠️ {error}<br/><small>A është aktiv serveri?</small></div>
            )}

            {result && zones.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                  Parashikim për{' '}
                  <strong style={{ color: 'var(--text)' }}>
                    {result.sqm} m²
                    {form.beds  ? `, ${form.beds} dhoma` : ''}
                    {form.floor ? `, Kati ${form.floor}` : ''}
                  </strong>
                  {' '}· kliko çdo zonë për projeksionin
                </div>

                <ComparisonSummary zones={zones} />

                {/* Zone cards */}
                {zones.map((zone, i) => (
                  <ZoneCard
                    key={zone.cluster_id}
                    zone={zone}
                    color={ZONE_COLORS[i % ZONE_COLORS.length]}
                    rank={i + 1}
                    expanded={expanded === zone.cluster_id}
                    onToggle={() => setExpanded(
                      expanded === zone.cluster_id ? null : zone.cluster_id
                    )}
                  />
                ))}

                {/* Common feature importance — one for all zones */}
                <CommonInsights
                  insights={result.feature_insights}
                  growthNote={result.growth_note}
                />

                {/* Growth rate transparency note */}
                {result.growth_note && (
                  <div style={{
                    padding: '12px 16px',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7,
                    marginTop: 8,
                  }}>
                    <strong style={{ color: 'var(--text)' }}>📌 Normat e rritjes:</strong>{' '}
                    {result.growth_note}
                  </div>
                )}
              </>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  )
}