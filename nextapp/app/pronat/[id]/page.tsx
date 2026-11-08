import type { Metadata } from 'next'
import DetailClient from './DetailClient'

export const metadata: Metadata = { title: 'Prona' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DetailClient id={decodeURIComponent(id)} />
}
