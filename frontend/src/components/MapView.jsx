import { useEffect, useRef } from 'react'
import { formatPrice } from '../api'

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const CENTRE      = [41.3275, 19.8187]
const API_BASE    = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'; l.href = href
  document.head.appendChild(l)
}

function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = resolve
    document.head.appendChild(s)
  })
}

function drawMarkers(map, layer, items, onSelect) {
  const L = window.L
  if (!L || !map || !layer) return

  layer.clearLayers()
  window._mapSel = (id) => onSelect(id)

  const valid = items.filter(i => i.latitude != null && i.longitude != null)
  if (valid.length === 0) return

  valid.forEach(item => {
    const label = item.area_name || item.neighborhood || item.property_type || 'Pronë'

    L.circleMarker([item.latitude, item.longitude], {
      radius: 7, fillColor: '#2F8F51', color: '#fff',
      weight: 2, fillOpacity: 0.85,
    })
    .bindPopup(`
      <div style="font-family:sans-serif;min-width:170px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:2px">${label}</div>
        <div style="color:var(--gold);font-size:16px;font-weight:800;margin-bottom:5px">
          ${formatPrice(item.price)}
        </div>
        <div style="color:var(--text);font-size:12px;margin-bottom:8px">
          ${[
            item.sqm   != null ? item.sqm + ' m²'    : null,
            item.beds  != null ? item.beds + ' dhoma' : null,
            item.floor != null ? 'Kati ' + item.floor : null,
          ].filter(Boolean).join(' · ')}
        </div>
        <button onclick="window._mapSel('${item.id}')"
          style="background:var(--accent);color:#fff;border:none;border-radius:6px;
                 padding:5px 12px;cursor:pointer;font-size:12px;width:100%;font-weight:600">
          Shiko detajet
        </button>
      </div>
    `, { maxWidth: 220 })
    .addTo(layer)
  })

  // Fit map to visible markers
  try {
    const lats = valid.map(i => i.latitude)
    const lngs = valid.map(i => i.longitude)
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40], maxZoom: 15 }
    )
  } catch (_) {
    map.setView(CENTRE, 13)
  }
}

function drawZonePolygon(map, zoneLayer, areaName, areas) {
  const L = window.L
  if (!L || !map || !zoneLayer) return

  zoneLayer.clearLayers()
  if (!areaName || !areas || areas.length === 0) return

  const area = areas.find(a => a.name === areaName)
  if (!area || !area.polygon || area.polygon.length < 3) return

  // polygon is [[lat,lon], ...] — Leaflet expects [[lat,lon], ...]
  const latlngs = area.polygon.map(p => [p[0], p[1]])

  L.polygon(latlngs, {
    color: '#f59e0b',
    weight: 3,
    fillColor: '#f59e0b',
    fillOpacity: 0.08,
    dashArray: '6 4',
  }).addTo(zoneLayer)
}

export default function MapView({ items = [], onSelect, areaName = null, height = 600 }) {
  const divRef      = useRef(null)
  const mapRef      = useRef(null)
  const layerRef    = useRef(null)
  const zoneRef     = useRef(null)   // polygon layer for selected zone
  const areasRef    = useRef([])     // cached /areas data
  const itemsRef    = useRef(items)
  const selectRef   = useRef(onSelect)
  const areaNameRef = useRef(areaName)

  useEffect(() => { itemsRef.current   = items    }, [items])
  useEffect(() => { selectRef.current  = onSelect }, [onSelect])
  useEffect(() => { areaNameRef.current = areaName }, [areaName])

  // Fetch /areas once and cache
  useEffect(() => {
    if (areasRef.current.length > 0) return
    fetch(`${API_BASE}/areas`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { areasRef.current = data || [] })
      .catch(() => {})
  }, [])

  // Boot Leaflet map once
  useEffect(() => {
    let alive = true
    async function init() {
      loadCss(LEAFLET_CSS)
      await loadScript(LEAFLET_JS)
      if (!alive || !divRef.current || mapRef.current) return

      const L   = window.L
      const map = L.map(divRef.current, { center: CENTRE, zoom: 13 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const zoneLayer  = L.layerGroup().addTo(map)
      const markerLayer = L.layerGroup().addTo(map)

      mapRef.current   = map
      layerRef.current = markerLayer
      zoneRef.current  = zoneLayer

      drawZonePolygon(map, zoneLayer, areaNameRef.current, areasRef.current)
      drawMarkers(map, markerLayer, itemsRef.current, selectRef.current)
    }
    init()
    return () => { alive = false }
  }, [])

  // Redraw markers when items change
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return
    drawMarkers(mapRef.current, layerRef.current, items, onSelect)
  }, [items, onSelect])

  // Redraw zone polygon when areaName changes
  useEffect(() => {
    if (!mapRef.current || !zoneRef.current) return

    // May need to wait a tick for areasRef to be populated
    const attempt = () => drawZonePolygon(mapRef.current, zoneRef.current, areaName, areasRef.current)

    if (areasRef.current.length > 0) {
      attempt()
    } else {
      // Areas not yet loaded — retry after fetch
      fetch(`${API_BASE}/areas`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          areasRef.current = data || []
          attempt()
        })
        .catch(() => {})
    }
  }, [areaName])

  // Cleanup
  useEffect(() => {
    return () => {
      delete window._mapSel
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      layerRef.current = null
      zoneRef.current  = null
    }
  }, [])

  const count = items.filter(i => i.latitude != null).length

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden',
      border: '1px solid var(--border)' }}>
      <div ref={divRef} style={{ height, width: '100%' }} />
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)', borderRadius: 8,
        padding: '4px 10px', fontSize: 12, color: 'var(--muted)',
      }}>
        {count} prona në hartë
        {areaName && <span style={{ marginLeft: 6, color: '#f59e0b' }}>· {areaName}</span>}
      </div>
    </div>
  )
}