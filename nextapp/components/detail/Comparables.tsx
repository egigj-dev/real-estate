import Link from 'next/link'
import type { CompItem, ListingSummary } from '@/lib/types'
import { fmtEur, fmtEurPerSqm, fmtPct, fmtSqm } from '@/lib/format'
import { distanceLabel, listingTitle, similarityReason } from '@/lib/listing'
import { median } from '@/lib/stats'
import { Note } from '@/components/ui/states'

export interface Comparable extends CompItem {
  /** Full listing summary when it loaded; comparables still render without it. */
  summary?: ListingSummary
}

/**
 * The five listings closest to this one by size, rooms, floor, amenities and
 * location (feature distance, not a valuation). Shown as a table so price per m²
 * can be compared down a column.
 */
export default function Comparables({ comps, subjectPpsqm }: { comps: Comparable[]; subjectPpsqm: number }) {
  const ppsqms = comps.map(c => c.price / c.sqm)
  const med = median(ppsqms)
  const gap = subjectPpsqm / med - 1

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-base text-ink">
        Mediana e çmimit për m² e këtyre {comps.length} pronave është <span className="num font-semibold">{fmtEurPerSqm(med)}</span>.
        Kjo pronë kërkon <span className="num font-semibold">{fmtEurPerSqm(subjectPpsqm)}</span>, pra{' '}
        <span className="num">{fmtPct(Math.abs(gap))}</span> {gap >= 0 ? 'më shumë' : 'më pak'}.
      </p>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Prona të ngjashme me këtë</caption>
          <thead className="bg-surface-sunken text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Prona</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Çmimi</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">€/m²</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Sipërfaqja</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Larg kësaj</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Pse e ngjashme</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {comps.map(c => (
              <tr key={c.id}>
                <th scope="row" className="px-4 py-3 font-normal">
                  <Link href={`/pronat/${encodeURIComponent(c.id)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {c.summary ? listingTitle(c.summary) : `Prona ${c.id}`}
                  </Link>
                  {c.summary?.neighborhood && <span className="block text-xs text-ink-muted">{c.summary.neighborhood}</span>}
                </th>
                <td className="num whitespace-nowrap px-4 py-3 text-right text-ink">{fmtEur(c.price)}</td>
                <td className="num whitespace-nowrap px-4 py-3 text-right text-ink">{fmtEurPerSqm(c.price / c.sqm)}</td>
                <td className="num whitespace-nowrap px-4 py-3 text-right text-ink">{fmtSqm(c.sqm)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{distanceLabel(c.distance_label)}</td>
                <td className="px-4 py-3 text-ink-muted">{similarityReason(c.similarity_reason)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>
        Pronat zgjidhen sipas ngjashmërisë në sipërfaqe, dhoma, kat, komoditete dhe vendndodhje. Edhe ato janë çmime të kërkuara,
        jo çmime shitjeje.
      </Note>
    </div>
  )
}
