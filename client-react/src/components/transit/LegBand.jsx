/**
 * Avtobus hissəsinin xətt rəngində zolağı (Six-O): çiplər, iri xətt nömrəsi, istiqamət,
 * minmə → düşmə dayanacaqları zaman xətti.
 */
import { useState } from 'react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { BusFront, ChevronDown, CircleArrowRight } from 'lucide-react'
import { fmtTime, routeShade } from '@utils'
import { CrowdDots } from './CrowdBadge'
import { LiveArc } from './sixo'

const Chip = ({ children }) => <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-extrabold">{children}</span>

export const LegBand = ({ leg, route, baseTime, joined = false }) => {
  const { t } = useTranslation('passenger')
  const [open, setOpen] = useState(false)
  const boardAt = baseTime + leg.departInSec * 1000
  const alightAt = boardAt + leg.rideSec * 1000
  const level = leg.crowd?.level || 'unknown'

  const stops = route?.stops || []
  const a = stops.findIndex((s) => s.id === leg.from?.stopId)
  const b = stops.findIndex((s) => s.id === leg.to?.stopId)
  const between = a >= 0 && b >= 0 ? (a < b ? stops.slice(a + 1, b) : stops.slice(b + 1, a).reverse()) : []
  const moreCount = between.length || Math.max(0, (leg.stopsCount || 1) - 1)

  return (
    <section className={clsx('rounded-card px-5 pb-5 pt-5 text-white', joined && 'rounded-tl-none')} style={{ background: routeShade(leg.color) }}>
      <div className="flex flex-wrap gap-2">
        <Chip>
          <CrowdDots level={level} tone="#fff" />
          {t(`common:crowd.${level}.long`)}
          {leg.crowd?.loadPct != null && level !== 'unknown' && <span className="opacity-80">{leg.crowd.loadPct}%</span>}
        </Chip>
        {leg.live && (
          <Chip>
            <LiveArc className="text-[13px]" /> {t('trip.liveGps')}
          </Chip>
        )}
        {leg.isReserve && <Chip>{t('common:map.bus.reserve')}</Chip>}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <BusFront className="h-8 w-8 shrink-0 opacity-75" aria-hidden />
        <span className="text-hero">{leg.number}</span>
      </div>
      <p className="mt-2 flex items-start gap-2 text-xl font-extrabold">
        <CircleArrowRight className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
        <span className="min-w-0">{leg.headsign}</span>
      </p>

      <ol className="relative mt-5 space-y-1">
        <span className="absolute bottom-3 left-[8px] top-3 w-[3px] rounded bg-white/35" aria-hidden />
        <li className="relative flex items-start gap-3">
          <span className="mt-1 h-[19px] w-[19px] shrink-0 rounded-full border-[3.5px] border-white" style={{ background: routeShade(leg.color) }} />
          <p className="min-w-0 flex-1 text-lg font-extrabold leading-snug">{leg.from?.name}</p>
          <time className="shrink-0 text-lg font-extrabold tabular-nums">{fmtTime(boardAt)}</time>
        </li>
        {moreCount > 0 && (
          <li className="relative pl-[31px]">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              disabled={!between.length}
              className="inline-flex items-center gap-1 py-1.5 text-sm font-bold text-white/85 hover:text-white disabled:cursor-default"
            >
              <ChevronDown className={clsx('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
              {t('trip.moreStops', { count: moreCount })}
            </button>
            {open && (
              <ul className="space-y-1 pb-1">
                {between.map((s) => (
                  <li key={s.id} className="relative text-sm font-semibold text-white/85">
                    <span className="absolute -left-[26px] top-[7px] h-2 w-2 rounded-full bg-white/70" aria-hidden />
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
        <li className="relative flex items-start gap-3">
          <span className="mt-1 h-[19px] w-[19px] shrink-0 rounded-full border-[3.5px] border-white" style={{ background: routeShade(leg.color) }} />
          <p className="min-w-0 flex-1 text-lg font-extrabold leading-snug">{leg.to?.name}</p>
          <time className="shrink-0 text-lg font-extrabold tabular-nums">{fmtTime(alightAt)}</time>
        </li>
      </ol>
    </section>
  )
}
