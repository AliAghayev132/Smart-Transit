import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { PenLine, X } from 'lucide-react'
import { Button } from '@components/ui'
import { CrowdBadge, RouteNum } from '@components/transit'
import { baseApi, useGetRecentReportsQuery } from '@store/api'
import { useSocketEvent } from '@store/hooks'
import { crowdLevels } from '@constants'
import { fmtAgo } from '@utils'
import { AISummaryCard } from './AISummaryCard'
import { RecommendationPanel } from './RecommendationPanel'
import { ForecastMini } from './ForecastMini'
import { AlertCard } from './AlertCard'

const Stat = ({ label, value, hint }) => (
  <div className="min-w-0 rounded-2xl bg-raised px-2 py-2 text-center" title={hint}>
    <p className="truncate text-lg font-black leading-none tracking-tight text-ink">{value ?? '—'}</p>
    <p className="mt-1 truncate text-[11px] font-semibold text-ink-soft">{label}</p>
  </div>
)

const SectionTitle = ({ children }) => <h3 className="mb-1.5 text-sm font-extrabold text-ink">{children}</h3>

/**
 * Sağ kontekst paneli — seçilmiş xətt:
 * statistika, seqment sıxlığı, AI xülasəsi, aktiv xəbərdarlıqlar, dispetçer tövsiyəsi,
 * proqnoz və real-vaxt crowdsourcing bildirişləri.
 */
export const RouteContextPanel = ({ route, crowd, buses, density, alerts = [], selectedAlertId, onClose, onAct, onCompose, onSelectAlert, busy }) => {
  const { t } = useTranslation('operator')
  const rc = crowd?.routes.find((r) => r.routeId === route.id)
  const routeBuses = buses.filter((b) => b.routeId === route.id)
  const hasReserve = routeBuses.some((b) => b.isReserve)
  const riders = (density?.buses || []).filter((b) => b.routeId === route.id).reduce((s, b) => s + b.riders, 0)
  const routeAlerts = alerts.filter((a) => a.route?._id === route.id && a.status !== 'resolved')
  const alertForRec = routeAlerts.find((a) => a._id === selectedAlertId) || routeAlerts[0]

  const dispatch = useDispatch()
  const { data: reports = [] } = useGetRecentReportsQuery({ routeId: route.id, limit: 15 })
  const onReport = useCallback(
    (r) => {
      if (r.routeId === route.id) dispatch(baseApi.util.invalidateTags(['Report']))
    },
    [route.id, dispatch]
  )
  useSocketEvent('report:new', onReport)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5">
        <RouteNum number={route.number} color={route.color} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-snug text-ink">{route.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold text-ink-soft">
            <span className="rounded-full bg-raised px-2 py-0.5">{t('context.stops', { count: route.stops.length })}</span>
            <span className="rounded-full bg-raised px-2 py-0.5">{t('common:dist.km', { n: route.lengthKm })}</span>
          </div>
        </div>
        <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-ink-soft hover:text-ink" title={t('context.close')} aria-label={t('context.close')}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CrowdBadge level={rc?.level} long pct={rc?.loadPct} />
        {rc?.total > 0 && <span className="text-xs font-semibold text-ink-soft">{t(`common:trend.${rc.trend}`)}</span>}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <Stat label={t('context.buses')} value={`${routeBuses.length}${hasReserve ? '*' : ''}`} hint={hasReserve ? `* ${t('context.withReserve')}` : undefined} />
        <Stat label={t('context.reports')} value={rc?.total ?? 0} />
        <Stat label={t('context.load')} value={rc?.loadPct != null ? `${rc.loadPct}%` : '—'} />
        <Stat label={t('context.live')} value={riders} />
      </div>

      {/* Seqment sıxlığı */}
      {rc && (
        <div>
          <div className="flex gap-0.5">
            {rc.segments.map((s) => (
              <span
                key={s.index}
                className={clsx('h-2.5 flex-1 rounded-full', s.level === 'unknown' && 'opacity-30')}
                style={{ background: (crowdLevels[s.level] || crowdLevels.unknown).color }}
                title={`${s.from} → ${s.to}: ${t(`common:crowd.${s.level}.long`)} (${t('common:map.stopReports', { count: s.total })})`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between gap-3 text-[11px] font-semibold text-ink-faint">
            <span className="min-w-0 truncate">{route.stops[0].name}</span>
            <span className="min-w-0 truncate text-right">{route.stops[route.stops.length - 1].name}</span>
          </div>
        </div>
      )}

      <AISummaryCard routeId={route.id} />

      {routeAlerts.map((a) => (
        <AlertCard key={a._id} alert={a} selected={a._id === selectedAlertId} onSelect={onSelectAlert} onAct={onAct} onCompose={onCompose} busy={busy} />
      ))}

      <RecommendationPanel key={`${route.id}:${alertForRec?._id || ''}`} routeId={route.id} alertId={alertForRec?._id} />

      <Button size="sm" variant="outline" fullWidth leftIcon={<PenLine className="h-3.5 w-3.5" />} onClick={() => onCompose({ route })}>
        {t('context.writeCommand')} (C)
      </Button>

      <ForecastMini routeId={route.id} />

      <div>
        <SectionTitle>{t('context.recent')}</SectionTitle>
        {!reports.length && <p className="text-sm text-ink-faint">{t('context.noReports')}</p>}
        <ul className="divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <CrowdBadge level={r.level} size="sm" />
              <span className="flex flex-wrap items-center justify-end gap-x-2 text-xs text-ink-soft">
                <span className={clsx('font-semibold', r.verified && 'text-ok')}>
                  {r.verified ? t('context.gpsOk') : r.source === 'gps' ? t('context.gpsFar') : t('context.unverified')}
                </span>
                <span className="text-ink-faint">{fmtAgo(r.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
