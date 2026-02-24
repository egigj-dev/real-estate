import { Container } from 'react-bootstrap'

const FEATURES = [
  { icon: '📍', label: 'Vendndodhje (Lat/Lng, Adresë)' },
  { icon: '📐', label: 'Sipërfaqe (m², Dhoma, Banje)' },
  { icon: '🏗️', label: 'Amenitete (Ashensor, Parking)' },
  { icon: '🇦🇱', label: 'Përshkrime Shqip' },
  { icon: '🏠', label: 'Statusi (Mobiluar, Lloji)' },
]

export default function FeatureBadges() {
  return (
    <Container className="pb-4">
      <div className="d-flex flex-wrap gap-2">
        {FEATURES.map((f) => (
          <div key={f.label} className="feat-badge">
            <span style={{ fontSize: 14 }}>{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>
    </Container>
  )
}
