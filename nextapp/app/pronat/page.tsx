import type { Metadata } from 'next'
import { Suspense } from 'react'
import ExploreClient from './ExploreClient'

// Rendered per request: these pages read filters from the URL, and a static
// prerender without them breaks client navigation when a link carries a query.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Eksploro pronat' }

export default function Page() {
  return (
    <Suspense>
      <ExploreClient />
    </Suspense>
  )
}
