'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, fetchPredictByZone, getHealth } from '@/lib/api'
import { EMPTY_FILTERS, filtersToSearch } from '@/lib/filters'
import { fmtDec, fmtInt, fmtPct } from '@/lib/format'
import { FEATURE_LABELS, FURNISHING_LABELS } from '@/lib/listing'
import { useAsync } from '@/lib/useAsync'
import { DEFAULT_INPUT, describeInput, inputToSearch, LIMITS, parseInput, toRequest, validate, type ValuationInput } from '@/lib/valuation'
import ZoneEstimates from '@/components/valuation/ZoneEstimates'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select } from '@/components/ui/field'
import { PageIntro, Panel, Section } from '@/components/ui/layout'
import { ErrorState, Loading, Note, Skeleton } from '@/components/ui/states'

type NumKey = keyof typeof LIMITS
const NUM_FIELDS: { key: NumKey; label: string; hint?: string; step?: number }[] = [
  { key: 'sqm', label: 'Sipërfaqja (m²)', hint: `${LIMITS.sqm.min}–${LIMITS.sqm.max} m²` },
  { key: 'beds', label: 'Dhoma gjumi', hint: '0 për garsonierë' },
  { key: 'baths', label: 'Banjo' },
  { key: 'floor', label: 'Kati', hint: '0 për përdhesë' },
  { key: 'living_rooms', label: 'Dhoma ndenjeje' },
  { key: 'balconies', label: 'Ballkone' },
]
const BOOL_FIELDS: { key: keyof ValuationInput; label: string }[] = [
  { key: 'has_elevator', label: 'Ashensor' },
  { key: 'has_parking_space', label: 'Vend parkimi' },
  { key: 'has_carport', label: 'Parkim i mbuluar' },
  { key: 'has_garage', label: 'Garazh' },
  { key: 'has_terrace', label: 'Tarracë' },
  { key: 'has_garden', label: 'Kopsht' },
]

export default function ValuationClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const submitted = useMemo(() => parseInput(new URLSearchParams(sp.toString())), [sp])

  // Text drafts let a field be empty while typing; they're converted on submit.
  const [draft, setDraft] = useState<Record<NumKey, string>>(() => toDraft(submitted ?? DEFAULT_INPUT))
  const [flags, setFlags] = useState<ValuationInput>(submitted ?? DEFAULT_INPUT)
  const [errors, setErrors] = useState<Partial<Record<NumKey, string>>>({})
  useEffect(() => {
    if (submitted) { setDraft(toDraft(submitted)); setFlags(submitted) }
  }, [submitted])

  const submit = () => {
    const input: ValuationInput = { ...flags }
    for (const f of NUM_FIELDS) input[f.key] = draft[f.key].trim() === '' ? NaN : Number(draft[f.key].replace(',', '.'))
    const errs = validate(input)
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`v-${Object.keys(errs)[0]}`)?.focus()
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
              {NUM_FIELDS.map(f => (
                <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]} className={f.key === 'sqm' ? 'col-span-2' : undefined}>
                  {({ describedBy, invalid }) => (
                    <Input
                      id={`v-${f.key}`}
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
              ))}
            </div>
            <Field label="Mobilimi">
              {({ id }) => (
                <Select id={id} value={flags.furnishing_status} onChange={e => setFlags(fl => ({ ...fl, furnishing_status: e.target.value as ValuationInput['furnishing_status'] }))}>
                  {Object.entries(FURNISHING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              )}
            </Field>
            <fieldset className="space-y-2.5">
              <legend className="mb-1 text-sm font-medium text-ink">Ka</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {BOOL_FIELDS.map(f => (
                  <Checkbox key={f.key} label={f.label} checked={Boolean(flags[f.key])} onChange={e => setFlags(fl => ({ ...fl, [f.key]: e.target.checked }))} />
                ))}
              </div>
            </fieldset>
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
                <ZoneEstimates zones={result.data.zones} exploreHref={exploreHref} />
                <Note className="max-w-prose">
                  Këto janë çmime të kërkuara të pritshme, jo vlera tregu. Gabimi është matur në njoftime që modeli nuk i pa gjatë
                  trajnimit. Kliko një zonë për të parë njoftime me sipërfaqe dhe dhoma të ngjashme atje.
                </Note>
              </Section>

              {result.data.feature_insights.length > 0 && (
                <Section
                  title="Çfarë peshon më shumë te modeli"
                  description="Rëndësia e secilës veçori në model në përgjithësi, jo ndikimi i saj te ky apartament. Zona dhe koordinatat nuk përfshihen në këtë listë."
                >
                  <ul className="max-w-xl space-y-2.5">
                    {result.data.feature_insights.map((f, _, all) => (
                      <li key={f.feature} className="grid grid-cols-[180px_1fr_48px] items-center gap-3 text-sm">
                        <span className="text-ink">{FEATURE_LABELS[f.feature] ?? f.label}</span>
                        <span aria-hidden className="h-2 rounded-full bg-surface-sunken">
                          <span className="block h-2 rounded-full bg-brass" style={{ width: `${(f.importance_pct / Math.max(...all.map(a => a.importance_pct))) * 100}%` }} />
                        </span>
                        <span className="num text-right text-ink-muted">{fmtDec(f.importance_pct)}%</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Note className="max-w-prose">
                Parashikime për çmimin në vitet e ardhshme nuk jepen. Të dhënat janë një fotografi e vetme pa data njoftimesh, ndaj
                prej tyre nuk mund të nxirret asnjë prirje. Shih <Link href="/rreth-te-dhenave" className="text-primary underline-offset-4 hover:underline">si është ndërtuar modeli</Link>{' '}
                dhe sa gabon{propertyMetrics ? ` (gabim tipik ${fmtPct(propertyMetrics.median_ape_pct / 100)} në testim)` : ''}.
              </Note>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function toDraft(i: ValuationInput): Record<NumKey, string> {
  return Object.fromEntries(Object.keys(LIMITS).map(k => [k, String(i[k as NumKey])])) as Record<NumKey, string>
}
