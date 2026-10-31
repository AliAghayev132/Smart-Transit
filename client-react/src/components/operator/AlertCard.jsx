import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { BusFront, Check, CheckCheck, PenLine, Users } from 'lucide-react'
import { Badge, Button } from '@components/ui'
import { CrowdDots, RouteNum } from '@components/transit'
import { alertStatusOptions, alertTypeOptions } from '@constants'
import { fmtAgo, fmtTime } from '@utils'
import { useAlertText } from './alertText'

const STRIPE = {
  open: 'var(--color-danger)',
  acknowledged: 'var(--color-warn)',
  dispatched: 'var(--color-brand)',
  resolved: 'var(--color-line)',
}

/**
 * Xəbərdarlıq kartı. compact: yalnız əsas məlumat (siyahılar üçün).
 * Hərəkətlər: Qəbul et · Ehtiyat ayır (tövsiyə ilə) · Əmr yaz · Həll olundu
 */
export const AlertCard = ({ alert: a, selected, onSelect, onAct, onCompose, busy, compact = false }) => {
  const { t } = useTranslation('operator')
  const text = useAlertText()
  const st = alertStatusOptions[a.status] || alertStatusOptions.open
  const tp = alertTypeOptions[a.type] || alertTypeOptions.RESERVE_BUS_NEEDED
  const forecast = a.type === 'DEMAND_FORECAST'
  const rec = a.recommendation
  const active = a.status !== 'resolved'

  return (
    <div
      onClick={() => onSelect?.(a)}
      className={clsx(
        'cursor-pointer rounded-2xl border-l-[5px] bg-surface p-3.5 shadow-card transition-shadow',
        selected ? 'ring-2 ring-brand' : 'hover:shadow-float'
      )}
      style={{ borderLeftColor: forecast && a.status === 'open' ? 'var(--color-brand)' : STRIPE[a.status] }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {a.route && <RouteNum number={a.route.number} color={a.route.color} size="sm" />}
        <Badge variant={st.badge} size="sm">
          {t(`alert.status.${a.status}`)}
        </Badge>
        <Badge variant={tp.badge === 'danger' ? 'default' : 'info'} size="sm">
          {t(`alert.typeShort.${a.type}`)}
        </Badge>
        <span className="ml-auto text-xs font-semibold text-ink-faint" title={fmtTime(a.createdAt)}>
          {fmtAgo(a.createdAt)}
        </span>
      </div>

      <p className={clsx('mt-2 font-extrabold leading-snug hyphens-none', active ? 'text-danger' : 'text-ink-soft')}>{text.title(a)}</p>
      {a.route?.name && <p className="text-sm text-ink-soft">{a.route.name}</p>}

      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-soft">
        {forecast ? <Users className="mt-px h-3.5 w-3.5 shrink-0" /> : <CrowdDots level="high" size="sm" className="mt-1 shrink-0" />}
        <span className="min-w-0">{text.stats(a)}</span>
      </p>

      {!compact && rec && active && (
        <div className="mt-2.5 rounded-xl bg-brand-soft px-3 py-2 text-xs text-ink">
          <p className="font-extrabold text-brand">{rec.recommendedBuses ? t('alert.reco', { count: rec.recommendedBuses }) : t('alert.recoNone')}</p>
          <p className="mt-0.5 text-ink-soft">
            {t('alert.recoDetail', { hwFrom: rec.headwayNowMin ?? '—', hwTo: rec.headwayAfterMin ?? '—', loadFrom: rec.loadNowPct, loadTo: rec.loadAfterPct })}
          </p>
        </div>
      )}

      {!compact && active && onAct && (
        <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {a.status === 'open' && (
            <Button size="sm" variant="secondary" leftIcon={<Check className="h-3.5 w-3.5" />} onClick={() => onAct(a, 'acknowledge')} disabled={busy}>
              {t('alert.actions.acknowledge')}
            </Button>
          )}
          {!a.reserveBuses?.length && (
            <Button size="sm" leftIcon={<BusFront className="h-3.5 w-3.5" />} onClick={() => onAct(a, 'dispatch')} disabled={busy}>
              {rec?.recommendedBuses ? t('alert.actions.dispatchN', { count: rec.recommendedBuses }) : t('alert.actions.dispatch')}
            </Button>
          )}
          {onCompose && (
            <Button size="sm" variant="outline" leftIcon={<PenLine className="h-3.5 w-3.5" />} onClick={() => onCompose(a)}>
              {t('alert.actions.command')}
            </Button>
          )}
          <Button size="sm" variant="ghost" leftIcon={<CheckCheck className="h-3.5 w-3.5" />} onClick={() => onAct(a, 'resolve')} disabled={busy}>
            {t('alert.actions.resolve')}
          </Button>
        </div>
      )}
    </div>
  )
}
