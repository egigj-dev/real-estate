// Drop-in replacement for the old hand-rolled SVG set.
// Same export names + same { size, className } props, so every existing
// import site (Sidebar, Topbar, OverviewPage, InsightsPage) is unchanged.
// strokeWidth 1.8 preserves the previous lighter stroke weight.
import {
  Home, Compass, Map, Search, Target, BarChart3, Sun, Moon, Heart, Layers,
  ChevronDown, Building2, TrendingUp, TrendingDown, ArrowRight,
} from 'lucide-react'

const make = (Lucide, defaultSize) =>
  ({ size = defaultSize, className }) => (
    <Lucide size={size} className={className} strokeWidth={1.8} />
  )

export const IconHome        = make(Home, 18)
export const IconCompass     = make(Compass, 18)
export const IconMap         = make(Map, 18)
export const IconSearch      = make(Search, 18)
export const IconTarget      = make(Target, 18)
export const IconBarChart    = make(BarChart3, 18)
export const IconSun         = make(Sun, 18)
export const IconMoon        = make(Moon, 18)
export const IconHeart       = make(Heart, 18)
export const IconLayers      = make(Layers, 18)
export const IconChevronDown = make(ChevronDown, 14)
export const IconBuilding    = make(Building2, 18)
export const IconTrendUp     = make(TrendingUp, 14)
export const IconTrendDown   = make(TrendingDown, 14)
export const IconArrowRight  = make(ArrowRight, 16)