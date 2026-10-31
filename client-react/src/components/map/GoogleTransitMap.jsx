/**
 * Google Maps xəritəsi (@vis.gl/react-google-maps).
 * Leaflet versiyası ilə EYNİ props-ları qəbul edir — MapView ikisi arasında keçid edir.
 */
import { Fragment, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Map, AdvancedMarker, AdvancedMarkerAnchorPoint, Polyline, Circle, useMap } from '@vis.gl/react-google-maps'
import { BAKU, WALK_COLOR, crowdLevels } from '@constants'
import { GOOGLE_MAP_ID } from '@/lib/variables'
import { useTheme } from '@store/context'
import { useCrowdHex } from '@hooks'
import { BUS_SVG, levelHexOf, useMapModel } from './mapModel'

const toLL = (p) => ({ lat: p[0], lng: p[1] })
const toPath = (arr) => arr.map(toLL)

// Kəsik/nöqtəli xətt üçün Google "icons" texnikası
const dashed = (color, gap = '12px', scale = 3) => ({
  strokeOpacity: 0,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, scale }, offset: '0', repeat: gap }],
})

const FitTo = ({ points, fitKey }) => {
  const map = useMap()
  useEffect(() => {
    if (!map || !points?.length || !window.google) return
    const b = new window.google.maps.LatLngBounds()
    points.forEach((p) => b.extend(toLL(p)))
    map.fitBounds(b, 48)
    window.google.maps.event.addListenerOnce(map, 'idle', () => {
      if (map.getZoom() > 15) map.setZoom(15)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])
  return null
}

const FlyTo = ({ center }) => {
  const map = useMap()
  useEffect(() => {
    if (!map || !center) return
    map.panTo(toLL(center))
    if (map.getZoom() < 15) map.setZoom(15)
  }, [map, center])
  return null
}

/** Avtobus nişanı — Leaflet versiyası ilə eyni görünüş (App.css → .bus-mk) */
const BusPin = ({ number, color, level, reserve, onPlan, dim }) => {
  const l = crowdLevels[level] || crowdLevels.unknown
  return (
    <div className={`bus-icon g${dim ? ' dim' : ''}`} style={{ transform: 'translateY(7px)' }}>
      <div className={`bus-mk${reserve ? ' reserve' : ''}${onPlan ? ' on-plan' : ''}`} style={{ '--c': color, '--cr': l.color }}>
        <span className="bus-mk__disc" dangerouslySetInnerHTML={{ __html: BUS_SVG }} />
        <span className="bus-mk__num">{number}</span>
        <span className="bus-mk__dots">
          {[1, 2, 3].map((i) => (
            <i key={i} className={i <= l.bars ? 'on' : ''} />
          ))}
        </span>
      </div>
    </div>
  )
}

export const GoogleTransitMap = (props) => {
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
  } = props
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const hex = useCrowdHex()
  const casing = isDark ? '#121212' : '#ffffff'
  const { routeById, crowdByRoute, fitPoints, fitKey, densityCircles, demandCircles } = useMapModel(props)
  const dimAll = !!plan

  return (
    <Map
      mapId={GOOGLE_MAP_ID}
      defaultCenter={BAKU}
      defaultZoom={13}
      gestureHandling="greedy"
      clickableIcons={false}
      streetViewControl={false}
      mapTypeControl={false}
      fullscreenControl={false}
      colorScheme={isDark ? 'DARK' : 'LIGHT'}
      draggableCursor={picking ? 'crosshair' : undefined}
      onClick={(e) => e.detail.latLng && onMapClick?.({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng })}
      style={{ width: '100%', height: '100%' }}
    >
      <FitTo points={fitPoints} fitKey={fitKey} />
      {flyTo && <FlyTo center={flyTo} />}

      {densityCircles.map((c) => (
        <AdvancedMarker key={c.key} position={{ lat: c.lat, lng: c.lng }} anchorPoint={AdvancedMarkerAnchorPoint.CENTER} zIndex={1}>
          <div className="heat-blob" style={{ '--s': `${c.size}px`, '--o': c.opacity }}>
            <span>{c.count}</span>
          </div>
        </AdvancedMarker>
      ))}

      {routes.map((r) => {
        const dimmed = dimAll || (focusRouteId && focusRouteId !== r.id)
        const rc = crowdByRoute[r.id]
        return (
          <Fragment key={r.id}>
            <Polyline
              path={toPath(r.path)}
              strokeColor={r.color}
              strokeWeight={segmentMode ? 3 : 6}
              strokeOpacity={dimmed ? 0.15 : 0.9}
              {...(segmentMode && !dimmed ? dashed(r.color, '10px', 2) : {})}
              onClick={onRouteClick ? () => onRouteClick(r) : undefined}
            />
            {segmentMode &&
              r.segmentPaths.map((seg, i) => {
                const s = rc?.segments?.[i]
                if (!s || s.level === 'unknown') return null
                return (
                  <Polyline
                    key={i}
                    path={toPath(seg)}
                    strokeColor={levelHexOf(hex, s.level)}
                    strokeWeight={9}
                    strokeOpacity={dimmed ? 0.2 : 0.8}
                    onClick={onRouteClick ? () => onRouteClick(r) : undefined}
                  />
                )
              })}
            {!dimmed &&
              r.stops.map((s) => (
                <AdvancedMarker
                  key={s.id}
                  position={{ lat: s.lat, lng: s.lng }}
                  anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                  title={s.name}
                  zIndex={s.id === selectedStopId ? 50 : 10}
                  onClick={onStopClick ? () => onStopClick(s, r) : undefined}
                >
                  <div className={`g-stop${s.id === selectedStopId ? ' selected' : ''}`} style={{ '--c': r.color }} />
                </AdvancedMarker>
              ))}
          </Fragment>
        )
      })}

      {demandCircles.map((c) => (
        <AdvancedMarker
          key={c.key}
          position={{ lat: c.lat, lng: c.lng }}
          anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
          zIndex={5}
          title={`${t('route.number', { number: c.routeNumber })} ${c.stopName}\n${t('map.demandTip', { confirmed: c.confirmed, searched: c.count - c.confirmed })}`}
        >
          <div className="demand-ring" style={{ '--r': `${c.radiusPx * 2}px` }} />
        </AdvancedMarker>
      ))}

      {heat.map((h) => (
        <Circle
          key={h.id}
          center={{ lat: h.lat, lng: h.lng }}
          radius={h.verified ? 40 : 25}
          strokeWeight={0}
          fillColor={levelHexOf(hex, h.level)}
          fillOpacity={h.verified ? 0.5 : 0.28}
          clickable={false}
        />
      ))}

      {plan?.legs.map((l, i) =>
        l.type === 'walk' ? (
          <Polyline key={i} path={toPath(l.path)} {...dashed(WALK_COLOR, '10px', 3)} clickable={false} />
        ) : (
          <Fragment key={i}>
            <Polyline path={toPath(l.path)} strokeColor={casing} strokeWeight={11} strokeOpacity={0.9} clickable={false} />
            <Polyline path={toPath(l.path)} strokeColor={l.color} strokeWeight={7} strokeOpacity={1} clickable={false} />
            {[l.from, l.to].map((p, k) =>
              p?.lat != null ? (
                <AdvancedMarker key={k} position={{ lat: p.lat, lng: p.lng }} anchorPoint={AdvancedMarkerAnchorPoint.CENTER} title={p.name} zIndex={60}>
                  <div className="g-stop selected" style={{ '--c': l.color }} />
                </AdvancedMarker>
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
          <AdvancedMarker
            key={b.id}
            position={{ lat: b.lat, lng: b.lng }}
            anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
            zIndex={onPlan ? 200 : b.isReserve ? 150 : 100}
            title={[
              `${t('route.number', { number: r.number })} ${b.plate}${b.isReserve ? ` — ${t('map.bus.reserve')}` : ''}`,
              t('map.bus.towards', { headsign: b.headsign }),
              b.nextStop && t('map.bus.next', { stop: b.nextStop }),
              `${t(`crowd.${level}.long`)}${bc?.loadPct != null ? ` (${t('crowd.occupancy', { pct: bc.loadPct })})` : ''}`,
            ]
              .filter(Boolean)
              .join('\n')}
            onClick={onRouteClick ? () => onRouteClick(r) : undefined}
          >
            <BusPin number={r.number} color={r.color} level={level} reserve={b.isReserve} onPlan={onPlan} dim={dim} />
          </AdvancedMarker>
        )
      })}

      {endpoints?.from && (
        <AdvancedMarker position={{ lat: endpoints.from.lat, lng: endpoints.from.lng }} zIndex={300} title={endpoints.from.name || t('map.from')}>
          <div className="ep-pin from">
            <span>A</span>
          </div>
        </AdvancedMarker>
      )}
      {endpoints?.to && (
        <AdvancedMarker position={{ lat: endpoints.to.lat, lng: endpoints.to.lng }} zIndex={300} title={endpoints.to.name || t('map.to')}>
          <div className="ep-pin to">
            <span>B</span>
          </div>
        </AdvancedMarker>
      )}
    </Map>
  )
}

export default GoogleTransitMap
