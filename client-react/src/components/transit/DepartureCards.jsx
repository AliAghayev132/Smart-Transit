/**
 * Six-O gəliş kartları: növbəti avtobuslar iri dəqiqə rəqəmləri ilə.
 * Seçilmiş kart xətt rəngindədir və altındakı xətt zolağı ilə birləşir.
 */
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { routeShade } from '@utils'
import { CrowdDots } from './CrowdBadge'
import { LiveArc } from './sixo'

export const DepartureCards = ({ items = [], color, selectedId, joined = false, live = true, className }) => {
  const { t } = useTranslation()
  if (!items.length) return null
  const selId = selectedId && items.some((a) => a.busId === selectedId) ? selectedId : items[0].busId

  return (
    <ul className={clsx('no-scrollbar relative z-10 -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-1', joined ? 'pb-0' : 'pb-2', className)}>
      {items.map((a) => {
        const sel = a.busId === selId
        const now = a.etaSec <= 30
        const min = Math.max(1, Math.round(a.etaSec / 60))
        const level = a.crowd?.level || 'unknown'
        const label = `${now ? t('time.now') : t('time.minutes', { count: min })}, ${t(`crowd.${level}.long`)}`
        return (
          <li key={a.busId} className="snap-start">
            <div
              aria-label={label}
              className={clsx(
                'flex w-[108px] shrink-0 flex-col items-center px-2 pt-3.5',
                sel ? 'text-white' : 'bg-surface text-ink shadow-card',
                sel && joined ? 'rounded-t-card pb-7' : 'rounded-card pb-3.5'
              )}
              style={sel ? { background: routeShade(color) } : undefined}
            >
              {now ? (
                <span className="flex h-[3.25rem] items-center text-title">{t('time.now')}</span>
              ) : (
                <span className="relative text-giant tabular-nums">
                  {min}
                  {live && <LiveArc className={clsx('absolute -right-4 top-1 text-[22px]', sel ? 'text-white' : 'text-go')} />}
                </span>
              )}
              <span className={clsx('mt-1 text-sm font-bold', sel ? 'text-white/85' : 'text-ink-soft')}>
                {now ? t('time.arriving') : t('time.minUnit', { count: min })}
              </span>
              <span className={clsx('mt-2.5 rounded-full px-2 py-1', sel ? 'bg-white/15' : 'bg-raised')}>
                <CrowdDots level={level} tone={sel ? '#fff' : undefined} />
              </span>
              {a.isReserve && <span className={clsx('mt-1.5 text-[11px] font-black', sel ? 'text-white' : 'text-reserve')}>{t('map.bus.reserve')}</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
