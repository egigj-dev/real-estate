// Deterministic, dependency-free sparkline. Same `seed` always renders the
// same little squiggle (so a stat doesn't visually "jump" on every render),
// gently biased toward `trend` so the shape agrees with the % it sits next to.
// NOTE: this is illustrative, not a real time series — wire up real history
// later by passing `values` directly instead of relying on the seed.

function seededRandom(seed) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return () => {
    h = (h * 1664525 + 1013904223) | 0
    return ((h >>> 8) % 1000) / 1000
  }
}

function buildPoints(seed, trend, n = 9) {
  const rand = seededRandom(seed)
  const drift = trend === 'up' ? 0.055 : trend === 'down' ? -0.055 : 0
  let v = 0.45
  const pts = [v]
  for (let i = 1; i < n; i++) {
    v += drift + (rand() - 0.5) * 0.22
    v = Math.max(0.08, Math.min(0.92, v))
    pts.push(v)
  }
  return pts
}

export default function Sparkline({ seed = 'x', trend = 'up', width = 76, height = 26, color }) {
  const pts = buildPoints(seed, trend)
  const stepX = width / (pts.length - 1)
  const coords = pts.map((v, i) => [i * stepX, height - v * height])

  let d = `M ${coords[0][0]},${coords[0][1]}`
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1]
    const [x1, y1] = coords[i]
    const mx = (x0 + x1) / 2
    d += ` Q ${x0},${y0} ${mx},${(y0 + y1) / 2} Q ${x1},${y1} ${x1},${y1}`
  }

  const areaD = `${d} L ${width},${height} L 0,${height} Z`
  const stroke = color || 'var(--accent)'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={areaD} fill={stroke} opacity="0.12" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
