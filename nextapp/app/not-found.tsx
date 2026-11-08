import { ButtonLink } from '@/components/ui/button'
import { PageIntro } from '@/components/ui/layout'

export default function NotFound() {
  return (
    <div className="space-y-6">
      <PageIntro title="Faqja nuk u gjet">Adresa mund të jetë e gabuar ose prona nuk ekziston më në të dhëna.</PageIntro>
      <ButtonLink href="/pronat" variant="secondary">Shko te pronat</ButtonLink>
    </div>
  )
}
