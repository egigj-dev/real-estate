import { Card } from 'react-bootstrap'
import { formatPrice } from '../api'

export default function ListingCard({ item, onClick, index }) {
  const meta = [
    item.sqm       && `${item.sqm} m²`,
    item.bedrooms  != null && `${item.bedrooms} dhoma`,
    item.bathrooms != null && `${item.bathrooms} banje`,
    item.floor     != null && `Kati ${item.floor}`,
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
          {item.address || 'Adresë e panjohur'}
        </div>

        <div className="card-price">{formatPrice(item.price_in_euro)}</div>

        {meta.length > 0 && (
          <div className="d-flex flex-wrap gap-1">
            {meta.map((m) => (
              <span key={m} className="meta-chip">{m}</span>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
