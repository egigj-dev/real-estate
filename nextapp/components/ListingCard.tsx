"use client"
import { Card, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import { formatPrice, listingLabel } from "@/lib/api"
import type { ListingSummary } from "@/lib/types"

export default function ListingCard({
  item, onClick, index = 0,
}: {
  item: ListingSummary
  onClick: () => void
  index?: number
}) {
  const meta = [
    item.sqm != null && `${item.sqm} m²`,
    item.beds != null && `${item.beds} dhoma`,
    item.baths != null && `${item.baths} banjo`,
    item.floor != null && `Kati ${item.floor}`,
  ].filter(Boolean) as string[]

  return (
    <Card
      onClick={onClick}
      className="h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <CardContent className="flex h-full flex-col gap-2 p-4">
        {item.property_type && (
          <Badge variant="secondary" className="w-fit">{item.property_type}</Badge>
        )}

        <div className="text-[15px] font-semibold leading-snug text-foreground">
          {listingLabel(item)}
        </div>

        <div className="text-xl font-bold text-foreground">{formatPrice(item.price)}</div>

        {meta.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {meta.map((m) => (
              <span key={m} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {m}
              </span>
            ))}
          </div>
        )}

        {item.price_per_sqm != null && (
          <div className="mt-auto text-xs text-muted-foreground">
            {Math.round(item.price_per_sqm).toLocaleString()} €/m²
          </div>
        )}
      </CardContent>
    </Card>
  )
}
