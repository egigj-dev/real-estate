import { Card } from 'react-bootstrap'
import { formatPrice, listingLabel } from '../api'

export default function ListingCard({ item, onClick, index }) {
  // Backend fields: price, beds, baths, sqm, floor, property_type, neighborhood, city
  const meta = [
    item.sqm   != null && `${item.sqm} m²`,
    item.beds  != null && `${item.beds} dhoma`,
    item.baths != null && `${item.baths} banjo`,
    item.floor != null && `Kati ${item.floor}`,
  ].filter(Boolean)

  return (
    <Card
      className="listing-card h-100"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <Card.Body className="d-flex flex-column gap-2 p-3">
        {item.property_type && (
          <div>
            <span className="type-badge">{item.property_type}</span>
          </div>
        )}

        <div className="card-address">
          {listingLabel(item)}
        </div>

        <div className="card-price">{formatPrice(item.price)}</div>

        {meta.length > 0 && (
          <div className="d-flex flex-wrap gap-1">
            {meta.map((m) => (
              <span key={m} className="meta-chip">{m}</span>
            ))}
          </div>
        )}

        {item.price_per_sqm != null && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 'auto' }}>
            {Math.round(item.price_per_sqm).toLocaleString()} €/m²
          </div>
        )}
      </Card.Body>
    </Card>
  )
}