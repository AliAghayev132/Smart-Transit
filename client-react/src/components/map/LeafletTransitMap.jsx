/**
 * Leaflet xəritəsi — Google Maps əlçatan olmadıqda FALLBACK (və ya açar yoxdursa əsas xəritə).
 * Plitələr üçün də fallback zənciri var: CARTO (açarla) → Mapbox → CARTO → OSM (constants/TILE_PROVIDERS).
 */
import { Fragment, useEffect, useRef, useState } from 'react'
import { MapContainer, Polyline, CircleMarker, Marker, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import { BAKU, TILE_PROVIDERS, WALK_COLOR, DEMAND_COLOR } from '@constants'
import { useTheme } from '@store/context'
import { useCrowdHex } from '@hooks'
import { BUS_ICON_ANCHOR, BUS_ICON_SIZE, busMarkerHtml, heatBlobHtml, levelHexOf, useMapModel } from './mapModel'

const iconCache = new Map()
const busIcon = (opts, dim) => {
  const key = `${opts.number}|${opts.color}|${opts.level}|${opts.reserve}|${opts.onPlan}|${dim}`
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: `bus-icon${dim ? ' dim' : ''}`,
        html: busMarkerHtml(opts),
        iconSize: BUS_ICON_SIZE,
        iconAnchor: BUS_ICON_ANCHOR,
        tooltipAnchor: [0, -20],
      })
    )
  }
  return iconCache.get(key)
}

const endpointIcon = (label, cls) =>
  L.divIcon({ className: 'ep-icon', html: `<div class="ep-pin ${cls}"><span>${label}</span></div>`, iconSize: [32, 42], iconAnchor: [16, 40] })
const EP_FROM = endpointIcon('A', 'from')
const EP_TO = endpointIcon('B', 'to')

/** Plitə fallback: aktiv provayderdən heç bir plitə yüklənməyibsə → növbəti provayder */
const FallbackTileLayer = ({ onProviderChange, dark }) => {
  const map = useMap()
  const [idx, setIdx] = useState(0)
  const stats = useRef({ ok: 0, err: 0 })

  useEffect(() => {
    const p = TILE_PROVIDERS[idx]
    if (!p) return
    stats.current = { ok: 0, err: 0 }
    const url = dark && p.darkUrl ? p.darkUrl : p.url
    const layer = L.tileLayer(url, { attribution: p.attribution, maxZoom: 19, subdomains: p.subdomains || 'abc', crossOrigin: true })
    const next = () => idx < TILE_PROVIDERS.length - 1 && setIdx((i) => i + 1)
    layer.on('tileload', () => stats.current.ok++)
    layer.on('tileerror', () => {
      stats.current.err++
      if (stats.current.ok === 0 && stats.current.err >= 4) next()
    })
    layer.addTo(map)
    onProviderChange?.(p)
    // 8 san-də bir dənə də uğurlu plitə yoxdursa (bloklanmış domen / səhv açar) — növbəti provayder
    const t = setTimeout(() => stats.current.ok === 0 && stats.current.err > 0 && next(), 8000)
    return () => {
      clearTimeout(t)
      map.removeLayer(layer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, map, dark])
  return null
}

const FitTo = ({ points, fitKey, padding }) => {
  const map = useMap()
  useEffect(() => {
    if (points?.length) map.fitBounds(L.latLngBounds(points), { maxZoom: 15, ...padding })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])
  return null
}

const FlyTo = ({ center }) => {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [map, center])
  return null
}

const ClickHandler = ({ onMapClick }) => {
  useMapEvents({ click: (e) => onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

/** Konteyner ölçüsü dəyişəndə (panel açılıb-bağlananda) xəritəni yenilə */
const ResizeWatcher = () => {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

export const LeafletTransitMap = (props) => {
  const {
    routes = [],
    buses = [],
    crowd,
    segmentMode = false,
    heat = [],
    selectedStopId,
    onStopClick,
    onRouteClick,
    focusRouteId,
    flyTo,
    plan,
    endpoints,
    onMapClick,
    picking,
    onTileProvider,
    fitPadding,
  } = props
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const hex = useCrowdHex()
  const { routeById, crowdByRoute, fitPoints, fitKey, densityCircles, demandCircles } = useMapModel(props)
  const dimAll = !!plan
  const surface = isDark ? '#1c1c1e' : '#ffffff'
  const casing = isDark ? '#121212' : '#ffffff'
  const padding = fitPadding || { padding: [48, 48] }

  return (
    <MapContainer center={[BAKU.lat, BAKU.lng]} zoom={13} zoomControl={false} className={`h-full w-full ${picking ? 'picking' : ''}`}>
      <FallbackTileLayer onProviderChange={onTileProvider} dark={isDark} />
      <ZoomControl position="bottomright" zoomInTitle="+" zoomOutTitle="−" />
      <FitTo points={fitPoints} fitKey={fitKey} padding={padding} />
      {flyTo && <FlyTo center={flyTo} />}
      <ClickHandler onMapClick={onMapClick} />
      <ResizeWatcher />

      {/* Yanaşma B — canlı sərnişin sıxlığı */}
      {densityCircles.map((c) => (
        <Marker
          key={c.key}
          position={[c.lat, c.lng]}
          interactive={false}
          zIndexOffset={-1000}
          icon={L.divIcon({ className: 'heat-icon', html: heatBlobHtml(c), iconSize: [c.size, c.size], iconAnchor: [c.size / 2, c.size / 2] })}
        />
      ))}

      {routes.map((r) => {
        const dimmed = dimAll || (focusRouteId && focusRouteId !== r.id)
        const rc = crowdByRoute[r.id]
        return (
          <Fragment key={r.id}>
            <Polyline
              positions={r.path}
              pathOptions={{ color: r.color, weight: segmentMode ? 3 : 6, opacity: dimmed ? 0.15 : 0.9, dashArray: segmentMode ? '2 6' : undefined }}
              eventHandlers={onRouteClick ? { click: () => onRouteClick(r) } : undefined}
            />
            {segmentMode &&
              r.segmentPaths.map((seg, i) => {
                const s = rc?.segments?.[i]
                if (!s || s.level === 'unknown') return null
                return (
                  <Polyline
                    key={i}
                    positions={seg}
                    pathOptions={{ color: levelHexOf(hex, s.level), weight: 9, opacity: dimmed ? 0.2 : 0.85, lineCap: 'round' }}
                    eventHandlers={onRouteClick ? { click: () => onRouteClick(r) } : undefined}
                  >
                    <Tooltip sticky>
                      <b>{t('route.number', { number: r.number })}</b> {s.from} → {s.to}
                      <br />
                      {t(`crowd.${s.level}.long`)}
                      {s.loadPct != null && ` (${t('crowd.occupancy', { pct: s.loadPct })})`}
                      <br />
                      {t('map.stopReports', { count: s.total })}
                    </Tooltip>
                  </Polyline>
                )
              })}
            {!dimmed &&
              r.stops.map((s) => {
                const selected = s.id === selectedStopId
                return (
                  <CircleMarker
                    key={s.id}
                    center={[s.lat, s.lng]}
                    radius={selected ? 9 : 5}
                    pathOptions={{ color: r.color, weight: selected ? 4 : 2, fillColor: surface, fillOpacity: 1 }}
                    eventHandlers={onStopClick ? { click: () => onStopClick(s, r) } : undefined}
                  >
                    <Tooltip direction="top" offset={[0, -6]}>
                      {s.name}
                    </Tooltip>
                  </CircleMarker>
                )
              })}
          </Fragment>
        )
      })}

      {/* Yanaşma A — dayanacaq üzrə gözlənilən tələb */}
      {demandCircles.map((c) => (
        <CircleMarker
          key={c.key}
          center={[c.lat, c.lng]}
          radius={c.radiusPx}
          pathOptions={{ color: DEMAND_COLOR, weight: 2.5, fillColor: DEMAND_COLOR, fillOpacity: 0.18 }}
        >
          <Tooltip>
            <b>{t('route.number', { number: c.routeNumber })}</b> {c.stopName}
            <br />
            {t('map.demandTip', { confirmed: c.confirmed, searched: c.count - c.confirmed })}
          </Tooltip>
        </CircleMarker>
      ))}

      {heat.map((h) => (
        <CircleMarker
          key={h.id}
          center={[h.lat, h.lng]}
          radius={h.verified ? 6 : 4}
          pathOptions={{ stroke: false, fillColor: levelHexOf(hex, h.level), fillOpacity: h.verified ? 0.55 : 0.3 }}
        />
      ))}

      {/* Seçilmiş marşrut variantı */}
      {plan?.legs.map((l, i) =>
        l.type === 'walk' ? (
          <Polyline key={i} positions={l.path} pathOptions={{ color: WALK_COLOR, weight: 4, dashArray: '2 8', lineCap: 'round' }} />
        ) : (
          <Fragment key={i}>
            <Polyline positions={l.path} pathOptions={{ color: casing, weight: 11, opacity: 0.9 }} />
            <Polyline positions={l.path} pathOptions={{ color: l.color, weight: 7 }}>
              <Tooltip sticky>
                <b>{t('route.number', { number: l.number })}</b> {l.from?.name} → {l.to?.name}
              </Tooltip>
            </Polyline>
            {[l.from, l.to].map((p, k) =>
              p?.lat != null ? (
                <CircleMarker key={k} center={[p.lat, p.lng]} radius={7} pathOptions={{ color: l.color, weight: 4, fillColor: surface, fillOpacity: 1 }}>
                  <Tooltip direction="top">{p.name}</Tooltip>
                </CircleMarker>
              ) : null
            )}
          </Fragment>
        )
      )}

      {buses.map((b) => {
        const r = routeById[b.routeId]
        if (!r) return null
        const bc = crowd?.buses?.[b.id]
        const level = bc?.level || 'unknown'
        const onPlan = !!plan?.legs.some((l) => l.busId === b.id)
        const dim = (focusRouteId && focusRouteId !== b.routeId) || (plan && !onPlan)
        return (
          <Marker
            key={b.id}
            position={[b.lat, b.lng]}
            icon={busIcon({ number: r.number, color: r.color, level, reserve: b.isReserve, onPlan }, dim)}
            zIndexOffset={onPlan ? 2000 : b.isReserve ? 1000 : 0}
            eventHandlers={onRouteClick ? { click: () => onRouteClick(r) } : undefined}
            alt={t('route.line', { number: r.number })}
          >
            <Tooltip direction="top">
              <b>{t('route.number', { number: r.number })}</b> {b.plate}
              {b.isReserve && <b className="text-reserve"> {t('map.bus.reserve')}</b>}
              <br />
              {t('map.bus.towards', { headsign: b.headsign })}
              {b.nextStop && (
                <>
                  <br />
                  {t('map.bus.next', { stop: b.nextStop })}
                </>
              )}
              <br />
              {t(`crowd.${level}.long`)}
              {bc?.loadPct != null && ` (${t('crowd.occupancy', { pct: bc.loadPct })})`}
            </Tooltip>
          </Marker>
        )
      })}

      {endpoints?.from && <Marker position={[endpoints.from.lat, endpoints.from.lng]} icon={EP_FROM} zIndexOffset={3000} alt={t('map.from')} />}
      {endpoints?.to && <Marker position={[endpoints.to.lat, endpoints.to.lng]} icon={EP_TO} zIndexOffset={3000} alt={t('map.to')} />}
    </MapContainer>
  )
}

export default LeafletTransitMap
