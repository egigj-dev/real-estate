'use client'
import { useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { fetchChatParse } from '@/lib/api'
import type { ChatParseResponse } from '@/lib/types'
import { EMPTY_FILTERS, type Filters } from '@/lib/filters'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { ErrorState, Note } from '@/components/ui/states'

interface Criterion {
  label: string
  /** The filter change this criterion maps to, or a reason it can't be applied. */
  apply: Partial<Filters> | { reason: string }
}

const SQM_TOLERANCE = 0.15

/** Turn the parser's output into explicit, reviewable criteria. */
function toCriteria(p: ChatParseResponse, zones: string[]): Criterion[] {
  const out: Criterion[] = []
  if (p.sqm) {
    const lo = Math.round(p.sqm * (1 - SQM_TOLERANCE))
    const hi = Math.round(p.sqm * (1 + SQM_TOLERANCE))
    out.push({ label: `Rreth ${p.sqm} m² (kërkon ${lo}–${hi} m²)`, apply: { smin: lo, smax: hi } })
  }
  if (p.beds != null) out.push({ label: `Të paktën ${p.beds} ${p.beds === 1 ? 'dhomë' : 'dhoma'} gjumi`, apply: { dhoma: p.beds } })
  if (p.baths != null) out.push({ label: `Të paktën ${p.baths} banjo`, apply: { banjo: p.baths } })
  if (p.has_elevator) out.push({ label: 'Me ashensor', apply: { ashensor: true } })
  if (p.has_parking_space) out.push({ label: 'Me vend parkimi', apply: { parkim: true } })
  if (p.floor != null) out.push({ label: `Kati ${p.floor}`, apply: { reason: 'Kërkimi nuk filtron sipas katit; kati shfaqet te çdo pronë.' } })
  if (p.neighborhood) {
    const exact = zones.find(z => z.toLowerCase() === p.neighborhood!.toLowerCase())
    if (exact) out.push({ label: `Zona: ${exact}`, apply: { zona: exact } })
    else {
      const parts = zones.filter(z => z.toLowerCase().startsWith(p.neighborhood!.toLowerCase()))
      out.push({
        label: `Zona: ${p.neighborhood}`,
        apply: { reason: parts.length ? `Kjo përfshin ${parts.join(' dhe ')}; zgjidh njërën te filtrat.` : 'Kjo zonë nuk përputhet me zonat e çmimit.' },
      })
    }
  }
  return out
}

export default function DescribeSearch({ zones, onApply }: { zones: string[]; onApply: (f: Filters) => void }) {
  const [text, setText] = useState('')
  const [state, setState] = useState<{ status: 'idle' | 'loading' } | { status: 'done'; parsed: ChatParseResponse } | { status: 'error'; message: string }>({ status: 'idle' })

  const submit = async () => {
    if (!text.trim()) return
    setState({ status: 'loading' })
    try {
      setState({ status: 'done', parsed: await fetchChatParse(text.trim()) })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const criteria = state.status === 'done' ? toCriteria(state.parsed, zones) : []
  const applicable = criteria.filter(c => !('reason' in c.apply))

  return (
    <div className="space-y-4">
      <form onSubmit={e => { e.preventDefault(); submit() }} className="space-y-3">
        <label htmlFor="describe" className="block text-sm font-medium text-ink">Përshkruaj apartamentin që kërkon</label>
        <Textarea
          id="describe"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="p.sh. 2 dhoma gjumi, rreth 90 m², me ashensor dhe parkim, afër Bllokut"
          aria-describedby="describe-hint"
        />
        <Note>
          <span id="describe-hint">
            Kuptohen sipërfaqja, dhomat e gjumit, banjot, kati, ashensori, parkimi dhe zona. Gjithçka tjetër injorohet.
            Para se të zbatohen, kriteret shfaqen këtu që t’i kontrollosh.
          </span>
        </Note>
        <Button type="submit" variant="secondary" disabled={!text.trim() || state.status === 'loading'}>
          {state.status === 'loading' ? 'Duke lexuar…' : 'Lexo kriteret'}
        </Button>
      </form>

      {state.status === 'error' && <ErrorState title="Përshkrimi nuk u lexua" message={state.message} />}

      {state.status === 'done' && (
        <div className="space-y-3 rounded-lg border border-line bg-surface-sunken p-4" aria-live="polite">
          {criteria.length === 0 ? (
            <p className="text-sm text-ink">Nuk gjeta asnjë kriter që mund të përdor. Provo të shkruash sipërfaqen, dhomat ose zonën.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">Kuptova këto kritere:</p>
              <ul className="space-y-2">
                {criteria.map(c => (
                  <li key={c.label} className="flex items-start gap-2 text-sm">
                    {'reason' in c.apply
                      ? <Minus aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />
                      : <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                    <span>
                      <span className="text-ink">{c.label}</span>
                      {'reason' in c.apply && <span className="block text-ink-muted">{c.apply.reason}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {applicable.length > 0 && (
                <Button
                  onClick={() => onApply(applicable.reduce<Filters>((f, c) => ({ ...f, ...(c.apply as Partial<Filters>) }), { ...EMPTY_FILTERS }))}
                >
                  Përdor {applicable.length === 1 ? 'këtë kriter' : `këto ${applicable.length} kritere`} si filtra
                </Button>
              )}
            </>
          )}
          {state.parsed.method === 'keywords' && (
            <Note>Leximi u bë me fjalë kyçe, jo me model gjuhe, ndaj fraza të ndërlikuara mund të mos kuptohen.</Note>
          )}
        </div>
      )}
    </div>
  )
}
