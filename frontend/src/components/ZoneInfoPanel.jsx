import useAnimatedNumber from '../hooks/useAnimatedNumber'

function DeltaLine({ deltaPct }) {
  if (deltaPct == null || !isFinite(deltaPct)) return null
  const dir = deltaPct > 1.5 ? 'up' : deltaPct < -1.5 ? 'down' : 'flat'
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '–'
  const text = dir === 'flat'
    ? 'rreth mesatares së qytetit'
    : `${arrow} ${Math.abs(Math.round(deltaPct))}% ${dir === 'up' ? 'mbi' : 'nën'} mesataren e qytetit`
  return <div className={`zone-panel-delta ${dir}`}>{text}</div>
}

export default function ZoneInfoPanel({ zone, onExplore }) {
  const animatedPrice = useAnimatedNumber(zone?.price ?? 0)

  if (!zone) {
    return (
      <div className="zone-panel">
        <div className="zone-panel-empty">Zgjedh një zonë në hartë…</div>
      </div>
    )
  }

  return (
    <div className="zone-panel">
      <div className="zone-panel-content" key={zone.name}>
        <div className="zone-panel-name">📍 {zone.name}</div>

        <div className="zone-panel-price">
          {Math.round(animatedPrice).toLocaleString()}
          <span className="zone-panel-price-unit">€/m²</span>
        </div>

        <DeltaLine deltaPct={zone.deltaPct} />

        {zone.insights?.length > 0 && (
          <div className="zone-panel-insights">
            {zone.insights.map((ins, i) => (
              <div key={i} className="zone-panel-insight">
                <span className="ico">{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        )}

        <div className="zone-panel-divider" />

        <div className="zone-panel-stats">
          <div className="mini-stat">
            <div className="mini-stat-value">{zone.listingCount ?? '—'}</div>
            <div className="mini-stat-label">Prona në kampion</div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-value">{zone.avgSqm != null ? `${Math.round(zone.avgSqm)} m²` : '—'}</div>
            <div className="mini-stat-label">Sipërfaqja mesatare</div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-value">{zone.avgBeds != null ? zone.avgBeds.toFixed(1) : '—'}</div>
            <div className="mini-stat-label">Dhoma gjumi mesatare</div>
          </div>
          <div className="mini-stat">
            <div className="mini-stat-value">{zone.activityScore != null ? `${zone.activityScore.toFixed(1)}/10` : '—'}</div>
            <div className="mini-stat-label">Aktiviteti i Tregut</div>
          </div>
        </div>

        {onExplore && (
          <button className="btn-secondary zone-panel-cta" onClick={() => onExplore(zone.name)}>
            Shiko pronat në {zone.name} →
          </button>
        )}
      </div>
    </div>
  )
}
