// Albanian number formatting: "483 000", "13,4". Shared by every page.
const LOCALE = 'sq-AL'

const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const oneDec = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 })

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

export const fmtInt = (v: number | null | undefined) => (isNum(v) ? intFmt.format(Math.round(v)) : '—')
export const fmtDec = (v: number | null | undefined) => (isNum(v) ? oneDec.format(v) : '—')
export const fmtEur = (v: number | null | undefined) => (isNum(v) ? `${intFmt.format(Math.round(v))} €` : '—')
export const fmtEurPerSqm = (v: number | null | undefined) => (isNum(v) ? `${intFmt.format(Math.round(v))} €/m²` : '—')
export const fmtSqm = (v: number | null | undefined) => (isNum(v) ? `${oneDec.format(v)} m²` : '—')
/** Percent from a ratio (0.13 → "13%"). */
export const fmtPct = (ratio: number | null | undefined, digits = 0) =>
  isNum(ratio) ? `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(ratio * 100)}%` : '—'
/** Signed percent from a ratio (0.52 → "+52%"). */
export const fmtSignedPct = (ratio: number) => `${ratio > 0 ? '+' : ratio < 0 ? '−' : ''}${fmtPct(Math.abs(ratio))}`
export const fmtSignedEur = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtEur(Math.abs(v))}`

/** Compact euros for axes and tight spaces: "150 mijë €", "1,2 mln €". */
export function fmtEurCompact(v: number) {
  if (!isNum(v)) return '—'
  if (Math.abs(v) >= 1_000_000) return `${oneDec.format(v / 1_000_000)} mln €`
  if (Math.abs(v) >= 1_000) return `${intFmt.format(v / 1_000)} mijë €`
  return fmtEur(v)
}

/** Albanian plural for the few nouns the interface counts. */
export function plural(n: number, one: string, many: string) {
  return `${fmtInt(n)} ${n === 1 ? one : many}`
}
