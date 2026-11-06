import { useMemo } from 'react'

// Projects lat/lon polygons onto a flat SVG canvas (small-city scale, so a
// simple equirectangular projection is indistinguishable from anything fancier)
// and colors each shape by where its price/m² falls in the dataset's range.

function project(areas, targetH = 380) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
  areas.forEach(a => {
    const b = a.bbox
    if (!b) return
    minLat = Math.min(minLat, b.min_lat); maxLat = Math.max(maxLat, b.max_lat)
    minLon = Math.min(minLon, b.min_lon); maxLon = Math.max(maxLon, b.max_lon)
  })
  const latSpan = (maxLat - minLat) || 1
  const lonSpan = (maxLon - minLon) || 1
  const midLat = (maxLat + minLat) / 2
  const aspect = Math.max(0.6, Math.min(1.8, (lonSpan * Math.cos(midLat * Math.PI / 180)) / latSpan))

  const H = targetH
  const W = H * aspect
  const padPct = 0.06
  const padX = W * padPct, padY = H * padPct
  const innerW = W - padX * 2, innerH = H - padY * 2

  const toXY = (lat, lon) => [
    padX + ((lon - minLon) / lonSpan) * innerW,
    padY + innerH - ((lat - minLat) / latSpan) * innerH,
  ]

  return { W, H, toXY }
}

function centroid(points) {
  const n = points.length
  const sx = points.reduce((s, p) => s + p[0], 0)
  const sy = points.reduce((s, p) => s + p[1], 0)
  return [sx / n, sy / n]
}

export default function ZoneMap({
  areas = [], priceByArea = {}, activeArea = null,
  onHoverArea, onSelectArea, height = 380,
}) {
  const { shapes, W, H } = useMemo(() => {
    if (!areas.length) return { shapes: [], W: 0, H: 0 }
    const { W, H, toXY } = project(areas, height)

    const prices = Object.values(priceByArea).filter(v => typeof v === 'number' && v > 0)
    const sorted = [...prices].sort((a, b) => a - b)
    const tierOf = (price) => {
      if (!price || !sorted.length) return null
      const idx = sorted.findIndex(v => v >= price)
      const rank = idx === -1 ? sorted.length - 1 : idx
      return Math.min(4, Math.floor((rank / sorted.length) * 5))
    }

    const built = areas
      .filter(a => a.polygon && a.polygon.length >= 3)
      .map(a => {
        const pts = a.polygon.map(([lat, lon]) => toXY(lat, lon))
        const price = priceByArea[a.name]
        return {
          name: a.name,
          pointsAttr: pts.map(p => p.join(',')).join(' '),
          centroid: centroid(pts),
          price,
          tier: tierOf(price),
        }
      })

    return { shapes: built, W, H }
  }, [areas, priceByArea, height])

  if (!shapes.length) {
    return (
      <div className="zonemap-empty" style={{ height }}>
        Harta nuk u ngarkua — kontrollo lidhjen me API.
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} className="zonemap-svg">
      {shapes.map(s => (
        <polygon
          key={s.name}
          points={s.pointsAttr}
          className={`zone-shape zone-tier-${s.tier ?? 'na'} ${activeArea === s.name ? 'is-active' : ''}`}
          onMouseEnter={() => onHoverArea?.(s.name)}
          onMouseLeave={() => onHoverArea?.(null)}
          onClick={() => onSelectArea?.(s.name)}
        >
          <title>{s.price ? `${s.name} — ${Math.round(s.price).toLocaleString()} €/m²` : s.name}</title>
        </polygon>
      ))}
    </svg>
  )
}
