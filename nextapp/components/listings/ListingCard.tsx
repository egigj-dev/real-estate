import Link from 'next/link'
import type { ListingSummary } from '@/lib/types'
import { fmtEur, fmtEurPerSqm, fmtSqm } from '@/lib/format'
import { floorLabel, knownPositive, listingTitle } from '@/lib/listing'
import { ppsqm } from '@/lib/stats'

/**
 * A listing in search results. Listings have no photos or street addresses,
 * so the card leads with the facts a buyer compares: price, size, €/m², rooms.
 */
export default function ListingCard({ listing, href }: { listing: ListingSummary; href: string }) {
  const baths = knownPositive(listing.baths)
  const floor = floorLabel(listing.floor)
  const meta = [fmtSqm(listing.sqm), baths !== null ? `${baths} banjo` : null, floor].filter(Boolean)

  return (
    <article className="group relative flex flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong focus-within:border-primary">
      <p className="text-xs text-ink-muted">{listing.neighborhood ?? 'Zonë e panjohur'}</p>
      <h3 className="mt-1 text-base font-medium text-ink">
        <Link href={href} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none">
          {listingTitle(listing)}
        </Link>
      </h3>
      <p className="mt-3 num text-xl font-semibold text-ink">{fmtEur(listing.price)}</p>
      <p className="num text-sm text-brass-ink">{fmtEurPerSqm(ppsqm(listing))}</p>
      <p className="mt-3 border-t border-line pt-3 num text-sm text-ink-muted">{meta.join(' · ')}</p>
    </article>
  )
}
