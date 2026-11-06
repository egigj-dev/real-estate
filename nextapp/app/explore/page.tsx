import { Suspense } from "react"
import ExploreContent from "./ExploreContent"

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Duke ngarkuar…</div>}>
      <ExploreContent />
    </Suspense>
  )
}
