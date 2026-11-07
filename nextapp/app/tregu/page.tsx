import type { Metadata } from 'next'
import MarketClient from './MarketClient'

export const metadata: Metadata = { title: 'Analiza e tregut' }

export default function Page() {
  return <MarketClient />
}
