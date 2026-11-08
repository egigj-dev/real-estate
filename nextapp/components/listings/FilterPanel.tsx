'use client'
import { useEffect, useState } from 'react'
import type { Filters } from '@/lib/filters'
import { Checkbox, Field, Input, Segmented, Select } from '@/components/ui/field'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Number input that commits on blur or Enter, so typing doesn't trigger a search per keystroke. */
function CommitNumber({ value, onCommit, ...rest }: {
  value: number | null
  onCommit: (v: number | null) => void
  id: string
  placeholder?: string
  'aria-describedby'?: string
  min?: number
  step?: number
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  useEffect(() => setDraft(value === null ? '' : String(value)), [value])
  const commit = () => {
    const n = draft.trim() === '' ? null : Number(draft)
    const next = n !== null && Number.isFinite(n) && n >= 0 ? n : null
    if (next !== value) onCommit(next)
    else setDraft(value === null ? '' : String(value))
  }
  return (
    <Input
      {...rest}
      type="number"
      inputMode="numeric"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
    />
  )
}

function TextCommit({ value, onCommit, id }: { value: string; onCommit: (v: string) => void; id: string }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => { if (draft.trim() !== value) onCommit(draft.trim()) }
  return (
    <Input
      id={id}
      type="search"
      value={draft}
      placeholder="p.sh. pamje, i ri, Blloku"
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
    />
  )
}

/** "Çdo", "1+", "2+", … up to max. */
const minOptions = (max: number): { value: number | null; label: string }[] => [
  { value: null, label: 'Çdo' },
  ...Array.from({ length: max }, (_, i) => ({ value: i + 1, label: `${i + 1}+` })),
]

export default function FilterPanel({ filters, zones, onChange }: {
  filters: Filters
  zones: string[]
  onChange: (patch: Partial<Filters>) => void
}) {
  // Less-used filters stay folded away unless one of them is in use.
  const advancedCount = [filters.banjo !== null, filters.ashensor, filters.parkim, filters.kopsht, Boolean(filters.mobilim), Boolean(filters.q.trim())].filter(Boolean).length
  const [moreOpen, setMoreOpen] = useState(advancedCount > 0)
  return (
    <form className="space-y-6" onSubmit={e => e.preventDefault()} aria-label="Filtrat e kërkimit">
      <Field label="Zona e çmimit" hint="Gjashtë zona që përdor modeli, nga qendra te periferia.">
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={filters.zona} onChange={e => onChange({ zona: e.target.value })}>
            <option value="">Të gjitha zonat</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </Select>
        )}
      </Field>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium text-ink">Çmimi i kërkuar (€)</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor="cmin">Çmimi minimal</label>
          <CommitNumber id="cmin" placeholder="Nga" step={5000} value={filters.cmin} onCommit={v => onChange({ cmin: v })} />
          <label className="sr-only" htmlFor="cmax">Çmimi maksimal</label>
          <CommitNumber id="cmax" placeholder="Deri" step={5000} value={filters.cmax} onCommit={v => onChange({ cmax: v })} />
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium text-ink">Sipërfaqja (m²)</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor="smin">Sipërfaqja minimale</label>
          <CommitNumber id="smin" placeholder="Nga" value={filters.smin} onCommit={v => onChange({ smin: v })} />
          <label className="sr-only" htmlFor="smax">Sipërfaqja maksimale</label>
          <CommitNumber id="smax" placeholder="Deri" value={filters.smax} onCommit={v => onChange({ smax: v })} />
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Dhoma gjumi</legend>
        <Segmented label="Dhoma gjumi, të paktën" value={filters.dhoma} options={minOptions(4)} onChange={v => onChange({ dhoma: v })} />
      </fieldset>

      <div className="border-t border-line pt-4">
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="more-filters"
          onClick={() => setMoreOpen(o => !o)}
          className="flex w-full items-center justify-between text-sm font-medium text-ink"
        >
          <span>Më shumë filtra{advancedCount ? ` (${advancedCount})` : ''}</span>
          <ChevronDown aria-hidden className={cn('h-4 w-4 text-ink-muted transition-transform', moreOpen && 'rotate-180')} />
        </button>
        {moreOpen && (
          <div id="more-filters" className="mt-5 space-y-6">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">Banjo</legend>
              <Segmented label="Banjo, të paktën" value={filters.banjo} options={minOptions(3)} onChange={v => onChange({ banjo: v })} />
            </fieldset>

            <fieldset className="space-y-2.5">
              <legend className="text-sm font-medium text-ink">Duhet të ketë</legend>
              <Checkbox label="Ashensor" checked={filters.ashensor} onChange={e => onChange({ ashensor: e.target.checked })} />
              <Checkbox label="Vend parkimi" checked={filters.parkim} onChange={e => onChange({ parkim: e.target.checked })} />
              <Checkbox label="Kopsht" checked={filters.kopsht} onChange={e => onChange({ kopsht: e.target.checked })} />
            </fieldset>

            <Field label="Mobilimi">
              {({ id }) => (
                <Select id={id} value={filters.mobilim} onChange={e => onChange({ mobilim: e.target.value as Filters['mobilim'] })}>
                  <option value="">Çdo</option>
                  <option value="po">E mobiluar (plotësisht ose pjesërisht)</option>
                  <option value="jo">Jo e mobiluar ose pa informacion</option>
                </Select>
              )}
            </Field>

            <Field label="Fjalë në përshkrim" hint="Kërkon në tekstin e njoftimit.">
              {({ id }) => <TextCommit id={id} value={filters.q} onCommit={v => onChange({ q: v })} />}
            </Field>
          </div>
        )}
      </div>
    </form>
  )
}
