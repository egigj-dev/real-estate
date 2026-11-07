'use client'
import { getHealth } from '@/lib/api'
import { fmtEur, fmtInt, fmtPct } from '@/lib/format'
import type { ModelMetrics } from '@/lib/types'
import { useAsync } from '@/lib/useAsync'
import { PageIntro, Section } from '@/components/ui/layout'
import { ErrorState, Loading, Skeleton } from '@/components/ui/states'

function MetricsTable({ listing, property }: { listing: ModelMetrics; property: ModelMetrics }) {
  const rows: [string, (m: ModelMetrics) => string][] = [
    ['Gabimi tipik (mediana e gabimit relativ)', m => `±${fmtPct(m.median_ape_pct / 100, 1)}`],
    ['Brenda ±10% të çmimit të kërkuar', m => fmtPct(m.share_within_10_pct)],
    ['Brenda ±20% të çmimit të kërkuar', m => fmtPct(m.share_within_20_pct)],
    ['Gabimi mesatar absolut', m => fmtEur(m.mae_eur)],
    ['R² (sa nga ndryshimi i çmimeve shpjegohet)', m => m.r2.toFixed(2).replace('.', ',')],
    ['Njoftime të testuara', m => fmtInt(m.n)],
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">Saktësia e dy modeleve në njoftime që nuk i panë gjatë trajnimit</caption>
        <thead className="text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 pr-4 font-medium">Matja</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Modeli i njoftimeve</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Modeli i pronës</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} className="border-b border-line">
              <th scope="row" className="py-2.5 pr-4 font-normal text-ink">{label}</th>
              <td className="num py-2.5 pl-4 text-right text-ink">{f(listing)}</td>
              <td className="num py-2.5 pl-4 text-right text-ink">{f(property)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AboutClient() {
  const health = useAsync(getHealth, [])
  const metrics = health.data?.model_metrics

  return (
    <div className="max-w-3xl space-y-12">
      <PageIntro title="Rreth të dhënave dhe modelit">
        Çfarë tregojnë shifrat në këtë faqe, nga vijnë, dhe ku nuk duhet t’u besosh shumë.
      </PageIntro>

      <Section id="te-dhenat" title="Të dhënat">
        <div className="space-y-3 text-base leading-relaxed text-ink">
          <p>
            {health.data ? fmtInt(health.data.listings_loaded) : 'Rreth 4 000'} njoftime shitjeje apartamentesh në Tiranë, të mbledhura, sipas
            dokumentimit të projektit, nga portale pronash shqiptare në një moment të vetëm. Data e mbledhjes nuk është ruajtur, ndaj shifrat nuk tregojnë tregun e sotëm
            dhe nuk mund të tregojnë si kanë ndryshuar çmimet me kohën.
          </p>
          <p>
            <strong className="font-medium">Janë çmime të kërkuara, jo çmime shitjeje.</strong> Shitësit shpesh kërkojnë më shumë nga sa
            marrin në fund, dhe njoftimet mund të përsëriten ose të jenë pasaktë. Njoftimet me çmime të pamundshme për m² janë hequr para analizës.
          </p>
          <p>Njoftimet nuk kanë adresa rrugësh; vendndodhja vjen nga koordinatat e njoftimit. Numrat e telefonit në përshkrime fshihen kur shfaqen.</p>
          {health.data?.data_source === 'demo' && (
            <p className="rounded-lg border border-brass/40 bg-brass-soft p-3 text-sm">
              Ky server po përdor <strong className="font-medium">të dhëna demo</strong>: prona fiktive pa vlerësime modeli.
            </p>
          )}
        </div>
      </Section>

      <Section id="zonat" title="Zonat e çmimit dhe njësitë administrative">
        <div className="space-y-3 text-base leading-relaxed text-ink">
          <p>
            Faqja përdor dy ndarje të qytetit. <strong className="font-medium">Zonat e çmimit</strong> janë gjashtë grupe që krijon modeli
            duke grupuar njoftimet vetëm sipas vendndodhjes; emrat (Qendra &amp; Blloku, Qendra A, Zona e Mesme A dhe B, Periferia A dhe B)
            i renditin sipas çmimit. Nuk janë kufij zyrtarë.
          </p>
          <p>
            <strong className="font-medium">Njësitë administrative</strong> në hartë janë kufijtë zyrtarë nga OpenStreetMap. Mediana e
            një njësie shfaqet vetëm kur ka të paktën 15 njoftime.
          </p>
        </div>
      </Section>

      <Section id="modeli" title="Modeli i vlerësimit">
        <div className="space-y-3 text-base leading-relaxed text-ink">
          <p>
            Dy modele XGBoost parashikojnë çmimin e kërkuar. <strong className="font-medium">Modeli i pronës</strong> përdor vetëm
            karakteristikat (sipërfaqja, dhomat, kati, komoditetet, mobilimi, vendndodhja) dhe përdoret te “Vlerëso pronën”.{' '}
            <strong className="font-medium">Modeli i njoftimeve</strong> lexon edhe tekstin e përshkrimit dhe jep vlerësimet te faqja e
            çdo prone.
          </p>
          <p>
            Saktësia u mat me ndarje në pesë pjesë: çdo njoftim u vlerësua nga një model që nuk e kishte parë gjatë trajnimit. Njoftimet e
            përsëritura dhe ato me përshkrim identik mbahen gjithmonë në të njëjtën pjesë, që modeli të mos “njohë” një kopje. Vlerësimi që
            shfaqet për çdo pronë është pikërisht ky vlerësim i testit.
          </p>
        </div>
        {health.status === 'loading' && <Loading><Skeleton className="h-48 w-full" /></Loading>}
        {health.status === 'error' && <ErrorState message={health.error.message} onRetry={health.retry} />}
        {metrics && <MetricsTable listing={metrics.listing} property={metrics.property} />}
        {health.status === 'success' && !metrics && <p className="text-sm text-ink-muted">Ky server nuk ka model të instaluar, ndaj nuk ka matje.</p>}
        <div className="space-y-3 text-base leading-relaxed text-ink">
          <p>
            <strong className="font-medium">Si të lexosh gabimin.</strong> “Gabimi tipik” do të thotë që për gjysmën e njoftimeve në test,
            vlerësimi ishte më afër se kaq me çmimin e kërkuar, dhe për gjysmën tjetër më larg. Nuk është interval besueshmërie për një pronë
            të caktuar. Te faqja e një prone, brezi rreth vlerësimit tregon gabimin që përfshin 3 nga 4 njoftime të testuara në atë zonë.
          </p>
          <p>
            Modeli nuk sheh gjendjen e apartamentit, pamjen, cilësinë e ndërtimit, vitin e ndërtimit apo dokumentacionin e pronësisë. Një
            diferencë e madhe nga vlerësimi është arsye për pyetje, jo provë që çmimi është i gabuar.
          </p>
        </div>
      </Section>

      <Section id="cfare-nuk-ka" title="Çfarë nuk ofron kjo faqe">
        <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-ink marker:text-ink-subtle">
          <li>Parashikime për çmimet në të ardhmen: pa data njoftimesh nuk ka bazë për to.</li>
          <li>Çmime transaksionesh ose vlerësime zyrtare për bankë apo noter.</li>
          <li>Pikë apo nota për lagjet. Te faqja e pronës tregohen vetëm distancat deri te shkollat, parqet dhe stacionet më të afërta.</li>
        </ul>
      </Section>
    </div>
  )
}
