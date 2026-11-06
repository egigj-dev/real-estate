import { useEffect, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import MapView from '../components/MapView'
import { fetchAreas, fetchListings } from '../api'

export default function MapPage({ onSelect, initialAreaName = '' }) {
  const [areas, setAreas] = useState([])
  const [areaName, setAreaName] = useState(initialAreaName)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAreas().then(setAreas).catch(() => setAreas([]))
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    fetchListings({ area_name: areaName || '', per_page: 300 })
      .then(d => { if (alive) setItems(d.listings ?? []) })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [areaName])

  return (
    <>
      <PageHeader
        title="Harta e Zonave"
        subtitle="Zgjedh një zonë për ta filtruar hartën, ose eksploro lirisht të gjitha pronat."
      />

      {error && <div className="err-box mb-3">⚠️ {error}</div>}

      <div className="map-page-grid">
        <div className="card area-rail">
          <div className="area-rail-title">Zonat ({areas.length})</div>
          <button className={`area-chip ${!areaName ? 'active' : ''}`} onClick={() => setAreaName('')}>
            Të gjitha zonat
          </button>
          {areas.map(a => (
            <button
              key={a.name}
              className={`area-chip ${areaName === a.name ? 'active' : ''}`}
              onClick={() => setAreaName(a.name)}
            >
              {a.name}
            </button>
          ))}
        </div>

        <div>
          <MapView items={items} onSelect={onSelect} areaName={areaName || null} height={620} />
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
            {loading ? 'Duke ngarkuar pronat…' : `${items.length} prona ${areaName ? `në ${areaName}` : 'gjithsej (kampion deri 300)'}`}
          </div>
        </div>
      </div>
    </>
  )
}
