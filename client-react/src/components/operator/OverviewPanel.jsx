import { useTranslation } from 'react-i18next'
import { BusFront, CircleCheck, MapPin } from 'lucide-react'
import { CrowdBadge, RouteNum } from '@components/transit'
import { AlertCard } from './AlertCard'
import { DemoTools } from './DemoTools'
import { PredictionCard } from './PredictionCard'

const SectionTitle = ({ children, count }) => (
  <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
    {children}
    {count != null && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-raised px-1.5 text-[11px] font-black text-ink-soft">{count}</span>}
  </h3>
)

/** Xətt seçilməyəndə sağ panel: aktiv xəbərdarlıqlar, xətlər, canlı (B) və tələb (A) xülasəsi */
export const OverviewPanel = ({ routes, crowd, density, demand, alerts = [], selectedAlertId, onSelectRoute, onSelectAlert, onAct, onCompose, busy, demo }) => {
  const { t } = useTranslation('operator')
  const active = alerts.filter((a) => a.status !== 'resolved')
  return (
    <div className="space-y-5">
      <section>
        <SectionTitle count={active.length}>{t('overview.activeAlerts')}</SectionTitle>
        {!active.length && (
          <p className="flex items-center gap-2 rounded-2xl bg-go-soft p-3 text-sm font-semibold text-go">
            <CircleCheck className="h-4 w-4 shrink-0" /> {t('overview.allClear')}
          </p>
        )}
        <div className="space-y-2">
          {active.map((a) => (
            <AlertCard key={a._id} alert={a} selected={a._id === selectedAlertId} onSelect={onSelectAlert} onAct={onAct} onCompose={onCompose} busy={busy} />
          ))}
        </div>
      </section>

      <PredictionCard routes={routes} onSelectRoute={onSelectRoute} />

      <section>
        <SectionTitle>{t('overview.routes')}</SectionTitle>
        <div className="space-y-1">
          {(crowd?.routes || []).map((r) => {
            const route = routes.find((x) => x.id === r.routeId)
            return (
              <button
                key={r.routeId}
                onClick={() => route && onSelectRoute(route)}
                className="flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-raised"
              >
                <RouteNum number={r.number} color={r.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                  {r.total > 0 && <span className="block text-xs text-ink-faint">{t(`common:trend.${r.trend}`)}</span>}
                </span>
                <CrowdBadge level={r.level} size="sm" pct={r.loadPct} />
              </button>
            )
          })}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="rounded-2xl bg-[color-mix(in_srgb,#7c3aed_10%,var(--color-surface))] p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="text-sm font-extrabold text-[#6d28d9] dark:text-[#c4b5fd]">{t('overview.live')}</p>
            <p className="text-xs font-semibold text-ink-soft">{t('overview.liveUsers', { count: density?.total ?? 0 })}</p>
          </div>
          {!density?.stops?.length && !density?.buses?.length && <p className="mt-1 text-sm text-ink-soft">{t('overview.noLive')}</p>}
          <ul className="mt-1.5 space-y-1 text-sm text-ink">
            {density?.stops?.slice(0, 3).map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <b className="shrink-0">{t('overview.waiting', { count: s.waiting })}</b>
              </li>
            ))}
            {density?.buses?.slice(0, 3).map((b) => (
              <li key={b.busId} className="flex items-center gap-2">
                <BusFront className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1 truncate">
                  №{b.routeNumber} <span className="text-ink-faint">{b.plate}</span>
                </span>
                <b className="shrink-0">{t('overview.riders', { count: b.riders })}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-brand-soft p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="text-sm font-extrabold text-brand">{t('overview.demand')}</p>
            <p className="text-xs font-semibold text-ink-soft">{t('overview.horizon', { count: demand?.horizonMin || 30 })}</p>
          </div>
          {!demand?.stops?.length && <p className="mt-1 text-sm text-ink-soft">{t('overview.noDemand')}</p>}
          <ul className="mt-1.5 space-y-1 text-sm text-ink">
            {demand?.stops?.slice(0, 5).map((s) => (
              <li key={`${s.routeId}${s.stopId}`} className="flex items-center gap-2">
                <span className="shrink-0 font-black">№{s.routeNumber}</span>
                <span className="min-w-0 flex-1 truncate">{s.stopName}</span>
                <span className="shrink-0 text-right">
                  <b>{t('overview.intents', { count: s.confirmed })}</b> <span className="text-xs text-ink-faint">{t('overview.searches', { count: s.searched })}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {demo && <DemoTools routes={routes} />}
    </div>
  )
}
