import type { Metadata } from 'next'
import AboutClient from './AboutClient'

export const metadata: Metadata = { title: 'Rreth të dhënave dhe modelit' }

export default function Page() {
  return <AboutClient />
}
