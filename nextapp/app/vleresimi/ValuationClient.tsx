'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, fetchPredictByZone, getHealth } from '@/lib/api'
import { EMPTY_FILTERS, filtersToSearch } from '@/lib/filters'
import { fmtDec, fmtEur, fmtInt, fmtPct } from '@/lib/format'
import type { ZonePrediction } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { FEATURE_LABELS, FURNISHING_LABELS } from '@/lib/listing'
import { useAsync } from '@/lib/useAsync'
import { DEFAULT_INPUT, describeInput, inputToSearch, LIMITS, parseInput, toRequest, validate, type ValuationInput } from '@/lib/valuation'
import ZoneEstimates from '@/components/valuation/ZoneEstimates'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select } from '@/components/ui/field'
import { PageIntro, Panel, Section } from '@/components/ui/layout'
import { ErrorState, Loading, Note, Skeleton } from '@/components/ui/states'

type NumKey = keyof typeof LIMITS
// `more` fields sit behind "Më shumë detaje"; they still go to the model with their defaults.
const NUM_FIELDS: { key: NumKey; label: string; hint?: string; more?: boolean }[] = [
  { key: 'sqm', label: 'Sipërfaqja (m²)', hint: `${LIMITS.sqm.min}–${LIMITS.sqm.max} m²` },
  { key: 'beds', label: 'Dhoma gjumi', hint: '0 për garsonierë' },
  { key: 'baths', label: 'Banjo' },
  { key: 'floor', label: 'Kati', hint: '0 për përdhesë' },
  { key: 'living_rooms', label: 'Dhoma ndenjeje', more: true },
  { key: 'balconies', label: 'Ballkone', more: true },
]
const BOOL_FIELDS: { key: keyof ValuationInput; label: string; more?: boolean }[] = [
  { key: 'has_elevator', label: 'Ashensor' },
  { key: 'has_parking_space', label: 'Vend parkimi' },
  { key: 'has_carport', label: 'Parkim i mbuluar', more: true },
  { key: 'has_garage', label: 'Garazh', more: true },
  { key: 'has_terrace', label: 'Tarracë', more: true },
  { key: 'has_garden', label: 'Kopsht', more: true },
]
const MORE_KEYS = [...NUM_FIELDS.filter(f => f.more).map(f => f.key), ...BOOL_FIELDS.filter(f => f.more).map(f => f.key), 'furnishing_status'] as (keyof ValuationInput)[]
const changedFromDefault = (i: ValuationInput) => MORE_KEYS.filter(k => i[k] !== DEFAULT_INPUT[k]).length

export default function ValuationClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const submitted = useMemo(() => parseInput(new URLSearchParams(sp.toString())), [sp])

  // Text drafts let a field be empty while typing; they're converted on submit.
  const [draft, setDraft] = useState<Record<NumKey, string>>(() => toDraft(submitted ?? DEFAULT_INPUT))
  const [flags, setFlags] = useState<ValuationInput>(submitted ?? DEFAULT_INPUT)
  const [errors, setErrors] = useState<Partial<Record<NumKey, string>>>({})
  const [moreOpen, setMoreOpen] = useState(() => (submitted ? changedFromDefault(submitted) > 0 : false))
  useEffect(() => {
    if (submitted) { setDraft(toDraft(submitted)); setFlags(submitted) }
  }, [submitted])

  const submit = () => {
    const input: ValuationInput = { ...flags }
    for (const f of NUM_FIELDS) input[f.key] = draft[f.key].trim() === '' ? NaN : Number(draft[f.key].replace(',', '.'))
    const errs = validate(input)
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0]
      if (NUM_FIELDS.find(f => f.key === first)?.more) setMoreOpen(true)
      // Focus after the disclosure (if any) has rendered.
      requestAnimationFrame(() => document.getElementById(`v-${first}`)?.focus())
      return
    }
    router.push(`${pathname}${inputToSearch(input)}`, { scroll: false })
  }

  const result = useAsync(
    () => (submitted && !Object.keys(validate(submitted)).length ? fetchPredictByZone(toRequest(submitted)) : Promise.resolve(null)),
    [submitted ? inputToSearch(submitted) : ''],
  )

  const health = useAsync(getHealth, [])
  const propertyMetrics = health.data?.model_metrics?.property

  const exploreHref = (zone: string) => {
    if (!submitted) return '/pronat'
    const f = { ...EMPTY_FILTERS, zona: zone, smin: Math.round(submitted.sqm * 0.85), smax: Math.round(submitted.sqm * 1.15), dhoma: submitted.beds || null }
    return `/pronat${filtersToSearch(f, 'lista')}`
  }

  const numberField = (f: (typeof NUM_FIELDS)[number]) => (
    <Field key={f.key} id={`v-${f.key}`} label={f.label} hint={f.hint} error={errors[f.key]} className={f.key === 'sqm' ? 'col-span-2' : undefined}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          type="number"
          inputMode={f.key === 'sqm' ? 'decimal' : 'numeric'}
          min={LIMITS[f.key].min}
          max={LIMITS[f.key].max}
          value={draft[f.key]}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
        />
      )}
    </Field>
  )
  const checkboxField = (f: (typeof BOOL_FIELDS)[number]) => (
    <Checkbox key={f.key} label={f.label} checked={Boolean(flags[f.key])} onChange={e => setFlags(fl => ({ ...fl, [f.key]: e.target.checked }))} />
  )

  return (
    <div className="space-y-10">
      <PageIntro title="Vlerëso pronën">
        Përshkruaj një apartament dhe shiko sa do të kërkohej për të, sipas modelit, në secilën nga gjashtë zonat e çmimit të Tiranës.
      </PageIntro>

      <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Panel as="section" className="h-fit p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-semibold text-ink">Karakteristikat</h2>
          <form noValidate onSubmit={e => { e.preventDefault(); submit() }} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {NUM_FIELDS.filter(f => !f.more).map(numberField)}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {BOOL_FIELDS.filter(f => !f.more).map(checkboxField)}
            </div>

            <div className="border-t border-line pt-4">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-controls="more-details"
                onClick={() => setMoreOpen(o => !o)}
                className="flex w-full items-center justify-between text-sm font-medium text-ink"
              >
                <span>Më shumë detaje{changedFromDefault(flags) ? ` (${changedFromDefault(flags)})` : ''}</span>
                <ChevronDown aria-hidden className={cn('h-4 w-4 text-ink-muted transition-transform', moreOpen && 'rotate-180')} />
              </button>
              {!moreOpen && <p className="mt-1 text-xs text-ink-muted">Ndenje, ballkone, mobilimi, garazh, tarracë, kopsht.</p>}
              {moreOpen && (
                <div id="more-details" className="mt-4 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    {NUM_FIELDS.filter(f => f.more).map(numberField)}
                  </div>
                  <Field label="Mobilimi">
                    {({ id }) => (
                      <Select id={id} value={flags.furnishing_status} onChange={e => setFlags(fl => ({ ...fl, furnishing_status: e.target.value as ValuationInput['furnishing_status'] }))}>
                        {Object.entries(FURNISHING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    )}
                  </Field>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {BOOL_FIELDS.filter(f => f.more).map(checkboxField)}
                  </div>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={result.status === 'loading' && Boolean(submitted)}>Vlerëso</Button>
          </form>
        </Panel>

        <div className="min-w-0 space-y-10">
          {!submitted && (
            <div className="max-w-prose space-y-4 text-base leading-relaxed text-ink">
              <p>
                Modeli është trajnuar me {propertyMetrics ? fmtInt(propertyMetrics.n) : 'rreth 4 000'} njoftime shitjeje. Për secilën
                zonë, apartamenti vendoset në pikën qendrore të zonës dhe modeli jep çmimin që do të kërkohej për të. Çmimi brenda
                një zone ndryshon sipas vendndodhjes së saktë.
              </p>
              <p className="text-ink-muted">Plotëso karakteristikat dhe shtyp “Vlerëso”. Fushat janë mbushur me vlera fillestare.</p>
            </div>
          )}

          {submitted && result.status === 'loading' && <Loading label="Duke llogaritur…"><Skeleton className="h-80 w-full" /></Loading>}
          {submitted && result.status === 'error' && (
            result.error instanceof ApiError && result.error.status === 503
              ? <ErrorState title="Vlerësimet nuk janë të disponueshme" message="Nuk ka model të instaluar në këtë server. Kjo ndodh kur aplikacioni punon me të dhënat demo." />
              : <ErrorState title="Vlerësimi dështoi" message={result.error.message} onRetry={result.retry} />
          )}

          {submitted && result.status === 'success' && result.data && (
            <>
              <Section title="Vlerësimi sipas zonës" description={<>Për: {describeInput(submitted)}{submitted.furnishing_status !== 'unknown' ? `, ${FURNISHING_LABELS[submitted.furnishing_status].toLowerCase()}` : ''}.</>}>
                <RangeSummary zones={result.data.zones} />
                <ZoneEstimates zones={result.data.zones} exploreHref={exploreHref} />
                <Note className="max-w-prose">
                  Këto janë çmime të kërkuara të pritshme, jo vlera tregu. Gabimi është matur në njoftime që modeli nuk i pa gjatë
                  trajnimit. Kliko një zonë për të parë njoftime me sipërfaqe dhe dhoma të ngjashme atje.
                </Note>
              </Section>

              {result.data.feature_insights.length > 0 && (
                <details className="group max-w-xl border-t border-line pt-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
                    Çfarë peshon më shumë te modeli
                    <ChevronDown aria-hidden className="h-4 w-4 text-ink-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm text-ink-muted">
                    Rëndësia e secilës veçori në model në përgjithësi, jo ndikimi i saj te ky apartament. Zona dhe koordinatat nuk përfshihen.
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {result.data.feature_insights.map((f, _, all) => (
                      <li key={f.feature} className="grid grid-cols-[160px_1fr_48px] items-center gap-3 text-sm">
                        <span className="text-ink">{FEATURE_LABELS[f.feature] ?? f.label}</span>
                        <span aria-hidden className="h-2 rounded-full bg-surface-sunken">
                          <span className="block h-2 rounded-full bg-brass" style={{ width: `${(f.importance_pct / Math.max(...all.map(a => a.importance_pct))) * 100}%` }} />
                        </span>
                        <span className="num text-right text-ink-muted">{fmtDec(f.importance_pct)}%</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <Note className="max-w-prose">
                Parashikime për çmimin në vitet e ardhshme nuk jepen. Të dhënat janë një fotografi e vetme pa data njoftimesh, ndaj
                prej tyre nuk mund të nxirret asnjë prirje. Shih <Link href="/rreth-te-dhenave" className="text-primary underline underline-offset-4">si është ndërtuar modeli</Link>{' '}
                dhe sa gabon{propertyMetrics ? ` (gabim tipik ${fmtPct(propertyMetrics.median_ape_pct / 100)} në testim)` : ''}.
              </Note>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** One sentence before the table: the spread of estimates across zones. */
function RangeSummary({ zones }: { zones: ZonePrediction[] }) {
  if (!zones.length) return null
  const sorted = [...zones].sort((a, b) => a.estimated_price - b.estimated_price)
  const lo = sorted[0]
  const hi = sorted[sorted.length - 1]
  return (
    <p className="max-w-prose text-lg text-ink">
      Sipas modelit, ky apartament do të kërkohej për rreth <span className="num font-semibold">{fmtEur(lo.estimated_price)}</span> në {lo.zone_name}
      {' '}dhe rreth <span className="num font-semibold">{fmtEur(hi.estimated_price)}</span> në {hi.zone_name}.
    </p>
  )
}

function toDraft(i: ValuationInput): Record<NumKey, string> {
  return Object.fromEntries(Object.keys(LIMITS).map(k => [k, String(i[k as NumKey])])) as Record<NumKey, string>
}
