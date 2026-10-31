import { useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import { SEO, MapView, LayerToggles, RouteContextPanel, OverviewPanel } from '@components'
import { baseApi, useGetRoutesQuery, useGetAlertsQuery, useGetHeatQuery, useGetDemandStopsQuery, useGetHealthQuery } from '@store/api'
import { useSocketEvent, useTransitLive } from '@store/hooks'
import { selectRoute, selectAlert, toggleLayer } from '@store/slices/operatorSlice'
import { useAlertActions } from '@hooks'

/**
 * Mərkəzi iş sahəsi: canlı xəritə (Google / Leaflet fallback) + sağ kontekst paneli.
 * Xəritədə: seqment sıxlığı (crowdsourcing), bildiriş nöqtələri, canlı istifadəçilər (B),
 * gözlənilən tələb (A), avtobuslar (ehtiyat avtobuslar sarı haşiyə ilə).
 */
export const MapPage = () => {
  const { t } = useTranslation('operator')
  const dispatch = useDispatch()
  const { selectedRouteId, selectedAlertId, layers } = useSelector((s) => s.operator)
  const live = useTransitLive()
  const { data: routes = [] } = useGetRoutesQuery()
  const { data: alerts = [] } = useGetAlertsQuery({ status: 'active' })
  const { data: heat = [] } = useGetHeatQuery(15, { skip: !layers.reports, pollingInterval: 30000 })
  const { data: demand } = useGetDemandStopsQuery(undefined, { pollingInterval: 30000 })
  const { data: health } = useGetHealthQuery()
  const { act, compose, busy } = useAlertActions()

  const timer = useRef()
  const onReport = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => dispatch(baseApi.util.invalidateTags(['Report'])), 1500)
  }, [dispatch])
  useSocketEvent('report:new', layers.reports ? onReport : null)

  const route = routes.find((r) => r.id === selectedRouteId)
  const onSelectRoute = useCallback((r) => dispatch(selectRoute(r?.id || null)), [dispatch])
  const onSelectAlert = useCallback((a) => dispatch(selectAlert(a)), [dispatch])

  const visibleHeat = selectedRouteId ? heat.filter((h) => h.routeId === selectedRouteId) : heat
  const demandStops = (demand?.stops || []).filter((s) => !selectedRouteId || s.routeId === selectedRouteId)

  return (
    <div className="flex h-full min-h-0">
      <SEO title={t('nav.map')} noindex />
      <div className="relative min-w-0 flex-1">
        <MapView
          routes={routes}
          buses={live.buses}
          crowd={live.crowd}
          segmentMode={layers.segments}
          heat={layers.reports ? visibleHeat : []}
          density={layers.density ? live.density : null}
          demandStops={layers.demand ? demandStops : null}
          focusRouteId={selectedRouteId}
          onRouteClick={onSelectRoute}
          onStopClick={(s, r) => onSelectRoute(r)}
          legend={{ density: layers.density, demand: layers.demand }}
        >
          <LayerToggles layers={layers} onToggle={(k) => dispatch(toggleLayer(k))} className="absolute right-3 top-3 z-[600]" />
        </MapView>
      </div>

      <aside className="w-[400px] shrink-0 overflow-y-auto border-l border-line bg-canvas p-4">
        {route ? (
          <RouteContextPanel
            key={route.id}
            route={route}
            crowd={live.crowd}
            buses={live.buses}
            density={live.density}
            alerts={alerts}
            selectedAlertId={selectedAlertId}
            onClose={() => {
              dispatch(selectAlert(null))
              dispatch(selectRoute(null))
            }}
            onAct={act}
            onCompose={compose}
            onSelectAlert={onSelectAlert}
            busy={busy}
          />
        ) : (
          <OverviewPanel
            routes={routes}
            crowd={live.crowd}
            density={live.density}
            demand={demand}
            alerts={alerts}
            selectedAlertId={selectedAlertId}
            onSelectRoute={onSelectRoute}
            onSelectAlert={onSelectAlert}
            onAct={act}
            onCompose={compose}
            busy={busy}
            demo={health?.demo}
          />
        )}
      </aside>
    </div>
  )
}
