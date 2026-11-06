import { Container, Row, Col } from 'react-bootstrap'

export default function Hero({ total }) {
  const stats = [
    { value: total > 0 ? total.toLocaleString() : '…', label: 'Lista Aktive' },
    { value: '19',   label: 'Zona në Tiranë' },
    { value: '24/7', label: 'Të Disponueshme' },
    { value: 'EUR',  label: 'Çmim në Euro' },
  ]

  return (
    <Container className="py-5">
      <Row className="align-items-center gy-4">

        {/* Left — headline */}
        <Col lg={7}>
          <div className="hero-eyebrow">Tregu Imobiliar</div>
          <h1 className="hero-title">
            Gjej Pronën Tënde <em>Ideale</em><br />në Tiranë
          </h1>
          <p className="hero-sub">
            Shfleto mbi {total > 0 ? total.toLocaleString() : '—'} prona —
            apartamente, zyra, vila dhe më shumë. Filtro sipas zonës,
            çmimit dhe karakteristikave.
          </p>
        </Col>

        {/* Right — stat grid (2 × 2) */}
        <Col lg={5}>
          <Row xs={2} className="g-3">
            {stats.map(s => (
              <Col key={s.label}>
                <div style={{
                  background: 'rgba(13,31,53,0.7)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  textAlign: 'center',
                }}>
                  <strong style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 28,
                    color: 'var(--accent)',
                    display: 'block',
                    lineHeight: 1.1,
                  }}>
                    {s.value}
                  </strong>
                  <span style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.4px' }}>
                    {s.label}
                  </span>
                </div>
              </Col>
            ))}
          </Row>
        </Col>

      </Row>
    </Container>
  )
}