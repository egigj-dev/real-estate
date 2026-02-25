import { Navbar, Container } from 'react-bootstrap'
import { API_BASE } from '../api'

export default function AppNavbar({ onHome }) {
  return (
    <Navbar sticky="top" expand="lg" className="px-3">
      <Container fluid>
        <Navbar.Brand
          as="button"
          onClick={onHome}
          className="navbar-brand"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          🏙️ Tirana<span className="gold">Listings</span>
        </Navbar.Brand>

        <span className="nav-badge ms-2">Beta</span>

        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="api-dot" />
          <span className="api-label d-none d-sm-inline">{API_BASE}</span>
        </div>
      </Container>
    </Navbar>
  )
}
