/** Yanaşma A: seçilmiş başlanğıc ətrafında yola düşmək istəyən digər sərnişinlər */
import { useCallback, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { baseApi, useGetNearbyDemandQuery } from '@store/api'
import { useSocketEvent } from '@store/hooks'
import { getDeviceId } from '@utils'

const RADII = [300, 500, 1000]

export const NearbyDemand = ({ point }) => {
  const { t } = useTranslation('passenger')
  const [radius, setRadius] = useState(500)
  const dispatch = useDispatch()
  const { data: d } = useGetNearbyDemandQuery(point ? { lat: point.lat, lng: point.lng, radius, deviceId: getDeviceId() } : undefined, {
    skip: !point,
    pollingInterval: 30000,
  })
  const timer = useRef()
  const onChanged = useCallback(() => {
    clearTimeout(timer.current)
    // Başqa istifadəçi niyyət bildirdi → keşi yenilə (refetch yalnız aktiv sorğuda işləyir)
    timer.current = setTimeout(() => dispatch(baseApi.util.invalidateTags(['Demand'])), 1500)
  }, [dispatch])
  useSocketEvent('demand:changed', onChanged)

  if (!point) return null
  return (
    <section className="rounded-card bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold">{t('demand.title')}</h3>
        <div className="inline-flex rounded-full bg-raised p-1" role="radiogroup" aria-label={t('demand.radius')}>
          {RADII.map((r) => (
            <button
              key={r}
              role="radio"
              aria-checked={radius === r}
              onClick={() => setRadius(r)}
              className={clsx('h-7 rounded-full px-2.5 text-xs font-extrabold', radius === r ? 'bg-surface text-ink shadow-card' : 'text-ink-soft')}
            >
              {t('common:dist.m', { n: r })}
            </button>
          ))}
        </div>
      </div>
      {d ? (
        <>
          <p className="mt-3 flex items-baseline gap-3">
            <span className="text-giant tabular-nums text-brand">{d.total}</span>
            <span className="text-base font-bold text-ink-soft">{t('demand.people', { count: d.total, minutes: d.horizonMin })}</span>
          </p>
          {d.confirmed > 0 && <p className="mt-1 text-sm font-bold text-go">{t('demand.confirmed', { count: d.confirmed })}</p>}
          {d.byStop.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {d.byStop.slice(0, 3).map((s) => (
                <li key={`${s.routeNumber}${s.stopName}`} className="rounded-full bg-raised px-3 py-1 text-xs font-bold text-ink-soft">
                  <b className="text-ink">{t('common:route.number', { number: s.routeNumber })}</b> {s.stopName} — {s.confirmed + s.searched}
                </li>
              ))}
            </ul>
          )}
          {d.topDestinations.length > 0 && <p className="mt-2 text-xs font-semibold text-ink-faint">{t('demand.topDestinations', { list: d.topDestinations.map((x) => x.name).join(', ') })}</p>}
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-faint">{t('common:status.loading')}</p>
      )}
    </section>
  )
}
