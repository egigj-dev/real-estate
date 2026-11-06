import { IconHome, IconCompass, IconMap, IconSearch, IconTarget, IconBarChart } from '../icons/Icons'

const NAV_ITEMS = [
  { key: 'overview', label: 'Përmbledhje',         Icon: IconHome },
  { key: 'explore',  label: 'Eksploro',             Icon: IconCompass },
  { key: 'map',      label: 'Harta',                Icon: IconMap },
  { key: 'find',     label: 'Gjej Pronën',          Icon: IconSearch },
  { key: 'predict',  label: 'Parashiko sipas Zonës', Icon: IconTarget },
  { key: 'insights', label: 'Tregu',                Icon: IconBarChart },
]

export default function Sidebar({ page, onNavigate, listingsCount }) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo" onClick={() => onNavigate('overview')}>
        <span className="sidebar-logo-mark">🏙️</span>
        <div>
          <div className="sidebar-logo-word">Tirana</div>
          <div className="sidebar-logo-tag">REAL ESTATE EXPLORER</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`nav-link ${page === key ? 'active' : ''}`}
            onClick={() => onNavigate(key)}
          >
            <Icon size={18} className="nav-icon" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-card">
          <div className="footer-card-top">
            <span className="footer-card-label">Të dhënat dhe modeli</span>
          </div>
          <div className="footer-card-model">Modeli: XGBoost</div>
          <div className="footer-card-count">
            {listingsCount != null ? listingsCount.toLocaleString() : '—'} prona u analizuan
          </div>
        </div>
      </div>
    </aside>
  )
}
