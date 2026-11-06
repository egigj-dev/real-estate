"use client"
import { useEffect, useMemo, useRef } from "react"
import * as echarts from "echarts/core"
import { MapChart } from "echarts/charts"
import { TooltipComponent, VisualMapComponent, GeoComponent } from "echarts/components"
import { SVGRenderer } from "echarts/renderers"
import ReactECharts from "echarts-for-react/lib/core"
import type { Area } from "@/lib/types"
import { useTheme } from "@/context/ThemeContext"

echarts.use([MapChart, TooltipComponent, VisualMapComponent, GeoComponent, SVGRenderer])

function cssVar(name: string): string {
  if (typeof document === "undefined") return "0 0% 50%"
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function areasToGeoJSON(areas: Area[]) {
  return {
    type: "FeatureCollection" as const,
    features: areas
      .filter((a) => a.polygon && a.polygon.length >= 3)
      .map((a) => {
        const ring = a.polygon.map(([lat, lon]) => [lon, lat])
        const first = ring[0]
        const last = ring[ring.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first)
        return {
          type: "Feature" as const,
          properties: { name: a.name },
          geometry: { type: "Polygon" as const, coordinates: [ring] },
        }
      }),
  }
}

const MAP_NAME = "tirana-zones"

export default function ZoneMap({
  areas, priceByArea, activeArea, onHoverArea, onSelectArea, height = 380,
}: {
  areas: Area[]
  priceByArea: Record<string, number>
  activeArea?: string | null
  onHoverArea?: (name: string | null) => void
  onSelectArea?: (name: string) => void
  height?: number
}) {
  const { theme } = useTheme()
  const chartRef = useRef<ReactECharts>(null)
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!areas.length) return
    echarts.registerMap(MAP_NAME, areasToGeoJSON(areas))
    registeredRef.current = true
  }, [areas])

  const colors = useMemo(() => ({
    zone1: `hsl(${cssVar("--zone-1")})`,
    zone4: `hsl(${cssVar("--zone-4")})`,
    border: `hsl(${cssVar("--border")})`,
    accent: `hsl(${cssVar("--primary")})`,
    bg: `hsl(${cssVar("--background")})`,
    fg: `hsl(${cssVar("--foreground")})`,
    na: `hsl(${cssVar("--zone-na")})`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [theme])

  const prices = Object.values(priceByArea).filter((v) => typeof v === "number" && v > 0)
  const min = prices.length ? Math.min(...prices) : 0
  const max = prices.length ? Math.max(...prices) : 1

  const option = useMemo(() => {
    const data = areas.map((a) => {
      const price = priceByArea[a.name]
      return {
        name: a.name,
        value: price ?? "-",
        selected: activeArea === a.name,
        itemStyle: price == null ? { areaColor: colors.na } : undefined,
      }
    })

    return {
      tooltip: {
        trigger: "item",
        formatter: (p: any) =>
          p.value && typeof p.value === "number"
            ? `<strong>${p.name}</strong><br/>${Math.round(p.value).toLocaleString()} €/m²`
            : p.name,
      },
      visualMap: {
        min, max,
        left: "left",
        bottom: 0,
        text: ["Premium", "E përballueshme"],
        textStyle: { color: colors.fg, fontSize: 10 },
        calculable: false,
        itemWidth: 10,
        itemHeight: 90,
        inRange: { color: [colors.zone1, colors.zone4] },
      },
      series: [
        {
          type: "map",
          map: MAP_NAME,
          roam: false,
          selectedMode: "single" as const,
          label: { show: false },
          itemStyle: { borderColor: colors.border, borderWidth: 1, areaColor: colors.na },
          emphasis: { itemStyle: { borderColor: colors.accent, borderWidth: 2 }, label: { show: false } },
          select: { itemStyle: { borderColor: colors.accent, borderWidth: 2 } },
          blur: { itemStyle: { opacity: 0.3 } },
          data,
        },
      ],
    }
  }, [areas, priceByArea, activeArea, colors, min, max])

  if (!areas.length) {
    return (
      <div className="flex items-center justify-center rounded-md text-sm text-muted-foreground" style={{ height }}>
        Harta nuk u ngarkua — kontrollo lidhjen me API.
      </div>
    )
  }

  return (
    <ReactECharts
      ref={chartRef}
      echarts={echarts}
      option={option}
      style={{ height, width: "100%" }}
      onEvents={{
        mouseover: (params: any) => onHoverArea?.(params.name ?? null),
        mouseout: () => onHoverArea?.(null),
        click: (params: any) => params.name && onSelectArea?.(params.name),
      }}
    />
  )
}
