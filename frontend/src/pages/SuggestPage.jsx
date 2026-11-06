import { useState, lazy, Suspense, useRef, useEffect } from 'react'
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap'
import PageHeader from '../components/layout/PageHeader'
import { fetchSuggestions, fetchChatParse, formatPrice, listingLabel } from '../api'

const MapView = lazy(() => import('../components/MapView'))

const EMPTY_FORM = {
  sqm: '', floor: '', beds: '', baths: '',
  has_elevator: false, has_parking_space: false,
  neighborhood: '', n: 10,
}

// ── NL Chat component ─────────────────────────────────────────────────────────
const EXAMPLE_PROMPTS = [
  'Dua një apartament 2+1 në Bllok me ashensor, rreth 80 m²',
  'Kërkoj studio afër qendrës, çmim i ulët, kati i lartë',
  'Nevojitet vilë me garazh dhe kopsht në periferi, 4 dhoma',
  'Apartament i mobiluar me parking, Zona e Mesme',
]

function ChatBox({ onParsed }) {
  const [text,    setText]    = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)
  const taRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto'
      taRef.current.style.height = taRef.current.scrollHeight + 'px'
    }
  }, [text])

  const submit = async (txt) => {
    const t = (txt || text).trim()
    if (!t) return
    setText(t)
    setLoading(true); setError(null); setResult(null)
    try {
      const parsed = await fetchChatParse(t)
      setResult(parsed)
      onParsed(parsed)
    } catch (e) {
      setError('Nuk u lidh me serverin. Provoni manualisht filtrat.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div style={{
      background: 'var(--accent-soft)',
      border: '1px solid var(--border)',
      borderRadius: 16, padding: 20, marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>🤖</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            Përshkruaj pronën që dëshiron
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Shkruaj lirshëm — sistemi nxjerr karakteristikat automatikisht
          </div>
        </div>
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <textarea
          ref={taRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="p.sh. Dua apartament 2+1 në Bllok me ashensor, rreth 80 m², kati i lartë…"
          rows={2}
          style={{
            width: '100%', background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 48px 10px 14px',
            color: 'var(--text)', fontSize: 14, lineHeight: 1.5,
            resize: 'none', outline: 'none', minHeight: 60,
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => submit()}
          disabled={loading || !text.trim()}
          style={{
            position: 'absolute', right: 8, bottom: 10,
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: loading || !text.trim()
              ? 'var(--border)'
              : 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff', cursor: loading || !text.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, transition: 'all .2s',
          }}
        >
          {loading ? '⏳' : '→'}
        </button>
      </div>

      {/* Example chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: result ? 14 : 0 }}>
        {EXAMPLE_PROMPTS.map(p => (
          <button key={p}
            onClick={() => submit(p)}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '3px 12px', fontSize: 11,
              color: 'var(--muted)', cursor: 'pointer',
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--muted)' }}
          >{p.length > 45 ? p.slice(0, 45) + '…' : p}</button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>⚠️ {error}</div>
      )}

      {/* Parsed result chips */}
      {result && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'var(--accent-soft)', border: '1px solid var(--border)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>
            ✓ U kuptua — filtrat u përditësuan{result.method === 'claude' ? ' (Claude AI)' : ' (keyword)'}:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {result.sqm          && <Chip>📐 {result.sqm} m²</Chip>}
            {result.beds         && <Chip>🛏 {result.beds} dhoma</Chip>}
            {result.baths        && <Chip>🚿 {result.baths} banjo</Chip>}
            {result.floor        && <Chip>🏢 Kati {result.floor}</Chip>}
            {result.neighborhood && <Chip>📍 {result.neighborhood}</Chip>}
            {result.has_elevator      && <Chip>🛗 Ashensor</Chip>}
            {result.has_parking_space && <Chip>🅿️ Parking</Chip>}
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ children }) {
  return (
    <span style={{
      background: 'var(--accent-soft)', border: '1px solid var(--border)',
      color: 'var(--accent)', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
    }}>{children}</span>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function ToggleCheck({ id, label, icon, checked, onChange }) {
  return (
    <label htmlFor={id} className={`fancy-check ${checked ? 'active' : ''}`}>
      <input id={id} type="checkbox" checked={checked}
        onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      <span>{icon}</span> {label}
    </label>
  )
}

// ── Match badge ───────────────────────────────────────────────────────────────
function MatchBadge({ score }) {
  const pct   = Math.round(score)
  const color = pct >= 75 ? 'var(--accent)' : pct >= 50 ? 'var(--gold)' : 'var(--muted)'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: `${color}22`, border: `1px solid ${color}55`,
      borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
      color, marginBottom: 6,
    }}>◉ {pct}% përputhje</div>
  )
}

// ── Suggestion card ───────────────────────────────────────────────────────────
function SuggestionCard({ item, onClick }) {
  const label = listingLabel(item)
  return (
    <div onClick={onClick} style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 20, cursor: 'pointer',
      transition: 'border-color .2s, transform .2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)';         e.currentTarget.style.transform='none' }}>
      <MatchBadge score={item.match_score} />
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: 'var(--accent)',
        textTransform: 'uppercase', marginBottom: 4 }}>{item.property_type || 'Pronë'}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', marginBottom: 12 }}>{formatPrice(item.price)}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {[
          item.sqm  != null ? `${item.sqm} m²`      : null,
          item.beds != null ? `${item.beds} dhoma`   : null,
          item.baths != null? `${item.baths} banjo`  : null,
          item.floor != null? `Kati ${item.floor}`   : null,
          item.furnished    ? 'Mobiluar'              : null,
        ].filter(Boolean).map(t => (
          <span key={t} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '3px 10px', fontSize: 12,
          }}>{t}</span>
        ))}
      </div>
      {item.neighborhood && <div style={{ fontSize: 12, color: 'var(--muted)' }}>📍 {item.neighborhood}</div>}
      {item.price_per_sqm != null && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          {Math.round(item.price_per_sqm).toLocaleString()} €/m²
        </div>
      )}
    </div>
  )
}

// ── Estimate banner ───────────────────────────────────────────────────────────
function EstimateBanner({ result }) {
  return (
    <div style={{
      background: 'var(--accent-soft)',
      border: '1px solid var(--border)', borderRadius: 14,
      padding: '18px 24px', marginBottom: 24,
      display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Çmimi i vlerësuar</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{formatPrice(result.estimated_price)}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          {formatPrice(result.range_low)} – {formatPrice(result.range_high)}
          <span style={{ marginLeft: 8 }}>±{result.band_pct}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuggestPage({ onSelect }) {
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [result,  setResult]  = useState(null)
  const [zones,   setZones]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/filters/options`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.area_names?.length) setZones(d.area_names)
        else if (d?.neighborhoods) setZones(d.neighborhoods)
      })
      .catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Called when ChatBox parses NL → apply to form
  const handleParsed = (parsed) => {
    setForm(f => ({
      ...f,
      ...(parsed.sqm               != null ? { sqm:               String(parsed.sqm) }   : {}),
      ...(parsed.floor             != null ? { floor:             String(parsed.floor) } : {}),
      ...(parsed.beds              != null ? { beds:              String(parsed.beds) }  : {}),
      ...(parsed.baths             != null ? { baths:             String(parsed.baths) } : {}),
      ...(parsed.has_elevator      != null ? { has_elevator:      parsed.has_elevator }  : {}),
      ...(parsed.has_parking_space != null ? { has_parking_space: parsed.has_parking_space } : {}),
      ...(parsed.neighborhood      != null ? { neighborhood:      parsed.neighborhood }  : {}),
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null); setResult(null)

    const payload = { n: form.n }
    if (form.sqm)               payload.sqm               = Number(form.sqm)
    if (form.floor)             payload.floor             = Number(form.floor)
    if (form.beds)              payload.beds              = Number(form.beds)
    if (form.baths)             payload.baths             = Number(form.baths)
    if (form.has_elevator)      payload.has_elevator      = true
    if (form.has_parking_space) payload.has_parking_space = true
    if (form.neighborhood)      payload.neighborhood      = form.neighborhood

    try {
      setResult(await fetchSuggestions(payload))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => { setForm(EMPTY_FORM); setResult(null); setError(null) }

  const suggestions = result?.suggestions ?? []

  return (
    <div style={{ minHeight: '100vh' }}>
      <PageHeader
        eyebrow="Gjej pronën ideale"
        title="Çfarë prone kërkoni?"
        subtitle="Shkruaj me fjalë të tua ose plotëso filtrat — sistemi gjen pronat më të ngjashme dhe vlerëson çmimin e drejtë."
      />

      <Container className="pb-5 px-0">
        <Row className="g-4">

          {/* ── Left: Chat + Form ──────────────────────────────────────────── */}
          <Col xs={12} lg={4}>
            <div style={{ position: 'sticky', top: 80 }}>

              {/* NL Chat box */}
              <ChatBox onParsed={handleParsed} />

              {/* Manual filter form */}
              <Card className="filter-panel">
                <Card.Body>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h2 style={{ fontSize: 14, margin: 0, color: 'var(--muted)' }}>
                      ✏️ Ose plotëso manualisht
                    </h2>
                    <button className="clear-btn" onClick={handleReset}>↺ Pastro</button>
                  </div>

                  <Form onSubmit={handleSubmit}>
                    {/* Zone */}
                    <div className="mb-3">
                      <div className="filter-label mb-1">Zona</div>
                      <Form.Select className="filter-input" value={form.neighborhood}
                        onChange={e => set('neighborhood', e.target.value)}>
                        <option value=''>Çdo zonë</option>
                        {zones.map(z => <option key={z} value={z}>{z}</option>)}
                      </Form.Select>
                    </div>

                    {/* Sqm */}
                    <div className="mb-3">
                      <div className="filter-label mb-1">Sipërfaqja (m²)</div>
                      <Form.Control className="filter-input" type="number"
                        placeholder="p.sh. 80" min={10} max={1000}
                        value={form.sqm} onChange={e => set('sqm', e.target.value)} />
                    </div>

                    {/* Floor */}
                    <div className="mb-3">
                      <div className="filter-label mb-1">Kati</div>
                      <Form.Control className="filter-input" type="number"
                        placeholder="p.sh. 3" min={0} max={30}
                        value={form.floor} onChange={e => set('floor', e.target.value)} />
                    </div>

                    {/* Beds + Baths */}
                    <Row className="g-2 mb-3">
                      <Col>
                        <div className="filter-label mb-1">Dhoma</div>
                        <Form.Select className="filter-input" value={form.beds}
                          onChange={e => set('beds', e.target.value)}>
                          <option value="">Çdo</option>
                          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                        </Form.Select>
                      </Col>
                      <Col>
                        <div className="filter-label mb-1">Banjo</div>
                        <Form.Select className="filter-input" value={form.baths}
                          onChange={e => set('baths', e.target.value)}>
                          <option value="">Çdo</option>
                          {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                        </Form.Select>
                      </Col>
                    </Row>

                    {/* Amenities */}
                    <div className="mb-4">
                      <div className="filter-label mb-2">Amenitete</div>
                      <div className="d-flex flex-wrap gap-2">
                        <ToggleCheck id="s-el" icon="🛗" label="Ashensor"
                          checked={form.has_elevator} onChange={v => set('has_elevator', v)} />
                        <ToggleCheck id="s-pk" icon="🅿️" label="Parking"
                          checked={form.has_parking_space} onChange={v => set('has_parking_space', v)} />
                      </div>
                    </div>

                    {/* N results */}
                    <div className="mb-4">
                      <div className="filter-label mb-1">Numri i sugjerimeve</div>
                      <Form.Select className="filter-input" value={form.n}
                        onChange={e => set('n', Number(e.target.value))}>
                        {[5,10,15,20].map(n => <option key={n} value={n}>{n} prona</option>)}
                      </Form.Select>
                    </div>

                    <Button type="submit" className="btn-search w-100" disabled={loading}>
                      {loading ? '⏳ Duke kërkuar…' : '🔍 Gjej pronat'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </div>
          </Col>

          {/* ── Right: Results ─────────────────────────────────────────────── */}
          <Col xs={12} lg={8}>
            {/* Empty state */}
            {!result && !loading && !error && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', minHeight: 400, textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                  Përshkruaj pronën me fjalë të tua
                </div>
                <div style={{ maxWidth: 360, fontSize: 14 }}>
                  Shkruaj si po i tregon dikujt — çfarë dëshiron, ku, me çfarë karakteristikash.
                  Sistemi do ta kuptojë.
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', minHeight: 400, color: 'var(--muted)', gap: 16 }}>
                <div style={{ fontSize: 40 }}>⏳</div>
                <div>Duke analizuar {form.n} pronat më të ngjashme…</div>
              </div>
            )}

            {/* Error */}
            {error && <div className="err-box mb-4">⚠️ {error}</div>}

            {/* Results */}
            {result && (
              <>
                <EstimateBanner result={result} />

                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 700 }}>{suggestions.length}</span> prona u gjetën
                  </div>
                  <button className={`status-btn ${showMap ? 'active' : ''}`}
                    onClick={() => setShowMap(m => !m)}>
                    🗺 {showMap ? 'Fshih hartën' : 'Trego hartën'}
                  </button>
                </div>

                {showMap && suggestions.length > 0 && (
                  <div className="mb-4">
                    <Suspense fallback={
                      <div style={{ height: 360, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', border: '1px solid var(--border)',
                        borderRadius: 16, color: 'var(--muted)', fontSize: 14 }}>
                        Duke ngarkuar hartën…
                      </div>
                    }>
                      <MapView items={suggestions} onSelect={onSelect} height={360} />
                    </Suspense>
                  </div>
                )}

                <Row xs={1} sm={2} className="g-3">
                  {suggestions.map(item => (
                    <Col key={item.id}>
                      <SuggestionCard item={item} onClick={() => onSelect(item.id)} />
                    </Col>
                  ))}
                </Row>

                {suggestions.length === 0 && (
                  <div className="empty-box">
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                    <div>Nuk u gjetën prona me këto karakteristika.</div>
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