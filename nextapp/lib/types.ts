// Mirrors backend/app/schemas (Pydantic models) — keep in sync if the API changes.

export interface ListingSummary {
  id: string
  price: number
  sqm: number
  beds: number
  baths?: number | null
  floor?: number | null
  furnished: boolean
  furnishing_status?: string | null
  address?: string | null
  neighborhood?: string | null
  neighborhood_cluster?: number | null
  area_name?: string | null
  property_type?: string | null
  latitude?: number | null
  longitude?: number | null
  price_per_sqm?: number | null
  total_rooms?: number | null
}

export interface ListingDetail extends ListingSummary {
  description?: string | null
  property_status?: string | null
  has_elevator?: boolean | null
  has_parking_space?: boolean | null
  has_carport?: boolean | null
  has_garage?: boolean | null
  has_garden?: boolean | null
  has_terrace?: boolean | null
  balconies?: number | null
  living_rooms?: number | null
  city?: string | null
  dist_to_nearest_center?: number | null
  distance_from_center?: number | null
}

export interface PaginatedListings {
  total: number
  page: number
  per_page: number
  pages: number
  listings: ListingSummary[]
}

export type PriceLabel = 'Fair' | 'Overpriced' | 'Underpriced'

export interface EstimateResponse {
  listing_id: string
  estimated_price: number
  range_low: number
  range_high: number
  label: PriceLabel
  band_pct?: number | null
  threshold_pct?: number | null
}

export interface CompItem {
  id: string
  price: number
  sqm: number
  rooms: number
  distance_label: string
  similarity_reason: string
}

export interface CompsResponse {
  listing_id: string
  comps: CompItem[]
}

export interface NeighborhoodInsight {
  neighborhood: string
  avg_price_per_sqm: number
  avg_price: number
  listing_count: number
}

export interface MarketInsights {
  overall_median_price: number
  overall_median_price_per_sqm: number
  neighborhood_count: number
  neighborhoods: NeighborhoodInsight[]
}

export interface SuggestionItem {
  id: string
  price: number
  sqm: number
  beds: number
  baths: number
  floor?: number | null
  address?: string | null
  neighborhood?: string | null
  property_type?: string | null
  latitude?: number | null
  longitude?: number | null
  price_per_sqm?: number | null
  furnished: boolean
  match_score: number
  rank: number
}

export interface SuggestResponse {
  estimated_price: number
  range_low: number
  range_high: number
  band_pct: number
  suggestions: SuggestionItem[]
  neighborhood?: string | null
}

export interface RangeOption { min: number; max: number }
export interface IntRangeOption { min: number; max: number }

export interface FilterOptions {
  neighborhoods: string[]
  area_names: string[]
  property_types: string[]
  furnished_options: string[]
  price_range: RangeOption
  sqm_range: RangeOption
  beds_range: IntRangeOption
  baths_range: RangeOption
}

export interface AreaBBox { min_lat: number; max_lat: number; min_lon: number; max_lon: number }

export interface Area {
  name: string
  osm_id: number
  admin_level: string
  bbox: AreaBBox
  polygon: [number, number][] // [lat, lon] pairs
}

export interface ModelMetrics {
  mae_eur: number
  median_ape_pct: number
  mape_pct: number
  r2: number
  share_within_10_pct: number
  share_within_20_pct: number
  n_train: number
  n_test: number
  split: string
  training_date: string
}

export interface HealthResponse {
  model_metrics: ModelMetrics | null
  status: string
  listings_loaded: number
  model_loaded: boolean
}

export interface ChatParseResponse {
  sqm?: number | null
  floor?: number | null
  beds?: number | null
  baths?: number | null
  has_elevator?: boolean | null
  has_parking_space?: boolean | null
  neighborhood?: string | null
  raw_text: string
  method: 'claude' | 'keywords'
}

export interface FeatureInsight {
  feature: string
  label: string
  user_value: number
  zone_median: number
  unit: string
  importance_pct: number
  direction: 'up' | 'down' | 'neutral'
  insight: string
}

export interface FuturePrice {
  years: number
  price: number
  growth_rate: number
}

export interface ZonePrediction {
  cluster_id: number
  zone_name: string
  estimated_price: number
  price_per_sqm: number
  range_low: number
  range_high: number
  band_pct: number
  avg_zone_price: number
  avg_zone_price_per_sqm: number
  listing_count: number
  future_prices: FuturePrice[]
}

export interface PredictResponse {
  zones: ZonePrediction[]
  sqm: number
  feature_insights: FeatureInsight[]
  growth_note: string
}

export interface PredictRequest {
  sqm?: number
  floor?: number
  beds?: number
  baths?: number
  has_elevator?: boolean
  has_parking_space?: boolean
}

export interface SuggestRequest extends PredictRequest {
  neighborhood?: string
  n?: number
}

export interface ListingsQuery {
  q?: string
  per_page?: number
  page?: number
  min_price?: number | string
  max_price?: number | string
  min_beds?: number | string
  max_beds?: number | string
  min_baths?: number | string
  max_baths?: number | string
  min_sqm?: number | string
  max_sqm?: number | string
  furnished?: boolean | string
  has_elevator?: boolean
  has_parking_space?: boolean
  has_garden?: boolean
  neighborhood?: string
  area_name?: string
  property_type?: string
  sort?: string
}
