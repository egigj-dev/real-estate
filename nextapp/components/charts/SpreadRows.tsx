import type { ReactNode } from 'react'
import { fmtEurPerSqm, fmtInt } from '@/lib/format'

export interface SpreadRow {
  key: string
  label: ReactNode
  n: number
  p25: number
  median: number
  p75: number
  extra?: ReactNode
}

/**
 * Median with the middle half (25th–75th percentile) as a bar, on a shared axis.
 * Rendered as a table so every value is readable without the graphic.
 */
export default function SpreadRows({ rows, caption, extraHeader }: { rows: SpreadRow[]; caption: string; extraHeader?: string }) {
  const min = Math.min(...rows.map(r => r.p25)) * 0.92
  const max = Math.max(...rows.map(r => r.p75)) * 1.04
  const x = (v: number) => ((v - min) / (max - min)) * 100

  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[680px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-4 font-medium">Grupi</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Njoftime</th>
            <th scope="col" className="py-2 font-medium"><span className="sr-only">Grafiku</span></th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Mediana €/m²</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Gjysma e mesme</th>
            {extraHeader && <th scope="col" className="py-2 pl-4 text-right font-medium">{extraHeader}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-b border-line">
              <th scope="row" className="py-3 pr-4 font-normal text-ink">{r.label}</th>
              <td className="num py-3 pr-4 text-right text-ink-muted">{fmtInt(r.n)}</td>
              <td className="w-[38%] py-3" aria-hidden>
                <div className="relative h-5">
                  <div className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm bg-ramp-2" style={{ left: `${x(r.p25)}%`, width: `${x(r.p75) - x(r.p25)}%` }} />
                  <div className="absolute top-0 h-5 w-0.5 -translate-x-1/2 bg-primary" style={{ left: `${x(r.median)}%` }} />
                </div>
              </td>
              <td className="num whitespace-nowrap py-3 pl-4 text-right font-semibold text-ink">{fmtEurPerSqm(r.median)}</td>
              <td className="num whitespace-nowrap py-3 pl-4 text-right text-ink-muted">{fmtInt(r.p25)}–{fmtInt(r.p75)}</td>
              {extraHeader && <td className="num whitespace-nowrap py-3 pl-4 text-right text-ink-muted">{r.extra}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
