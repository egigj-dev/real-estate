import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell({ page, onNavigate, onSearch, listingsCount, children }) {
  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={onNavigate} listingsCount={listingsCount} />
      <div className="app-main">
        <Topbar onSearch={onSearch} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}
