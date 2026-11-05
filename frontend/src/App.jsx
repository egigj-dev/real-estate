import { useEffect, useState } from 'react'
import { fetchHealth } from './api'
import AppNavbar from './components/AppNavbar'
import ListingsPage from './pages/ListingsPage'
import DetailPage from './pages/DetailPage'

export default function App() {
  const [health, setHealth] = useState(null)
  useEffect(() => { fetchHealth().then(setHealth).catch(() => {}) }, [])
  const [page,  setPage]  = useState('listings')
  const [selId, setSelId] = useState(null)

  const goDetail = (id) => { setSelId(id); setPage('detail') }
  const goHome   = ()   => { setSelId(null); setPage('listings') }

  return (
    <>
      <AppNavbar onHome={goHome} />
      {health?.data_source === 'demo' && (
        <div className="container py-3" role="status">
          Të dhëna demo sintetike: {health.listings_loaded} prona fiktive, jo oferta reale.
        </div>
      )}

      {page === 'listings' && (
        <ListingsPage onSelect={goDetail} />
      )}

      {page === 'detail' && selId && (
        <DetailPage
          id={selId}
          onBack={goHome}
          onSelect={goDetail}   /* lets comp cards navigate to their own detail page */
        />
      )}
    </>
  )
}