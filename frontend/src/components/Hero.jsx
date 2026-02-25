import { Container, Row, Col } from 'react-bootstrap'

export default function Hero({ total }) {
  return (
    <Container className="py-5">
      <Row>
        <Col lg={8}>
          <div className="hero-eyebrow">Tregu Imobiliar</div>
          <h1 className="hero-title">
            Gjej Pronën Tënde <em>Ideale</em><br />
            në Tiranë
          </h1>
          <p className="hero-sub">
            Shfleto mbi {total > 0 ? total.toLocaleString() : '—'} prona të
            disponueshme — apartamente, zyra, vila dhe më shumë. Filtro sipas
            adresës, çmimit dhe karakteristikave.
          </p>
          <div className="d-flex gap-4 mt-4 flex-wrap">
            <div className="hero-stat">
              <strong>{total > 0 ? total.toLocaleString() : '…'}</strong>
              <span>Lista Aktive</span>
            </div>
            <div className="hero-stat">
              <strong>24/7</strong>
              <span>Të Disponueshme</span>
            </div>
            <div className="hero-stat">
              <strong>EUR €</strong>
              <span>Çmim në Euro</span>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  )
}
