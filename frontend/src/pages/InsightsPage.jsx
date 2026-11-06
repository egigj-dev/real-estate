import { useEffect, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import Sparkline from '../components/charts/Sparkline'
import { IconTrendUp, IconTrendDown } from '../components/icons/Icons'
import { fetchMarketInsights } from '../api'

function PulseItem({ label, value, trend, deltaLabel, seed, placeholder }) {
  return (
    <div className="pulse-item">
      <div className="pulse-label">
        {label}
        {placeholder && <span className="pulse-placeholder-tag" title="Vlerë ilustruese — lidhet me të dhëna reale së shpejti"> ●</span>}
      </div>
      <div className="pulse-value">{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`pulse-trend ${trend}`}>
          {trend === 'up' ? <IconTrendUp size={12} /> : <IconTrendDown size={12} />} {deltaLabel}
        </span>
        <Sparkline seed={seed} trend={trend} width={56} height={20} color={trend === 'up' ? 'var(--accent)' : 'var(--danger)'} />
      </div>
    </div>
  )
}

export default function InsightsPage({ onSelectNeighborhood }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    fetchMarketInsights()
      .then(d => alive && setData(d))
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const neighborhoods = data?.neighborhoods ?? []
  const maxPpsqm = neighborhoods.reduce((m, n) => Math.max(m, n.avg_price_per_sqm), 0)
  const sortedByPpsqm = [...neighborhoods].sort((a, b) => b.avg_price_per_sqm - a.avg_price_per_sqm)
  const avgPricePerSqm = data?.overall_median_price_per_sqm ?? null

  return (
    <>
      <PageHeader
        title="Tregu i Pronave"
        subtitle="Statistika çmimi sipas zonës ML, bazuar drejtpërdrejt në modelin e të dhënave."
      />

      {error && <div className="err-box mb-3">⚠️ {error}</div>}
      {loading && <div className="empty-box">Duke ngarkuar statistikat e tregut…</div>}

      {data && (
        <>
          <div className="insights-summary">
            <div className="card insights-summary-item">
              <div className="insights-summary-label">Çmimi Mesatar (median)</div>
              <div className="insights-summary-value">{Math.round(data.overall_median_price).toLocaleString()} €</div>
            </div>
            <div className="card insights-summary-item">
              <div className="insights-summary-label">Çmimi/m² (median)</div>
              <div className="insights-summary-value">{Math.round(data.overall_median_price_per_sqm).toLocaleString()} €</div>
            </div>
            <div className="card insights-summary-item">
              <div className="insights-summary-label">Zona ML të Analizuara</div>
              <div className="insights-summary-value">{data.neighborhood_count}</div>
            </div>
          </div>

          {/* ── Pulsi i Tregut — moved here from Overview ─────────────────── */}
          <div className="card pulse-card mb-4">
            <div className="pulse-head">
              <span className="pulse-head-title">Pulsi i Tregut</span>
            </div>
            <div className="pulse-grid">
              <PulseItem
                label="Çmimi Mesatar"
                value={avgPricePerSqm ? `${Math.round(avgPricePerSqm).toLocaleString()} €/m²` : '—'}
                trend="up" deltaLabel="+4.6% në vit" seed="avg-price"
                placeholder
              />
              <PulseItem
                label="Rritja më e Lartë"
                value={sortedByPpsqm[0]?.neighborhood ?? '—'}
                trend="up" deltaLabel="+22.8% në vit" seed="growth"
                placeholder
              />
              <PulseItem
                label="Më e Nënvlerësuara"
                value={sortedByPpsqm[sortedByPpsqm.length - 1]?.neighborhood ?? '—'}
                trend="down" deltaLabel="-12% nën çmimin e drejtë" seed="undervalued"
                placeholder
              />
              <PulseItem
                label="Rendimenti më i Mirë"
                value={sortedByPpsqm[1]?.neighborhood ?? '—'}
                trend="up" deltaLabel="5.7% rendiment mesatar" seed="yield"
                placeholder
              />
            </div>
          </div>

          <div className="card insights-table-card">
            <div className="insights-table-head">
              <span style={{ width: 22 }} />
              <span style={{ flex: 1.4 }}>Zona</span>
              <span style={{ flex: 2 }}>Çmimi / m²</span>
              <span style={{ width: 88, textAlign: 'right' }}>Çmimi mes.</span>
              <span style={{ width: 80, textAlign: 'right' }}>Prona</span>
            </div>
            {sortedByPpsqm.map((n, i) => (
              <div key={n.neighborhood} className="insights-row" onClick={() => onSelectNeighborhood?.(n.neighborhood)}>
                <span className="insights-rank">{i + 1}</span>
                <span className="insights-name">{n.neighborhood}</span>
                <span className="insights-bar-col">
                  <span className="insights-bar-track">
                    <span
                      className="insights-bar-fill"
                      style={{ width: `${maxPpsqm ? (n.avg_price_per_sqm / maxPpsqm) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="insights-value">{Math.round(n.avg_price_per_sqm).toLocaleString()} €</span>
                </span>
                <span className="insights-sub" style={{ width: 88 }}>{Math.round(n.avg_price).toLocaleString()} €</span>
                <span className="insights-sub">{n.listing_count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
