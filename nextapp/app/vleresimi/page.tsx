import type { Metadata } from 'next'
import { Suspense } from 'react'
import ValuationClient from './ValuationClient'

export const metadata: Metadata = { title: 'Vlerëso pronën' }

export default function Page() {
  return (
    <Suspense>
      <ValuationClient />
    </Suspense>
  )
}
