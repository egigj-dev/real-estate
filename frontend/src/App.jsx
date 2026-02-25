import { useState } from 'react'
import AppNavbar from './components/AppNavbar'
import ListingsPage from './pages/ListingsPage'
import DetailPage from './pages/DetailPage'

export default function App() {
  const [page,  setPage]  = useState('listings')
  const [selId, setSelId] = useState(null)

  const goDetail = (id) => { setSelId(id); setPage('detail') }
  const goHome   = ()   => { setSelId(null); setPage('listings') }

  return (
    <>
      <AppNavbar onHome={goHome} />

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