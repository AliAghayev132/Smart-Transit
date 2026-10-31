// Hər iki xəritə mühərriki (Google / Leaflet) üçün ümumi məntiq
import { useMemo } from 'react'
import { crowdLevels } from '@constants'

/** Səviyyə → hex (cari temanın palitrası: useCrowdHex()) */
export const levelHexOf = (palette, level) => palette[level] || palette.unknown

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Avtobus ikonu (öndən görünüş). Gövdə xətt rəngində (currentColor),
 * pəncərə/fənərlər diskin fon rəngində (.win → var(--color-surface)).
 */
export const BUS_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect x="4" y="2.5" width="16" height="16.5" rx="3.4" fill="currentColor"/>' +
  '<rect class="win" x="6.2" y="5.6" width="11.6" height="6" rx="1.3"/>' +
  '<rect class="win" x="8.6" y="3.6" width="6.8" height="1.1" rx=".55" opacity=".8"/>' +
  '<circle class="win" cx="8" cy="15.2" r="1.3"/><circle class="win" cx="16" cy="15.2" r="1.3"/>' +
  '<rect x="5.6" y="18.4" width="3.2" height="3.2" rx="1.1" fill="currentColor"/>' +
  '<rect x="15.2" y="18.4" width="3.2" height="3.2" rx="1.1" fill="currentColor"/>' +
  '</svg>'

/** Avtobus nişanı HTML (Leaflet divIcon). Ölçü 44×52, lövbər diskin mərkəzi (22, 19). */
export const busMarkerHtml = ({ number, color, level, reserve, onPlan }) => {
  const l = crowdLevels[level] || crowdLevels.unknown
  const dots = [1, 2, 3].map((i) => `<i class="${i <= l.bars ? 'on' : ''}"></i>`).join('')
  const cls = `bus-mk${reserve ? ' reserve' : ''}${onPlan ? ' on-plan' : ''}`
  return (
    `<div class="${cls}" style="--c:${esc(color)};--cr:${l.color}">` +
    `<span class="bus-mk__disc">${BUS_SVG}</span>` +
    `<span class="bus-mk__num">${esc(number)}</span>` +
    `<span class="bus-mk__dots">${dots}</span></div>`
  )
}
export const BUS_ICON_SIZE = [44, 52]
export const BUS_ICON_ANCHOR = [22, 19]

/** Heatmap ləkəsi — server rəqəmləri HTML-ə yalnız Number kimi düşür (XSS qorunması) */
export const heatBlobHtml = (c) =>
  `<div class="heat-blob" style="--s:${Number(c.size) || 0}px;--o:${Number(c.opacity) || 0}"><span>${Number(c.count) || 0}</span></div>`

/**
 * Props → çəkiləcək obyektlər.
 *  plan        — seçilmiş marşrut variantı (legs)
 *  endpoints   — { from, to }
 *  density     — Yanaşma B: canlı xanalar { cells }
 *  demandStops — Yanaşma A: dayanacaq üzrə gözlənilən minik
 */
export const useMapModel = ({ routes = [], crowd, focusRouteId, plan, endpoints, density, demandStops }) => {
  const routeById = useMemo(() => Object.fromEntries(routes.map((r) => [r.id, r])), [routes])
  const crowdByRoute = useMemo(() => Object.fromEntries((crowd?.routes || []).map((r) => [r.routeId, r])), [crowd])

  const { fitPoints, fitKey } = useMemo(() => {
    if (plan) return { fitPoints: plan.legs.flatMap((l) => l.path || []), fitKey: `plan:${plan.id}` }
    const ep = [endpoints?.from, endpoints?.to].filter(Boolean)
    if (ep.length === 2) {
      return { fitPoints: ep.map((p) => [p.lat, p.lng]), fitKey: `ep:${ep.map((p) => `${p.lat},${p.lng}`).join('|')}` }
    }
    const target = focusRouteId ? routes.filter((r) => r.id === focusRouteId) : routes
    return { fitPoints: target.flatMap((r) => r.path), fitKey: `r:${focusRouteId || 'all'}:${routes.length}` }
  }, [plan, endpoints, routes, focusRouteId])

  // Yanaşma B: piksel ölçülü "heatmap" ləkələri (istənilən zoom-da görünür)
  const densityCircles = useMemo(() => {
    const cells = density?.cells || []
    if (!cells.length) return []
    const max = Math.max(...cells.map((c) => c.count))
    return cells.map((c) => ({
      key: `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
      lat: c.lat,
      lng: c.lng,
      count: c.count,
      size: Math.round(26 + 14 * Math.sqrt(c.count)),
      opacity: +(0.35 + 0.55 * (c.count / max)).toFixed(2),
    }))
  }, [density])

  // Yanaşma A: dayanacaq üzrə gözlənilən minik — piksel radiuslu halqa
  const demandCircles = useMemo(
    () =>
      (demandStops || [])
        .filter((s) => s.lat != null)
        .map((s) => ({
          key: `${s.routeId}|${s.stopId}`,
          lat: s.lat,
          lng: s.lng,
          count: s.confirmed + s.searched,
          confirmed: s.confirmed,
          routeNumber: s.routeNumber,
          stopName: s.stopName,
          radiusPx: Math.round(9 + 5 * Math.sqrt(s.confirmed * 2 + s.searched)),
        })),
    [demandStops]
  )

  return { routeById, crowdByRoute, fitPoints, fitKey, densityCircles, demandCircles }
}
