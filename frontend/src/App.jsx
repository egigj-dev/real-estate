import { useEffect, useState } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import AppShell from './components/layout/AppShell'
import OverviewPage from './pages/OverviewPage'
import ListingsPage from './pages/ListingsPage'
import MapPage from './pages/MapPage'
import SuggestPage from './pages/SuggestPage'
import PredictPage from './pages/PredictPage'
import InsightsPage from './pages/InsightsPage'
import DetailPage from './pages/DetailPage'
import { fetchHealth } from './api'

function AppInner() {
  const [page, setPage] = useState('overview')
  const [previousPage, setPreviousPage] = useState('overview')
  const [selId, setSelId] = useState(null)
  const [exploreSeed, setExploreSeed] = useState({ areaName: '', query: '' })
  const [listingsCount, setListingsCount] = useState(null)

  useEffect(() => {
    fetchHealth().then(h => setListingsCount(h.listings_loaded)).catch(() => {})
  }, [])

  // Generic nav handler used by the sidebar and every page.
  // `opts` can carry { areaName } or { query } to seed Explore/Map on arrival.
  const navigate = (target, opts = {}) => {
    if (target === 'explore' || target === 'map') {
      setExploreSeed({ areaName: opts.areaName || '', query: opts.query || '' })
    }
    setPage(target)
  }

  const goDetail = (id) => { setPreviousPage(page); setSelId(id); setPage('detail') }
  const goBackFromDetail = () => setPage(previousPage)

  const handleTopbarSearch = (q) => navigate('explore', { query: q })

  return (
    <AppShell page={page} onNavigate={navigate} onSearch={handleTopbarSearch} listingsCount={listingsCount}>
      {page === 'overview' && <OverviewPage onNavigate={navigate} />}

      {page === 'explore' && (
        <ListingsPage
          onSelect={goDetail}
          initialAreaName={exploreSeed.areaName}
          initialQuery={exploreSeed.query}
        />
      )}

      {page === 'map' && (
        <MapPage onSelect={goDetail} initialAreaName={exploreSeed.areaName} />
      )}

      {page === 'find' && <SuggestPage onSelect={goDetail} />}

      {page === 'predict' && <PredictPage />}

      {page === 'insights' && (
        <InsightsPage onSelectNeighborhood={(name) => navigate('explore', { areaName: name })} />
      )}

      {page === 'detail' && selId && (
        <DetailPage id={selId} onBack={goBackFromDetail} onSelect={goDetail} />
      )}
    </AppShell>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}
