import { Suspense } from 'react'
import HomeClient from './HomeClient'

// Rendered per request: the map's mode and selection are read from the URL.
export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  )
}
