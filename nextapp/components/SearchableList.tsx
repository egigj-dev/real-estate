"use client"
import { useMemo, useState } from "react"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Button } from "./ui/button"
import { formatPrice, listingLabel } from "@/lib/api"
import type { ListingSummary } from "@/lib/types"

export default function SearchableList({
  items = [], onSelect,
}: {
  items: ListingSummary[]
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [minBeds, setMinBeds] = useState("")
  const [minSqm, setMinSqm] = useState("")
  const [maxSqm, setMaxSqm] = useState("")

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search && !listingLabel(item).toLowerCase().includes(search.toLowerCase())) return false
      if (minPrice !== "" && (item.price ?? 0) < Number(minPrice)) return false
      if (maxPrice !== "" && (item.price ?? Infinity) > Number(maxPrice)) return false
      if (minBeds !== "" && (item.beds ?? 0) < Number(minBeds)) return false
      if (minSqm !== "" && (item.sqm ?? 0) < Number(minSqm)) return false
      if (maxSqm !== "" && (item.sqm ?? Infinity) > Number(maxSqm)) return false
      return true
    })
  }, [items, search, minPrice, maxPrice, minBeds, minSqm, maxSqm])

  const clearAll = () => {
    setSearch(""); setMinPrice(""); setMaxPrice(""); setMinBeds(""); setMinSqm(""); setMaxSqm("")
  }

  return (
    <div>
      <div className="mb-3 rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Kërko brenda rezultateve</span>
          <Button variant="ghost" size="sm" onClick={clearAll}>Pastro</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <div className="col-span-2 sm:col-span-1 md:col-span-2">
            <Label className="mb-1.5 block">Kërkim</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Lloji, zonë…" />
          </div>
          <div>
            <Label className="mb-1.5 block">Çmim min</Label>
            <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label className="mb-1.5 block">Çmim max</Label>
            <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="∞" />
          </div>
          <div>
            <Label className="mb-1.5 block">Min dhoma</Label>
            <Input type="number" value={minBeds} onChange={(e) => setMinBeds(e.target.value)} placeholder="—" />
          </div>
          <div>
            <Label className="mb-1.5 block">Min m²</Label>
            <Input type="number" value={minSqm} onChange={(e) => setMinSqm(e.target.value)} placeholder="—" />
          </div>
        </div>
      </div>

      <div className="mb-2 text-sm text-muted-foreground">{filtered.length} nga {items.length} prona</div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Asnjë rezultat me këto filtra.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                {["Prona", "Lloji", "Çmimi", "m²", "€/m²", "Dhoma", "Banjo", "Kati"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-accent"
                >
                  <td className="max-w-[280px] px-3.5 py-2.5 font-medium text-foreground">{listingLabel(item)}</td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">{item.property_type ?? "—"}</td>
                  <td className="px-3.5 py-2.5 font-semibold text-foreground">{formatPrice(item.price)}</td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">{item.sqm ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">
                    {item.price_per_sqm != null ? Math.round(item.price_per_sqm).toLocaleString() : "—"}
                  </td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">{item.beds ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">{item.baths ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">{item.floor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
