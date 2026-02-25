import { useEffect, useRef } from 'react'
import { formatPrice } from '../api'

const LEAFLET_CSS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const CLUSTER_CSS  = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css'
const CLUSTER_CSS2 = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css'
const CLUSTER_JS   = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'

const CENTRE = [41.3275, 19.8187]

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'; l.href = href
  document.head.appendChild(l)
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export default function MapView({ items = [], onSelect, height = 600 }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const clusterRef   = useRef(null)
  const readyRef     = useRef(false)

  // ── Boot Leaflet once ────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true

    async function boot() {
      loadCss(LEAFLET_CSS)
      loadCss(CLUSTER_CSS)
      loadCss(CLUSTER_CSS2)
      await loadScript(LEAFLET_JS)
      await loadScript(CLUSTER_JS)
      if (!alive || !containerRef.current || mapRef.current) return

      const L   = window.L
      const map = L.map(containerRef.current, { center: CENTRE, zoom: 13 })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const cluster = L.markerClusterGroup({ maxClusterRadius: 60, chunkedLoading: true })
      map.addLayer(cluster)

      mapRef.current     = map
      clusterRef.current = cluster
      readyRef.current   = true

      // Trigger marker draw now that map is ready
      drawMarkers(map, cluster, items, onSelect)
    }

    boot()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Redraw markers when items change ─────────────────────────────────────
  useEffect(() => {
    if (!readyRef.current) return
    drawMarkers(mapRef.current, clusterRef.current, items, onSelect)
  }, [items, onSelect])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      delete window._mapSelect
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      clusterRef.current = null
      readyRef.current   = false
    }
  }, [])

  const visible = items.filter(i => i.latitude != null && i.longitude != null).length

  return (
    <div style={{ position: 'relative', height, borderRadius: 16,
      overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%', background: '#0d1f35' }} />

      {/* Counter badge */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
        background: 'rgba(7,17,31,0.85)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)', borderRadius: 10,
        padding: '5px 12px', fontSize: 12, color: 'var(--muted)',
      }}>
        {visible} prona në hartë
      </div>
    </div>
  )
}

function drawMarkers(map, cluster, items, onSelect) {
  if (!map || !cluster) return

  cluster.clearLayers()
  window._mapSelect = (id) => onSelect(id)

  const valid = items.filter(i => i.latitude != null && i.longitude != null)
  if (valid.length === 0) return

  const L = window.L

  valid.forEach(item => {
    const label = item.address
      ? item.address.split(',')[0]
      : item.property_type || 'Pronë'

    const marker = L.circleMarker([item.latitude, item.longitude], {
      radius:      7,
      fillColor:   '#4fc3f7',
      color:       '#07111f',
      weight:      2,
      opacity:     1,
      fillOpacity: 0.85,
    })

    marker.bindPopup(`
      <div style="font-family:'DM Sans',sans-serif;min-width:190px">
        <div style="font-size:12px;font-weight:600;margin-bottom:3px;
          color:#111;line-height:1.3">${label}</div>
        <div style="font-size:17px;font-weight:700;color:#e65100;margin-bottom:6px">
          ${formatPrice(item.price)}
        </div>
        <div style="font-size:12px;color:#555;margin-bottom:8px">
          ${[
            item.sqm   != null ? `${item.sqm} m²`      : null,
            item.beds  != null ? `${item.beds} dhoma`   : null,
            item.baths != null ? `${item.baths} banjo`  : null,
          ].filter(Boolean).join(' · ')}
        </div>
        <button onclick="window._mapSelect('${item.id}')"
          style="background:#1565c0;color:#fff;border:none;border-radius:6px;
            padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;width:100%">
          Shiko detajet →
        </button>
      </div>
    `, { maxWidth: 230 })

    cluster.addLayer(marker)
  })

  // Fit to markers
  try {
    const bounds = cluster.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    }
  } catch (_) {
    map.setView(CENTRE, 13)
  }
}