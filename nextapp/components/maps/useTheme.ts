'use client'
import { useEffect, useState } from 'react'

/** Current data-theme, updated when the header toggle changes it. */
export function useThemeAttr(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

/**
 * Standard OpenStreetMap tiles (free with attribution). They're muted with a
 * CSS filter (see .map-tiles in globals.css) so the data layer stays readable.
 */
export function tileLayerProps(theme: 'light' | 'dark', muted = false) {
  // Muting uses a filter, not opacity: semi-transparent tiles from two zoom levels show seams.
  const cls = ['map-tiles', theme === 'dark' && 'map-tiles-dark', muted && (theme === 'dark' ? 'map-tiles-dark-muted' : 'map-tiles-muted')]
  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    className: cls.filter(Boolean).join(' '),
  }
}

export const TIRANA_CENTER: [number, number] = [41.3275, 19.8187]

/** Read a colour token as a CSS colour string for Leaflet, which can't use CSS variables directly. */
export function tokenColor(name: string, alpha = 1) {
  if (typeof window === 'undefined') return '#888'
  const rgb = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim().split(/\s+/).join(',')
  return alpha === 1 ? `rgb(${rgb})` : `rgba(${rgb},${alpha})`
}
