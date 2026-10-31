/**
 * Marşrut nəticələri (Six-O): «Çıxış / Çatma» kartı + GO («Gedirəm», Yanaşma A),
 * piyada çipləri, növbəti avtobusların iri dəqiqə kartları, xətt zolağı, digər variantlar.
 */
import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { Zap, Smile } from 'lucide-react'
import { Badge } from '@components/ui'
import { usePlanTripQuery, useConfirmTripMutation, useCancelTripMutation, useGetStopEtaQuery } from '@store/api'
import { getDeviceId, fmtTime, toast } from '@utils'
import { CrowdDots } from './CrowdBadge'
import { DepartureCards } from './DepartureCards'
import { LegBand } from './LegBand'
import { GoButton } from './GoButton'
import { TripBar, WalkChip } from './sixo'
import { directionDepartures } from './departures'

const leaveInfo = (it, baseTime) => {
  const firstBus = it.legs.find((l) => l.type === 'bus')
  const waitSec = firstBus ? firstBus.waitSec : 0
  const leaveAt = baseTime + waitSec * 1000
  const arriveAt = new Date(it.arriveAt).getTime()
  return { firstBus, now: waitSec < 60, leaveAt, arriveAt, durMin: Math.max(1, Math.round((arriveAt - leaveAt) / 60000)) }
}

/**
 * Birinci avtobus hissəsi: seçilmiş avtobus + ondan sonrakı 2 avtobus (eyni istiqamət) iri dəqiqə kartları,
 * altında onlarla birləşən xətt zolağı.
 */
const FirstBusLeg = ({ leg, route, baseTime }) => {
  const enabled = !!(leg.routeId && leg.from?.stopId)
  const { data } = useGetStopEtaQuery({ routeId: leg.routeId, stopId: leg.from?.stopId, limit: 8 }, { skip: !enabled, pollingInterval: 10000 })
  const items = useMemo(() => {
    const same = directionDepartures(data?.arrivals, route, leg.from?.stopId, leg.headsign)
    const i = same.findIndex((a) => a.busId === leg.busId)
    return (i >= 0 ? same.slice(i) : same).slice(0, 3)
  }, [data, route, leg.from?.stopId, leg.headsign, leg.busId])
  return (
    <>
      {items.length > 0 && <DepartureCards items={items} color={leg.color} selectedId={items[0].busId} joined live={leg.live !== false} />}
      <LegBand leg={leg} route={route} baseTime={baseTime} joined={items.length > 0} />
    </>
  )
}

const TripCard = ({ it, baseTime, go }) => {
  const { t } = useTranslation('passenger')
  const { firstBus, now, leaveAt, arriveAt, durMin } = leaveInfo(it, baseTime)
  return (
    <div className="relative mt-7 rounded-card bg-surface p-5 shadow-card">
      {firstBus && <GoButton {...go} className="absolute -top-7 right-4" />}
      <h2 className={clsx('text-title', firstBus && 'pr-32')}>{now ? t('trip.leaveNow') : t('trip.leaveAt', { time: fmtTime(leaveAt) })}</h2>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-lg font-bold text-ink-soft">{t('trip.arriveAt', { time: fmtTime(arriveAt) })}</p>
        <p className="text-lg font-extrabold text-ink-soft">{t('common:time.min', { count: durMin })}</p>
      </div>
      <TripBar legs={it.legs} className="mt-4" />
    </div>
  )
}

const TripDetail = ({ it, routes, baseTime, go }) => {
  const { t } = useTranslation('passenger')
  const routeById = useMemo(() => Object.fromEntries(routes.map((r) => [r.id, r])), [routes])
  const firstBusIdx = it.legs.findIndex((l) => l.type === 'bus')
  return (
    <div>
      <TripCard it={it} baseTime={baseTime} go={go} />
      {go.confirmed && <p className="mt-2 px-1 text-sm font-semibold text-go">{t('trip.goConfirmed')}</p>}
      {it.legs.map((l, i) =>
        l.type === 'walk' ? (
          l.durationSec >= 30 && <WalkChip key={i} sec={l.durationSec} className="my-1" />
        ) : (
          <div key={i} className={clsx(i > 0 && it.legs[i - 1].type !== 'walk' && 'mt-3')}>
            {i === firstBusIdx ? (
              <FirstBusLeg leg={l} route={routeById[l.routeId]} baseTime={baseTime} />
            ) : (
              <LegBand leg={l} route={routeById[l.routeId]} baseTime={baseTime} />
            )}
          </div>
        )
      )}
      {firstBusIdx < 0 && <p className="mt-3 px-1 text-sm font-semibold text-ink-soft">{t('trip.walkOnly')}</p>}
    </div>
  )
}

const AltRow = ({ it, baseTime, onSelect }) => {
  const { t } = useTranslation('passenger')
  const { now, leaveAt, durMin } = leaveInfo(it, baseTime)
  return (
    <button onClick={() => onSelect(it)} className="flex w-full items-center gap-4 rounded-card bg-surface p-4 text-left shadow-card transition-colors hover:bg-raised">
      <div className="min-w-0 flex-1">
        <p className="text-base font-extrabold">{now ? t('trip.leaveNow') : t('trip.leaveAt', { time: fmtTime(leaveAt) })}</p>
        <TripBar legs={it.legs} className="mt-2.5" />
        {(it.tags.length > 0 || it.source === 'google') && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {it.tags.map((tag) => (
              <Badge key={tag} variant={tag === 'comfort' ? 'go' : 'info'} size="sm">
                {t(`trip.tag.${tag}`)}
              </Badge>
            ))}
            {it.source === 'google' && <Badge size="sm">Google</Badge>}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-2xl font-black tabular-nums">{durMin}</span>
        <span className="text-xs font-bold text-ink-soft">{t('common:time.minUnit', { count: durMin })}</span>
        {it.legs.some((l) => l.type === 'bus') && <CrowdDots level={it.crowd} />}
      </div>
    </button>
  )
}

export const TripPlanner = ({ from, to, routes = [], selected, onSelect }) => {
  const { t } = useTranslation('passenger')
  const [prefer, setPrefer] = useState('fast')
  const [confirmedId, setConfirmedId] = useState(null)
  const args = useMemo(() => (from && to ? { from, to, prefer, deviceId: getDeviceId() } : null), [from, to, prefer])
  const { data, isFetching, error } = usePlanTripQuery(args, { skip: !args, pollingInterval: 30000, refetchOnMountOrArgChange: true })
  const [confirmTrip, { isLoading: confirming }] = useConfirmTripMutation()
  const [cancelTrip] = useCancelTripMutation()

  // Yeni nəticədə seçimi saxla (ETA-lar yenilənir) və ya birincini seç
  useEffect(() => {
    if (!args) return onSelect(null)
    if (!data) return
    const all = [...data.itineraries, ...(data.google?.itineraries || [])]
    onSelect((cur) => all.find((i) => i.id === cur?.id) || all[0] || null)
  }, [data, args, onSelect])

  // Başlanğıc/təyinat dəyişəndə «GO» vəziyyətini sıfırla (render zamanı — effektsiz)
  const [prevPair, setPrevPair] = useState([from, to])
  if (prevPair[0] !== from || prevPair[1] !== to) {
    setPrevPair([from, to])
    setConfirmedId(null)
  }

  if (!args) return null

  const all = [...(data?.itineraries || []), ...(data?.google?.itineraries || [])]
  const baseTime = data ? new Date(data.generatedAt).getTime() : 0
  const others = all.filter((i) => i.id !== selected?.id)

  const go = {
    confirmed: confirmedId === selected?.id,
    busy: confirming,
    onGo: async () => {
      try {
        await confirmTrip({ from, to, itinerary: selected, deviceId: getDeviceId() }).unwrap()
        setConfirmedId(selected.id)
      } catch (err) {
        toast.error(err?.data?.message || t('common:status.notSent'))
      }
    },
    onCancel: async () => {
      await cancelTrip(getDeviceId())
        .unwrap()
        .catch(() => {})
      setConfirmedId(null)
    },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-raised p-1" role="radiogroup" aria-label={t('trip.preferLabel')}>
          {[
            ['fast', Zap],
            ['comfort', Smile],
          ].map(([k, Icon]) => (
            <button
              key={k}
              role="radio"
              aria-checked={prefer === k}
              onClick={() => setPrefer(k)}
              className={clsx(
                'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-extrabold transition-colors',
                prefer === k ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden /> {t(`trip.prefer.${k}`)}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold text-ink-faint" aria-live="polite">
          {isFetching ? t('trip.calculating') : ''}
        </span>
      </div>

      {error && <p className="rounded-card bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-surface))] p-4 text-sm font-bold text-danger">{error.data?.message || t('common:status.error')}</p>}
      {data && !all.length && <p className="rounded-card bg-surface p-5 text-base font-semibold text-ink-soft shadow-card">{t('trip.noRoute')}</p>}
      {!data && !error && <div className="h-40 animate-pulse rounded-card bg-surface/70" aria-label={t('common:status.loading')} />}

      {selected && <TripDetail it={selected} routes={routes} baseTime={baseTime} go={go} />}

      {others.length > 0 && (
        <section className="space-y-2.5 pt-2">
          <h3 className="px-1 text-lg font-extrabold">{t('trip.alternatives')}</h3>
          {others.map((it) => (
            <AltRow key={it.id} it={it} baseTime={baseTime} onSelect={onSelect} />
          ))}
        </section>
      )}
      {data?.google?.enabled && data.google.error && <p className="px-1 text-xs text-ink-faint">Google Routes: {data.google.error}</p>}
    </div>
  )
}
