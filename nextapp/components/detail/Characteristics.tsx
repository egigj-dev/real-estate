import type { ListingDetail } from '@/lib/types'
import { fmtDec, fmtSqm } from '@/lib/format'
import { FURNISHING_LABELS, floorLabel, known, knownPositive } from '@/lib/listing'

const UNKNOWN = <span className="text-ink-subtle">Nuk tregohet</span>

const yesNo = (v: boolean | null | undefined) => (v === true ? 'Po' : v === false ? 'Jo' : UNKNOWN)

/** The listing's attributes as a definition list; missing values say so rather than showing 0 or -1. */
export default function Characteristics({ item }: { item: ListingDetail }) {
  const count = (v: number | null | undefined) => {
    const k = known(v)
    return k === null ? UNKNOWN : fmtDec(k)
  }
  const rows: [string, React.ReactNode][] = [
    ['Sipërfaqja', fmtSqm(item.sqm)],
    ['Dhoma gjumi', count(item.beds)],
    ['Banjo', knownPositive(item.baths) === null ? UNKNOWN : fmtDec(item.baths!)],
    ['Dhoma ndenjeje', count(item.living_rooms)],
    ['Ballkone', count(item.balconies)],
    ['Kati', floorLabel(item.floor) ?? UNKNOWN],
    ['Ashensor', yesNo(item.has_elevator)],
    ['Vend parkimi', yesNo(item.has_parking_space)],
    ['Parkim i mbuluar', yesNo(item.has_carport)],
    ['Garazh', yesNo(item.has_garage)],
    ['Tarracë', yesNo(item.has_terrace)],
    ['Kopsht', yesNo(item.has_garden)],
    ['Mobilimi', FURNISHING_LABELS[item.furnishing_status ?? 'unknown'] ?? UNKNOWN],
  ]
  return (
    <dl className="grid gap-x-8 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="num text-right text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
