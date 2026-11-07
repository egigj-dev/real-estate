'use client'
import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { getHealth } from '@/lib/api'

/** Shown on every page when the API is serving the synthetic demo dataset. */
export default function DataNotice() {
  const [demo, setDemo] = useState(false)
  useEffect(() => {
    getHealth().then(h => setDemo(h.data_source === 'demo')).catch(() => {})
  }, [])
  if (!demo) return null
  return (
    <div role="status" className="border-b border-brass/40 bg-brass-soft">
      <p className="container flex items-start gap-2 py-2.5 text-sm text-ink">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brass-ink" />
        <span>
          <strong className="font-medium">Të dhëna demo.</strong> Këto janë prona fiktive të krijuara për prova, jo
          njoftime reale. Vlerësimet e modelit nuk janë të disponueshme në këtë mënyrë.
        </span>
      </p>
    </div>
  )
}
