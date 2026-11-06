import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import ZoneMap from '../components/ZoneMap'
import ZoneInfoPanel from '../components/ZoneInfoPanel'
import { IconArrowRight, IconBuilding } from '../components/icons/Icons'
import {
  fetchHealth, fetchAreas, fetchMarketInsights, fetchListingsSample,
} from '../api'

const TIRANA_CENTER = [41.3275, 19.8187]

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, d2r = Math.PI / 180
  const dLat = (lat2 - lat1) * d2r, dLon = (lon2 - lon1) * d2r
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Short, real-signal-driven insight lines. Nothing here is hardcoded per zone —
// it's derived from this zone's own distance-from-centre, average bedrooms,
// and price relative to the city median, so every area gets an honest read
// rather than a copy-pasted "growing investment potential" for everyone.
function buildInsights({ distanceKm, avgBeds, deltaPct }) {
  const out = []
  if (distanceKm != null) {
    if (distanceKm > 6) out.push({ icon: '🌳', text: 'Zonë e gjelbër, larg zhurmës së qendrës' })
    else if (distanceKm > 3) out.push({ icon: '🏘️', text: 'Zonë periferike dhe e qetë' })
    else out.push({ icon: '🏙️', text: 'Zonë qendrore, jetë urbane aktive' })
  }
  if (avgBeds != null) {
    if (avgBeds >= 2.4) out.push({ icon: '🏡', text: 'Kryesisht banesa familjare' })
    else if (avgBeds <= 1.4) out.push({ icon: '🏢', text: 'Kryesisht studio dhe apartamente të vogla' })
  }
  if (deltaPct != null) {
    if (deltaPct < -10) out.push({ icon: '📈', text: 'Çmim nën mesataren e qytetit — potencial investimi' })
    else if (deltaPct > 25) out.push({ icon: '💎', text: 'Zonë premium, e qëndrueshme në kërkesë' })
  }
  return out.slice(0, 3)
}

// Single aggregation pass over the sampled listings (see fetchListingsSample
// in api.js for why it's a sample, not the full dataset) producing one
// metrics object per OSM area — used to drive the map's coloring, the info
// panel, the legend range, and the Top Neighborhoods section.
function buildZoneData(areas, sample, overallMedianPpsqm) {
  const buckets = {}
  sample.forEach(l => {
    const name = l.area_name
    if (!name || name === 'E panjohur') return
    if (!buckets[name]) buckets[name] = { sumPpsqm: 0, countPpsqm: 0, sumSqm: 0, countSqm: 0, sumBeds: 0, countBeds: 0, count: 0 }
    const b = buckets[name]
    b.count += 1
    if (l.price_per_sqm != null && isFinite(l.price_per_sqm)) { b.sumPpsqm += l.price_per_sqm; b.countPpsqm += 1 }
    if (l.sqm != null && isFinite(l.sqm)) { b.sumSqm += l.sqm; b.countSqm += 1 }
    if (l.beds != null && isFinite(l.beds)) { b.sumBeds += l.beds; b.countBeds += 1 }
  })

  const counts = Object.values(buckets).map(b => b.count)
  const maxCount = Math.max(1, ...counts)
  const minCount = counts.length ? Math.min(...counts) : 0

  const areaByName = {}
  areas.forEach(a => { areaByName[a.name] = a })

  return Object.entries(buckets).map(([name, b]) => {
    const price = b.countPpsqm ? b.sumPpsqm / b.countPpsqm : null
    const avgSqm = b.countSqm ? b.sumSqm / b.countSqm : null
    const avgBeds = b.countBeds ? b.sumBeds / b.countBeds : null
    const deltaPct = price != null && overallMedianPpsqm ? ((price - overallMedianPpsqm) / overallMedianPpsqm) * 100 : null

    const bbox = areaByName[name]?.bbox
    const distanceKm = bbox
      ? haversineKm(TIRANA_CENTER[0], TIRANA_CENTER[1], (bbox.min_lat + bbox.max_lat) / 2, (bbox.min_lon + bbox.max_lon) / 2)
      : null

    const activityScore = maxCount > minCount
      ? ((b.count - minCount) / (maxCount - minCount)) * 10
      : 5

    return {
      name, price, listingCount: b.count, avgSqm, avgBeds, deltaPct, activityScore,
      insights: buildInsights({ distanceKm, avgBeds, deltaPct }),
    }
  })
}

function NeighborhoodCard({ name, price, count, rank, onClick }) {
  const hue = 150 - Math.min(rank, 5) * 14 // subtle green→teal drift per rank, no stock photos needed
  return (
    <div className="nbhd-card" onClick={onClick}>
      <div className="nbhd-thumb" style={{ background: `linear-gradient(135deg, hsl(${hue},30%,38%), hsl(${hue + 10},26%,52%))` }}>
        <IconBuilding size={26} />
      </div>
      <div className="nbhd-body">
        <div className="nbhd-name">{name}</div>
        <div className="nbhd-price">{Math.round(price).toLocaleString()} €/m²</div>
        <div className="nbhd-tag">{count} prona në kampion</div>
      </div>
    </div>
  )
}

export default function OverviewPage({ onNavigate }) {
  const [health, setHealth] = useState(null)
  const [areas, setAreas] = useState([])
  const [insights, setInsights] = useState(null)
  const [sample, setSample] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [hoveredArea, setHoveredArea] = useState(null)
  const [pinnedArea, setPinnedArea] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetchHealth().catch(() => null),
      fetchAreas().catch(() => []),
      fetchMarketInsights().catch(() => null),
      fetchListingsSample(500).catch(() => null),
    ]).then(([h, a, mi, sampleRes]) => {
      if (!alive) return
      setHealth(h)
      setAreas(a || [])
      setInsights(mi)
      setSample(sampleRes?.listings ?? [])
    }).catch(e => alive && setLoadError(e.message))
    return () => { alive = false }
  }, [])

  const avgPricePerSqm = insights?.overall_median_price_per_sqm ?? null

  const zoneData = useMemo(
    () => buildZoneData(areas, sample, avgPricePerSqm),
    [areas, sample, avgPricePerSqm]
  )

  const priceByArea = useMemo(() => {
    const m = {}
    zoneData.forEach(z => { if (z.price != null) m[z.name] = z.price })
    return m
  }, [zoneData])

  const topNeighborhoods = useMemo(
    () => [...zoneData].sort((a, b) => b.listingCount - a.listingCount).slice(0, 4),
    [zoneData]
  )

  // Default the focal panel to the most data-rich zone once it's available,
  // without ever overriding a click the person already made.
  useEffect(() => {
    if (pinnedArea == null && topNeighborhoods.length > 0) {
      setPinnedArea(topNeighborhoods[0].name)
    }
  }, [topNeighborhoods, pinnedArea])

  const displayedAreaName = hoveredArea ?? pinnedArea
  const displayedZone = zoneData.find(z => z.name === displayedAreaName) ?? null

  const priceRange = useMemo(() => {
    const vals = Object.values(priceByArea)
    if (!vals.length) return null
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [priceByArea])

  const listingsAnalyzed = health?.listings_loaded ?? sample.length ?? null
  const priceZones = areas.length || null

  return (
    <>
      <PageHeader title="Përmbledhje" />

      <div className="overview-grid">
        {/* ── Left: hero + CTAs + stats ─────────────────────────────────── */}
        <div className="card ov-hero-card">
          <div>
            <h1 className="ov-title">
              Kupto tregun e pronave në Tiranë <span className="accent">para se të blesh</span>.
            </h1>
            <p className="ov-sub">
              Të dhëna konkrete, vlerësime ML, dhe analizë e zonave — gjithçka në një vend.
            </p>
          </div>

          <div className="ov-cta-row">
            <button className="btn-primary" onClick={() => onNavigate('explore')}>
              Kërko Prona <IconArrowRight size={15} />
            </button>
            <button className="btn-secondary" onClick={() => onNavigate('predict')}>
              Parashiko Vlerën
            </button>
          </div>

          <div className="ov-stats">
            <div className="stat-tile">
              <div className="stat-tile-value">{listingsAnalyzed != null ? listingsAnalyzed.toLocaleString() : '—'}</div>
              <div className="stat-tile-label">Prona të Analizuara</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-value">{priceZones != null ? priceZones : '—'}</div>
              <div className="stat-tile-label">Zona Çmimi</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-value">{health?.model_metrics?.listing?.median_ape_pct != null ? `±${Math.round(health.model_metrics.listing.median_ape_pct)}%` : '—'}</div>
              <div className="stat-tile-label">Gabimi tipik</div>
              <div className="stat-tile-note">në prona të patestuara</div>
            </div>
          </div>
        </div>

        {/* ── Centre: signature zone price map + focal info panel ───────── */}
        <div className="card ov-map-card">
          <div className="map-card-head">
            <span className="map-card-title">Çmimi sipas Zonës</span>
            <span className="map-card-hint">kalo me miun ose kliko një zonë</span>
          </div>
          {loadError && <div className="err-box">⚠️ {loadError}</div>}

          <div className="ov-map-split">
            <div>
              <ZoneMap
                areas={areas}
                priceByArea={priceByArea}
                height={380}
                activeArea={displayedAreaName}
                onHoverArea={setHoveredArea}
                onSelectArea={setPinnedArea}
              />
              {priceRange && (
                <div className="zonemap-legend">
                  <div className="legend-bar" />
                  <div className="legend-labels">
                    <span>E përballueshme · <strong>{Math.round(priceRange.min).toLocaleString()} €/m²</strong></span>
                    <span>Premium · <strong>{Math.round(priceRange.max).toLocaleString()} €/m²</strong></span>
                  </div>
                </div>
              )}
            </div>

            <ZoneInfoPanel
              zone={displayedZone}
              onExplore={(name) => onNavigate('explore', { areaName: name })}
            />
          </div>
        </div>

        {/* ── Bottom: Top Neighborhoods (real, from sampled aggregation) ── */}
        <div className="card neighborhoods-section">
          <div className="neighborhoods-head">
            <span className="neighborhoods-head-title">Lagjet Kryesore</span>
            <button className="pulse-head-link" onClick={() => onNavigate('map')}>Shiko hartën →</button>
          </div>
          <div className="neighborhoods-grid">
            {topNeighborhoods.length === 0 && (
              <div className="empty-box" style={{ gridColumn: '1 / -1' }}>Duke ngarkuar lagjet…</div>
            )}
            {topNeighborhoods.map((n, i) => (
              <NeighborhoodCard
                key={n.name} rank={i} name={n.name} price={n.price} count={n.listingCount}
                onClick={() => onNavigate('explore', { areaName: n.name })}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
