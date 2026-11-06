"use client"
import { useMemo } from "react"
import * as echarts from "echarts/core"
import { BarChart } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import { SVGRenderer } from "echarts/renderers"
import ReactECharts from "echarts-for-react/lib/core"
import { useTheme } from "@/context/ThemeContext"
import type { NeighborhoodInsight } from "@/lib/types"

echarts.use([BarChart, GridComponent, TooltipComponent, SVGRenderer])

function cssVar(name: string) {
  if (typeof document === "undefined") return "0 0% 50%"
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export default function ZoneBarChart({ data, height = 360 }: { data: NeighborhoodInsight[]; height?: number }) {
  const { theme } = useTheme()

  const colors = useMemo(() => ({
    primary: `hsl(${cssVar("--primary")})`,
    border: `hsl(${cssVar("--border")})`,
    fg: `hsl(${cssVar("--foreground")})`,
    muted: `hsl(${cssVar("--muted-foreground")})`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [theme])

  const sorted = [...data].sort((a, b) => a.avg_price_per_sqm - b.avg_price_per_sqm)

  const option = {
    grid: { left: 12, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "item" as const,
      formatter: (p: any) => `<strong>${p.name}</strong><br/>${Math.round(p.value).toLocaleString()} €/m²`,
    },
    xAxis: { type: "value" as const, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: colors.border } }, axisLabel: { color: colors.muted, fontSize: 11 } },
    yAxis: {
      type: "category" as const,
      data: sorted.map((n) => n.neighborhood),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: colors.fg, fontSize: 12 },
    },
    series: [{
      type: "bar" as const,
      data: sorted.map((n) => n.avg_price_per_sqm),
      barWidth: 16,
      itemStyle: { color: colors.primary, borderRadius: [0, 4, 4, 0] },
      label: {
        show: true, position: "right" as const, color: colors.muted, fontSize: 11,
        formatter: (p: any) => `${Math.round(p.value).toLocaleString()} €`,
      },
    }],
  }

  return <ReactECharts echarts={echarts} option={option} style={{ height, width: "100%" }} />
}
