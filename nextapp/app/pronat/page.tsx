import type { Metadata } from 'next'
import { Suspense } from 'react'
import ExploreClient from './ExploreClient'

export const metadata: Metadata = { title: 'Eksploro pronat' }

export default function Page() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <ExploreClient />
    </Suspense>
  )
}
