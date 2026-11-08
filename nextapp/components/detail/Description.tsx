'use client'
import { useState } from 'react'
import { cleanDescription } from '@/lib/listing'
import { Button } from '@/components/ui/button'
import { Note } from '@/components/ui/states'

const PREVIEW_CHARS = 700

/** The seller's text, with contact details removed; long texts start collapsed. */
export default function Description({ text }: { text: string | null | undefined }) {
  const { text: clean, redacted } = cleanDescription(text)
  const [expanded, setExpanded] = useState(false)
  if (!clean) return <p className="text-sm text-ink-muted">Njoftimi nuk ka përshkrim.</p>

  const long = clean.length > PREVIEW_CHARS
  const shown = !long || expanded ? clean : `${clean.slice(0, PREVIEW_CHARS).replace(/\s+\S*$/, '')}…`

  return (
    <div className="space-y-3">
      <div lang="sq" className="max-w-prose whitespace-pre-line text-base leading-relaxed text-ink">{shown}</div>
      {long && (
        <Button variant="link" aria-expanded={expanded} onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Shfaq më pak' : 'Shfaq të gjithë përshkrimin'}
        </Button>
      )}
      <Note>
        Teksti vjen nga njoftimi i shitësit{redacted ? '. Numrat e telefonit, adresat e e-mailit dhe faqet e internetit janë hequr' : ''}.
      </Note>
    </div>
  )
}
