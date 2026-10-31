import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Car, CloudRain, CloudSun, RefreshCw, Sparkles, TriangleAlert, Warehouse } from 'lucide-react'
import { Badge } from '@components/ui'
import { CrowdBadge, RouteNum } from '@components/transit'
import { useGetPredictionQuery } from '@store/api'
import { fmtTime } from '@utils'

const WET = new Set(['rain', 'drizzle', 'snow', 'storm'])
const TRAFFIC_TONE = { light: 'text-go', moderate: 'text-warn', heavy: 'text-danger' }

const Chip = ({ icon: Icon, children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-soft ${className}`}>
    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    {children}
  </span>
)

const RouteRef = ({ r, routes, onSelectRoute }) => {
  const route = routes.find((x) => x.id === r.routeId)
  return (
    <button type="button" onClick={() => route && onSelectRoute?.(route)} className="shrink-0 rounded-lg focus-visible:outline-2" aria-label={`№${r.number}`}>
      <RouteNum number={r.number} color={r.color} size="sm" />
    </button>
  )
}

/** Gemini AI proqnozu: növbəti 1–2 saatda sıxlıq sıçrayışları və avtobusların yerdəyişməsi */
export const PredictionCard = ({ routes = [], onSelectRoute }) => {
  const { t } = useTranslation('operator')
  const [nonce, setNonce] = useState(0)
  const { data, isFetching, error } = useGetPredictionQuery(nonce, { pollingInterval: 300000 })

  const w = data?.weather
  const tr = data?.traffic
  const peaks = data?.peakHours?.hours?.map((h) => `${String(h.hour).padStart(2, '0')}:00`).join(', ')

  return (
    <section className="rounded-2xl bg-[color-mix(in_srgb,#7c3aed_10%,var(--color-surface))] p-3.5" aria-busy={isFetching}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-extrabold text-[#6d28d9] dark:text-[#c4b5fd]">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" /> {t('predict.title')}
          </span>
          <span className="block text-xs text-ink-faint">{t('predict.horizon')}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {data && (
            <Badge size="sm" variant={data.source === 'gemini' ? 'purple' : 'default'}>
              {data.source === 'gemini' ? t('predict.gemini') : t('predict.rules')}
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            disabled={isFetching}
            className="grid h-7 w-7 place-items-center rounded-full text-[#6d28d9] hover:bg-[color-mix(in_srgb,#7c3aed_15%,transparent)] disabled:opacity-60 dark:text-[#c4b5fd]"
            title={t('predict.refresh')}
            aria-label={t('predict.refresh')}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </span>
      </div>

      {error && !data && <p className="text-sm text-ink">{t('predict.failed')}</p>}
      {!data && !error && <p className="text-sm text-ink-soft">{t('predict.preparing')}</p>}

      {data && (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Chip icon={w && WET.has(w.condition) ? CloudRain : CloudSun}>
              {w ? `${t(`predict.weather.${w.condition}`, { defaultValue: t('predict.weather.unknown') })}${w.tempC != null ? `, ${Math.round(w.tempC)}°C` : ''}` : t('predict.weather.none')}
            </Chip>
            {tr && (
              <Chip icon={Car}>
                {t('predict.traffic.label')}: <b className={TRAFFIC_TONE[tr.level]}>{t(`predict.traffic.${tr.level}`)}</b>
                {tr.source === 'gps' && tr.avgSpeedKmh != null && <span className="text-ink-faint">· {t('predict.traffic.gps', { speed: tr.avgSpeedKmh })}</span>}
              </Chip>
            )}
          </div>

          {data.fallback && <p className="mb-1.5 text-xs font-semibold text-warn">{t('predict.fallback')}</p>}
          <p className="text-sm leading-relaxed text-ink">{data.summary}</p>

          <h4 className="mt-3 mb-1 text-xs font-extrabold uppercase tracking-wide text-ink-soft">{t('predict.spikes')}</h4>
          {!data.spikes.length && <p className="text-sm text-ink-soft">{t('predict.noSpikes')}</p>}
          <ul className="space-y-1.5">
            {data.spikes.map((s) => (
              <li key={s.routeId} className="rounded-xl bg-surface p-2">
                <div className="flex items-center gap-2">
                  <RouteRef r={s} routes={routes} onSelectRoute={onSelectRoute} />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                    <span className="whitespace-nowrap">{s.inMin > 0 ? t('predict.inMin', { count: s.inMin }) : t('predict.now')}</span>
                    {s.confidence != null && <span className="ml-1 whitespace-nowrap text-xs font-normal text-ink-faint">· {t('predict.confidence', { pct: Math.round(s.confidence * 100) })}</span>}
                  </span>
                  <CrowdBadge level={s.level} size="sm" pct={s.loadPct} />
                </div>
                {s.reason && <p className="mt-1 text-xs leading-snug text-ink-soft">{s.reason}</p>}
              </li>
            ))}
          </ul>

          <h4 className="mt-3 mb-1 text-xs font-extrabold uppercase tracking-wide text-ink-soft">{t('predict.realloc')}</h4>
          {!data.reallocations.length && <p className="text-sm text-ink-soft">{t('predict.noRealloc')}</p>}
          <ul className="space-y-1.5">
            {data.reallocations.map((x, i) => (
              <li key={`${x.from?.routeId || 'depot'}-${x.to.routeId}-${i}`} className="rounded-xl bg-surface p-2">
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  {x.from ? (
                    <RouteRef r={x.from} routes={routes} onSelectRoute={onSelectRoute} />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-soft">
                      <Warehouse className="h-3.5 w-3.5" aria-hidden="true" /> {t('predict.depot')}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
                  <RouteRef r={x.to} routes={routes} onSelectRoute={onSelectRoute} />
                  <b className="text-ink">{t('predict.buses', { count: x.buses })}</b>
                  <span className="text-xs text-ink-faint">· {x.inMin > 0 ? t('predict.inMin', { count: x.inMin }) : t('predict.now')}</span>
                </div>
                {x.reason && <p className="mt-1 text-xs leading-snug text-ink-soft">{x.reason}</p>}
              </li>
            ))}
          </ul>

          {data.risks?.length > 0 && (
            <>
              <h4 className="mt-3 mb-1 text-xs font-extrabold uppercase tracking-wide text-ink-soft">{t('predict.risks')}</h4>
              <ul className="space-y-1">
                {data.risks.map((r) => (
                  <li key={r} className="flex gap-1.5 text-xs text-ink-soft">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" /> {r}
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-3 flex flex-wrap justify-between gap-x-2 text-[11px] text-ink-faint">
            {peaks && <span>{t(data.peakHours.source === 'history' ? 'predict.peaks' : 'predict.peaksPrior', { hours: peaks })}</span>}
            <span>{t('predict.updated', { time: fmtTime(data.generatedAt) })}</span>
          </p>
        </>
      )}
    </section>
  )
}
