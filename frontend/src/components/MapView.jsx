import { useEffect, useRef } from 'react'
import { formatPrice } from '../api'

const LEAFLET_CSS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const CLUSTER_CSS  = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css'
const CLUSTER_CSS2 = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css'
const CLUSTER_JS   = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'

const CENTRE = [41.3275, 19.8187]

// Injected once — themes popups, clusters and zoom controls to match the app
const MAP_STYLES = `
  .leaflet-popup-content-wrapper {
    background: rgba(7,17,31,0.97) !important;
    border: 1px solid rgba(100,180,255,0.18) !important;
    border-radius: 14px !important;
    box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(79,195,247,0.08) !important;
    padding: 0 !important;
    color: #e8f4fd !important;
  }
  .leaflet-popup-content { margin: 0 !important; width: auto !important; }
  .leaflet-popup-tip-container { margin-top: -1px; }
  .leaflet-popup-tip { background: rgba(7,17,31,0.97) !important; box-shadow: none !important; }
  .leaflet-popup-close-button {
    color: rgba(126,172,196,0.6) !important;
    font-size: 18px !important;
    right: 10px !important; top: 8px !important;
    width: 22px !important; height: 22px !important;
    border-radius: 50% !important; line-height: 22px !important;
    text-align: center !important; transition: all 0.15s !important;
  }
  .leaflet-popup-close-button:hover {
    color: #4fc3f7 !important;
    background: rgba(79,195,247,0.12) !important;
  }

  .marker-cluster-small,
  .marker-cluster-medium,
  .marker-cluster-large { background-color: rgba(79,195,247,0.18) !important; }
  .marker-cluster-small div,
  .marker-cluster-medium div,
  .marker-cluster-large div {
    background-color: rgba(79,195,247,0.78) !important;
    color: #07111f !important;
    font-weight: 700 !important;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 13px !important;
  }

  .leaflet-control-zoom {
    border: 1px solid rgba(100,180,255,0.18) !important;
    border-radius: 10px !important;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
  }
  .leaflet-control-zoom a {
    background: rgba(7,17,31,0.92) !important;
    color: #7eacc4 !important;
    font-size: 16px !important;
    line-height: 30px !important;
    width: 30px !important; height: 30px !important;
    border-bottom: 1px solid rgba(100,180,255,0.12) !important;
    transition: all 0.15s !important;
  }
  .leaflet-control-zoom a:last-child { border-bottom: none !important; }
  .leaflet-control-zoom a:hover {
    background: rgba(79,195,247,0.14) !important;
    color: #4fc3f7 !important;
  }

  .leaflet-control-attribution {
    background: rgba(7,17,31,0.7) !important;
    color: rgba(126,172,196,0.55) !important;
    font-size: 10px !important;
    padding: 2px 8px !important;
    border-radius: 6px 0 0 0 !important;
    backdrop-filter: blur(4px) !important;
  }
  .leaflet-control-attribution a { color: rgba(79,195,247,0.65) !important; }
`

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
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

function injectMapStyles() {
  if (document.getElementById('map-custom-styles')) return
  const style = document.createElement('style')
  style.id = 'map-custom-styles'
  style.textContent = MAP_STYLES
  document.head.appendChild(style)
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

      injectMapStyles()

      const L   = window.L
      const map = L.map(containerRef.current, { center: CENTRE, zoom: 12 })

      // Dark CartoDB tiles — matches the app theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      const cluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
      })
      map.addLayer(cluster)

      mapRef.current     = map
      clusterRef.current = cluster
      readyRef.current   = true

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

  const validCount = items.filter(i => i.latitude != null && i.longitude != null).length

  return (
    <div style={{ position: 'relative', height, borderRadius: 16,
      overflow: 'hidden', border: '1px solid rgba(100,180,255,0.15)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>

      <div ref={containerRef} style={{ height: '100%', width: '100%', background: '#0d1120' }} />

      {/* Badge — top left, above Leaflet zoom controls */}
      <div style={{
        position: 'absolute', top: 12, left: 52, zIndex: 1000,
        background: 'rgba(7,17,31,0.88)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(100,180,255,0.18)', borderRadius: 10,
        padding: '5px 12px', fontSize: 12, display: 'flex',
        alignItems: 'center', gap: 6, pointerEvents: 'none',
      }}>
        <span style={{ color: '#4fc3f7', fontWeight: 700 }}>📍 {validCount}</span>
        <span style={{ color: '#7eacc4' }}>prona në hartë</span>
      </div>
    </div>
  )
}

// ── PIN SVG ───────────────────────────────────────────────────────────────────
const PIN_HTML = `
  <svg width="22" height="30" viewBox="0 0 22 30" fill="none"
    xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 8px rgba(0,0,0,0.55));cursor:pointer">
    <path d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 19 11 19S22 19.25 22 11C22 4.925 17.075 0 11 0z"
      fill="#4fc3f7"/>
    <circle cx="11" cy="11" r="5" fill="rgba(7,17,31,0.75)"/>
    <circle cx="11" cy="11" r="2.5" fill="#4fc3f7" opacity="0.9"/>
  </svg>`

// ── DRAW MARKERS ─────────────────────────────────────────────────────────────
function drawMarkers(map, cluster, items, onSelect) {
  if (!map || !cluster) return

  cluster.clearLayers()
  window._mapSelect = (id) => onSelect && onSelect(id)

  const valid = items.filter(i => i.latitude != null && i.longitude != null)
  if (valid.length === 0) return

  const L = window.L

  const icon = L.divIcon({
    className: '',
    html: PIN_HTML,
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    popupAnchor: [0, -32],
  })

  valid.forEach(item => {
    const typeLabel = item.property_type
      ? item.property_type.charAt(0).toUpperCase() + item.property_type.slice(1)
      : 'Pronë'

    const chips = [
      item.sqm   != null ? `<span style="${CHIP}">${item.sqm} m²</span>`        : '',
      item.beds  != null ? `<span style="${CHIP}">${item.beds} dhoma</span>`      : '',
      item.baths != null ? `<span style="${CHIP}">${item.baths} banjo</span>`     : '',
      item.floor != null ? `<span style="${CHIP}">Kati ${item.floor}</span>`      : '',
    ].filter(Boolean).join('')

    const ppsm = item.price_per_sqm
      ? `<div style="font-size:11px;color:#4fc3f7;font-weight:600;margin-bottom:12px">
           ${Math.round(item.price_per_sqm).toLocaleString('en-US')} €/m²
         </div>`
      : '<div style="margin-bottom:12px"></div>'

    const neighborhood = item.neighborhood
      ? `<div style="font-size:10px;font-weight:700;letter-spacing:1.1px;
           text-transform:uppercase;color:#7eacc4;margin-bottom:8px">
           ${item.neighborhood}
         </div>`
      : `<div style="font-size:10px;font-weight:700;letter-spacing:1.1px;
           text-transform:uppercase;color:#7eacc4;margin-bottom:8px">
           ${typeLabel}
         </div>`

    const popup = `
      <div onclick="window._mapSelect('${item.id}')"
        style="padding:16px 18px 14px;min-width:210px;cursor:pointer;
          font-family:'DM Sans',sans-serif">
        ${neighborhood}
        <div style="font-size:20px;font-weight:700;color:#ffd54f;
          font-family:'DM Serif Display',serif;line-height:1.2;margin-bottom:4px">
          ${formatPrice(item.price)}
        </div>
        ${ppsm}
        ${chips ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">${chips}</div>` : ''}
        <div style="background:rgba(79,195,247,0.14);color:#4fc3f7;
          border:1px solid rgba(79,195,247,0.32);border-radius:8px;
          padding:8px 14px;font-size:12px;font-weight:600;
          text-align:center;letter-spacing:.4px;
          transition:background 0.15s">
          Shiko detajet →
        </div>
      </div>`

    const marker = L.marker([item.latitude, item.longitude], { icon })
    marker.bindPopup(popup, { maxWidth: 260, autoPan: true })
    marker.on('click', function () { this.openPopup() })
    cluster.addLayer(marker)
  })

  // Fit map to all visible markers
  try {
    const bounds = cluster.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  } catch (_) {
    map.setView(CENTRE, 12)
  }
}

const CHIP = `
  display:inline-block;
  background:rgba(255,255,255,0.06);
  border:1px solid rgba(100,180,255,0.15);
  border-radius:6px;
  padding:2px 8px;
  font-size:11px;
  color:#b0cfe0;
  font-family:'DM Sans',sans-serif;
`
