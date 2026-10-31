import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SEO, MapView, SearchBar, TripPlanner, NearbyDemand, LiveShareCard, RouteList, RouteView, TransitChatbot, BrandMark } from '@components'
import { useGetRoutesQuery } from '@store/api'
import { useTransitLive } from '@store/hooks'
import { useMapEngine } from '@store/context'
import { useLiveLocationShare, useMediaQuery } from '@hooks'
import { reverseLabel } from '@services'

const FIT_DESKTOP = { paddingTopLeft: [476, 84], paddingBottomRight: [48, 48] }
const FIT_MOBILE = { paddingTopLeft: [20, 72], paddingBottomRight: [20, 44] }

/**
 * Sərnişin modulu (Six-O):
 *  - Ana ekran: «Hara gedirik?» axtarışı + xətlər
 *  - Marşrut: «Çıxış / Çatma» kartı, GO («Gedirəm» — Yanaşma A), növbəti avtobuslar, xətt zolağı
 *  - Xətt: iri nömrə, istiqamət, dayanacaq üzrə gəliş kartları, sıxlığı bildirmə, dayanacaqlar
 *  - Yanaşma B: canlı mövqeyi anonim paylaşmaq / xəritədə canlı sərnişinlər
 * Xəritə tam ekrandır; panel mobil cihazda aşağıdan, kompüterdə solda üzür.
 */
export const HomePage = () => {
  const { t } = useTranslation('passenger')
  const engine = useMapEngine()
  const live = useTransitLive()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { data: routes = [] } = useGetRoutesQuery()

  // Planlayıcı
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [picking, setPicking] = useState(null)
  const [plan, setPlan] = useState(null)

  // Xətt görünüşü
  const [routeId, setRouteId] = useState(null)
  const [stopId, setStopId] = useState(null)
  const [direction, setDirection] = useState(1)
  const route = routes.find((r) => r.id === routeId)
  const ordered = useMemo(() => (route ? (direction === 1 ? route.stops : [...route.stops].reverse()) : []), [route, direction])
  const stop = route?.stops.find((s) => s.id === stopId) || ordered[0]

  // Yanaşma B
  const [share, setShare] = useState(false)
  const [showDensity, setShowDensity] = useState(false)
  const { state: shareState } = useLiveLocationShare(share)

  const planning = !!(from && to)
  const mode = planning ? 'plan' : route ? 'route' : 'home'

  const openRoute = useCallback((r) => {
    setRouteId(r.id)
    setStopId(null)
    setDirection(1)
  }, [])

  const onMapClick = useCallback(
    async (p) => {
      if (!picking) return
      const set = picking === 'from' ? setFrom : setTo
      setPicking(null)
      set({ lat: p.lat, lng: p.lng, name: `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` })
      const name = await reverseLabel(p.lat, p.lng, engine?.googleAvailable)
      set((cur) => (cur && cur.lat === p.lat && cur.lng === p.lng ? { ...cur, name } : cur))
    },
    [picking, engine?.googleAvailable]
  )

  const mapProps =
    mode === 'route'
      ? {
          routes: [route],
          buses: live.buses.filter((b) => b.routeId === route.id),
          crowd: live.crowd,
          selectedStopId: stop?.id,
          onStopClick: (s) => setStopId(s.id),
          focusRouteId: route.id,
          flyTo: stopId && stop ? [stop.lat, stop.lng] : null,
        }
      : {
          routes,
          buses: live.buses,
          crowd: live.crowd,
          plan: mode === 'plan' ? plan : null,
          endpoints: { from, to },
          onMapClick,
          picking: !!picking,
          onRouteClick: mode === 'home' && !picking ? openRoute : undefined,
        }

  return (
    <div className="h-full">
      <SEO title={t('common:nav.passenger')} path="/" />

      <div className="absolute inset-x-0 top-0 h-[44dvh] lg:inset-0 lg:h-auto">
        <MapView
          {...mapProps}
          className="map-passenger"
          controlsClassName="top-[72px] lg:left-[472px] lg:top-4"
          fitPadding={isDesktop ? FIT_DESKTOP : FIT_MOBILE}
          density={showDensity ? live.density : null}
          legend={{ density: showDensity, hidden: !showDensity, className: 'bottom-9 lg:bottom-4 lg:left-[472px]' }}
        />
      </div>

      <aside
        className="sheet-scroll absolute inset-x-0 bottom-0 top-[calc(44dvh-24px)] z-[1000] overflow-y-auto rounded-t-sheet bg-canvas shadow-float lg:bottom-4 lg:left-4 lg:right-auto lg:top-4 lg:w-[440px] lg:rounded-sheet"
        aria-label={t('home.panel')}
      >
        <div className="sticky top-0 z-20 flex justify-center bg-canvas/90 pb-1 pt-2.5 backdrop-blur lg:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>

        <div className="space-y-5 px-4 pb-28 pt-2 lg:p-5 lg:pb-24">
          <div className="hidden items-center gap-3 lg:flex">
            <BrandMark className="h-11 w-11" />
            <div className="min-w-0">
              <p className="text-lg font-black leading-tight">{t('common:app.name')}</p>
              <p className="text-sm font-semibold text-ink-soft">{t('common:app.tagline')}</p>
            </div>
          </div>

          {mode !== 'route' && (
            <section className="space-y-3">
              <h1 className="text-title px-1">{planning ? t('home.yourTrip') : t('home.whereTo')}</h1>
              <div className="rounded-card bg-surface p-3 shadow-card">
                <SearchBar from={from} to={to} setFrom={setFrom} setTo={setTo} routes={routes} picking={picking} setPicking={setPicking} />
                {picking && (
                  <p className="mt-2.5 px-1 text-sm font-bold text-brand" role="status">
                    {t('home.pickHint', { field: picking === 'from' ? t('common:map.from') : t('common:map.to') })}{' '}
                    <button className="underline underline-offset-2" onClick={() => setPicking(null)}>
                      {t('common:actions.cancel')}
                    </button>
                  </p>
                )}
              </div>
            </section>
          )}

          {mode === 'plan' && (
            <>
              <TripPlanner from={from} to={to} routes={routes} selected={plan} onSelect={setPlan} />
              <NearbyDemand point={from} />
            </>
          )}

          {mode === 'home' && (
            <section className="space-y-3">
              <h2 className="px-1 text-lg font-extrabold">{t('home.lines')}</h2>
              <RouteList routes={routes} crowd={live.crowd} buses={live.buses} onOpen={openRoute} />
              {!from && !to && <p className="px-1 text-sm font-semibold text-ink-soft">{t('home.hint')}</p>}
            </section>
          )}

          {mode === 'route' && (
            <RouteView
              route={route}
              buses={live.buses}
              crowd={live.crowd}
              stopId={stop?.id}
              setStopId={setStopId}
              direction={direction}
              setDirection={setDirection}
              onBack={() => setRouteId(null)}
            />
          )}

          {mode !== 'plan' && (
            <LiveShareCard share={share} setShare={setShare} state={shareState} showDensity={showDensity} setShowDensity={setShowDensity} density={live.density} />
          )}
        </div>
      </aside>

      <TransitChatbot />
    </div>
  )
}
