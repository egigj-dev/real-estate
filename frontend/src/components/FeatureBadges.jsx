import { Container } from 'react-bootstrap'

export default function FeatureBadges() {
  return (
    <Container className="pb-5">
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
      }}>
      </div>
    </Container>
  )
}