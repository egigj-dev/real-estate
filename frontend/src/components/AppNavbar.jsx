import { Navbar, Container } from 'react-bootstrap'

export default function AppNavbar({ page, onHome, onSuggest, onPredict }) {
  return (
    <Navbar
      expand="lg"
      style={{
        background:   'rgba(7,17,31,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        position:     'sticky',
        top:          0,
        zIndex:       900,
      }}
    >
      <Container fluid className="px-3 px-lg-4">
        {/* Brand */}
        <Navbar.Brand
          onClick={onHome}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <span style={{ fontSize: 22 }}>🏙️</span>
          <span style={{
            fontWeight: 800, fontSize: 17,
            background: 'linear-gradient(90deg,#4fc3f7,#81d4fa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Tirana Real Estate
          </span>
        </Navbar.Brand>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          <NavTab active={page === 'listings' || page === 'detail'}
            onClick={onHome}    icon="🏠" label="Listat" />
          <NavTab active={page === 'suggest'}
            onClick={onSuggest} icon="🔍" label="Gjej pronën" />
          <NavTab active={page === 'predict'}
            onClick={onPredict} icon="📊" label="Parashiko çmimin" />
        </div>
      </Container>
    </Navbar>
  )
}

function NavTab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:   active ? 'rgba(79,195,247,0.12)' : 'transparent',
        border:       active ? '1px solid rgba(79,195,247,0.3)' : '1px solid transparent',
        borderRadius: 10,
        padding:      '6px 16px',
        fontSize:     14,
        fontWeight:   active ? 700 : 400,
        color:        active ? '#4fc3f7' : 'var(--muted)',
        cursor:       'pointer',
        transition:   'all .15s',
        display:      'flex',
        alignItems:   'center',
        gap:          6,
      }}
    >
      <span>{icon}</span> {label}
    </button>
  )
}