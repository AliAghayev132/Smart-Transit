/**
 * Xətt görünüşü (Six-O): iri xətt nömrəsi, istiqamət, seçilmiş dayanacaq üçün növbəti
 * avtobusların dəqiqə kartları, sıxlığı bildirmə, dayanacaqlar zaman xətti.
 */
import { useMemo } from 'react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowLeftRight, BusFront, CircleArrowRight, Users } from 'lucide-react'
import { useGetStopEtaQuery } from '@store/api'
import { routeTint } from '@utils'
import { CrowdBadge, CrowdDots } from './CrowdBadge'
import { DepartureCards } from './DepartureCards'
import { ReportCard } from './ReportCard'
import { directionDepartures } from './departures'

export const RouteView = ({ route, buses = [], crowd, stopId, setStopId, direction, setDirection, onBack }) => {
  const { t } = useTranslation('passenger')
  const ordered = useMemo(() => (direction === 1 ? route.stops : [...route.stops].reverse()), [route.stops, direction])
  const headsign = ordered[ordered.length - 1].name
  const stop = route.stops.find((s) => s.id === stopId) || ordered[0]
  const rc = crowd?.routes.find((x) => x.routeId === route.id)

  const { data: eta } = useGetStopEtaQuery({ routeId: route.id, stopId: stop.id, limit: 8 }, { pollingInterval: 5000 })
  const arrivals = useMemo(() => directionDepartures(eta?.arrivals, route, stop.id, headsign), [eta, route, stop.id, headsign])
  const dirBuses = buses.filter((b) => b.routeId === route.id && b.headsign === headsign)
  const approaching = useMemo(() => {
    const m = {}
    for (const b of dirBuses) if (b.nextStop) (m[b.nextStop] ||= []).push(b)
    return m
  }, [dirBuses])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          aria-label={t('common:actions.back')}
          title={t('common:actions.back')}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-card hover:bg-raised"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="min-w-0 truncate text-sm font-bold text-ink-soft">{route.name}</p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <h2 className="text-hero" style={{ color: route.color }}>
          <span className="sr-only">{t('common:route.line', { number: route.number })}</span>
          <span aria-hidden>{route.number}</span>
        </h2>
        <CrowdBadge level={rc?.level} pct={rc?.loadPct} long />
      </div>

      <button
        onClick={() => setDirection(-direction)}
        className="flex max-w-full items-center gap-2 rounded-full text-left text-xl font-extrabold"
        style={{ color: route.color }}
        title={t('route.switchDirection')}
      >
        <CircleArrowRight className="h-6 w-6 shrink-0" aria-hidden />
        <span className="min-w-0">{headsign}</span>
        <span className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised text-ink-soft">
          <ArrowLeftRight className="h-4 w-4" aria-label={t('route.switchDirection')} />
        </span>
      </button>

      <div>
        <p className="mb-2 px-1 text-base font-bold text-ink-soft">
          {t('route.atStop')} <b className="text-ink">{stop.name}</b>
        </p>
        {arrivals.length ? (
          <DepartureCards items={arrivals.slice(0, 3)} color={route.color} />
        ) : (
          <p className="rounded-card bg-surface p-4 text-base font-semibold text-ink-soft shadow-card">{eta ? t('route.noBuses') : t('common:status.loading')}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-extrabold shadow-card">
            <BusFront className="h-4 w-4 text-ink-soft" aria-hidden />
            {t('route.busesOnLine', { count: buses.filter((b) => b.routeId === route.id).length })}
          </span>
          {eta?.stop.liveWaiting > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-extrabold shadow-card">
              <Users className="h-4 w-4 text-ink-soft" aria-hidden />
              {t('route.waitingNow', { count: eta.stop.liveWaiting })}
            </span>
          )}
        </div>
      </div>

      <ReportCard route={route} stop={stop} arrivals={arrivals} buses={dirBuses} />

      <section className="rounded-card bg-surface p-4 shadow-card" aria-label={t('route.stops')}>
        <h3 className="mb-2 px-1 text-lg font-extrabold">{t('route.stops')}</h3>
        <ol className="relative">
          <span className="absolute bottom-5 left-[19px] top-5 w-1 rounded" style={{ background: route.color }} aria-hidden />
          {ordered.map((s) => {
            const sel = s.id === stop.id
            const here = approaching[s.name] || []
            return (
              <li key={s.id}>
                <button
                  onClick={() => setStopId(s.id)}
                  aria-current={sel ? 'location' : undefined}
                  className={clsx('relative flex w-full items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-2 text-left', !sel && 'hover:bg-raised')}
                  style={sel ? { background: routeTint(route.color) } : undefined}
                >
                  <span
                    className={clsx('relative z-10 shrink-0 rounded-full border-[3.5px] bg-surface', sel ? 'h-[22px] w-[22px]' : 'ml-[3px] h-4 w-4')}
                    style={{ borderColor: route.color }}
                    aria-hidden
                  />
                  <span className={clsx('min-w-0 flex-1 text-base leading-snug', sel ? 'font-black' : 'font-semibold')}>{s.name}</span>
                  {here.map((b) => (
                    <span key={b.id} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-raised px-2 py-1" title={t('route.busApproaching', { plate: b.plate })}>
                      <BusFront className="h-3.5 w-3.5" style={{ color: route.color }} aria-hidden />
                      <CrowdDots level={crowd?.buses?.[b.id]?.level} size="sm" />
                    </span>
                  ))}
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
